# AnyMotion · Verified implementation status

Date: 2026-11-11. The normative source requirements are `docs/master-blueprint.md` (copied from the project master DOCX). This is an **implementation** ledger, not permission to change the product vision.

| Phase | Status | Verified evidence | Missing gate |
| --- | --- | --- | --- |
| F0: identity / engine selection | PARTIAL | Original provisional SVG animation, FFmpeg render; concept and licensing reviewed in master spec | Side-by-side Remotion/Motion Canvas benchmark, approved art direction, Windows compatibility and final engine decision |
| F1: executable short clip | PROTOTYPE COMPLETE | 78-second MP4 640×360 at 12 fps, 2 characters, camera cuts, gestural animation, split SRT, FFprobe and automated tests | Artistic approval and 60–90s commercial-quality acting |
| F2: 8–10min autonomous story | PARTIAL | LLM JSON draft adapter and strict episode validator; 3 provisional sets | Model/provider QA, real 8–10min episode, narrative/editorial acceptance and controlled actions |
| F3: dubbing and localization | DIAGNOSTIC PASS | Actual es-ES and en-US full-length audio & MP4 without re-rendering picture, source-voice check before frozen timeline, line-level reports | Expressive TTS, native language listening, source timing optimization and professional sound stems |
| F4: autonomous operations | PARTIAL | SQLite job ledger, leases, idempotent bilingual pilot pipeline, release hashes and validated per-episode backup/restore | Stable database driver, realistic crash/restart testing, quotas and three distinct productions |
| F5: YouTube integration | MOCK TESTS PASS (NO LIVE CHANNEL) | Explicit editorial signoff, voice allowlist, OAuth refresh, resumable private upload, remote privacy check and idempotent receipt under mock transport | Real OAuth/channel permissions, actual private upload, YouTube Studio audio tracks and operator acceptance |
| F6: six-episode commercial pilot | NOT STARTED | No publication done | Six approved original episodes and measurable retention/cost data |

Local integration evidence: `npm test` passed 37 tests; two same-input pipeline executions passed with 78s H.264/AAC for both locales; 44 release artifacts and no automatic publication. A synthetic **9-minute** technical load fixture passed end-to-end for both languages with eSpeak diagnostic voice: 108 lines per locale, two 540.000 s H.264/AAC videos and no truncated clips. The 9-minute image render passed FFprobe: 6,480 preview frames, 540.000 s, H.264 640×360/12 fps, 16.8 seconds measured render in the current Linux test environment. This fixture is repetitive by design and explicitly NOT publishable. CI multimedia uses an explicit synthetic tone adapter and is **not** real-speech QA. The previous CI media job failed on the host package-install timeout (apt-get). A rewritten job uses preinstalled tools; verify the new run before calling it green.

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
- YouTube private-only resumable upload implementation, OAuth access/refresh support, remote private-status verification and replayable upload session; tested with mocked responses only. Publishing is blocked for unapproved episodes. Public scheduling, thumbnail upload and multi-audio Studio steps remain unimplemented.
- Added unit tests for OAuth, TTS provider, master integrity, editorial approval and private-upload behavior; observed `npm test` result: **37 tests PASS** on Linux. A new clean 78-second bilingual preview has completed twice (first build and idempotent replay) with technical pass. Follow-up CI result remains pending until the new branch commit runs.

Critical remaining work: Remotion versus Motion Canvas choice and licensing, actual authored character direction, genuinely original 8–10 minute narrative verified by a human, real natural-language TTS evaluation, automated rights-provenance ledger, localization review, disk backup/restore drills, production-ready SQLite dependency, YouTube OAuth/channel access and real API integration, branding and commercial six-episode pilot. **Current status is PARTIAL, not complete.**

## Security and operational hardening (iter 5)

- `packageEpisode` hashes manifest, technical QA, source timeline, per-locale voice metadata, each stem/SRT/WAV and mux report. `verifiedRelease` requires complete entries before editorial approval. Modifying voice metadata after packaging blocks approval.
- Voices are fail-closed: eSpeak diagnostic and CI synthetic never pass. `ANYMOTION_APPROVED_VOICE_PROVIDERS` must explicitly name commercial voice provider IDs reviewed for licensing/quality. The HTTP WAV voice adapter can be pointed at a compatible provider but has not been auditioned for natural dialogue.
- YouTube uploader is restricted to explicit private uploads, validates the official resumable origin, rechecks remote privacy on receipt reuse and binds metadata as well as MP4 hashes. Tests use mock HTTP transport only.
- `backup`, `backup-verify`, `restore` check SHA-256 of all files and refuse to overwrite source/recovered episodes. In the real 78-second pilot rehearsal 51 production artifacts were independently archived and restored. Keep backups outside the production directory and preferably on a different physical device.

- Original vector-derived 1280×720 thumbnail rendered with FFmpeg and verified PNG SHA-256; no thumbnail upload API call performed. A dedicated unit test checks deterministic and safe source frames.
