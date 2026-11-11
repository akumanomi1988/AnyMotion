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

On Windows, the pure Node contract/unit tests run with Node 22. Media rendering still requires a compatible `ffmpeg` build with the SVG decoder (`librsvg`), and the Windows 1080p/30fps pipeline must be benchmarked on the target computer. Node 22 `node:sqlite` is still experimental in this environment. Read `docs/status.md` before treating a feature as production-ready.


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
