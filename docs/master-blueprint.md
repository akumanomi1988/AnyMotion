<!-- Generated transcription of the v2.0 source DOCX, 2026-11-11. Normative creative specification; implementation status lives in README and docs/status.md. -->

# SITCOM AI STUDIO

## Documento maestro de producto, serie animada y arquitectura de producción

SERIE ORIGINAL · ANIMACIÓN PROGRAMÁTICA · DOBLAJE MULTILINGÜE

Versión: 2.0
Fecha de corte: 11 de noviembre de 2026
Estado: DEFINITION_READY / PRE_IMPLEMENTATION
Tipo: Base de conocimiento del proyecto y contrato de referencia para agentes de desarrollo
Idioma: especificación en español; identificadores, APIs y prompts técnicos en inglés
Ámbito: serie de animación 2D para YouTube + estudio automatizado de producción multilingüe.
Repositorio / infraestructura / canal: no definidos ni inspeccionados en esta fase; no asumir que existen.
Regla de precedencia: instrucciones posteriores confirmadas explícitamente por el propietario > este documento > decisiones provisionales internas > sugerencias de agentes.

## Índice de capítulos

| 0. Cómo utilizar y mantener esta base de conocimiento | 16. YouTube: publicación, cumplimiento, idiomas y descubrimiento |
| --- | --- |
| 1. Problema, oportunidades y antítesis del producto | 17. Negocio, unidad económica y métricas |
| 2. Definición del público, promesa y posicionamiento editorial | 18. Pruebas, validación y Quality Gates |
| 3. Biblia creativa de la serie (`Show Bible`) | 19. Roadmap de implementación y dependencias |
| 4. Dirección artística y sistema de diseño audiovisual | 20. Decisiones formales (ADR/PDR) y compensaciones |
| 5. Guion, humor, originalidad y criterios editoriales | 21. Registro de riesgos y mitigación temprana |
| 6. Motor de producción: cadena completa y contratos de etapa | 22. Matriz de alcance: qué sí, qué no y cuándo |
| 7. Contratos de datos y cronología canónica | 23. Definition of Ready (DoR), Definition of Done (DoD) y criterio de lanzamiento |
| 8. Sistema visual, animación y compositor | 24. Gobierno del proyecto y flujo con agentes |
| 9. Voz, localización y mezcla audiovisual | 25. Contrato de traspaso compacto (`Development Handoff`) |
| 10. Arquitectura de software y separación de módulos | 26. Primer prompt para agente de desarrollo — SOLO Fase 0 |
| 11. IA: alcance, controles y ausencia deliberada de agentes innecesarios | 27. Cuestiones abiertas: bloqueantes y no bloqueantes |
| 12. Estructura de archivos y ciclo de vida de los artefactos | 28. Referencias y grado de confianza (consultadas: 11/11/2026) |
| 13. Cola de producción y ejecución recuperable | 29. Glosario de conceptos |
| 14. Requisitos no funcionales y seguridad | 30. Registro de versión y siguientes instrucciones |
| 15. Experiencia de gestión interna: operador único |  |

### 0. Cómo utilizar y mantener esta base de conocimiento

Este es el documento normativo para definir el producto. Los agentes deben leerlo antes de diseñar cambios o escribir código; no deben reinterpretar los objetivos críticos ni convertir recomendaciones provisionales en requisitos inmutables. La documentación no demuestra que el sistema ya exista.

Etiquetas de estado:

- CONFIRMED: decidido expresamente por el propietario o requisito inequívoco de la idea original.

- PROPOSED: decisión recomendada para avanzar, reversible y todavía no ratificada.

- ASSUMED: hipótesis de trabajo; debe contrastarse cuando afecte el resultado.

- VERIFIED: hecho externo contrastado en fuentes identificadas y fechado; puede cambiar.

- OPEN: pendiente de validación o definición; se especifica si bloquea alguna fase.

- EXCLUDED: excluido deliberadamente del alcance actual.

Gestión de cambios: todo cambio importante se registra como ADR-NNN o PDR-NNN, indicando motivo, consecuencias, elementos afectados, fecha y criterio de reversión. Los contratos machine-readable, pruebas y recursos versionados que se creen durante desarrollo serán fuentes de verdad de implementación; no deben contradecir los requisitos confirmados sin una decisión documentada. La biblioteca visual (Show Bible) y las reglas de producción deberán evolucionar conjuntamente.

Prioridades de decisión: experiencia y originalidad de la serie; viabilidad comercial; seguridad y robustez; mantenibilidad y evolución; costes de producción; velocidad de entrega. Evitar complejidad que no resuelva un problema verificado.

#### 0.1 Resumen ejecutivo

Qué construimos: una sitcom animada de situaciones domésticas con dos protagonistas, episodios horizontales de 8–10 minutos que se disfrutan individualmente; y un motor de producción que crea el guion, lo convierte a instrucciones visuales estructuradas, renderiza un vídeo maestro, produce SRT por personaje, sintetiza pistas por idioma, verifica calidad y deja los entregables preparados para publicar.

Para quién: audiencia general adulta que disfruta de humor observacional sobre pareja y convivencia; operador inicial: creador independiente que controla la identidad, presupuestos y publicación.

Propuesta diferenciadora: personajes y lenguaje visual consistentes con historias genuinamente distintas; coste marginal bajo mediante reutilización de personajes, decorados y acciones; adaptación multilingüe sin renderizar de nuevo los planos.

Restricción no negociable: no sacrificar originalidad ni claridad visual para aumentar la cadencia. Una producción altamente automatizada puede ser creativa, pero no debe simular creatividad mediante cambios mínimos en una plantilla.

Resultado final buscado: cadena de producción local-first y recuperable, biblioteca creativa propia, episodios originales, doblajes consistentes y posibilidad de distribución internacional. La monetización es objetivo, no ingreso garantizado.

#### 0.2 Decisiones principales en una página

| Asunto | Decisión actual | Estado | Motivo |
| --- | --- | --- | --- |
| Producto | Serie original + estudio automatizado | CONFIRMED | El valor es el entretenimiento; el software es el medio |
| Formato | 8–10 min, 16:9, episodios autónomos | CONFIRMED | Objetivo editorial del propietario |
| Tema | Convivencia de una pareja; humor matrimonial y memes reinterpretados | CONFIRMED | Identidad conceptual |
| Continuidad | No hay continuidad argumental; sí identidad persistente | CONFIRMED / PROPOSED | Evita contradicción entre episodios y personajes |
| Elenco | Dos protagonistas, Vera y Leo como nombres provisionales | PROPOSED | Permite explorar personalidad y estilo antes del branding |
| Visual | 2D vectorial estilizado, rig por partes, fondos reutilizables | PROPOSED | Calidad estable con coste acotado |
| Motor | Abstracción de motor; Remotion candidato inicial con prueba comparativa Motion Canvas | PROPOSED | Productividad sin aceptar lock-in indefinido |
| Fuente de verdad | episode.json + timeline.json validados | PROPOSED | Desacoplar LLM, render, SRT y audio |
| Audio | Español original; inglés primera prueba | PROPOSED | Primer contraste multilingüe |
| Plataforma | Windows local para render y TTS, nube opcional para LLM o archivo | ASSUMED | Encaja con operación personal y control de coste |
| YouTube | Un vídeo por episodio con pistas multilingües cuando estén habilitadas | PROPOSED | Evita dispersar audiencia y duplicar vídeos |
| Publicación | Aprobación editorial humana durante el piloto | PROPOSED | Mitiga riesgo reputacional y de contenido repetitivo |
| Monetización | Anuncios + Premium; otros ingresos opcionales futuros | PROPOSED | Monetización natural de YouTube para entretenimiento |

### 1. Problema, oportunidades y antítesis del producto

#### 1.1 Problema real

Crear animación seriada implica costes recurrentes en escritura, arte, acting, edición, localización y distribución. Los sistemas que generan vídeo con modelos de difusión planos a plano pueden introducir inconsistencias de personaje, coste variable y dificultades de sincronización. El problema no es simplemente «generar MP4»: es producir una serie reconocible y divertida de forma repetible, manteniendo autonomía operativa sin perder el control creativo.

#### 1.2 Dos productos, una propiedad intelectual

- Producto de audiencia (B2C, no software): la serie, su identidad, personajes, humor y episodios.

- Producto interno (herramienta de producción): motor que fabrica y localiza episodios. No convertirlo prematuramente en SaaS, editor generalista ni plataforma para otros creadores.

La prioridad comercial es validar la serie. Un motor perfecto incapaz de generar episodios entretenidos no valida el negocio.

#### 1.3 Oportunidades

- Reutilización de rigs, expresiones y decorados; cada inversión creativa reduce trabajo futuro.

- Historias universales de convivencia con referencias culturales localizables.

- Episodios autocontenidos que facilitan descubrimiento desde cualquier vídeo.

- Escalado lingüístico con pista de audio y metadatos específicos por idioma.

- Construcción de una marca original que después pueda extenderse a clips, compilaciones propias, licencias o merchandising, si la audiencia lo justifica.

#### 1.4 Qué NO estamos construyendo

- Un lector de guiones sobre personajes estáticos.

- Un generador de vídeos idénticos con títulos cambiados.

- Un clon visual, narrativo o de voz de una sitcom existente.

- Un sistema que dependa de imágenes generadas al azar para mantener la identidad.

- Un proyecto de infraestructura distribuida antes de tener un episodio convincente.

- Un canal infantil por el mero hecho de ser dibujos animados.

- Una máquina que publique sin controles material potencialmente problemático.

- Un producto donde el número de episodios sea la métrica principal de éxito.

#### 1.5 Hipótesis y experimentos de negocio

H1: los personajes generan afinidad suficiente para que el espectador vuelva. Medida: espectadores recurrentes y comportamiento entre episodios.
H2: la comedia funciona en un formato largo de animación sencilla. Medida: retención real por escena, finalización, comentarios cualitativos y visualizaciones recurrentes.
H3: el doblaje añade alcance sin destruir el humor. Medida: valoraciones y audiencia por idioma; coste de adaptación frente a consumo incremental.
H4: el sistema reduce el coste por episodio a medida que amplía la biblioteca reutilizable. Medida: tiempo y coste por etapa, regeneraciones, incidencias.
H5: originalidad y propuesta visual permiten acceder y mantenerse en monetización. Medida: revisión y cumplimiento continuado de las políticas reales, sin presumir aprobación.

No se inferirán tasas de conversión, RPM, demanda ni facturación hasta disponer de datos observados.

### 2. Definición del público, promesa y posicionamiento editorial

Público base (PROPOSED): adultos hispanohablantes que comparten vivienda o reconocen los conflictos de pareja: tareas, dinero doméstico, tecnología, familia, descanso, reparto de tiempo, vacaciones, compras, visitas, hábitos y comunicación. No convertir las historias en mensajes hostiles hacia una identidad o género.

Promesa editorial: «Una pareja normal que consigue convertir cualquier tontería doméstica en un acontecimiento absurdo». La relación debe permanecer creíble y afectuosa incluso cuando discuten.

Posicionamiento: humor de observación + diálogo ágil + humor visual; tono algo sarcástico y adulto, pero accesible. Mejor ser recordados por los protagonistas y sus decisiones que por acumular referencias virales efímeras.

Competencia a observar, no copiar: comedia animada de personajes recurrentes, sketches independientes, canales vectoriales narrativos y sitcoms audiovisuales. El benchmark debe registrar: legibilidad visual, expresividad con pocos dibujos, utilización de pausas, densidad de plano, ritmo, empaquetado y qué porcentaje de humor es transferible a otros idiomas. Nunca presentar métricas ajenas sin fuentes verificadas.

#### 2.1 Estrategia de idioma y cultura

- Idioma fuente recomendado: es-ES.

- Primer doblaje de prueba: en-US, por contraste de ritmo, longitud y humor.

- Otros idiomas: secuencialmente tras pruebas de TTS, demanda, revisión cultural y coste.

- Los juegos de palabras, dobles sentidos, monedas, instituciones y referencias nacionales pueden necesitar adaptación, no traducción literal.

- Evitar chistes que dependan de un texto fijo sobreimpreso imposible de localizar sin rerender.

- Los títulos y miniaturas se localizan como entregables separados.

### 3. Biblia creativa de la serie (Show Bible)

#### 3.1 Concepto narrativo

Dos adultos mantienen una relación sólida, pero sus modos de resolver problemas domésticos colisionan. Un estímulo insignificante provoca estrategias incompatibles, tácticas cada vez más desproporcionadas y un desenlace que revela una verdad divertida sobre ambos.

Reglas de mundo: presente cercano, piso urbano reconocible, presupuesto y capacidades razonablemente realistas; se permiten exageraciones de montaje y fantasías visuales breves cuando el espectador comprenda que no son hechos literales. Los personajes no desarrollan poderes ni se resetean moralmente de forma arbitraria. La memoria de cada episodio no debe condicionar la comprensión de otro.

Persistencia correcta: guardar personalidades, gestos, motivaciones, registros de voz, habitaciones y conflictos usados. No exigir continuidad de estado físico, cronología ni acontecimientos concretos entre episodios.

#### 3.2 Personajes principales — propuesta de trabajo

##### Vera (vera)

- Función dramática: intenta anticiparse a los problemas; se irrita cuando el mundo no sigue su plan.

- Fortalezas: resolutiva, perspicaz, valiente para abordar conversaciones incómodas.

- Defectos cómicos: perfeccionismo, necesidad de control, exceso de confianza en sus listas.

- Contradicción: desea espontaneidad, pero intenta organizarla con antelación.

- Voz: adulta, expresiva, dinámica; sarcasmo mediante entonación, no mediante gritos.

- Gestos recurrentes: ceja elevada, mirada fija, pausa antes de responder, brazos cruzados que se desarman cuando se divierte.

- Límites: no debe ser siempre la persona que tiene razón, ni actuar como figura materna del otro personaje.

##### Leo (leo)

- Función dramática: encuentra soluciones creativas y sorprendentemente complicadas a problemas simples.

- Fortalezas: imaginación, optimismo, capacidad de improvisar, empatía inesperada.

- Defectos cómicos: racionaliza errores, se dispersa, confunde inventiva con eficiencia.

- Contradicción: quiere ahorrar trabajo, pero puede dedicar horas a diseñar un atajo.

- Voz: adulto, ingenioso, levemente teatral cuando expone planes; sin caricaturizar un acento regional.

- Gestos recurrentes: sonrisa contenida, señalar objetos como si presentara una invención, titubeo cuando su solución falla.

- Límites: no debe ser continuamente torpe, inútil o incapaz de comprender lo obvio.

##### Dinámica entre ambos

Ambos son inteligentes en dominios distintos, ambos tienen momentos de lucidez, ambos fallan. La discusión es un mecanismo dramático; el desprecio permanente no lo es. Una escena puede terminar con complicidad, negociación, una pequeña victoria de cada uno o un giro donde los dos pierden.

Nombres, apariencia exacta, edad y región: PROPOSED hasta aprobar un piloto visual y de voz.

#### 3.3 Personajes secundarios

P1 como voces ocasionales o elementos fuera de plano si enriquecen episodios; no incluir un reparto extenso en el MVP. Posibles roles: vecino, repartidor, familiar por teléfono, asistente de voz. Su incorporación requiere justificación narrativa y recursos de voz/animación.

#### 3.4 Biblioteca de situaciones

Categorías iniciales: limpieza, temperatura, cajas y objetos acumulados, reparto de tareas, compras online, compra del supermercado, presupuesto, cocina, viajes, llegar tarde, teletrabajo, aplicaciones, contraseñas, visitas, listas, bricolaje, dormir, mando a distancia, regalos y decisiones triviales.

Anti-repetición: cada episodio registra premiseFingerprint, conflictType, escalationPattern, mainProp, resolutionType, dominantCharacter, tags y resumen semántico. El motor puede buscar similitudes para alertar; no necesita leer una memoria argumental completa para escribir.

#### 3.5 Ejemplos ORIGINALES de semillas narrativas (no guiones aprobados)

- La contraseña compartida: Leo propone un protocolo de autenticación doméstico absurdo para no olvidar una contraseña; Vera termina gestionando accesos al frigorífico.

- El cajón de todo: reorganizar el cajón de objetos variados crea un sistema de inventario más complicado que el problema original.

- Modo ahorro: ambos intentan ahorrar electricidad; lo que ahorran en luz lo gastan en soluciones desproporcionadas.

- La lista perfecta: Vera establece una lista de compras tan detallada que el supermercado deja de ser reconocible como experiencia cotidiana.

- Cinco minutos: la discusión sobre cuánto tardan en salir exige cronómetros, variables y árbitros domésticos.

- La planta resistente: el cuidado de una planta supuestamente indestructible se convierte en una misión científica.

Estas semillas sirven para evaluar variedad de conflictos, no son compromisos de producción ni prueba de originalidad frente a obras existentes.

### 4. Dirección artística y sistema de diseño audiovisual

#### 4.1 Estilo recomendado: «sitcom editorial vectorial» (PROPOSED)

Sí: formas geométricas limpias, siluetas distinguibles incluso en tamaño pequeño, contornos controlados, sombras mínimas, colores cálidos moderadamente contrastados, expresiones muy legibles, fondos simples pero habitables, composición cinematográfica básica.
No: estética de presentación corporativa genérica, personajes tipo stock sin personalidad, brazos que flotan, movimiento robótico, fondos fotorrealistas, colisiones de geometría, abuso de zooms o cambio radical de estilo entre episodios.

Rasgo visual propio: combinación consistente de siluetas, proporciones de cabeza/manos, paleta, diseño de cejas y ojos, patrón de iluminación y atrezzo característico. La identidad deberá poder describirse y regenerarse sin depender de prompts vagos.

#### 4.2 Dirección de arte, tokens propuestos

| Elemento | Regla inicial | Evitar |
| --- | --- | --- |
| Canvas | 1920×1080, 16:9, 30 FPS como objetivo inicial | Cambios arbitrarios de resolución |
| Paleta | Fondo cálido desaturado + acentos coral, azul petróleo y mostaza | Saturación máxima constante |
| Contornos | Grosor consistente escalado a plano | Líneas finísimas que desaparecen en móvil |
| Fondos | Máximo 3 niveles de profundidad en MVP | Paralaje innecesario en cada toma |
| Personajes | Rigs modulares, estados faciales parametrizados | Rasterizar cada pose como imagen independiente |
| Gestos | Anticipación breve, acción legible, reposo | Oscilación perpetua sin propósito |
| Cámara | Plano general, medio, dos-shot, primer plano, reacción | Zoom automático por frase |
| Tipografía | Sans legible, sin usar textos como soporte principal del humor | Subtítulos quemados en el vídeo maestro |
| Iluminación | Variantes diurna/nocturna por escena | Cambios cromáticos incompatibles con marca |
| Utilería | Objetos con identidad y escala constante | Un objeto que cambia de tamaño sin recurso cómico |

Paleta de exploración, no definitiva: #F4E7D7 crema; #24565A petróleo; #E47C63 coral; #E8BC64 mostaza; #2D3035 tinta; #8DA3A6 gris azulado. Medir contraste en tipografía y miniaturas. La marca final puede reemplazar la paleta sin tocar lógica.

#### 4.3 Rigs y expresividad

Cada personaje se compone como mínimo de: torso, cabeza, pelo, ojos, cejas, boca, brazos/hombros/manos, piernas y sombras de contacto. La representación interna puede basarse en SVG/grupos vectoriales y transformaciones, pero debe ser independiente del motor de render.

Expresiones mínimas: neutral, contento, irritado, perplejo, sorprendido, cansado, avergonzado, satisfecho, preocupado.
Estados de boca: cerrada, apertura pequeña y grande, sonrisa, mueca, pausas; no se exige lip-sync fonético exacto en el MVP.
Animaciones base: respirar discreto, parpadear contextual, mirar, señalar, asentir, negar, encogerse de hombros, cruzar brazos, caminar simplificado, sentarse/levantarse y manipular un objeto.

Importante: un estado «hablando» no debe equivaler a agitar la boca cada fotograma. Debe modularse por actividad real de voz cuando exista audio disponible o por curvas de la línea temporal si no lo hay.

#### 4.4 Decorados y continuidad visual

P0: salón, cocina, dormitorio. El primer corte ejecutable tendrá un solo decorado; los restantes llegan antes del primer episodio comercial. Los escenarios incluyen mapa de zonas seguras para caminar, puntos de interacción, niveles de oclusión, posiciones de cámara y utilería fija. Versión día/noche con cambios discretos de iluminación cuando sea útil.

Escala espacial: altura y puntos de apoyo estables; personajes no deben atravesar sofá, mesas o puertas. Todos los props tienen identificador único y coordenadas/áreas validadas.

#### 4.5 Gramática de cámara y edición

- wide: orienta, establece espacio y relación entre personajes.

- twoShot: permite conversación con gestos y reacciones simultáneas.

- medium(characterId): subraya exposición, duda o confrontación.

- closeUp(characterId): remate, microexpresión, revelación.

- insert(propId): acción importante del objeto (pantalla de móvil sin texto fijo, mando, lista, interruptor).

- reaction(characterId): la respuesta silenciosa puede ser el remate.

- cut, hold, pushIn, pan: transiciones controladas por propósito narrativo, no por aleatoriedad.

Regla de dirección: cambiar el encuadre solo cuando mejore claridad, humor o progresión. Evitar montaje frenético que destruya los silencios cómicos. Tampoco permitir un minuto entero de dos personajes inmóviles por ahorrar render.

#### 4.6 Accesibilidad visual y distribución

Legibilidad en pantalla de móvil, texto dentro de zona segura, contornos suficientemente claros, contraste en grafismos, subtítulos separados para elegir idioma y posibilidad de silencio total para redes cuando se preparen derivados. El episodio maestro nunca tendrá textos de subtítulo permanentemente integrados.

#### 4.7 Identidad sonora

- Voces diferenciadas por timbre, prosodia y ritmo, sin caricaturas ofensivas.

- Música discreta, preferiblemente tema original de cabecera y motivos breves, siempre licenciados.

- Efectos cómicos dosificados; usar sonido para subrayar acciones, no cada movimiento.

- Silencio intencional como recurso creativo.

- Dialogue, SFX y Music como stems independientes para doblaje y remasterización.

### 5. Guion, humor, originalidad y criterios editoriales

#### 5.1 Estructura narrativa variable

Cada episodio ha de contener un desencadenante, un objetivo de al menos uno de los protagonistas, un conflicto por incompatibilidad de estrategias, una o varias escaladas y una resolución. No imponer un número idéntico de escenas o chistes a todos los episodios.

Patrón sugerido, no plantilla obligatoria: apertura con fricción o sorpresa → planteamiento de conflicto → estrategia inicial → consecuencia inesperada → segunda decisión peor → complicación → remate y resolución. Alternar ocasiones donde domina uno, el otro o ninguno.

Duración: 8–10 minutos de vídeo final comprobado, no inflados mediante pausas largas o tomas redundantes. El número de palabras será derivado del ritmo real de TTS, gestos y silencios: no usar una cantidad fija como garantía de duración.

#### 5.2 Motor de generación creativa

Separar agentes o pasos lógicos, sin necesidad de ejecutar múltiples LLMs independientes:

- PremiseDesigner: propone conflictos y justifica por qué son distintos a los existentes.

- StoryArchitect: establece intención, giros, conflicto e interacciones visuales.

- DialogueWriter: escribe diálogo con voces de personaje consistentes.

- ComedyEditor: evalúa remates, ritmo, naturalidad y redundancia.

- ContinuityChecker: verifica identidad, espacios y reglas sin imponer continuidad episódica.

- ProductionPlanner: traduce el guion a acciones admitidas, nunca a código ejecutable.

Revisión humana en piloto: selecciona o rechaza premisas y episodios si el resultado no es divertido. Una puntuación LLM no prueba comicidad real.

#### 5.3 Reglas para humor y «memes»

Sí: humor de reconocimiento, ironía mutua, malentendidos plausibles, exageración visual, contraste entre intención y consecuencia, pausas, callback interno al episodio, cambio inesperado de estatus.
No: chistes repetidos sobre supuesta incompetencia de un género, humillación sistemática, copia literal de memes protegidos, referencias de actualidad que caducan antes de publicarse, memes obligatorios en cada escena, títulos engañosos.
Precaución: referencias a personas reales, marcas, noticias o comportamientos dañinos requieren revisión; no convertirlo en contenido difamatorio o en suplantación.

#### 5.4 Variedad obligatoria

Registrar para cada episodio: tema central, tipo de conflicto, detonante, objeto, escenario dominante, quien tiene la iniciativa, mecanismo cómico principal, giro, resolución, tono. Un episodio no se aprueba si comparte la misma combinación nuclear y secuencia narrativa con uno reciente. El evaluador automático detecta y explica duplicados potenciales, no censura todo lo parecido.

#### 5.5 Revisión editorial

Bloqueos: historia ininteligible, ausencia de conflicto, copia evidente de obra ajena, discurso de odio, humor abusivo presentado sin contexto, contenido destinado implícitamente a menores pese a posicionamiento adulto, dependencia de una marca o meme sin derechos claros.
Advertencias: diálogos expositivos demasiado largos, remates previsibles, escenas sin acción ni reacción, personaje permanentemente victorioso, episodios muy similares a los últimos.

Un episodio puede ser técnicamente correcto y fallar en calidad cómica. TECHNICAL_PASS y EDITORIAL_APPROVED son estados distintos.

### 6. Motor de producción: cadena completa y contratos de etapa

#### 6.1 Principio arquitectónico

El LLM no genera componentes React ni ejecuta código. Propone EpisodePlan y SceneScript validados. Un compilador propio transforma esos contratos en una representación intermedia (AnimationIR) con movimientos, acciones y cámaras; un RendererAdapter produce fotogramas/MP4. La voz y los subtítulos se derivan de la misma cronología canónica, no de subtítulos inventados a posteriori.

#### 6.2 Flujo operacional de extremo a extremo

| Orden | Etapa | Entrada | Salida verificable | Fallo / reintento |
| --- | --- | --- | --- | --- |
| 00 | Preflight | Configuración, límites, licencias | Informe de recursos y dependencias | Bloquear sin recursos críticos |
| 01 | SelectPremise | Biblia, catálogo de ideas previas | Premisa original y etiquetas | Regenerar premisa |
| 02 | WriteScript | Premisa, voces de personaje | Guion estructurado por escenas | Regenerar sección |
| 03 | EditorialCheck | Guion e historial | Informe de originalidad y claridad | Corregir guion, no todo el pipeline |
| 04 | PlanScenes | Guion y catálogo | Acciones/cámaras/props validados | Reparar acciones desconocidas |
| 05 | DraftTiming | Diálogo y acciones | Ventanas temporales provisionales | Replanificar escena |
| 06 | BaseVoiceTiming | Diálogo es-ES, motor TTS | Duraciones medidas y voz de prueba | Reescribir línea o cambiar voz |
| 07 | FreezeTimeline | Tiempos reales y dirección | timeline.json validado, versión inmóvil | Volver a etapa afectada |
| 08 | RenderMaster | AnimationIR, timeline | master/silent.mp4 | Rehacer únicamente render |
| 09 | ExportSubtitles | Timeline, texto fuente | SRT por personaje y combinado | Rehacer solo SRT |
| 10 | Localize | Guion y timing congelados | Diálogos culturales adaptados por idioma | Reescribir líneas concretas |
| 11 | Synthesize | Adaptación + voz por personaje | Clips TTS y duraciones reales | Reintentar clip, no episodio |
| 12 | TimeFitAndMix | Clips, Music, SFX, timeline | Pistas de audio por idioma | Ajustar intervención o mezcla |
| 13 | MediaQA | Audio, vídeo, SRT | QC report técnico | Bloquear si hay errores |
| 14 | EditorialQA | Preview final y metadatos | Aprobación o rechazo | Revisión focalizada |
| 15 | Package | Artefactos validados | Entregable versionado, hashes | Atómico, nunca parcial |
| 16 | Publish (P1) | Paquete aprobado y permisos | ID externo, estado y comprobación | Idempotencia, no duplicar |

Corrección respecto a un pipeline simplista: no renderizar todo el vídeo antes de medir la duración del habla de origen. Primero se produce una voz de referencia; luego se congela el timing y se renderiza una sola vez el maestro. El audio localizado posterior se encaja en esas ventanas sin alterar el vídeo.

#### 6.3 Resultados de cada etapa

Cada etapa emite un archivo estructurado de resultados con: jobId, inputHashes, toolVersions, modelId si aplica, inicio/fin, consumo aproximado, intentos, diagnóstico, artefactos, hashes y estado. Fallos de red/TTS son reintentables; violaciones de contrato deben corregirse, no reintentarse ciegamente.

#### 6.4 Estados

DRAFT → SCRIPT_READY → TIMELINE_FROZEN → MASTER_RENDERED → LOCALIZED → TECHNICAL_PASS → EDITORIAL_APPROVED → PACKAGED → PUBLISHED.

Estados laterales: WAITING_FOR_DEPENDENCY, RETRYABLE_FAILED, BLOCKED, REJECTED, CANCELLED. Prohibido saltar de MASTER_RENDERED a PUBLISHED sin pruebas y aprobación durante el piloto.

#### 6.5 Política de regeneración

Cambiar una frase del guion tras congelar tiempos invalida, como mínimo, su clip TTS, la secuencia de diálogo, el timing de escena y, potencialmente, todos los idiomas que dependan de esa réplica. Cambiar solo la voz inglesa invalida clips en-US y la mezcla inglesa, no el máster visual. Cambiar un color de camiseta invalida el render y derivados de vídeo, pero no traducción ni texto. El grafo explícito de dependencias debe controlar esta invalidación.

### 7. Contratos de datos y cronología canónica

#### 7.1 Principios de esquema

- Todos los contratos tendrán schemaVersion (semver o versión explícita) y validación estricta antes de utilizarlos.

- Identificadores técnicos estables en inglés (episodeId, sceneId, characterId, lineId, assetId).

- Los tiempos canónicos serán enteros de milisegundos desde el inicio absoluto del vídeo. No utilizar float en segundos como fuente de verdad.

- Las duraciones se validan contra los frames reales; redondeo final a frames según FPS elegido.

- Texto y presentación están separados: el render solo recibe operaciones visuales incluidas en un vocabulario permitido.

- El dialogueLineId permanece inmutable entre idiomas. El texto cambia, la identidad no.

- Las dependencias a recursos deberán resolverse por ID/version y hash, no por URLs aleatorias.

#### 7.2 Ejemplo ilustrativo de escena estructurada

```text
{
  "schemaVersion": "1.0",
  "episodeId": "EP0001",
  "fps": 30,
  "canvas": {"width": 1920, "height": 1080},
  "sourceLocale": "es-ES",
  "scenes": [
    {
      "sceneId": "SC001",
      "setId": "living-room-v1",
      "startMs": 0,
      "endMs": 22000,
      "camera": {"shot": "twoShot", "presetId": "sofa-two-shot"},
      "actions": [
        {"actionId": "AC001", "type": "lookAt", "actorId": "leo", "targetId": "vera", "atMs": 1800},
        {"actionId": "AC002", "type": "gesture", "actorId": "vera", "gesture": "raiseEyebrow", "atMs": 6500, "durationMs": 900}
      ],
      "dialogue": [
        {"lineId": "DL001", "characterId": "leo", "startMs": 900, "endMs": 3900, "text": "He encontrado una manera de organizar el cajón."},
        {"lineId": "DL002", "characterId": "vera", "startMs": 4400, "endMs": 7100, "text": "¿Has organizado el cajón o has contratado un equipo?"}
      ]
    }
  ]
}
```

Este JSON no es un esquema de producción definitivo; ilustra las responsabilidades y debe evolucionar con pruebas. La compilación de un guion largo no debe permitir operaciones arbitrarias eval, scripts incrustados ni rutas fuera del área de trabajo.

#### 7.3 Invariantes del tiempo

- startMs >= 0; endMs > startMs; ninguna acción sale de los límites del episodio.

- Toda línea pertenece a un personaje registrado, toda escena a un decorado registrado.

- La superposición de réplicas es válida solo si está declarada narrativamente; no rechazar automáticamente todo solapamiento. Los SRT de cada personaje pueden contener intervalos concurrentes con otros personajes.

- Cuando haya solapamientos, el SRT combinado podrá optar por una representación normalizada por cue o una salida WebVTT más expresiva; documentar el criterio y validar la experiencia real de reproducción.

- Una pausa sin diálogo puede ser intencionada; se registra como acción/beat con propósito, no como espacio muerto para extender el vídeo.

- La pista localizada debe durar exactamente lo mismo que el máster de vídeo. Si una frase no cabe, corregir traducción/prosodia o el montaje ANTES de publicar, nunca truncar sin aviso.

- Todo texto usado para generar SRT o locución se guarda asociado a su locale y versión.

- La cronología se congela con un timelineRevision; cualquier cambio material crea nueva revisión.

#### 7.4 Archivos de subtítulos

Por idioma: vera.srt, leo.srt, combined.srt; opcionalmente captions.vtt y transcripción accesible. Los archivos individuales solo incluyen réplicas del personaje asignado y preservan el origen absoluto de los timecodes (no rebasar a 00:00 por personaje). Se usarán códigos de idioma BCP 47; los nombres técnicos no implican género ni idioma. Los subtítulos no deben incluir nombres de hablante duplicados de forma artificial en cada línea, salvo cuando mejore la accesibilidad del combined.

#### 7.5 Contract tests

- Serialización/deserialización sin pérdida de IDs ni tiempos.

- Esquemas versionados y rechazo de campos/acciones incompatibles.

- Precisión de tiempos al pasar de ms a frames y viceversa.

- Referencias a assets válidas; detectar ID inexistente, versión incorrecta y rutas peligrosas.

- Exportación SRT en orden correcto y hh:mm:ss,mmm válido.

- Solapamiento deliberado válido y solapamiento accidental advertido.

- Compatibilidad del episodio antiguo al actualizar el motor; migrar o bloquear con error explícito, no modificar silenciosamente.

### 8. Sistema visual, animación y compositor

#### 8.1 Arquitectura del render

SceneScript → Validated ScenePlan → AnimationIR → RendererAdapter → FrameSequence / MP4.

AnimationIR captura operaciones semánticas: personaje entra, se sienta, mira objeto, mueve cejas, señala, se encoge, pausa; también cámara, z-order, transiciones y easing. La implementación concretará primitivas renderizables, sin meter código específico de Remotion en los modelos de negocio.

#### 8.2 Catálogo mínimo de acciones

| Familia | Operaciones P0 | Futuro |
| --- | --- | --- |
| Presencia | enter, exit, placeAt, idle | Trayectorias complejas |
| Mirada y cara | lookAt, blink, setExpression, speak | Lip-sync fonético |
| Cuerpo | gesture, nod, shakeHead, sit, stand | Manipulación con cinemática avanzada |
| Props | hold, release, pointAt, showProp, hideProp | Física o animación específica de objeto |
| Cámara | cutTo, holdShot, pushIn, panTo, reactionShot | Cámaras de trayectoria avanzadas |
| Tiempo | pause, beat, anticipation, reactionDelay | Curvas dramáticas generadas por análisis de voz |
| Escena | switchSet, setLighting, transition | Parallax complejo |

Cada acción define precondiciones, rangos, duración recomendada y límites de combinación. Un LLM que solicite flyAway() debe recibir «unknown action», no causar ejecución inesperada. Las acciones que no se puedan ejecutar se sustituyen únicamente si existe alternativa semánticamente equivalente aprobada por reglas; el sistema registra degradación visual.

#### 8.3 Capas y escena

Orden general: fondo → muebles traseros → personajes y props → muebles delanteros → efectos gráficos → safe-area / previsualizaciones internas. Utilizar anclajes de personaje y zonas de colisión simplificadas. Las referencias de profundidad y oclusión importan incluso en 2D ligero.

#### 8.4 Determinismo

Mismos insumos + mismas versiones de motor, assets, fuentes y configuración → salida visual equivalente. Semillas pseudoaleatorias controladas por episodio para parpadeos o microvariaciones. Prohibido depender de fecha/hora o fuentes externas en el render, salvo que formen parte del manifiesto.

#### 8.5 Rendimiento y renderizado

- Render principal CPU/Chromium o motor elegido; medir coste de frames reales antes de optimizar GPU.

- Control de concurrencia por CPU/RAM y por capacidad de TTS; configuración, no número fijo inmutable.

- Caché de sprites y recursos, no recrear SVGs costosos innecesariamente por frame.

- Modo preview de menor resolución y segmento corto; modo final 1080p.

- FFprobe debe verificar códec, resolución, frame rate, duración y pistas.

- La codificación propuesta: MP4/H.264 con píxel compatible (yuv420p) y audio AAC cuando exista. Verificar reproductores destino antes de fijar parámetros.

- No prometer tiempo de render ni euros por episodio antes de un benchmark en el ordenador real.

#### 8.6 Comparativa: Remotion vs Motion Canvas

| Criterio | Remotion | Motion Canvas |
| --- | --- | --- |
| Enfoque | React y composición por frames | Animación programática basada en TypeScript |
| Fortalezas | Ecosistema React, composición vídeo, tooling y ejemplos | Control detallado de animación 2D, enfoque de escenas |
| Coste inicial | Gratis para operadores elegibles según términos actuales | Código bajo MIT, sujeto a licencias de dependencias |
| Riesgo de licencia | Condiciones propias; no promete gratuidad para cualquier escala | MIT permite uso/modificación comercial de la versión recibida |
| Complejidad de rigs | Se implementa encima del runtime React | Se implementa en escena/timeline del motor |
| Cambio de motor | Reescribir adaptador y parte de biblioteca visual | Reescribir adaptador y parte de biblioteca visual |
| Recomendación | Candidato inicial, condicionado a benchmark y licencia | Candidato de continuidad si se exige MIT como requisito absoluto |

Posicionamiento: Remotion probablemente ofrece menor tiempo de arranque al aprovechar React/TypeScript, pero la preocupación explícita por «gratis para siempre» merece una prueba comparativa acotada de Motion Canvas, antes de desarrollar una gran biblioteca de personajes. Ninguna abstracción elimina por completo el coste de migración de un motor; el objetivo es limitarlo.

Prueba de selección (obligatoria en Fase 0/1): animar 20–30 segundos con ambos personajes, gestos y cortes de cámara, exportar MP4, medir calidad visible, dificultad, FPS, consumo y complejidad de extensión. Validar compatibilidad real de Windows y licencias instaladas. Elegir uno, no mantener dos motores en paralelo en el MVP.

Licencia Remotion (VERIFIED a 11/11/2026): uso comercial y automatizado gratuito para individuos y pequeñas organizaciones elegibles de hasta tres personas, sujeto a condiciones. El cómputo de personal y colaboradores depende de la relación contractual y de quién opera el código. Para organizaciones no elegibles, las opciones y tarifas son las publicadas por Remotion; no extrapolar una cifra a cualquier render o supuesto. No se puede prometer gratuidad incondicional de versiones futuras. Fuentes: licencia y precios, FAQ, términos.
Motion Canvas (VERIFIED): repositorio principal con licencia MIT, sin garantía de mantenimiento futuro ni de que todas las dependencias tengan exactamente la misma licencia.

### 9. Voz, localización y mezcla audiovisual

#### 9.1 Objetivo de doblaje

Construir un solo lenguaje visual que tolere diferentes duraciones naturales de frase sin fingir sincronía labial exacta. Evitar chistes cuya comprensión dependa de alinear sílabas con una boca específica. Una pausa dramática puede y debe mantenerse en todos los idiomas, aunque los textos cambien.

#### 9.2 Motor de voz

SpeechProvider con capacidades: listar voces e idiomas, sintetizar clip, reportar duración/sample-rate, fijar parámetros estables, versionar modelo y voice ID. El proveedor puede ser local o API; la primera opción es local-first. Kokoro es candidato por pesos Apache 2.0 y ligereza, no garantía de naturalidad o equivalencia de calidad en español/inglés; la elección final requiere escuchar decenas de diálogos y confirmar compatibilidad con Windows/hardware real. Fuente: Kokoro-82M.

Voz de personaje: characterId + locale -> voiceProfile, con id, versión de modelo, configuración, velocidad base, estilo y hashes. Evitar cambiar de timbre arbitrariamente entre episodios. Mantener variaciones de emoción sin clonación de voces reales sin consentimiento.

#### 9.3 Sincronización por líneas

- Extraer DialogueLine fuente y generar voz de referencia.

- Medir longitud real y determinar beat/pause y ventanas válidas.

- Congelar el timeline.json maestro.

- Traducir contextualizando chiste, no palabra por palabra.

- Sintetizar clip localizado y medir duración.

- Si excede la ventana: simplificar texto, reescribir remate conservando sentido, revisar pronunciación, o aplicar corrección moderada de velocidad con umbral configurable.

- Prohibido descartar palabras, cortar final de clips o acelerar hasta producir artefactos notorios.

- Generar un SpeechFitReport por personaje, idioma y línea, con incidencias auditables.

La suma de duraciones por personaje no sustituye la duración absoluta. Las pistas deben respetar los offsets y silencios reales del episodio.

#### 9.4 Mezcla

Pistas internas: dialogue_{locale}, sfx_master, music_master, full_mix_{locale}. Música y efectos universales se generan una vez; cada idioma reutiliza esos stems. Controlar ruido, clipping, inteligibilidad y balance. Como objetivo provisional, volumen de voz inteligible y peak seguro sin imponer erróneamente un valor de LUFS como «requisito YouTube». Los límites concretos se validan con escucha y medidores según destino.

Idioma de origen también produce pista final audible, aunque se conserve un silent.mp4 maestro para reutilización. Los MP4 localizados son derivados opcionales; cuando YouTube permita audio multilingüe, la estrategia preferente es subir máster con pista base y añadir las demás pistas al mismo vídeo.

#### 9.5 Textos en pantalla

Preferir utilería sin texto esencial, pictogramas originales y composición semántica. Si es inevitable mostrar texto (pantalla de móvil, lista de la compra), tratarlo como un localizableGraphic con variantes, lo que rompe parcialmente el ideal de un único vídeo común; documentar la excepción y su coste. No depender de que los espectadores activen subtítulos para entender el gag principal.

#### 9.6 Pruebas de voz

- Pronunciación de nombres, siglas, números y modismos.

- Consistencia del timbre entre clips.

- Ausencia de cortes, repeticiones o silencios inesperados.

- Variación prosódica suficiente para humor.

- QA humana en una muestra de cada idioma; no confiar solo en ASR automático.

- Comportamiento con frases solapadas y cambios abruptos de emoción.

### 10. Arquitectura de software y separación de módulos

#### 10.1 Estilo arquitectónico

Monolito modular TypeScript/Node.js para orquestación; React para composición y, más adelante, consola visual. Persistencia SQLite al inicio. Archivos locales para recursos y producciones. Adaptadores para LLM, TTS, almacenamiento externo, motor de render y YouTube. No usar una plataforma SaaS/back-end externo por inercia.

Por qué no .NET como núcleo inicial: el motor de composición y los posibles renderizadores elegidos viven cómodamente en TypeScript; añadir C# como servicio de orquestación duplicaría runtime, empaquetado y debugging. Si la integración futura con una aplicación .NET aporta valor concreto, separar por contrato HTTP/CLI.

#### 10.2 Módulos y propiedad de datos

| Módulo | Responsabilidad | No debe hacer |
| --- | --- | --- |
| show-bible | identidades, assets, reglas de personajes | generar vídeos |
| story | ideas, guiones, crítica, originalidad | dibujar ni publicar |
| episode-planner | escenas, acciones, planificación | ejecutar prompts como código |
| timeline | tiempo, voz fuente, invariantes | conocer APIs de YouTube |
| animation | ScenePlan→IR→motor de render | elegir temas, guardar secretos |
| localization | adaptar texto según timing | modificar máster visual |
| speech | voces, duración, prosodia | alterar identidad de personajes |
| audio | stems, mezcla, verificación | reescribir guiones |
| production | estados, trabajos, idempotencia, invalidación | ser fuente de verdad creativa |
| quality | reglas y evidencias | autoaprobar humor como hecho |
| publishing | paquete, YouTube y metadatos | iniciar publicaciones sin autorización |
| analytics (P1) | datos reales de audiencia y coste | inferir ingresos sin datos |

Acoplamiento permitido: módulos consumen contratos versionados, no tablas internas ni carpetas ajenas. El módulo production puede coordinar pero no asumir lógica de todos los servicios.

#### 10.3 Persistencia

SQLite para estados/jobs, indexación de episodios, referencias a artefactos, configuraciones y registro de licencias. No guardar binarios multimedia pesados dentro de la base de datos. Filesystem para MP4/WAV/SVG/JSON; hashes de contenido y rutas relativas al workspace. Operaciones de base de datos transaccionales en cambios de estado.

#### 10.4 Infraestructura operativa

- Windows local con CLI (studio create, studio render, studio localize, studio validate, studio package, studio status) como primera experiencia del operador.

- Render final en un proceso separado, con límite de concurrencia y timeouts controlados.

- TTS con worker local y manejo de interrupciones.

- Mini UI de revisión en P1; no construir front de control antes de tener escenas animadas convincentes.

- Google Drive opcional para archivo posterior, con estrategia de copia y limpieza segura.

- Autenticación: innecesaria para CLI exclusivamente local monooperador; necesaria si la UI se expone por red.

#### 10.5 Observabilidad

Logs estructurados por episodeId, jobId, phase, duración, versión y causa de fallo. Métricas: tiempo por etapa, fallos por tipo, reintentos, tamaño de archivos, errores de sincronía, tiempo de render y coste LLM/TTS. No almacenar secretos ni transcripciones privadas en logs de soporte externos.

#### 10.6 Reproducibilidad

Versionar: contrato, assets, fuentes, modelos y voces, prompt maestro, motor, FFmpeg, parámetros del render y seed. El manifiesto permite localizar inputs exactos. No prometer bit-identidad entre GPUs/encoders distintos; exigir equivalencia visual/técnica y trazabilidad.

### 11. IA: alcance, controles y ausencia deliberada de agentes innecesarios

IA requerida: ideación, outline, guion, variación de chistes, estructuración de escenas, adaptación cultural, evaluación semántica y quizá generación puntual de nuevos assets bajo revisión.
Algoritmos deterministas: validación de contratos, cálculo de frames, render de acciones conocidas, exportación SRT, mezcla, FFprobe, nombres/rutas, estado transaccional, publicación, presupuestos y derechos.
IA opcional: evaluación editorial complementaria, ASR de escucha, propuestas de miniatura; ninguna sustituye controles técnicos o revisión humana.

#### 11.1 Integración LLM

LLMProvider configurable con capacidades, coste conocido cuando se pueda medir, contexto y modelo. Prompts versionados por tarea y salida JSON validada con Zod/JSON Schema. Reintentar con mensajes de error concretos en vez de regenerar el episodio completo. Guardar solo la información necesaria para reproducir y auditar la creación; proteger claves y datos sensibles.

No comprometer el producto a un proveedor de IA. Introducir caché por hash de entrada. Presupuesto máximo y límite de iteraciones por episodio y por fase; disparar BUDGET_BLOCKED ante exceso de límite.

#### 11.2 Originalidad y límites del evaluador

No se utilizará una puntuación «viral» inventada como criterio automático. El LLM puede analizar estructura y detectar similitudes con episodios propios, pero no puede garantizar ausencia de plagio, gracia o cumplimiento de monetización. Los primeros episodios se aprueban editorialmente por una persona.

#### 11.3 Gobernanza de prompts

Versionar premise, script, critique, storyboard, localization y metadata. Cada prompt explica contrato, constraints, ejemplos originales, acciones permitidas y errores esperables. Prohibido que el LLM «invente» assets, comandos, integraciones o voces no registradas.

### 12. Estructura de archivos y ciclo de vida de los artefactos

```text
SitcomStudio/
├── docs/
│   ├── master-blueprint.md
│   ├── decisions/
│   ├── contracts/
│   └── runbooks/
├── show/
│   ├── show-bible.json
│   ├── characters/
│   │   ├── vera/
│   │   └── leo/
│   ├── sets/
│   │   ├── living-room/
│   │   ├── kitchen/
│   │   └── bedroom/
│   ├── props/
│   └── audio-assets/
├── src/
│   ├── domain/
│   ├── story/
│   ├── episode-planner/
│   ├── timeline/
│   ├── animation/
│   ├── localization/
│   ├── speech/
│   ├── audio/
│   ├── production/
│   ├── quality/
│   └── publishing/
├── productions/
│   └── 2026/11/EP0001/
│       ├── manifest.json
│       ├── episode.json
│       ├── script.json
│       ├── timeline.json
│       ├── master/
│       │   ├── silent.mp4
│       │   ├── sfx.wav
│       │   └── music.wav
│       ├── locales/
│       │   ├── es-ES/
│       │   │   ├── vera.srt
│       │   │   ├── leo.srt
│       │   │   ├── combined.srt
│       │   │   ├── dialogue.wav
│       │   │   ├── full_audio.wav
│       │   │   └── final.mp4
│       │   └── en-US/
│       ├── thumbnails/
│       ├── previews/
│       ├── reports/
│       └── publication/
└── workspace/
    ├── cache/
    ├── temp/
    └── logs/
```

#### 12.1 Reglas de almacenamiento

- productions/ contiene entregables y manifest versionado; workspace/temp son intermedios descartables.

- No borrar ni sobrescribir un archivo validado sin backup y nueva revisión.

- Separar maestros, audios, metadatos y resultados derivados para evitar render redundante.

- Cifras de almacenamiento se medirán con episodios reales; no dimensionar a ciegas.

- Subidas de Drive con uploadSession, hash, tamaño y comprobación posterior; subida exitosa no implica publicación correcta en YouTube.

#### 12.2 Retención y limpieza

Tras confirmar subida y publicación, NO borrar automáticamente el único máster o los contratos fuente. Mantener, al menos, una copia íntegra y recuperable del proyecto de episodio y otra copia de seguridad independiente cuando sea posible. Se puede limpiar caché regenerable según política y monitorizar disco. La eliminación por cuotas de Drive se implementará después de verificar integridad y retención; no condicionar la seguridad de datos a un upload succeeded aislado.

### 13. Cola de producción y ejecución recuperable

#### 13.1 Scheduler

- Cola inicial SQLite con estados y prioridades.

- Operaciones idempotentes con jobKey = (episodeId, stage, locale, inputHash).

- lease/propietario de trabajo para impedir doble render concurrente.

- Persistir checkpoints al finalizar cada fase y antes de cualquier side effect externo.

- Reintentos con backoff y límite; distinguir error transitorio de error de contrato.

- Criterio de cancelación sin corromper archivos validados.

- Concurrencia configurable por disponibilidad real; CPU/render y TTS pueden competir por recursos.

#### 13.2 Ejecución manual y automática

Inicio: manual desde CLI.
Después del MVP: calendario interno para generar nuevos episodios al ritmo que se demuestre sostenible; permitir backlog de premisas aprobadas.
Publicación: trabajo aparte y solo con permisos y aprobación. No asumir que publicar más equivale a crecer más.

#### 13.3 Errores operativos y degradación

| Incidencia | Comportamiento requerido |
| --- | --- |
| LLM JSON inválido | Mostrar violación de esquema y reparar salida acotada |
| Asset no existe | Bloquear escena o elegir sustituto permitido con registro |
| TTS falla en inglés | Mantener español; en-US en estado de fallo recuperable |
| Audio desborda ventana | Reescribir/adaptar esa línea y regenerar clip |
| FFmpeg interrumpido | Mantener archivos temporales aislados y reintentar render seguro |
| Disco insuficiente | Preflight y BLOCKED, nunca truncar master |
| Subida YouTube duplicada | Consultar estado/id remoto antes de reintentar |
| Permiso OAuth revocado | Bloquear publicación y solicitar intervención humana |
| Error de licencia | Bloquear uso del componente no autorizado |
| Episodio aburrido | EDITORIAL_REJECTED; no confundir con error técnico |

### 14. Requisitos no funcionales y seguridad

#### 14.1 Calidad de salida

Objetivo inicial (PROPOSED): 16:9 1080p a 30 FPS, MP4/H.264, audio estándar de distribución, sin subtítulos quemados, duración final 480–600 s. Estos son targets de producto a verificar contra rendimiento y compatibilidad; el vertical slice inicial será 60–90 s. Los capítulos deben reproducirse en escritorio y móvil sin artefactos graves.

#### 14.2 Seguridad técnica

- LLM no ejecuta código, comandos ni rutas directamente.

- Directorios de salida dentro de root permitido; validar y normalizar rutas.

- Ejecutar herramientas externas con argumentos estructurados y tiempo de espera, no interpolando comandos arbitrarios en shell.

- Credenciales en secreto local/gestor seguro, nunca en JSON/MP4/logs.

- Acceso mínimo OAuth para YouTube; tokens protegidos y rotados.

- Comprobación de permisos efectivos antes de modificar archivos, llamar proveedores o publicar.

- Mantener registros de procedencia de voces, recursos, fuentes y software.

- Si se expone una UI por red: autenticación, autorización, CSRF cuando aplique, protección de endpoints de publicación y límites de request.

#### 14.3 Derechos y licencias

Distinguir licencia del motor de licencia de los materiales. Un motor gratuito no da derechos automáticos sobre música, voces, assets, fuentes o personajes de terceros. Recursos preferidos: originales, propios o licencias comerciales compatibles y archivadas. No clonar voces reales sin permiso. Documentar si el material de entrenamiento/resultado de generadores externos permite uso comercial, según sus términos aplicables.

#### 14.4 Privacidad

El MVP no necesita perfiles de espectadores ni almacenar datos personales. Las analíticas futuras se agregan cuando sea viable; aplicar minimización de datos, protección de tokens y normativa correspondiente si se introducen usuarios o telemetría identificable.

#### 14.5 Operación y disponibilidad

No asumir alta disponibilidad 24/7: el proceso se ejecuta en equipo propio. Sí exigir tolerancia a interrupciones, colas recuperables, logs y evidencia. La disponibilidad exigida se revisará cuando exista calendario de publicación estable.

#### 14.6 Backups y recuperación

Guardar la Show Bible, assets originales, configuración, esquemas, manifest y base de datos operativa. Ensayar restauración de un episodio desde artefactos versionados antes de borrar nada. Un backup no validado es solo una copia supuesta.

#### 14.7 Rendimiento medible

Registrar tiempo real de render por minuto final, latencia y velocidad del TTS, coste LLM por guion, número de regeneraciones, RAM/CPU/GPU/disco. Definir umbrales cuantitativos después de los primeros benchmarks, no inventarlos en esta fase.

### 15. Experiencia de gestión interna: operador único

#### 15.1 MVP: interfaz CLI operativa

Comandos orientativos (nombre final revisable):

```text
studio doctor
studio show validate
studio episode new --premise "El cajón de todo"
studio episode plan EP0001
studio episode preview EP0001 --scene SC001
studio episode render EP0001
studio episode localize EP0001 --locale en-US
studio episode validate EP0001
studio episode package EP0001
studio episode status EP0001
```

Cada comando debe responder con estado claro, rutas existentes y fallos accionables. Si el entorno no soporta ejecución de vídeo, no marcar COMPLETE por tener documentación o scripts.

#### 15.2 Consola visual (P1, cuando el pipeline ya funcione)

Navegación propuesta: Producciones, Episodios, Biblioteca creativa, Personajes y decorados, Voces e idiomas, Calidad, Publicaciones, Configuración. Sin panel de «estadísticas» vacío ni exceso de tarjetas.

Pantalla Producciones: filas compactas con episodio, estado real, última etapa, duración, idiomas, bloqueos, coste estimado/medido y acceso a reanudar.
Detalle de episodio: tabs de Guion, Escenas, Animación, Audio, SRT, QA, Publicación; preview sincronizada con timeline; regenerar solo el segmento afectado.
Biblioteca: versiones de characters/props/set y compatibilidad; un cambio visual debe mostrar qué renders invalida.
QA: errores bloqueantes arriba, warnings abajo, evidencia reproducible.
Publicación: diff de título, descripción, miniatura e idiomas; botón de publicar deshabilitado sin aprobación.

Estados UX obligatorios: vacío, procesando con progreso por etapa (no porcentaje inventado), parcialmente listo (idioma faltante), fallo recuperable, bloqueo de licencia, sin permisos, sin espacio, aprobado, publicado, archivado.

#### 15.3 Autonomía y autoridad

El operador decide branding final, nivel de humor, cambios de mercado, presupuesto máximo, incorporación de proveedores de pago y permiso de publicar. Los agentes deciden detalles de implementación, validación, pruebas y optimización dentro de las restricciones. La ausencia de respuesta no equivale a autorización de publicación ni compras.

### 16. YouTube: publicación, cumplimiento, idiomas y descubrimiento

#### 16.1 Estrategia de canal

Propuesta: un canal principal con una marca coherente y un vídeo por episodio; utilizar las funciones de audio multilingüe cuando el canal disponga de ellas. Esto concentra métricas, comentarios, enlaces y catálogo. No es una garantía de que YouTube distribuya igual todos los idiomas; la audiencia real decidirá si en el futuro conviene separar mercados.

#### 16.2 Condiciones de monetización verificadas

- YouTube indica que el contenido original con tramas distintas, aunque reutilice personajes y formato, puede ser monetizable; el contenido producido en masa con diferencias mínimas o apariencia de plantilla puede no ser elegible. La evaluación puede abarcar el canal en su conjunto. Fuente: políticas oficiales de monetización.

- Para ingresos publicitarios completos, el YPP indica como ruta habitual 1.000 suscriptores y 4.000 horas públicas válidas en los últimos 12 meses, o la alternativa de Shorts vigente; también existen umbrales menores de acceso a ciertas funciones de apoyo de fans. Cumplir cifras no evita la revisión del canal. Fuente: opciones YPP.

- La animación estilizada no exige por sí misma divulgar contenido sintético realista, según la política oficial consultada; revisar cada caso si se incorporan personas reales, imitaciones o escenas fotorrealistas. Fuente: información oficial sobre contenido alterado/sintético.

#### 16.3 Audio multilingüe y límite API

YouTube documenta la subida de pistas dobladas desde YouTube Studio y señala disponibilidad condicionada al acceso a funciones avanzadas del creador. No confundir con el doblaje automático de YouTube. Referencia: funciones multilingües.

La API pública videos.insert ofrece subida del vídeo, metadatos y localizaciones, pero la documentación consultada no establece un método público general para adjuntar arbitrariamente múltiples pistas de audio dobladas. No introducir automatizaciones basadas en endpoints no documentados o scraping frágil. Entregar audios listos, con nombres, idioma, duración y guía de subida manual mientras no se verifique vía oficial automatizable.

#### 16.4 Subida programada

El adaptador YouTube debe usar OAuth oficial y las operaciones documentadas. La API admite videos.insert, localizaciones, status.publishAt sujeto a condiciones, y miniaturas mediante thumbnails.set. Definir explícitamente privacyStatus=private al probar o subir borradores: desde el cambio documentado en noviembre de 2026, no se debe asumir que cargas API de proyectos no verificados quedan privadas por defecto. Referencias: videos.insert, historial de API, thumbnails.set.

Regla de seguridad: nunca subir como public por omisión de parámetros. La programación solo se habilita tras verificar canal, permisos, comportamiento y estado remoto. Registrar videoId y reconsultarlo para reintentos idempotentes.

#### 16.5 Packaging de episodio

Artefactos recomendados:

- final_es-ES.mp4 de referencia.

- silent.mp4 y stems de mezcla.

- Audio en-US y otros como archivos de duración exactamente coincidente.

- SRT individual por personaje y SRT combinado por idioma.

- Títulos y descripciones adaptados culturalmente.

- Miniatura original y variantes localizadas si se necesitan.

- Metadatos: descripción del episodio, carácter original, colaboradores relevantes, licencias cuando proceda y clasificación de audiencia adecuada.

- publication.json con estado remoto, fecha programada, ID del vídeo y evidencias de verificación.

#### 16.6 Categoría y clasificación

No forzar la categoría «Ciencia y tecnología» por utilizar IA o motion graphics: el producto es entretenimiento de ficción. Comprobar las categorías vigentes al publicar y elegir la más adecuada. Animación no significa contenido creado para niños: evaluar el público real, el tono y las políticas de «Made for Kids» caso a caso; no usar una clasificación incorrecta para buscar ingresos mayores.

#### 16.7 Cadencia inicial

PROPOSED: dos episodios por semana durante un piloto de seis episodios, modificable según calidad y métricas reales. No programar 24 episodios/día porque el motor sea capaz de generarlos. La producción en volumen es una opción posterior, no el plan de adquisición por defecto.

#### 16.8 Títulos y miniaturas

Una premisa reconocible debe poder expresarse en una frase atractiva sin prometer algo que no ocurre. En miniaturas, preferir interacción visual y emoción clara, no una composición sobrecargada de texto; generar desde el mismo kit gráfico para mantener marca. A/B tests solo donde haya herramientas y muestra suficiente; no considerar porcentajes pequeños como prueba estadística sin tamaño y contexto.

### 17. Negocio, unidad económica y métricas

#### 17.1 Modelo principal

Ingresos de anuncios en vídeos largos y reparto de YouTube Premium tras aceptación en YPP. De forma secundaria y futura: patrocinios compatibles con el tono, miembros o productos de la marca si aparece demanda. No diseñar pagos, tienda o membresías antes de que exista una audiencia significativa.

#### 17.2 Coste real por episodio

Fórmula operativa:

CostPerEpisode = LLM + TTS(base + locales) + Rendering(compute + energy) + Storage + Bandwidth + Assets/Licenses + Rework + EditorialLabor + OperationalOverhead

Registrar siempre:

- Coste de cada inferencia y reintento LLM.

- Generación TTS por carácter/idioma/segundo de audio.

- Segundos reales de render por segundo de vídeo y uso de máquina.

- Tiempo de supervisión humana.

- Coste de almacenamiento de maestros, clips y respaldos.

- Fallos que obligan a rerender.

- Licencia de motor aplicable según tamaño y modo de operación.

No atribuir coste cero a un render local: el tiempo de máquina, electricidad, almacenamiento y mantenimiento tienen coste económico, aunque no exista factura por render del proveedor.

#### 17.3 Ingresos y escenarios

Revenue = (MonetizedViews/1000) × RealizedRPM × EligibleShareFactors solo como ilustración matemática general: en la práctica el RPM de YouTube ya refleja diferentes factores de monetización según su definición; por tanto, para simulaciones simples utilizar Views/1000 × ObservedRPM sin contar dos veces factores incluidos. El RPM variará por país, audiencia, formato, estacionalidad y situación de canal. No inventar un RPM español ni inglés para este tipo de serie. Las simulaciones deberán mostrar claramente las hipótesis y sensibilidad a cero ingresos.

Indicadores de viabilidad: coste total de producir un episodio; número de visualizaciones requeridas para recuperar ese coste bajo RPM observado; tiempo humano por episodio; coste incremental de cada idioma; ingresos incrementales atribuibles al doblaje cuando sea medible.

#### 17.4 Embudo editorial y de negocio

- Descubrimiento: impresiones, CTR, fuentes de tráfico, espectadores nuevos.

- Consumo: duración media, retención por momento, finalización y navegación a siguiente episodio.

- Fidelidad: espectadores recurrentes, sesiones y consumo de catálogo, suscripciones genuinas.

- Localización: visualizaciones/reproducciones por pista de idioma cuando la analítica lo permita, satisfacción del doblaje, incidencia de fallos.

- Producción: episodios aprobados frente a generados, revisiones por episodio, coste por minuto útil, coste por episodio publicado.

- Ingresos: RPM real si monetizado, ingresos netos estimados y sostenibilidad de coste.

No medir éxito por horas de vídeo fabricadas. El crecimiento de catálogo solo beneficia si genera consumo real y retención.

#### 17.5 Experimento piloto

Crear seis episodios con conflictos y estructuras diferentes, publicar con cadencia razonable y observar datos antes de escalar. El piloto debe producir un informe con tres posibles decisiones:

- Scale: hay demanda verificable, calidad aceptable y economía ajustable.

- Iterate: hay señales parciales; cambiar duración, humor, dirección visual, voz o miniaturas.

- Stop/Pivot: el formato no despierta consumo recurrente o requiere tal intervención que pierde sentido económico.

No establecer umbrales rígidos de CTR/retención universales antes de tener el tamaño de muestra y baseline reales. Sí establecer criterios de calidad técnica obligatorios, independientes de la audiencia.

### 18. Pruebas, validación y Quality Gates

#### 18.1 Dos capas independientes

Technical QA (automático y objetivo): esquema correcto, assets, tiempos, coherencia de tracks, archivos reproducibles, codecs, duración, clipping, integridad, licencia y procedencia.
Editorial QA (automático asistido + revisión humana inicial): calidad de chistes, claridad dramática, personalidad, variedad visual, autenticidad, adaptación cultural y riesgo de similitud.

La aprobación de uno no sustituye al otro.

#### 18.2 Pruebas unitarias

Contratos, validadores de tiempo, SRT por personaje, escaping, BCP 47, hashing, gestión de secuencias, rutas, stems, mapeo de voces, estados, límites de presupuesto, idempotencia y autorización de publicación.

#### 18.3 Pruebas de integración

- ScenePlan JSON real → composiciones → segmento MP4.

- Audio TTS de prueba → duración medida → alineación → stem final.

- Dos personajes con líneas consecutivas y solapadas → SRT separados y combined válido.

- Fallo de render a mitad → checkpoint → retry sin duplicar archivos finales.

- Cambio de texto inglés → regeneración localizada sin rerender del máster.

- FFprobe real sobre contenido generado, nunca metadatos simulados.

#### 18.4 Pruebas E2E por fase

F1: 60–90 s, dos personajes, al menos dos encuadres, gestos, SRT independientes, render real.
F2: episodio 8–10 min que se sostiene argumentalmente y tiene variedad de escenas.
F3: idioma fuente + un doblaje, audios coinciden en duración, sin voz truncada.
F4: tres producciones seguidas y recuperables después de corte simulado.
F5: carga de prueba con privacidad explícita y evidencia de estado.
F6: seis episodios publicados y revisión cuantitativa/cualitativa.

#### 18.5 Criterios de aceptación técnicos absolutos

- Ninguna dependencia inexistente da paso a render.

- Ningún output vacío o corrupto se marca completo.

- Ninguna frase se trunca silenciosamente.

- No hay cambios de personajes/estilo no autorizados.

- El vídeo maestro conserva duración única entre idiomas.

- Los SRT de personaje contienen únicamente sus líneas.

- Se puede recuperar un trabajo después de reiniciar la máquina.

- No existe publicación remota sin acción/permiso habilitante explícito.

- La eliminación solo aplica a archivos temporales autorizados o copias con retención verificada.

#### 18.6 Evidencia de QA

quality-report.json debe incluir checks, resultado, severidad, links/rutas de muestras, versiones y excepciones aprobadas. Para revisiones creativas, almacenar notas breves y específicas, no un score inventado que parezca objetivo.

### 19. Roadmap de implementación y dependencias

La ejecución se orientará a vertical slices verificables, no a «construir toda la plataforma» en una sola fase. Un agente solo recibe la siguiente fase coherente. F0 y F1 pueden compartir parte de la investigación; no se debe construir masivamente la biblioteca antes de aprobar una prueba artística.

#### Fase 0 — Validación creativa, licencia y benchmark tecnológico

Objetivo: decidir con evidencias el aspecto inicial y el renderer antes de producir deuda estructural.

Dependencias: ninguna.
Acciones: diseñar dos siluetas originales; un salón y dos variantes de plano; generar pruebas de actuación de 20–30 segundos con Remotion y Motion Canvas cuando resulte viable; medir render, esfuerzo, compatibilidad Windows y condiciones de licencia; comparar lenguaje de cámara, gestos y expresividad. Establecer los tokens visuales y las voces de prueba como decisiones provisionales.
Entregables: decisión ADR sobre motor, art direction v0.1, fixtures básicos de personajes y benchmark reproducible.
Aceptación: vídeo visualmente comparable generado por los candidatos o explicación verificable de imposibilidad; decisión razonada (uno seleccionado); identidad suficiente para iniciar F1.
Riesgo a evitar: comenzar con un motor cuya licencia o pipeline no se ha medido.

#### Fase 1 — Núcleo audiovisual funcional

Objetivo: producir un fragmento real que parezca una conversación animada, no una slide.

Dependencias: decisión F0.
Acciones: estructura TS; contrato SceneScript, AnimationIR y timeline; dos rigs iniciales y un salón; 8–12 acciones reutilizables; cámaras y expresiones; exportación SRT; render 60–90 s; pruebas.
Entregables: MP4 horizontal, vera.srt, leo.srt, combined.srt, manifiesto, comandos reproducibles, test suite.
Aceptación: FFprobe real confirma dimensiones y duración; personajes mantienen identidad en cambios de plano; las frases/subtítulos se corresponden con timeline; tests ejecutados.
Lo que NO toca: TTS final, 10 minutos completos, YouTube, SaaS, gestión de muchos idiomas.

#### Fase 2 — Guion autónomo y primer episodio de 8–10 minutos

Objetivo: pasar de un clip escrito manualmente a una historia completa generada y dirigida por sistema.

Dependencias: F1 aprobada visual y técnicamente.
Acciones: Show Bible v1, StoryEngine, editorial check, registro de premisas, EpisodePlanner, catálogo más amplio, cocina y dormitorio, dirección de múltiples escenas, guion coherente y duración real.
Entregables: episodio completo silencioso y subtítulos de origen, storyboard y QA de estructura.
Aceptación: 480–600 s reales, historia autónoma reconocible, acciones válidas, personajes estables, variedad visual evaluada humanamente.
Lo que NO toca: autopublicar o multiplicar producción.

#### Fase 3 — Voces, audio multilingüe y sincronización

Objetivo: entregar el primer episodio completo audible en español e inglés usando un render maestro.

Dependencias: F2 y motores TTS compatibles probados.
Acciones: SpeechProvider, audio fuente antes de freeze en producciones nuevas, versionado de voces, traducción cultural, SpeechFitReport, SRT localizado, mixing con stems, MP4 finales, QA de tiempo y escucha.
Entregables: episodio final es-ES, en-US, audio por personaje, SRTs, report de sincronía.
Aceptación: no se ha modificado máster para cambiar idioma; audio fluido, sin truncamientos; misma duración visual; TTS comprobado en entorno real.
Riesgo: comedia pierde fuerza en inglés; no considerar completado solo por generar ficheros.

#### Fase 4 — Orquestación y autonomía de producción

Objetivo: producir episodios sucesivos y recuperables con presupuestos y calidad controlados.

Dependencias: F3.
Acciones: SQLite/jobs, checkpoints, reintentos selectivos, límites, logs, registro de originales, autocontrol técnico, empaquetado, backup y previsualizaciones.
Entregables: cola autónoma local y tres episodios consecutivos procesados.
Aceptación: apagar/reanudar sin duplicados; tres outputs técnicamente completos; coste real y problemas visibles; rechazo editorial posible.
Lo que NO toca: distribuir por defecto sin autorización.

#### Fase 5 — YouTube, metadatos, distribución y medición

Objetivo: transformar un paquete aprobado en una publicación trazable y segura.

Dependencias: F4; OAuth con permisos efectivos; revisión de políticas y API actual.
Acciones: PublishingAdapter, subida de prueba privada explícita, programación, títulos/localizaciones y miniaturas, tracking de ID, recuperación de fallos. Pistas multilingües mediante YouTube Studio si no existe API pública compatible.
Entregables: vídeo de prueba verificable, paquete de pistas preparado, registro de publicación y guía operativa.
Aceptación: permiso real, sin duplicados, metadatos correctos, test de private y comportamiento de scheduling; sin prometer automatización de pistas no soportada.
Riesgo: cuotas o permisos del canal; deben gestionarse como bloqueos observables.

#### Fase 6 — Piloto editorial y validación de negocio

Objetivo: decidir si acelerar producción o cambiar formato.

Dependencias: F5 y editorial quality gate.
Acciones: producir seis episodios creativamente distintos; publicarlos progresivamente; revisar títulos y miniaturas; medir retención, consumo repetido, problemas de doblaje, coste y tiempo de supervisión.
Entregables: catálogo piloto e informe go/iterate/stop con evidencias.
Aceptación: seis episodios con calidad aprobada, datos reales, recomendaciones priorizadas y decisión explícita de siguiente escala.
Lo que NO toca: declarar éxito económico por superar métricas técnicas.

#### 19.1 Dependencias entre fases

```text
[F0 Estética + licencias + benchmark]
                 |
                 v
       [F1 Clip animado real]
                 |
                 v
       [F2 Episodio completo]
                 |
                 v
       [F3 Doblaje + mezcla]
                 |
                 v
       [F4 Cola + QA + costes]
                 |
                 v
       [F5 YouTube controlado]
                 |
                 v
       [F6 Piloto comercial]
```

Ruta crítica: estética aprobada → renderer → escena reproducible → narración completa → timing/voz → automatización → publicación → datos. El orden importa: una mala voz o un mal rig arrastran el defecto a todos los episodios.

#### 19.2 Backlog de alto nivel por capacidades

| Capacidad | Fase | Alcance y dependencias principales |
| --- | --- | --- |
| Identity & Show Bible | F0–F2 | personajes, paleta, personalidad, lenguaje visual |
| Renderer & Actions | F0–F1 | decisión motor, catálogo, timeline, prueba real |
| Story & Editorial Engine | F2 | guiones independientes, variantes, anti-repetición |
| Episode Planner | F2 | guion→acciones visuales, clips escena |
| Audio & Localization | F3 | TTS, voz origen, adaptación, stems, sincronía |
| Production Reliability | F4 | colas, idempotencia, retries, presupuesto |
| Publishing & Compliance | F5 | YouTube, metadatos, audio multilingüe, políticas |
| Business Validation | F6 | piloto, audiencia, unidad económica |

#### 19.3 Evolución post-piloto (P1 / P2)

Solo con señales de demanda: editor timeline, biblioteca secundaria de personajes, escenarios más ricos, un segundo canal o idiomas adicionales, evolución de texturas y fluidez, métricas más precisas. EXCLUDED hasta justificación: multitenancy, marketplace, microservicios, generación física compleja, red de agentes distribuidos y cientos de canales.

### 20. Decisiones formales (ADR/PDR) y compensaciones

#### ADR-001 — Monolito modular con TypeScript

Decisión: ejecutar módulos de producción dentro de un código base TS; DB SQLite y filesystem al inicio.
Pros: menos operaciones, tipos compartidos, menor coste, fácil tests.
Contras: render, IA y persistencia comparten producto; hay que aislar procesos intensivos.
Revisar cuando: producción distribuida o usuarios remotos concurrentes justifiquen infraestructura adicional.
Estado: PROPOSED.

#### ADR-002 — IR independiente del renderer

Decisión: LLM entrega acciones semánticas; compositor traduce a un motor seleccionado.
Pros: seguridad, reproducibilidad, reuso, pruebas, reduce acoplamiento de licencias.
Contras: diseño de catálogo y compilador; migrar motor requerirá adaptar visuales.
Revisar cuando: el coste de mantener IR exceda el valor (evidencia de prototipo).
Estado: PROPOSED.

#### ADR-003 — Remotion candidato, Motion Canvas alternativa MIT

Decisión: elección solo tras benchmark F0; evitar dos engines mantenidos de por vida.
Pros Remotion: composición React y accesibilidad de técnicas web.
Contras Remotion: licencia especial y riesgo en escalado organizativo.
Pros Motion Canvas: MIT y control de animación programática.
Contras Motion Canvas: coste de implementar ciertos recursos de composición y validar export/render.
Revisar cuando: requisito absoluto de MIT, incompatibilidad de hardware o coste de licencia significativo.
Estado: PROPOSED / OPEN hasta F0.

#### ADR-004 — Tiempo canónico desde diálogo medido

Decisión: voz de referencia en idioma fuente antes de freeze visual, y timeline canónico en milisegundos.
Pros: evita render por idioma, SRT fiable, posibilidad de QA de fit.
Contras: obliga a planificar duración antes de animar; cambios posteriores pueden invalidar render.
Revisar cuando: escenas no dialogadas predominan o un método probado reduce reprocesamiento.
Estado: PROPOSED.

#### ADR-005 — Un vídeo multilingüe de YouTube

Decisión: preferir un videoId por capítulo si el canal admite audio multilingüe; preparar audios por idioma aunque deban cargarse manualmente.
Pros: catálogo unificado, métricas, audiencia, evitar duplicados.
Contras: automatización de pistas no verificada públicamente; diferencias culturales limitadas por máster común.
Revisar cuando: habilitación/API insuficiente o evidencia de mercado aconseje canales independientes.
Estado: PROPOSED.

#### ADR-006 — Aprobación humana en el piloto

Decisión: separar TECHNICAL_PASS de EDITORIAL_APPROVED y no autopublicar antes del piloto.
Pros: reputación, prevención de repetición, evaluación de humor real.
Contras: limita cadencia y autonomía total inicial.
Revisar cuando: exista historial suficiente de episodios originales con calidad auditada y métricas estables.
Estado: PROPOSED.

#### ADR-007 — Local-first y nube solo donde compensa

Decisión: render/TTS en Windows local; LLM API o local a elegir por coste/calidad; Drive opcional de archivo.
Pros: control, evitar costes persistentes, privacidad, menor dependencia.
Contras: disponibilidad ligada al equipo y dificultad de producir en paralelo.
Revisar cuando: cuello de botella probado o demanda justifique worker cloud.
Estado: PROPOSED/ASSUMED.

#### ADR-008 — Originalidad como criterio de producción

Decisión: biblioteca visual reutilizable, pero guion singular y variación estructural obligatoria.
Pros: marca, retención, ayuda a cumplir políticas.
Contras: creatividad automática difícil; más rechazos editoriales.
Revisar cuando: solo para refinar reglas, nunca eliminar requisito de originalidad.
Estado: CONFIRMED en intención, PROPOSED en implementación.

### 21. Registro de riesgos y mitigación temprana

| Riesgo | Severidad cualitativa | Indicador | Mitigación / fase |
| --- | --- | --- | --- |
| Chistes previsibles o artificiales | CRÍTICO | abandonos y rechazo cualitativo | biblia + revisión editorial; F2/F6 |
| Escenas visualmente estáticas | CRÍTICO | preview parece diapositivas | benchmark de actuación; F0/F1 |
| Formato repetitivo monetización | CRÍTICO | argumentos similares / revisión canal | anti-repetición, variedad, revisión humana; F2–F6 |
| Dependencia de Remotion | ALTO | términos cambian o crece personal | benchmark MIT, contratos IR; F0 |
| Voces poco naturales | ALTO | prosodia plana/errores | batería de audición y proveedor alternativo; F3 |
| Doblaje rompe humor | ALTO | traducciones literales / mal fit | adaptación cultural, QA nativa; F3/F6 |
| Edición por tiempos incorrectos | ALTO | diálogos cortados, silencios | voz fuente→freeze→validación; F1/F3 |
| Coste por regeneración | ALTO | reintentos caros | caché, reintento por línea/escena; F4 |
| Audio multilingüe no automatizable | MEDIO-ALTO | API sin método público | entrega manual Studio, no prometer autopistas; F5 |
| Licencias de música, assets, voz | ALTO | derechos ambiguos | inventario de procedencia/permiso; F0–F3 |
| Publicación duplicada o accidental | ALTO | ID/estado inconsistente | privacidad explícita, idempotencia, aprobación; F5 |
| Falta de audiencia | CRÍTICO COMERCIAL | consumo no repetido | piloto seis episodios y decisión go/pivot; F6 |
| Pérdida de datos | ALTO | maestros únicos en nube | copias, manifests, recovery drill; F4 |
| Cuello de botella en Windows | MEDIO | render demasiado lento | benchmark y control de concurrencia; F0/F4 |

Los adjetivos representan priorización de revisión, no probabilidades calculadas.

### 22. Matriz de alcance: qué sí, qué no y cuándo

| Decisión de producto | MVP (P0) | P1 | P2 / Excluido |
| --- | --- | --- | --- |
| Dos protagonistas recurrentes | SÍ | Refinar | Ampliar elenco si aporta valor |
| Episodios independientes 8–10 min | SÍ | Optimizar | Mantener salvo prueba contraria |
| Rigs vectoriales reutilizables | SÍ | Animación adicional | Animación física solo si ROI |
| Guion LLM con QA | SÍ | Mejora por datos | Jamás copiar historias |
| Cronología canónica | SÍ | Versionado avanzado | No sustituir por SRT sueltos |
| SRT por personaje | SÍ | Más formatos | No usar subtítulos quemados como base |
| Doblaje local español + inglés | SÍ, tras F3 | Más idiomas | No garantizar voz perfecta sin QA |
| MP4 maestro y por idioma | SÍ | Refinar packaging | Evitar render completo por lengua |
| Cola idempotente y recuperable | SÍ, tras F4 | Programador | No distribuir antes de necesidad |
| Miniaturas/títulos originales | SÍ antes de canal | A/B tests | Evitar clickbait engañoso |
| Publicación YouTube con control | P1 (F5) | Cadencias y analytics | No autopublicar sin autorización |
| Web de control completa | NO | SÍ si ahorra trabajo | No multiempresa sin mercado |
| Episodios de otros géneros | NO | Evaluar | Proyecto separado si necesario |
| SaaS público de vídeos | NO | NO | Excluido en horizonte inicial |
| Múltiples canales por idioma | NO | Experimento condicionado | No asumir escalado automático |
| Generación de vídeo con difusión | NO | Casos puntuales | Excluido como motor core |

### 23. Definition of Ready (DoR), Definition of Done (DoD) y criterio de lanzamiento

#### 23.1 DoR para iniciar desarrollo (cumplido a nivel de definición)

- ☒ Público y propuesta de valor formulados.

- ☒ Formato y restricción de episodios independientes definidos.

- ☒ Estilo y personajes iniciales propuestos, expresamente no confirmados.

- ☒ Arquitectura inicial y sus límites descritos.

- ☒ Dependencias principales identificadas.

- ☒ Primer vertical slice sin exigencias de SaaS o nube.

- ☒ Contratos y criterios de QA conceptuales.

- ☒ Riesgos de monetización y licencias considerados.

- ☐ F0: seleccionar motor con evidencia y aprobar estilo visual — bloquea biblioteca definitiva, no inicio del benchmark.

#### 23.2 DoD de cada fase técnica

Una fase no es COMPLETE por generar código o documentación. Requiere: artefactos existentes, reproducción ejecutada, pruebas reales, validación de contratos, evidencia de coste y recursos, ausencia de defectos bloqueantes, procedimiento de ejecución y registro de decisiones. Si falta alguna comprobación material, estado PARTIAL, y bloqueo identificado.

#### 23.3 DoD del MVP de producto

- Existe al menos un episodio de 8–10 minutos con relato original, no relleno.

- Personajes visuales y voces consistentes.

- Máster 16:9, SRT por personaje e idioma, audio español e inglés derivados del mismo vídeo.

- Producción repetible sin corrupción, tiempos coherentes, costes observables y assets licenciados.

- Editorial QA real además de validación técnica.

- Operación local reproducible y copia recuperable.

- Exportación lista para subida a YouTube, aunque añadir pistas multilingües pueda requerir Studio.

#### 23.4 DoD de lanzamiento comercial

Además del MVP técnico: canal con marca y permisos configurados, cumplimiento de políticas, metadatos originales, revisión humana de episodios iniciales, autorización explícita de publicación y seguimiento de audiencia. Estar técnicamente listo no equivale a estar monetizado.

### 24. Gobierno del proyecto y flujo con agentes

#### 24.1 Responsable humano vs agente

Humano (decisiones irreversibles o de inversión): naming público, identidad visual final, límites creativos importantes, presupuesto y proveedor de pago, contenido que se publica, cambios de estrategia de monetización, clasificación del canal y uso de voces de terceros.
Agente (autonomía): implementación, organización interna, tests, elección de estructura dentro del stack, correcciones de errores, documentación de interfaces, propuesta de refinamientos.
Agente no autorizado: publicar, comprar servicios, cambiar licencias por conveniencia, borrar maestros, clonar voces ajenas, alterar visión o alcance sin constancia.

#### 24.2 Informe obligatorio de cada fase

```text
STATUS: COMPLETE / PARTIAL / BLOCKED
SCOPE: trabajo realmente solicitado
CHANGES: archivos, contratos, módulos y pruebas
ARTIFACTS: paths reales y tamaños/hashes si aplica
VALIDATION: comandos ejecutados, resultados, FFprobe, previews
DECISIONS: ADRs creadas o cambiadas
COSTS: consumo medido o desconocido (nunca inventado)
RISKS: incidencias nuevas o mitigadas
PENDING: acciones restantes con dependencia
NEXT: primera tarea coherente para fase siguiente
```

#### 24.3 Gestión del conocimiento

Fijar este documento como docs/master-blueprint.md. Crear docs/decisions/ para ADR; docs/contracts/ para esquemas versionados y show/show-bible.json cuando exista la identidad. Al modificar una funcionalidad, actualizar solo las secciones impactadas y añadir un breve changelog. Evitar duplicar la especificación en cinco documentos divergentes. El estado de implementación se obtiene de la realidad del repositorio, no del texto aspiracional.

### 25. Contrato de traspaso compacto (Development Handoff)

```text
PROJECT_IDENTITY:
  name: Sitcom AI Studio
  status: PRE_IMPLEMENTATION
  public_brand: OPEN
PRODUCT_VISION: >
  Original standalone animated sitcom about a couple,
  with automated writing, deterministic animation,
  character-separated subtitles and multilingual dubbing.
TARGET_USERS:
  audience: Adult general-entertainment viewers
  operator: Single independent creator initially
VALUE_PROPOSITION: >
  Recognizable original characters, varied stories,
  reusable visual assets and low-cost multilingual production.
CONFIRMED_REQUIREMENTS:
  - 8-10 minute landscape episodes
  - Independent storylines; no inter-episode plot continuity
  - Stable cast, sets and art direction
  - Automated screenplay, animation and rendered MP4
  - Separate timecoded SRT per speaking character
  - Dubbing/localization without reanimating the source video
  - Business goal: YouTube channel monetization
PROPOSED_DECISIONS:
  - Two leads (Vera and Leo) and three household sets
  - Adult-oriented observational comedy
  - Vectorial rigged animation
  - es-ES first, en-US first additional locale
  - Local-first Windows worker
  - TypeScript modular monolith, SQLite and local files
  - Renderer-neutral AnimationIR; Remotion benchmark against MIT Motion Canvas
  - One YouTube video with multiple audio tracks when supported
  - Editorial approval before public distribution during pilot
OUT_OF_SCOPE:
  - General-purpose video SaaS
  - Generative video per shot as core renderer
  - Full narrative memory across episodes
  - Microservices or multi-tenant infrastructure
  - Uncontrolled mass publication
CORE_USER_FLOWS:
  - Idea > script > editorial check > scene plan
  - Source voice timing > frozen canonical timeline
  - Deterministic visual render > master video
  - SRT by speaker > localization > local speech > stems/mix
  - QA > package > authorized publishing
DOMAIN_MODEL:
  - Series, ShowBible, Character, Set, Asset
  - Episode, Scene, AnimationAction, DialogueLine, Timeline
  - Localization, VoiceProfile, VoiceClip
  - ProductionJob, QualityReport, Publication
ARCHITECTURE:
  style: Modular monolith
  contracts: Versioned JSON + validation
  timeline: Integer milliseconds, stable line IDs
  files: Master and localized artifacts by episode
  orchestration: Idempotent persistent jobs
  renderer: Chosen after F0 benchmark
  tts: Replaceable adapter; local-first
TECH_STACK:
  runtime: Node.js / TypeScript
  renderer_candidates: Remotion, Motion Canvas
  media: FFmpeg / FFprobe
  persistence: SQLite + filesystem
  tests: Vitest + real media verification
CRITICAL_REQUIREMENTS:
  - Originality across episodes
  - Readable expressive animation, not slides
  - Same video master for multiple locales
  - No truncated dialogue or forged timecodes
  - Recoverable production and verified deliverables
  - Commercial license provenance for all assets
SECURITY_CONSTRAINTS:
  - No arbitrary LLM-generated code execution
  - No secrets in repository
  - Restricted paths and validated external calls
  - No upload/purchase/destructive actions without permissions
ARCHITECTURAL_DECISIONS:
  - ADR-001 Modular monolith
  - ADR-002 Renderer-independent AnimationIR
  - ADR-003 Select Remotion/Motion Canvas in F0
  - ADR-004 Voice source before timeline freeze
  - ADR-005 Prefer one multilingual YouTube video
  - ADR-006 Editorial pilot gate
  - ADR-007 Local-first operation
  - ADR-008 Originality required
ASSUMPTIONS_AND_UNCERTAINTIES:
  open:
    - Public name and exact visual identity
    - Actual renderer choice after benchmark
    - Voice quality on real Windows hardware
    - Real cost and duration of render
    - YouTube multi-audio eligibility and API automation
    - Demand and observed RPM
ROADMAP:
  F0: Creative/art/license benchmark
  F1: Real 60-90 second vertical slice
  F2: Original 8-10 minute episode
  F3: Multilingual speech and mixing
  F4: Reliable autonomous production
  F5: Authorized YouTube publishing
  F6: Six-episode business pilot
ACCEPTANCE_CRITERIA:
  phase_1: Real playable video and SRT split by character
  mvp: 8-10 minute original multilingual episode without reanimation
  commercial: Published approved pilot and real performance assessment
SOURCE_OF_TRUTH:
  document: SITCOM_AI_STUDIO_MASTER_BLUEPRINT_v2.md
  schema: Future versioned contracts in repository
  visual_identity: Future approved Show Bible
  source_timing: Frozen timeline.json
CURRENT_STATUS:
  definition: READY
  implementation: NOT_STARTED_OR_NOT_VERIFIED
  repository: UNKNOWN
  external_permissions: NOT_VERIFIED
  next_phase: F0
```

### 26. Primer prompt para agente de desarrollo — SOLO Fase 0

El primer encargo más seguro no es construir ocho minutos ni integrar YouTube. Es resolver la elección del motor y validar la actuación visual antes de acumular cientos de assets. La Fase 1 se ejecuta inmediatamente después, con el motor y estilo ya seleccionados.

```text
# SITCOM AI STUDIO — PHASE 0: CREATIVE & RENDERER FEASIBILITY

You are a Principal Software Architect, 2D Motion Design Engineer,
Technical Producer and QA Lead.

Communicate with the human exclusively in Spanish (Spain).
Use English for code, identifiers and technical documentation.

MISSION
Validate the visual direction, production feasibility and legal
eligibility of the rendering engine for an automated original
8–10-minute animated sitcom about a couple.

This task covers ONLY PHASE 0. Do not build the complete product,
introduce production infrastructure, publish media or incur paid costs.

SOURCE OF TRUTH
Read the full SITCOM_AI_STUDIO_MASTER_BLUEPRINT_v2.md first.
Treat all PROPOSED elements as reversible, not user approvals.

PRE-EXECUTION
1. Inspect the actual workspace, repository and permissions.
2. Detect installed Node, package manager, browser and FFmpeg.
3. Preserve all existing work; no destructive operations.
4. Check current engine licensing and compatibility.
5. Do not assume the environment can export video.

IMPLEMENTATION
A. Build a minimal original vector style exploration with two
   recognizable adult characters (working names: Vera and Leo).
B. Create one domestic set and at least two camera framings.
C. Produce a 20–30-second real animation test showing idle,
   speaking state, facial reactions, one gesture and a camera cut.
D. Evaluate Remotion and Motion Canvas fairly, where executable.
E. Record runtime, output format, render duration, constraints,
   dependency complexity and commercial licensing conditions.
F. Recommend ONE engine, with a reasoned trade-off and a clear
   revisit condition. Do not maintain two engines by default.
G. Freeze only the minimum art tokens needed for Phase 1.

VALIDATION
- Verify actual output via FFprobe where feasible.
- Inspect rendered frames visually, not only command exit codes.
- Confirm the clip is animated and not a slideshow.
- Run any implemented schema/unit tests.
- Log real hardware and actual command results.
- If tools cannot render, deliver verified blockers plus all
  independently feasible code and assets; report PARTIAL.

SAFETY
- No arbitrary LLM-generated code execution.
- No copyrighted copied characters or voices.
- No paid cloud service without authorization.
- No YouTube upload.
- No deletion of prior work.

FINAL REPORT IN SPANISH
STATUS: COMPLETE / PARTIAL / BLOCKED
ENGINE_DECISION: selected + rejected + reasons
VISUAL_DIRECTION: assets, palette, visual constraints
FILES: existing paths only
VALIDATION: commands, durations and FFprobe evidence
LICENSING: sources and applicability to current operator
RISKS: unresolved matters
NEXT_STEP: Phase 1 precise implementation readiness
```

### 27. Cuestiones abiertas: bloqueantes y no bloqueantes

| Decisión | Tipo | Bloquea | Resolución recomendada |
| --- | --- | --- | --- |
| Nombre del canal/serie | OPEN | no F0/F1 | definir antes de branding público y primera publicación |
| Diseño exacto Vera/Leo | OPEN | biblioteca definitiva | aprobar a partir de vídeo y miniaturas de prueba F0 |
| Remotion o Motion Canvas | OPEN | F1 | prueba de 20–30 s y auditoría de licencia F0 |
| TTS local de alta expresividad | OPEN | F3 | batería de doblaje antes de elegir proveedor |
| Ordenador exacto y tiempos | OPEN | presupuestos | inspeccionar entorno de ejecución en F0 |
| Posibilidad de pistas YouTube | OPEN | automatizar esa parte de F5 | verificar Advanced features y documentación pública |
| Nombre comercial y derechos | OPEN | lanzamiento | verificar disponibilidad comercial y dominio si importa |
| Cadencia real | OPEN | escalado F6 | datos del piloto, no intuición |
| RPM/demanda | OPEN | rentabilidad | observación real tras YPP |

Regla: no interrumpir la Fase 0 con preguntas sobre detalles que puedan ensayarse técnicamente. No tomar decisiones irreversibles como definitivas sin propietario.

### 28. Referencias y grado de confianza (consultadas: 11/11/2026)

| ID | Fuente | Aplica a | Evidencia |
| --- | --- | --- | --- |
| S01 | https://www.remotion.dev/docs/license/pricing | Licencia comercial y gratuita Remotion | VERIFIED, condiciones actuales |
| S02 | https://www.remotion.dev/docs/license/faq | Elegibilidad, automatización y colaboradores | VERIFIED, condiciones actuales |
| S03 | https://www.remotion.dev/docs/terms | Detalles contractuales Remotion | VERIFIED, condiciones actuales |
| S04 | https://github.com/motion-canvas/motion-canvas/blob/main/LICENSE | Licencia MIT de Motion Canvas | VERIFIED |
| S05 | https://huggingface.co/hexgrad/Kokoro-82M | Pesos y licencia Kokoro | VERIFIED; calidad por idioma OPEN |
| S06 | https://support.google.com/youtube/answer/1311392?hl=es | Originalidad, repetición y monetización | VERIFIED; elegibilidad individual OPEN |
| S07 | https://support.google.com/youtube/answer/94522?hl=es | Umbrales YPP | VERIFIED; pueden cambiar |
| S08 | https://support.google.com/youtube/answer/13338784?hl=en | Audio multilingüe | VERIFIED; acceso por canal OPEN |
| S09 | https://developers.google.com/youtube/data/reference/rest/v3/videos/insert | Subida/API, metadatos y publicación | VERIFIED |
| S10 | https://developers.google.com/youtube/data/revision_history | Cambio de comportamiento API nov. 2026 | VERIFIED |
| S11 | https://developers.google.com/youtube/data/reference/rest/v3/thumbnails/set | Miniaturas API | VERIFIED |
| S12 | https://support.google.com/youtube/blog/424874071/updates-to-ai-content-disclosure-and-labels?hl=en | Divulgación de sintético/animación | VERIFIED, sujeto a políticas actuales |

Cautela legal: las interpretaciones sobre licencias reflejan documentación pública consultada, no asesoramiento jurídico. Revalidar términos en cada nueva fase, especialmente antes de contratación, publicación y expansión de personal.

### 29. Glosario de conceptos

Show Bible: documento y datos que preservan identidad creativa del universo.
RIG: representación vectorial articulada y parametrizable de un personaje.
SceneScript: representación validada de escenas, diálogos y acciones.
AnimationIR: modelo intermedio de operaciones visuales, independiente del motor.
Timeline canónica: referencia temporal absoluta del episodio que no depende del idioma.
Stem: pista aislada (diálogo, música, efectos) para mezclar o sustituir.
Speech fitting: adaptación de locución a una ventana temporal sin destruir inteligibilidad.
Technical Pass: todas las verificaciones técnicas bloqueantes superadas.
Editorial Approved: calidad creativa juzgada suficiente para publicarse.
Idempotencia: reintentar una operación sin duplicar resultado externo o corromper outputs.
Gate: requisito concreto de salida que impide avanzar cuando falla.
P0/P1/P2: esencial de MVP / posterior / futuro.
VERIFIED/PROPOSED/ASSUMED/OPEN: clases explícitas de evidencia y decisión.

### 30. Registro de versión y siguientes instrucciones

v2.0 — 11/11/2026: versión inicial expandida para base de conocimiento; desarrolla estrategia de serie, personajes, diseño, gramática audiovisual, generación, cronología previa al render, doblaje, licencias, operación, publishing, roadmap, gates, riesgos y contrato de traspaso. No crea ni modifica un repositorio, canal o servicio.

Acción inmediata recomendada: adjuntar este Markdown al proyecto como referencia y entregar al agente únicamente la Fase 0. Con la evidencia visual y de licencias, actualizar ADR-003 y los tokens aprobados antes de iniciar F1. El DOCX es una edición de lectura; para agentes, este Markdown es la referencia preferente.
