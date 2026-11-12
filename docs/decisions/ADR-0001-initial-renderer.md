# ADR-0001 · SVG/FFmpeg as a reversible technical spike

- **Date:** 2026-11-11
- **Status:** PROPOSED / NOT A PERMANENT ENGINE DECISION
- **Context:** The repository starts empty. We must verify that original characters, multiple camera shots, deterministic actions, validated timelines, actual MP4 rendering and speaker-separated SRTs can be produced before investing in a large visual library.

## Decision

Implement the first runnable F0/F1 prototype using authored SVG frames and FFmpeg's `librsvg` decoder. The domain contract (`Episode`/`Scene`/`Action`) is independent of the drawing backend. It does not run arbitrary LLM-generated scripts. No external API, account or licensing service is required to execute the pilot.

## Alternatives to benchmark

- **Remotion:** React/TypeScript workflow with commercial licensing conditions; current eligibility must be checked for actual operator structure.
- **Motion Canvas:** MIT-licensed 2D animation engine, to be tested for export, runtime, rigs and production maintenance.

Do not invest heavily in SVG/FFmpeg-specific gestures before comparing like-for-like clips and measured Windows rendering characteristics. A separate renderer adapter can replace the proof of concept later. This abstraction cannot eliminate all migration costs.

## Constraints and open risks

- The original vector design and voices are still **unapproved**.
- Windows FFmpeg builds vary; `librsvg` and `libx264` are mandatory for this adapter.
- Per-frame SVG decoding is simple and deterministic, but quality and throughput at 1080p/30 FPS require a real hardware benchmark.
- The example's timecodes are **manually authored**. Production timing must derive from measured source-language speech before frame rendering.
- The current renderer cannot satisfy the 8–10-minute final episode, TTS, multilingual audio or publication requirements by itself.

## Revisit when

After a visually comparable 20–30-second Remotion/Motion Canvas benchmark, and before the final Show Bible asset library is frozen.
