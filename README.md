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

## Lo que falta para la visión comercial

1. Aprobar arte final, comparar Remotion/Motion Canvas con el renderer actual y decidir motor definitivo con licencias comprobadas.
2. Generar voces **antes** de congelar el timeline en producciones nuevas; integrar TTS expresivo, perfil versionado por personaje e idioma, mezcla SFX/música y QA de escucha.
3. Validar que un episodio de **8–10 min generado por LLM** es realmente original, gracioso y animado, no relleno narrativo. El generador existe, pero no está validado contra un proveedor real en este entorno.
4. Implementar compositor/editor de timeline, revisión editorial, cola autónoma programada, backups restaurables y métricas de coste.
5. Conectar el adaptador oficial de YouTube con OAuth, permisos efectivos, aprobación humana y subida privada de prueba, sin hacer suposiciones sobre APIs de pistas multilingües.
6. Producir seis episodios distintos y evaluar métricas reales antes de aumentar la cadencia.

No considerar `TECHNICAL_PASS` equivalente a `EDITORIAL_APPROVED`, ni un episodio generado automáticamente equivalente a un episodio publicable.
