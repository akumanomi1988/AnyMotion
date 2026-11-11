# AnyMotion · Sitcom AI Studio

**Estado real:** prototipo audiovisual bilingüe ejecutable + registro SQLite de trabajos + adaptador opcional de guiones LLM. **No es un estudio de producción comercial terminado.** La creatividad, las voces, los personajes y las licencias deberán pasar revisión editorial antes de publicar.

## Alcance implementado

- Contratos validados, cronología absoluta en milisegundos, IDs de réplica estables, y SRT por personaje y combinado.
- Renderer SVG/FFmpeg reproducible con **dos personajes** y **tres fondos domésticos** (salón, cocina, dormitorio); cámara, gestos y expresiones.
- Voz de referencia es-ES medida antes de congelar `timeline.json`; render maestro H.264 silencioso, previews y manifiestos SHA-256/FFprobe.
- Doblaje real por réplica con voz **eSpeak solo para diagnóstico**, voces distintas, `speech-fit-report`, adaptación en-US mediante texto explícito, rechazo de frases que no caben y montaje de vídeo sin rerenderizar planos.
- Persistencia SQLite local de trabajos, claims atómicos, leases y reintentos limitados. La API integrada `node:sqlite` está **marcada experimental en Node 22**: evaluar sustitución por un driver estable antes de cargas de producción críticas.
- Pipeline de prueba idempotente con verificación de integridad y paquete etiquetado `TECHNICAL_PASS_EDITORIAL_PENDING`. Prohibida la publicación automática.
- Adaptadores de LLM **opcionales** de API compatible con OpenAI: borradores JSON de guion con límites de 8–10 minutos y adaptación cultural en-US con IDs de diálogo inmutables; ambos necesitan revisión humana. No hay garantía automática de comicidad, originalidad ni calidad editorial.

## Instalación

- Node.js **22+**, npm, FFmpeg, FFprobe y decoder `librsvg` + encoder `libx264`.
- **eSpeak** en PATH para pruebas de voz. La voz final requerirá un proveedor expresivo validado para es-ES/en-US (Kokoro/Piper/API son candidatos, **no integrados**).
- Windows, Linux o macOS: comprobar FFmpeg, eSpeak y permisos de escritura con `doctor`.

```bash
npm install
npm test
npm run doctor
npm run pipeline:preview
```

El pipeline crea, bajo `productions/EP0001/`, el vídeo maestro **silencioso de 78 s**, `locales/es-ES/` y `locales/en-US/` con `vera.srt`, `leo.srt`, `combined.srt`, `dialogue.wav`, `full_audio.wav`, `final_preview.mp4`, informes y hashes, más `release_preview.json`. Los medios y la base `workspace/jobs.sqlite` no se suben a Git.

```bash
npm run render:preview
npm run dub:es
npm run dub:en
npm run mux:es
npm run mux:en
node dist/cli.js package examples/pilot.json --preset preview
node dist/cli.js jobs examples/pilot.json
```

Los comandos `render` y `package` se niegan a sobrescribir artefactos distintos. `dub` y `mux` recuperan únicamente productos cuyos hashes y entradas coinciden. Para cambiar el guion, el doblaje o el estilo, crear una **nueva revisión o episodeId** y conservar los masters previos.

Para validar escala **sin fingir que hemos generado una historia original**, ejecutar `npm run fixture:load` y `node dist/cli.js render workspace/loadtest-9min.json --preset preview`. Este fixture sintético de nueve minutos es solo una prueba de carga.

## Borradores de guion LLM (solo con proveedor configurado)

Definir explícitamente las variables `ANYMOTION_LLM_ENDPOINT`, `ANYMOTION_LLM_MODEL`, `ANYMOTION_LLM_API_KEY` en el entorno. El programa no almacena ni registra claves. Las llamadas remotas usan HTTPS y pueden generar costes según el proveedor. **No se ejecutan durante `npm test` ni `pipeline:preview`**.

```bash
node dist/cli.js generate examples/story-brief.json --out examples/EP0002.generated.json
```

El resultado se valida como episodio de **8–10 minutos** y permanece en estado **DRAFT**. Para obtener una traducción propuesta y revisarla antes de doblar:

```bash
node dist/cli.js localize examples/pilot.json --locale en-US --out examples/pilot.en-US.draft.json
```
 Su historia, expresividad y adaptación deben aprobarse manualmente. El guion ficticio de EP0001 y la localización en inglés son *fixtures*, no evidencias de creatividad automática.

## Base de conocimiento

- [Documento maestro de producto v2.0](docs/master-blueprint.md).
- [Estado técnico verificado y fases pendientes](docs/status.md).

## Arquitectura

```text
src/
  core/          contratos, timeline, rutas seguras, exportación SRT
  renderer/      SVG puro: personajes, escenarios, cámara y gestos
  timeline/      congelación previa al render tras medición de voz es-ES
  audio/         doblaje temporal y mux a MP4
  production/    trabajos SQLite y packaging verificado
  story/         proveedor LLM compatible y QA estructural del borrador
  tests/         validaciones y regresiones
examples/        fixtures originales de 78s, traducción en-US y brief LLM
productions/     artefactos versionados en disco (ignorados en Git)
workspace/       SQLite y temporales (ignorados en Git)
```

**CI note:** GitHub Actions runs the media pipeline with `ANYMOTION_TEST_VOICE=synthetic` to avoid network-installed voice dependencies; this generates a tone, not words, and is exclusively a test of routing, timing, encoders and manifests. Local eSpeak speech tests remain separate. Never use the synthetic setting to evaluate or publish episodes.

## Lo que falta para la visión comercial

1. Aprobar arte final, comparar Remotion/Motion Canvas con el renderer actual y decidir motor definitivo con licencias comprobadas.
2. Generar voces **antes** de congelar el timeline en producciones nuevas; integrar TTS expresivo, perfil versionado por personaje e idioma, mezcla SFX/música y QA de escucha.
3. Validar que un episodio de **8–10 min generado por LLM** es realmente original, gracioso y animado, no relleno narrativo. El generador existe, pero no está validado contra un proveedor real en este entorno.
4. Implementar compositor/editor de timeline, revisión editorial, cola autónoma programada, backups restaurables y métricas de coste.
5. Conectar el adaptador oficial de YouTube con OAuth, permisos efectivos, aprobación humana y subida privada de prueba, sin hacer suposiciones sobre APIs de pistas multilingües.
6. Producir seis episodios distintos y evaluar métricas reales antes de aumentar la cadencia.

No considerar `TECHNICAL_PASS` equivalente a `EDITORIAL_APPROVED`, ni un episodio generado automáticamente equivalente a un episodio publicable.

## F4/F5 hardening — new operator commands

The project now includes additional **fail-closed** controls; they do not imply that real channel access, commercial sound, or editorial quality has been verified.

- `pipeline:preview` verifies the hash and source revision of an existing master before reuse. It will **refuse** an old/stale master instead of silently skipping the render. It does not overwrite previously validated files.
- A lease heartbeat protects long-running stage claims from concurrent reuse. Stages are only reusable after input/output verification.
- `ANYMOTION_TTS_ENDPOINT`, `ANYMOTION_TTS_MODEL` and `ANYMOTION_TTS_VOICES` enable an OpenAI-compatible **WAV** TTS server (local loopback or HTTPS) with pinned voice IDs. The default eSpeak and `ANYMOTION_TEST_VOICE=synthetic` remain diagnostic only; neither may pass editorial approval. The new TTS adapter's protocol has unit tests, but no commercial voice has yet been auditioned.
- A release can only be approved for publication with a **full** preset, matching SHA-256 artifact hashes, approved non-diagnostic provider IDs, a named reviewer, written review notes, an explicit rights assertion, and the exact phrase `APPROVE:<episodeId>`.
- A YouTube video can only be uploaded as **private** using an explicitly confirmed `UPLOAD_PRIVATE:<episodeId>` command; the documented resumable API is used with an output/session record and remote verification. Upload is not enabled without valid OAuth credentials. No unattended public posting or scheduling exists yet.

### Editorial verification

```bash
npm test
node dist/cli.js editorial-check examples/pilot.json
# Only AFTER a full commercial-quality episode is packaged and source rights are confirmed:
node dist/cli.js editorial-approve examples/my-final-episode.json \
  --reviewer "Original Creator" --notes-file review.txt \
  --rights-confirmed yes --confirm APPROVE:EP0002
```

The current `EP0001` preview with eSpeak **must fail editorial approval**. This is deliberate.

### Private upload (explicit authorization only)

Prepare `metadata.json` locally with all mandatory classification fields:

```json
{
  "title": "Episode title - Original animated sitcom",
  "description": "Original independent animated sitcom episode. Characters and voices have been reviewed for release.",
  "categoryId": "24",
  "madeForKids": false,
  "tags": ["animated sitcom", "original animation"]
}
```

Set either `ANYMOTION_YOUTUBE_ACCESS_TOKEN` or all three `ANYMOTION_YOUTUBE_CLIENT_ID`, `ANYMOTION_YOUTUBE_CLIENT_SECRET`, `ANYMOTION_YOUTUBE_REFRESH_TOKEN` in the process environment (never in Git). Then explicitly run:

```bash
node dist/cli.js youtube-private examples/my-final-episode.json \
  --metadata metadata.json --confirm UPLOAD_PRIVATE:EP0002
```

This cannot be performed with the diagnostic example. Only a private YouTube video is created; subsequent public scheduling, additional audio tracks and thumbnails require separate permissions and implementation/validation. No project credentials are included.

### Implementation caveats

On Windows, the pure Node contract/unit tests run with Node 22. Media rendering now uses Sharp for SVG → PNG by default (cross-platform Node native package) and FFmpeg for PNG → H.264; `librsvg` in FFmpeg is no longer required. The Windows 1080p/30fps pipeline must still be benchmarked on the target computer. Node 22 `node:sqlite` is still experimental in this environment. Read `docs/status.md` before treating a feature as production-ready.


## Editorial assessment and safe scheduled publishing (F5 extension)

`node dist/cli.js editorial-analyze examples/pilot.json` emits an evidence-based risk report for dialogue repetition, long static shots, silent gaps, and premise similarity. **It never approves comedy or originality**; manual judgment remains mandatory. To compare with previous premises, pass `--prior path/to/summaries.json` containing a JSON string array.

A video may be scheduled **only** after a full-resolution, editorially approved release has a confirmed private upload and a separately verified uploaded thumbnail. The official `videos.update` call is **never** executed by the pipeline or Studio UI. It requires UTC time at least one hour in the future and an exact episode/time confirmation:

```bash
node dist/cli.js youtube-schedule examples/pilot.json \
  --metadata examples/youtube-metadata.example.json \
  --publish-at 2027-01-01T18:00:00Z \
  --confirm SCHEDULE:EP0001:2027-01-01T18:00:00Z
```

The scheduler validates `status.privacyStatus=private` before and after the update, verifies its remote `publishAt`, and saves a content-addressed receipt. A past time can cause immediate public publication in YouTube, therefore it is rejected. The live API has **not** been exercised with this project; the test suite uses mocked responses. Scheduling is a consequential publishing action requiring the operator's explicit authorization.


## Staged LLM screenplay generation (optional, still editorially unapproved)

The original one-response JSON generator remains available for compatibility. For longer episodes, the safer candidate is an outline followed by 5–12 independently validated scene calls, with one bounded repair attempt per scene, unique action/dialogue IDs, strict canonical timing and a final full-episode contract check. This reduces failure impact but does not prove narrative quality.

```bash
node dist/cli.js generate-staged examples/story-brief.json \
  --out workspace/new-episode.json \
  --confirm GENERATE_STAGED:EP0002
node dist/cli.js editorial-analyze workspace/new-episode.json
```

`generate-staged` requires `ANYMOTION_LLM_ENDPOINT`, `ANYMOTION_LLM_MODEL`, `ANYMOTION_LLM_API_KEY`. These are potentially billable requests. The bounded intermediate LLM responses are stored in content-hashed checkpoints under `workspace/drafts/<episodeId>/staged/` to resume without resending completed requests. The files are private, excluded from Git and tied to the precise brief and model. A crashed process may leave `.active.lock`; verify that no stage is active before removing a stale lock manually. Staged LLM generation has been tested with a **mock provider only**.


## Multilingual YouTube Studio handoff

When a full-resolution episode has been editorially approved and its thumbnail is hash-verified, generate an offline distribution package with the original-language MP4, one WAV per locale, individual/combined SRTs, thumbnail, localized metadata and a manual Studio upload guide:

```bash
node dist/cli.js youtube-kit examples/pilot.json --metadata examples/youtube-metadata.example.json
```

This requires **production-grade, approved voices**, not the included diagnostic fixture. The `productions/<episodeId>/studio-kit/<revision>/` directory is immutable, content-addressed, re-verifiable and separate from the approved master. It performs **no YouTube API calls**. Use the Studio interface for adding dubbed audio tracks where available; do not assume public API support for arbitrary dubbed tracks. A technical pass alone cannot create this kit without editorial signoff.


## Original long-form golden episode (editorial draft)

`examples/episode-0002-editorial-draft.json` is a **hand-authored** independent nine-minute sitcom story, *El tratado de los veintidós grados*, not generated by an LLM. It has 10 scenes, 90 distinct dialogue lines, expressive reactions and camera changes. `examples/episode-0002.en-US-editorial-draft.json` is a separate English cultural adaptation, with stable dialogueLine IDs and localized Fahrenheit references. Both remain editorial **drafts**, not human-approved show assets.

To verify the full preview audiovisual pipeline on a compatible machine:

```bash
npm install && npm test
npm run doctor
npm run pipeline:episode2
node dist/cli.js editorial-analyze examples/episode-0002-editorial-draft.json
```

The preview creates 540-second H.264/AAC videos in es-ES and en-US with separate character SRTs. Without a configured expressive commercial TTS provider this command uses **eSpeak diagnostic** output that is explicitly unpublishable; this does not imply voice or artistic approval. Do not confuse this authored golden example with autonomous generation using a live model, which remains unverified.

## Música, efectos y mezcla independiente (P0 technical)

El motor incluye un compositor **procedimental original**, sin samples ni obras musicales externas. Los efectos se describen mediante un contrato cerrado (`tap`, `pop`, `chime`, `swish`) con tiempos absolutos y ganancia limitada. Se exportan `audio/music.wav`, `audio/sfx.wav`, `audio/sound-design.json` y `audio/sound-manifest.json`; cada idioma conserva `dialogue.wav` y genera `full_audio.wav` usando **las mismas pistas**. Se rechazan cambios de sonido posteriores al doblaje o empaquetado sin una revisión de episodio.

```bash
npm run build
npm run soundtrack:pilot
# Desde una producción limpia, genera y utiliza el soundscape en el pipeline:
ANYMOTION_TEST_VOICE=synthetic npm run pipeline:preview -- --sound-design examples/pilot.sound-design.json
```

La voz `synthetic` **solo sirve para pruebas técnicas**, no para contenidos publicables. La composición sonora generada es una muestra funcional, no una validación de música comercial ni de mezcla profesional. Para un episodio nuevo, crear un archivo `*.sound-design.json` con los cues musicales y efectos aprobados, antes de producir los doblajes. No deben mezclarse pistas musicales con licencias desconocidas.


## Rendimiento: diálogo PCM directo y recuperación

Las réplicas WAV **PCM16 mono de 24 kHz** se leen con un analizador RIFF estricto, evitando una invocación a FFprobe y otra a FFmpeg por cada frase si no requieren time-stretch ni remuestreo. Otros formatos/frecuencias o ajustes de tempo siguen utilizando FFmpeg. Los WAV corruptos se bloquean; no se presume que todo archivo con extensión `.wav` sea compatible.

Los trabajos de orquestación usan leases de 90 segundos y heartbeats cada 15 segundos, de modo que un proceso interrumpido puede recuperar su lease caducado. Solo errores transitorios identificables pueden pasar a `RETRYABLE_FAILED`; errores de esquema, integridad y derechos permanecen bloqueantes.

Para reproducir la prueba de nueve minutos con **180 intervenciones diagnósticas** y una banda sonora original de prueba:

```bash
npm run build
# En un workspace limpio; NO usar este fixture como publicación comercial
ANYMOTION_TEST_VOICE=synthetic npm run pipeline:episode2:sound
```

Comprobación observada en Linux (11/11/2026): dos MP4 H.264/AAC de 540.000 segundos, 90 líneas de voz por locale, 10 escenas, una sola imagen maestra, 206 artefactos con hashes, y reejecución sin duplicación. La voz es un tono sintético, no español ni inglés hablado. El episodio sigue pendiente de revisión artística y editorial.


## Negocio y análisis de audiencia (F6 — herramienta preparada, sin audiencia real)

El análisis local `analytics` valida costes por etapa, visualizaciones, impresiones, CTR **reportado por YouTube**, duración vista, espectadores recurrentes, ingresos observados y consumo por idioma. Distingue `SIMULATED` de `OBSERVED`: los ejemplos no pueden atribuirse ingresos reales y los registros observados necesitan una referencia de exportación. El RPM se calcula **una sola vez** como ingresos observados / visualizaciones × 1000, si ambos existen. Nunca se presume aprobación de monetización, rendimiento adicional del doblaje ni decisión automática de escalar.

```bash
npm run build
npm run analytics:simulated
cat workspace/analytics-simulated-report.json
```

Reemplazar el ejemplo por métricas exportadas de YouTube Studio **solo después de publicar episodios reales**, aportando evidencia. La evaluación real del piloto de seis episodios sigue pendiente.

## Creative-memory registry (F2/F4 — implemented, editorial approval still required)

A local SQLite catalog (`workspace/creative-catalog.sqlite`, excluded from Git) records a stable SHA-256 of each draft, its original premise, a short summary, and optionally **human-edited** conflict/escalation/prop/resolution metadata. No inter-episode plot continuity is required. Scores are conservative lexical/structural **review warnings**, not proof of original work or plagiarism.

```bash
npm run build
node dist/cli.js creative-check examples/story-brief.json
node dist/cli.js creative-index examples/episode-0002-editorial-draft.json --brief examples/story-brief.json
# Optional: provide a strict, versioned fingerprint JSON at first indexing:
# node dist/cli.js creative-index examples/episode-0002-editorial-draft.json --brief examples/story-brief.json --fingerprint examples/fingerprint.json
node dist/cli.js creative-approve examples/episode-0002-editorial-draft.json
```

`creative-approve` **fails** without an actual full-resolution, commercially licensed, editorially approved release bound to the same episode hash. It is not a method to auto-approve an LLM draft. An indexed episode ID cannot be silently reused for a different story.

The `autopilot` and `generate-staged` commands now save `workspace/drafts/<episodeId>/creative-context.json` before the first LLM call. That snapshot pins the current catalog context so that replays do not change paid prompts when new episodes are indexed. The generated draft is registered after validation, and possible similarities are reported for human review. Before first use in production, back up `workspace/creative-catalog.sqlite` along with the show bible, source contracts and episode manifests. `node:sqlite` is experimental under Node 22 and remains a production-qualification item.

### Staged autopilot and bounded LLM costs

`autopilot` now defaults to `--story-mode staged`: an outline, 5–12 separately validated scenes (with a single targeted repair per scene) and one en-US localization stage, each cached by its precise prompt and model. Explicit `--story-mode single` remains available for legacy experiments, but a persisted episode cannot be silently switched between modes. Checkpoints use a deterministic creative-memory snapshot from the moment generation begins.

For staged generation, `workspace/drafts/<episodeId>/staged/budget-reservations.json` durably records the **maximum output tokens requested** and count of calls reserved before outbound requests. Default limits: 30 new model calls and 120,000 requested output tokens per episode. Successfully cached calls do not consume the budget again. A failed or interrupted outbound request conservatively consumes its reservation. This is **not a monetary cost meter**: input tokens, actual generated tokens, provider pricing and tax are additional costs that must be measured from provider billing. A limit hit returns `LLM_BUDGET_BLOCKED`; it never silently continues.

```bash
node dist/cli.js autopilot examples/story-brief.json --confirm GENERATE_PREVIEW:EP0002 --story-mode staged
```

Both the staged provider and the downstream dubbing remain unverified against a real paid LLM and commercial-grade expressive TTS. Automatic publishing is still prohibited.

Full-HD technical validation (Linux, 11 November 2026): the 78-second pilot has been rendered at 1920×1080/30fps with one silent master and two localized H.264/AAC MP4s of exactly 78.000 seconds, verified by FFprobe and release packaging. The interrupted first attempt recovered on a subsequent pipeline invocation. This **does not certify final-quality acting, nine-minute final render throughput, commercial voices, Windows media, or YouTube access**.


### Iteración 19 — Cross-platform rasterizer

`sharp@0.34.1` rasterizes renderer-generated SVG to PNG frames with fixed dimensions. FFmpeg only needs ordinary PNG input, FFprobe, and libx264, avoiding the nonstandard `librsvg` decoder dependency that blocked media CI/Windows builds. `ANYMOTION_RENDER_BACKEND=ffmpeg-svg` is a reversible legacy fallback, but **existing masters are bound to their backend**: changing backend requires archiving and regenerating the visual release, never silently reusing old bytes.

The clean Linux Sharp pipeline generated a 78-second bilingual H.264/AAC MP4 at 640×360/12 FPS. The repository CI now treats multimedia integration as mandatory on Ubuntu instead of reporting green while silently skipping it; Windows runs native Sharp raster contract tests but still requires FFmpeg end-to-end verification.

### Iteración 20 — Streaming, no PNGs temporales

Sharp now streams each rasterized frame directly to FFmpeg's `image2pipe` with Node stream backpressure (`src/renderer/encoder.ts`). Large intermediate PNG sequences are not created on disk. `svg-ffmpeg-poc` remains an explicit legacy fallback. This is a raster/encoding optimization, not a change of characters, timing or editorial policy.

```bash
npm run build
npm run benchmark:fullhd
```

The versioned `examples/benchmark-24.json` is a **24-second diagnostic**, containing the two leads, dialogue, camera cuts and gestures. The isolated Linux render produced 720 frames and H.264 at 1920×1080, 30fps, exactly 24.000 seconds in 17.5 seconds elapsed, with no leftover PNG temp directory. CI now requires this benchmark in addition to the bilingual preview. It is **not** a full nine-minute 1080p benchmark, a Windows media result or evidence of publishable art.


### Windows native media CI gate (F1)

In addition to Node contract tests on Windows, the workflow now **requires** a native Windows render using Sharp SVG rasterization and FFmpeg H.264. A missing encoder or binary fails the job instead of silently skipping media coverage. This does not replace an on-device Windows test with the creator’s GPU, installed fonts, chosen voices and production-length workload.


### Confirmed cross-platform media validation (iteration 21)

GitHub Actions run [43075837183](https://github.com/akumanomi1988/AnyMotion/actions/runs/43075837183) passed all required jobs on Ubuntu and Windows. The Windows runner installed FFmpeg, loaded Sharp, rendered the **78-second** vector preview as H.264 and verified video dimensions, FPS and duration with FFprobe. Linux also passed the bilingual diagnostic pipeline and the 24-second 1080p/30fps streaming benchmark. The source code's locally executed suite is **73/73 PASS**.

This establishes a real preview-level Windows workflow; it does **not** establish final TTS performance or art quality, unattended 10-minute Windows render, commercial rights or live YouTube publishing.
