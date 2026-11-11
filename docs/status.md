# AnyMotion · Verified implementation status

Date: 2026-11-11. The normative source requirements are `docs/master-blueprint.md` (copied from the project master DOCX). This is an **implementation** ledger, not permission to change the product vision.

| Phase | Estado actual | Evidencia | Condición pendiente |
| --- | --- | --- | --- |
| F0: identidad / elección de motor | PARTIAL | Render SVG/FFmpeg real y dirección artística provisional | Benchmark comparativo Remotion/Motion Canvas, identidad y licencias aprobadas |
| F1: escena reproducible | TECHNICAL PASS | Clip 78 s, personajes, planos, SRT, MP4 H.264 verificado | Calidad artística comercial y benchmark largo en Windows con TTS final |
| F2: guion largo autónomo | PARTIAL | Adaptador LLM, generador por etapas, episodio **escrito manualmente** de 9 minutos, 10 escenas y 90 diálogos | Validar proveedor LLM real y calidad narrativa original en revisión humana |
| F3: voz, música y localización | DIAGNOSTIC PASS | Dos MP4 bilingües 540 s, stems separados, voz de referencia medida, sin rerender | TTS expresivo, escucha real, adaptación cultural aprobada |
| F4: operación recuperable | TECHNICAL PROTOTYPE | SQLite, leases, backoff semántico, hashes, reintentos, backup/restauración y replay | SQLite estable, Windows y tres producciones autónomas distintas |
| F5: YouTube | MOCK PASS | OAuth, subida privada, miniatura, programación, kit Studio y bloqueo editorial con mocks | Canal/OAuth real, pistas multilingües, subida privada autorizada |
| F6: piloto y negocio | ANALYTICS READY, PILOT NOT STARTED | Informe local de métricas con distinción observado/simulado | Seis episodios originales aprobados, audiencia e ingresos reales |

**Última evidencia técnica (11/11/2026):** 64/64 pruebas locales; CI GitHub del commit anterior correcta; la nueva integración de audio de nueve minutos pasa y verifica 206 artefactos, dos MP4 H.264/AAC exactamente 540.000 s y reejecución idempotente. El doblaje de esa prueba utiliza **tonos sintéticos**, no voces habladas. La CI multimedia nativa puede omitirse si el runner carece de FFmpeg/librsvg; una CI verde no implica que ese paso se haya ejecutado.

### Registro histórico de pruebas

Local integration evidence: `npm test` passed 39 tests; two same-input pipeline executions passed with 78s H.264/AAC for both locales; 50 release artifacts and no automatic publication. A synthetic **9-minute** technical load fixture passed end-to-end for both languages with eSpeak diagnostic voice: 108 lines per locale, two 540.000 s H.264/AAC videos and no truncated clips. The 9-minute image render passed FFprobe: 6,480 preview frames, 540.000 s, H.264 640×360/12 fps, 16.8 seconds measured render in the current Linux test environment. This fixture is repetitive by design and explicitly NOT publishable. CI multimedia uses an explicit synthetic tone adapter and is **not** real-speech QA. The previous CI media job failed on the host package-install timeout (apt-get). The runner has no FFmpeg, and apt-get timed out. CI now reports an explicit warning and skips native media assertions when prerequisites are absent; do NOT report native CI multimedia as passed. Local full audio-video tests were separately verified on a tool-equipped Linux machine.

## Known limitations and risks

- eSpeak is **diagnostic only** and intentionally not approved for production voices.
- `node:sqlite` in Node 22 is experimental; evaluate stable alternative before unattended workloads.
- The current drafts still contain predicted dialogue intervals; TTS is checked before freezing, but a full semantic timeline planner is not implemented.
- The SVG renderer proves deterministic video creation, not polished original comedy animation.
- No paid API calls, YouTube publishing, licensing approvals or release permissions have been performed.

## Incremental work: reliability and publishing safeguards

Additional verified local capabilities:

- Master re-use now checks source digest, artifact hashes and technical report. Stale generated artifacts trigger a block rather than silent continuation.
- Job execution sends lease heartbeats while stages run, reducing the chance of duplicate claims for slow renders.
- Configurable HTTPS or local OpenAI-compatible TTS endpoint, immutable voice/profile fingerprint and WAV checks. A real production-quality model has NOT been tested; eSpeak/synthetic are explicitly prohibited from editorial release.
- Immutable editorial approval records bind a human note and commercial-rights confirmation to a verified, full-resolution release digest.
- YouTube private-only resumable upload implementation, OAuth access/refresh support, remote private-status verification and replayable upload session; tested with mocked responses only. Publishing is blocked for unapproved episodes. Public scheduling and multi-audio Studio steps remain unimplemented; thumbnail upload is implemented but verified only using mock HTTP responses.
- Added unit tests for OAuth, TTS provider, master integrity, editorial approval and private-upload behavior; observed `npm test` result: **37 tests PASS** on Linux. A new clean 78-second bilingual preview has completed twice (first build and idempotent replay) with technical pass. Follow-up CI result remains pending until the new branch commit runs.

Critical remaining work: Remotion versus Motion Canvas choice and licensing, actual authored character direction, genuinely original 8–10 minute narrative verified by a human, real natural-language TTS evaluation, automated rights-provenance ledger, localization review, disk backup/restore drills, production-ready SQLite dependency, YouTube OAuth/channel access and real API integration, branding and commercial six-episode pilot. **Current status is PARTIAL, not complete.**

## Security and operational hardening (iter 5)

- `packageEpisode` hashes manifest, technical QA, source timeline, per-locale voice metadata, each stem/SRT/WAV and mux report. `verifiedRelease` requires complete entries before editorial approval. Modifying voice metadata after packaging blocks approval.
- Voices are fail-closed: eSpeak diagnostic and CI synthetic never pass. `ANYMOTION_APPROVED_VOICE_PROVIDERS` must explicitly name commercial voice provider IDs reviewed for licensing/quality. The HTTP WAV voice adapter can be pointed at a compatible provider but has not been auditioned for natural dialogue.
- YouTube uploader is restricted to explicit private uploads, validates the official resumable origin, rechecks remote privacy on receipt reuse and binds metadata as well as MP4 hashes. Tests use mock HTTP transport only.
- `backup`, `backup-verify`, `restore` check SHA-256 of all files and refuse to overwrite source/recovered episodes. In the real 78-second pilot rehearsal 51 production artifacts were independently archived and restored. Keep backups outside the production directory and preferably on a different physical device.

- Original vector-derived 1280×720 thumbnail rendered with FFmpeg and verified PNG SHA-256; no thumbnail upload API call performed. A dedicated unit test checks deterministic and safe source frames.

- Consola local de previsualización en `npm run studio`: lectura de producciones, versiones e idiomas y streaming de vídeo `Range` con pruebas HTTP. No sustituye una consola de revisión y edición completa.

- `npm run studio` starts a read-only dashboard on `127.0.0.1:4321` (no remote access, approvals or publication). Test covers HTTP range playback, path allowlisting and non-GET request rejection.

## Iteración F5 posterior (miniatura y consola)

- `youtube-thumbnail` implementa `thumbnails.set` después de confirmar aprobación comercial, un videoId privado con recibo, un PNG 1280×720 íntegro y una confirmación de operador independiente. Verifica privacidad remota antes y después y reintenta de forma segura con recibo SHA-256. **Solo probado con HTTP mock; nunca se llamó a un canal real.**
- `studio` presenta producciones locales con endpoint de solo lectura y permite reproducir MP4 mediante `Range`. Sin publicación ni edición; inaccesible fuera de loopback.
- La prueba de miniatura subida cubre falta de autorización, emisión, idempotencia y corrupción posterior del PNG.
- `npm test` volvió a pasar 39/39 pruebas en el entorno Linux de desarrollo. No interpretar esta validación como una garantía editorial ni de política de plataforma.

- Miniatura determinista en PNG 1280×720, separada del vídeo maestro, con subida a YouTube mediante `thumbnails.set` explícitamente autorizada y pruebas de contrato; no verificada con un canal real.

- Read-only local Studio (`npm run studio`), tested with HTTP Range playback on 127.0.0.1; no remote exposure or edit/publish actions.
- Thumbnail PNG generation and guarded `thumbnails.set` implementation have mock tests; the real channel and permissions are unverified.


## Additional implementation (November 11, 2026)

- Deterministic editorial analysis emits auditable risks (dialogue repetition, sparse stage action, long scenes/holds, potential premise overlap). It is explicitly not an originality/humor approval.
- Guarded future YouTube scheduler, using the documented `videos.update` status request. Requires verified full release, explicit editorial approval, exact private upload receipt, uploaded thumbnail receipt, canonical UTC schedule >= one hour in future, and separate explicit command confirmation. Live channel validation is still OPEN.
- HTTP TTS no longer requires eSpeak as a preflight dependency when a commercial TTS provider is configured.
- Tests added for strict time validation, remote privacy, scheduling idempotency and tampered thumbnail evidence.


## Additional implementation: staged narrative generation

- Staged screenplay generation: 5–12 outline beats, scoped scene prompts, strict scene contract validation, one targeted repair per scene, final episode validation and global action/dialogue ID checks. Mocked model tests verify a complete 540-second structured episode and a successful targeted repair.
- Content-addressed LLM-call checkpoint cache binds the exact prompt, model, brief and output hash, rejects corruption and supports local resume. No real provider was contacted; creative acceptance remains OPEN.
- The existing `autopilot` still uses the legacy single-call story approach. `generate-staged` is an explicitly confirmed alternative until a live model benchmark justifies selecting it for production.


## Additional implementation: multilingual distribution kit

- Content-addressed, verified Studio handoff package: source-language video, localized full-dialogue WAV stems, accessibility SRTs, per-character diagnostic SRTs, approved thumbnail, metadata and a clear manual upload guide.
- Requires full-resolution signed-off source; never publishes or obtains OAuth tokens. Unit tests cover approval, idempotent reuse and post-export corruption rejection. Multilingual Studio upload has **not** been validated with channel access.


## Nine-minute original editorial fixture

- Added independently authored creative draft EP0002 ("El tratado de los veintidós grados") and en-US culturally localized draft. 10 scenes, 90 lines, 540 seconds, 40 camera changes. This is not a generated episode.
- Actual Linux FFmpeg preview validation: 6,480 frames at 640×360/12 fps, full 540.000 s H.264 picture; 90 eSpeak diagnostic speech clips per locale; two final H.264/AAC preview MP4s with the same 540.000 s duration; 202 content-hashed release artifacts and isolated SRT per character.
- Review status remains EDITORIAL_PENDING. No natural voice, original art approval, actual cloud LLM, source TTS pipeline on Windows or commercial publish validation is implied.

## Iteración 14 — Sound design and shared sound stems (technical)

- `src/audio/soundscape.ts` adds strict, versioned, allowlisted cues for original procedural SFX and a short original musical motif. The system does not fetch audio from third parties, generate arbitrary notes from an LLM or use copyright-protected samples.
- `sound-design.json`, `music.wav`, `sfx.wav` and `sound-manifest.json` are stored per episode, with content hashes and provenance. Editing audio, its design or its manifest invalidates the release.
- Dubbing now exports dialogue and full mix separately, with SFX/music identical across locales and sound manifest dependency stored in the dub manifest. Mix clipping triggers a hard error.
- The package and editorial release verification bind soundtrack stems and source design. Missing or added sound files after packaging fail validation.
- Verified in isolated Linux tests with 58 passing assertions; an end-to-end bilingual preview with synthetic diagnostic voice has been exercised. Production TTS, soundtrack artistic acceptance and hardware/Windows benchmarking remain OPEN.


## Iteración 15 — Long-form sound & recoverability benchmark

- The 540-second original scripted EP0002 draft now has a versioned independent sound design (`examples/episode-0002.sound-design.json`) with original procedural sound cues, intro and outro.
- Production of the nine-minute episode previously exceeded the execution limit because each of 180 WAV clips triggered external probing and re-encoding. This was a genuine observed throughput bug, not proof of bad hardware.
- The speech engine now strictly parses RIFF PCM16 mono WAV, reading sample rate/duration in process and bypassing FFmpeg for compatible 24kHz clips without tempo change. FFmpeg remains the fallback for other rates and tempo stretching.
- Job leases now expire after 90 seconds with heartbeat every 15 seconds; classified transient failures can be retried while validation/licensing/integrity errors block.
- Clean Linux end-to-end run produced 540s H.264/AAC es-ES/en-US MP4s, 90 synthetic tone clips per locale, shared original music/SFX, 206 release artifacts and successful replay. Synthetic diagnostics are NEVER commercial audio/actual speech. `npm test`: 61 tests PASS. External LLM/TTS, Windows media run, final art, real YouTube OAuth, and commercial pilot remain OPEN.


## Iteración 16 — Business/evidence report

- An offline, typed, zero-credential analytics engine (`src/analytics/report.ts`) now accepts episode production costs and YouTube Studio statistics, with provenance classification OBSERVED/SIMULATED.
- It calculates weighted platform-reported impression CTR, measured watch duration, episode cost, RPM (only for actual observed revenue), financial break-even views and locale coverage. Returning viewer ratio uses unique viewers when available.
- It never declares SCALE/STOP from synthetic data, never estimates unobserved revenue and never attributes localized views to incremental dubbing revenue.
- `node dist/cli.js analytics <input.json> --out <report.json>` produces an immutable JSON artifact; unit tests check validation, null economics, and sample calculations. Real channel metrics remain unavailable until the six-episode pilot.

## Iteración 17 — Memoria editorial y riesgo de repetición (comprobado localmente)

- `src/creative/catalog.ts`: libro SQLite inmutable por `episodeId` y SHA-256, huella editorial estructurada, comparación explicable entre premisas anteriores y nuevas, estado `DRAFT`/`EDITORIAL_APPROVED` comprobado contra firmas de entregas reales.
- `src/production/creative-context.ts`: snapshot versionado de premisas anteriores antes de gastar tokens de LLM; reintentos con exactamente el mismo contexto. `autopilot` y `generate-staged` consumen el contexto persistente y registran los nuevos borradores. No se inventan metadatos de conflicto cuando el LLM no los ha aportado de manera validada.
- CLI `creative-check`, `creative-index` y `creative-approve`; aprobación no permitida si falta una entrega final verificable.
- Prueba real de CLI, SQLite en disco y mini pipeline bilingüe de 78 segundos con voz sintética de prueba; la voz final y la calidad editorial siguen pendientes.
- **No es una memoria de continuidad argumental** y la similitud léxica no garantiza originalidad ni monetización. No se ha contactado un proveedor LLM real.

## Iteración 18 — Autopilot staged con presupuesto persistente

- `autopilot` usa por defecto un esquema por escenas, con `--story-mode single` como compatibilidad explícita. `prepareEpisodeDrafts` registra el modo para impedir que una misma revisión cambie silenciosamente el algoritmo de generación.
- El contexto de catálogo y los checkpoints de cada petición LLM son reanudables. Una prueba controlada generó 10 escenas, reparó únicamente la 4.ª tras un error contractual y recuperó el episodio sin repetir solicitudes al modelo.
- `src/story/checkpoints.ts` persiste las reservas de número de llamadas y máximo de tokens de salida antes de hacer peticiones; un presupuesto agotado responde `LLM_BUDGET_BLOCKED`. No representa una factura real ni mide tokens de entrada.
- La integración con un proveedor LLM comercial aún no se ha ejecutado: los tests utilizan un proveedor simulado, por lo que NO se considera F2 aprobado editorialmente.

### Evidencia adicional F1/F3 full HD (iteración 18)

En una ejecución local Linux con `ANYMOTION_TEST_VOICE=synthetic`, `pipeline:final` generó 2.340 fotogramas del maestro a 1920×1080/30 FPS. La primera invocación se interrumpió tras producir el máster y el audio español; el siguiente intento comprobó y recuperó los artefactos, completando el paquete bilingüe. FFprobe validó **dos MP4 H.264 + AAC de 78.000 s, 1920×1080 y 30/1 FPS** y `release_final.json`. Este resultado NO acredita voces expresivas, calidad artística, un vídeo de nueve minutos a 1080p ni render Windows. La interrupción dejó un archivo MP4 temporal huérfano, pendiente de una política de limpieza segura.


## Iteración 19 — Rasterización multiplataforma (validación parcial)

- Incorporado Sharp 0.34.1 (licencia Apache-2.0 del proyecto; revisar también dependencias transitivas según distribución) para convertir SVG generado por código a PNG. Se elimina la dependencia obligatoria de `librsvg` en FFmpeg; `libx264` y FFprobe siguen siendo necesarios.
- Un pipeline limpio Linux con `sharp-png-v1` generó **936 frames**, MP4 H.264/AAC español e inglés de **78.000 s exactos** a 640×360/12 FPS, con checksum y entrega técnica. La antigua secuencia SVG/FFmpeg se conserva solo como fallback explícito.
- El verificador de máster impide cambiar de backend y reutilizar silenciosamente un MP4 anterior. CI multimedia se convierte en requisito (no se omite por falta de dependencias).
- **Pendiente:** validar de verdad Sharp+FFmpeg a 1080p/30 FPS en Windows y, separadamente, la calidad artística. No declarar F0 final por cambiar el rasterizador.


CI de la primera iteración Sharp: los contratos Ubuntu finalizaron PASS, mientras el job multimedia FAIL durante la comprobación de dependencias del runner; por tanto NO se declara CI completa verde en ese commit. Se fija después `ubuntu-24.04` para medios (frente a la migración variable de `ubuntu-latest`), se añade diagnóstico explícito y una instalación FFmpeg de tiempo acotado solamente si falta el ejecutable. El objetivo sigue siendo que la ejecución multimedia sea **obligatoria**, no que se omita.

## Iteración 20 — Eliminación de secuencias PNG temporales

- La primera prueba Sharp a 1080p generó más de 290 MB de PNG intermedios y fue interrumpida antes de acabar. Se reemplazó el archivo temporal por `image2pipe`, mediante un `Readable` asíncrono con backpressure. Solo queda el MP4 temporal del proceso de codificación.
- En un workspace aislado se generó de nuevo el episodio de 78 segundos (640×360/12 FPS, vídeo es/en H.264/AAC) y un benchmark real de **24 segundos, 1920×1080, 30 FPS, H.264**, 720 frames, con FFprobe: 24.000 s, 17.5 s de trabajo medido, espacio temporal mínimo.
- `examples/benchmark-24.json` y su prueba de contrato reproducen el benchmark. CI Ubuntu exige ahora la conversión de este fragmento Full HD, además de toda la previsualización bilingüe.
- La extrapolación del rendimiento a 9 minutos en 1080p y la compatibilidad FFmpeg Windows siguen pendientes: no tratarlas como validadas por un clip corto.


#### Windows media validation gate — iteration 21

The required `media-windows` CI job performs actual SVG → Sharp → H.264 rendering of the 78-second preview on `windows-latest`. It checks codec, resolution, frame rate and duration via FFprobe. This gate remains **UNVERIFIED** until the CI result is inspected; Windows commercial production with final TTS and 8–10-minute render still requires a dedicated benchmark.


#### Windows workflow correction — 11/11/2026

The first `media-windows` run demonstrated that FFmpeg can be installed and Sharp can load on GitHub-hosted Windows. It failed before video generation because CI had not compiled `dist/cli.js`. The job now runs `npm run build` before invoking render. Real Windows media verification remains OPEN until the new run finishes.


#### Iteration 21 verification — required multiplatform CI (COMPLETED)

At commit `70c1d59af23be6856bdbeefb9e21dc83a2d94ef3`, GitHub Actions run [43075837183](https://github.com/akumanomi1988/AnyMotion/actions/runs/43075837183) completed **SUCCESS** with all four jobs passing:

- Ubuntu and Windows TypeScript contracts/unit tests. Local clean run: **73/73 tests PASS**.
- Required Linux native media integration (78-second bilingual synthetic preview, QA, idempotent replay, and 24-second 1080p/30fps Sharp stream benchmark).
- Required Windows native media smoke (actual FFmpeg installed through Chocolatey, Sharp rasterizer loaded, real 78-second H.264 render, 640x360/12fps and FFprobe duration verification).

This replaces the previous *Windows media unverified* limitation only for the **CI preview**. Long-form 8–10-minute final-resolution renders, natural speech models, creative art direction, licensing evidence, real provider API calls, YouTube authorization and commercial publishing are still unverified. This is a **technical milestone, not F0–F6 completion**.

## Iteration 22 — release-bound rights attestation (2026-11-11)

- New `src/publishing/rights.ts` derives the exact picture/voice/music/SFX inventory from the verified FINAL release. One human-confirmed, content-addressed rights claim is mandatory for each category in that release. Evidence is saved only on explicit `ATTEST_RIGHTS:<episodeId>` confirmation.
- `editorial-approve` now requires `rights-attestation.json` and binds its SHA-256 to the approval. Publication revalidates the ledger, so later changes fail closed. Rights claims are human assertions, **not automated legal proof**.
- Commands: `rights-inventory`, `rights-attest`, `rights-check`. Detailed usage and limitations are in ADR-0003 and README.
- Local independent validation: 76/76 tests passed using Node 22.16.0, TypeScript 5.8.3 and Sharp 0.34.1; a clean `ANYMOTION_TEST_VOICE=synthetic npm run pipeline:preview -- --sound-design examples/pilot.sound-design.json` rendered 936 frames and packaged the 78-second bilingual episode. No paid provider or YouTube call.
- CI status for this iteration: pending until the branch update runs remotely.

**Remaining gates:** renderer aesthetic/license selection, final characters and sets, authorized real LLM/TTS tests, native Windows benchmark on operator machine, six human-approved commercially published episodes and observed analytics. The product remains **PARTIAL / NOT COMMERCIAL-READY**.
