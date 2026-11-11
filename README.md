# AnyMotion

**Status: F0/F1 technical prototype, not a finished production studio.** A deterministic, dependency-light 2D vector renderer for original sitcom episodes. The creative brief is *Sitcom AI Studio*: original standalone 8–10 minute episodes, recurring characters and sets, individual SRTs per speaker, dubbing without rerendering the picture, and deliberate human approval before publication.

The current prototype deliberately generates **no AI scripts, no synthesized speech, no YouTube uploads, and makes no paid API calls**. These capabilities belong to later milestones. Character art and names (Vera and Leo) are provisional, not an approved show identity.

## Requirements

- Node.js **22+**, npm (to install build-time TypeScript)
- FFmpeg and FFprobe on `PATH`, with `librsvg` decoder and `libx264` encoder
- Windows/Linux/macOS with a compatible FFmpeg build (Windows availability of `librsvg` must be checked; not all builds include it)

## Run

```bash
npm install
npm test
npm run doctor
npm run render:preview
# When ready for full HD output:
npm run render:final
```

The preview generates `productions/EP0001/preview/silent.mp4` (78 seconds, 640×360, 12 FPS), with `vera.srt`, `leo.srt`, `combined.srt`, `manifest.json` and `quality-report.json` alongside their managed production paths. Full render generates 1920×1080 at 30 FPS. The video is **silent by design**: speech is indicated through deterministic facial animation, while real speech timing and multilingual audio integration are later deliverables.

`npm run subtitles` exports separate original-language SRTs without rendering. `node dist/cli.js validate examples/pilot.json` only validates the structured contract. `npm run doctor` verifies available local tools.

The CLI refuses to overwrite an existing validated MP4. Move/archive the old revision before another render. The generated `workspace/` and `productions/` folders are excluded from Git.

## What exists today

- Strict `Episode`/`Scene`/`DialogueLine`/`CameraCue`/`Action` schemas with runtime validation and stable IDs
- Integer millisecond timeline with frame-alignment checks; camera cuts, expressions, gestures, idle motion, blink and mouth movement
- Original SVG vector characters and a reusable living-room set, rendered to H.264 using FFmpeg
- SRT per character plus combined SRT preserving absolute timestamps and declared cross-speaker overlaps
- SHA-256 artifact manifest and FFprobe-based technical checks
- Automated tests for contracts, security boundaries, timing, subtitles and deterministic output
- Example original 78-second script with two scenes and multiple framings

## What is not implemented

LLM orchestration, episode generation, voice timing from actual TTS, emotion-dependent speech, localized speech fitting, dubbing, editable timelines, scalable job queue, editorial approval console, browser GUI, rights registry, or publishing. No technical PASS implies editorial approval. The initial SVG/FFmpeg renderer is a **reversible proof of concept**, not the final selection of Remotion versus Motion Canvas.

## Source structure

```text
src/
  core/         # Renderer-independent contracts, time, subtitles and safe paths
  renderer/     # Deterministic SVG frame generator
  cli.ts        # Preflight, rendering, FFprobe verification and artifacts
  tests/        # Node built-in tests
examples/       # Story and scene fixtures (not model prompts)
docs/decisions/ # Provisional architectural decisions
```

## Next gate

Compare a 20–30s section of this sequence against Remotion and Motion Canvas with the same visual requirements and hardware, validate licenses on the intended commercial use, and select one production renderer. The next vertical slice must add measured source-language voice **before** freezing the master timeline. Do not begin mass-generating episodes or autopublishing.
