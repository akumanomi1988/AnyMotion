/** SQLite-backed, process-recoverable job ledger with transactional claims and leases. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

/** Retry transient infrastructure/provider failures, never schema, media integrity or rights errors. */
export function isRetryableJobError(error:unknown):boolean{
  const code=(error && typeof error==='object' && 'code' in error)?String((error as {code?:unknown}).code):'';
  if(['ETIMEDOUT','ECONNRESET','ECONNREFUSED','EAI_AGAIN','ENETUNREACH','EPIPE'].includes(code))return true;
  const message=error instanceof Error?error.message:String(error);
  return /\bHTTP (?:408|425|429|500|502|503|504)\b|(?:request|provider|render(?:er)?|ffmpeg) timed out|\btemporary (?:failure|outage)\b/i.test(message);
}

export type JobStage = 'STORY' | 'TIMING' | 'RENDER' | 'LOCALIZE' | 'DUB' | 'MUX' | 'QA' | 'PACKAGE';
export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'RETRYABLE_FAILED' | 'BLOCKED';
export interface JobRecord {
  job_key: string; episode_id: string; stage: JobStage; locale: string; input_hash: string;
  status: JobStatus; attempts: number; lease_owner: string | null; lease_until: number | null;
  output_hash: string | null; error: string | null; updated_at: number;
}
export interface JobSpec { episodeId:string; stage:JobStage; locale?:string; inputHash:string }

export function jobKey(spec: JobSpec): string {
  if (!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(spec.episodeId)) throw new Error('Invalid episode ID');
  if (!/^[a-f0-9]{64}$/.test(spec.inputHash)) throw new Error('Input hash must be SHA-256');
  if (spec.locale !== undefined && !/^[a-z]{2,3}-[A-Z]{2}$/.test(spec.locale)) throw new Error('Invalid BCP-47 locale');
  return createHash('sha256').update(JSON.stringify([spec.episodeId,spec.stage,spec.locale ?? '',spec.inputHash])).digest('hex');
}

export class ProductionJobStore {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), {recursive:true});
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS production_jobs (
        job_key TEXT PRIMARY KEY,
        episode_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        locale TEXT NOT NULL DEFAULT '',
        input_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','RETRYABLE_FAILED','BLOCKED')),
        attempts INTEGER NOT NULL DEFAULT 0,
        lease_owner TEXT,
        lease_until INTEGER,
        output_hash TEXT,
        error TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS jobs_episode ON production_jobs(episode_id,updated_at);`);
  }
  close(): void { this.db.close(); }
  private getByKey(key: string): JobRecord | null {
    return (this.db.prepare('SELECT * FROM production_jobs WHERE job_key=?').get(key) as unknown as JobRecord | undefined) ?? null;
  }
  get(spec: JobSpec): JobRecord | null { return this.getByKey(jobKey(spec)); }
  list(episodeId: string): JobRecord[] {
    return this.db.prepare('SELECT * FROM production_jobs WHERE episode_id=? ORDER BY updated_at, stage, locale').all(episodeId) as unknown as JobRecord[];
  }
  ensure(spec: JobSpec, now=Date.now()): JobRecord {
    const key=jobKey(spec);
    this.db.prepare(`INSERT OR IGNORE INTO production_jobs(job_key,episode_id,stage,locale,input_hash,status,updated_at) VALUES(?,?,?,?,?,'PENDING',?)`).run(key,spec.episodeId,spec.stage,spec.locale??'',spec.inputHash,now);
    return this.getByKey(key)!;
  }
  /** Claim is atomic across separate Node processes. Stale leases may be reclaimed. */
  claim(spec: JobSpec, leaseMs = 120_000, now=Date.now(), maxAttempts=3): {owner:string;record:JobRecord} | null {
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1000) throw new RangeError('Invalid lease duration');
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) throw new RangeError('Invalid retry limit');
    const key = jobKey(spec);
    const owner = randomUUID();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`INSERT OR IGNORE INTO production_jobs(job_key,episode_id,stage,locale,input_hash,status,updated_at) VALUES(?,?,?,?,?,'PENDING',?)`).run(key,spec.episodeId,spec.stage,spec.locale??'',spec.inputHash,now);
      const result = this.db.prepare(`UPDATE production_jobs SET status='RUNNING', attempts=attempts+1, lease_owner=?, lease_until=?, updated_at=?, error=NULL
        WHERE job_key=? AND attempts<? AND (status IN ('PENDING','RETRYABLE_FAILED') OR (status='RUNNING' AND lease_until<?))`).run(owner,now+leaseMs,now,key,maxAttempts,now);
      const record=this.getByKey(key)!;
      this.db.exec('COMMIT');
      return result.changes ? {owner,record} : null;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  heartbeat(spec:JobSpec, owner:string, leaseMs:number, now=Date.now()):boolean {
    const res=this.db.prepare("UPDATE production_jobs SET lease_until=?,updated_at=? WHERE job_key=? AND status='RUNNING' AND lease_owner=? AND lease_until>=?").run(now+leaseMs,now,jobKey(spec),owner,now);
    return res.changes===1;
  }
  succeed(spec:JobSpec, owner:string, outputHash:string, now=Date.now()):void {
    if(!/^[a-f0-9]{64}$/.test(outputHash)) throw new Error('Invalid output hash');
    const res=this.db.prepare("UPDATE production_jobs SET status='SUCCEEDED', output_hash=?, lease_owner=NULL,lease_until=NULL,updated_at=? WHERE job_key=? AND status='RUNNING' AND lease_owner=? AND lease_until>=?").run(outputHash,now,jobKey(spec),owner,now);
    if(res.changes!==1) throw new Error('Cannot complete a job without current lease ownership');
  }
  fail(spec:JobSpec, owner:string, error:string, retryable:boolean, now=Date.now()):void {
    const state=retryable?'RETRYABLE_FAILED':'BLOCKED';
    const res=this.db.prepare("UPDATE production_jobs SET status=?,error=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE job_key=? AND status='RUNNING' AND lease_owner=? AND lease_until>=?").run(state,error.slice(0,1000),now,jobKey(spec),owner,now);
    if(res.changes!==1) throw new Error('Cannot fail a job without current lease ownership');
  }
}
