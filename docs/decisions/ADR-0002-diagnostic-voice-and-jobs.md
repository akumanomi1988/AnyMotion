# ADR-0002 — Diagnostic dubbing, immutable source timing and resilient local jobs

**Status:** PROPOSED (2026-11-11). Not a commercial audio/art approval.

## Context

The F0/F1 fixture is a 78-second silent pilot with dialogue intervals fixed before real TTS. The final system requires source-language TTS to define the canonical timeline before final master render, plus localization that cannot silently truncate or rerender picture.

## Decision

- Measure source-language diagnostic speech **before freezing `timeline.json` and rendering the visual master**; retain source voice hash/revision. Current draft dialogue windows still come from scene planning and must be iteratively calibrated by a proper timing director.
- Add a distinct local diagnostic speech adapter (eSpeak), never presented as final publishable voice. Split speech by stable dialogueLineId and store actual measured duration, chosen rate, fit ratio and digest.
- Fail if speech cannot fit within 1.2× tempo adjustment; never trim syllables or shift subsequent lines silently.
- Export es-ES and en-US stems/SRTs. Mux H.264 visual master by stream copy, audit H.264/AAC durations and retain manifests/hashes. Keep `EDITORIAL_PENDING` even when technical QA succeeds.
- Use SQLite (`node:sqlite`, experimental in Node 22) as a **temporary** recoverable job ledger with leases, atomic claims, idempotency, attempt limits, and per-stage input SHA-256.
- Keep the core SVG renderer as a proof-of-concept until an F0 visual benchmark justifies Remotion, Motion Canvas or continuing with SVG/FFmpeg.

## Consequences / next gates

- Source-first timing remains unresolved for newly generated episodes and must precede F2/F3 commercial validation. The existing fixture may fit diagnostic voices but is not proof of expressive natural dialogue.
- eSpeak and Node 22 SQLite need replacement/qualification before unattended production. Need realistic provider quality tests, costs and Windows validation.
- No new rights, assets or provider contracts assumed; no upload or purchase side effects.
