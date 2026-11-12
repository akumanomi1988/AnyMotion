# F2 — Verificación de proveedor LLM en producción

**Objetivo:** verificar que el endpoint configurado acepta un mensaje estructurado de AnyMotion y devuelve un JSON contractual sin confiar en mocks. No genera episodios ni valida comicidad.

## Preparación

1. Comprobar proveedor, modelo, licencias, presupuesto y consentimiento de posibles cargos. El operador es responsable de seleccionar credenciales válidas y no subirlas al repositorio.
2. Establecer `ANYMOTION_LLM_ENDPOINT` (HTTPS o loopback), `ANYMOTION_LLM_MODEL`, `ANYMOTION_LLM_API_KEY` en el entorno de ejecución. Ninguna credencial debe ir en scripts, archivos de producción ni commits.
3. Ejecutar `npm install && npm test`, comprobar conectividad y consentimiento; después:

```sh
npm run audit:llm -- --confirm I_ACCEPT_LLM_COSTS
```

Se realiza una petición con `response_format: {type:"json_object"}` y `max_completion_tokens:160`, incluyendo un desafío aleatorio de 128 bits. La respuesta debe reproducir los campos exactos y se guarda como `workspace/llm-probes/<fingerprint>/provider-audit.json`. No se almacenan credenciales ni las respuestas completas ajenas al contrato. Una segunda llamada al mismo modelo/endpoint no sobreescribe la evidencia y se rechaza antes del cobro.

Si falla el protocolo, corregir endpoint/modelo y revisar la salida de los tests antes de iniciar producción. No desactivar la validación para forzar un PASS.

## Criterio real de F2

Esta prueba solo acredita **conectividad técnica del modelo con formato JSON**. Para cerrar F2 se requiere además ejecutar `autopilot` con un proveedor real, generar un episodio original de 8–10 minutos, validar cronología y acciones, revisar las reparaciones y tener aprobación editorial humana del humor y de la historia. Registrar el consumo y los límites efectivos. Sin esos hechos, F2 permanece `PARTIAL`.
