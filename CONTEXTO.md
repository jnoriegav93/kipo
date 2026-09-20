# Contexto de trabajo — dónde va todo

Documento de traspaso entre sesiones y entre máquinas. Se actualiza al cerrar
cada tanda de trabajo. Las reglas de cómo trabajar en el repo están en
`CLAUDE.md`; esto es el **estado**.

Última actualización: 19 de septiembre de 2026.

> **Ahora:** el modo Diseño quedó en pausa el 14/09 para agregar el **cable de
> acero** a la sección FIBRA. Ver la sección "Cable de acero" más abajo.

---

## En qué estamos: el modo DISEÑO

Kipo cubre hoy **levantamiento en campo**, **tendido** y **liquidación**. Falta el
eslabón del medio: el **diseño** de la red, que hoy se hace en un proyecto aparte
("GPON Design", App_Design: JavaScript puro, sin build, PWA local con IndexedDB).
Ese proyecto **nunca se despliega**: fue un prototipo en localhost y la idea es
que Kipo absorba todas sus herramientas. No está en uso ni tiene datos que migrar,
así que se rehace sobre un modelo mejor en vez de portarlo tal cual.

App_Design no está en git. Dónde está:
- Otra PC: `C:\Users\USER\App_Design`
- Laptop: `C:\VIAJE_LIMA_11_9_26\App_Design`

El puente manual que queremos eliminar: hoy se exporta un KMZ de Kipo para
importarlo en el paso 2 de App_Design.

### Documentos de referencia (artifacts, en la cuenta de claude.ai)

- **Modo Diseño en Kipo** — plan por fases, modelo de datos y qué se porta de
  cada archivo: https://claude.ai/code/artifact/652fdd02-5eee-468f-8485-122cc843e94d
- **Funciones del Catastro** — inventario completo del paso 1 de App_Design,
  leído del código: https://claude.ai/code/artifact/5442bbca-ecc1-4084-8806-3f0138ac966d
- **Simbología de Postes Kipo** — las tres formas de marcador y sus estados:
  https://claude.ai/code/artifact/b2e32a8d-2d6e-4a33-9395-6d31f84ec0ff

---

## Decisiones cerradas

No volver a discutirlas al construir. Si algo cambia, cambia aquí primero.

**Dónde vive.** Modo dentro del **mismo proyecto** de Kipo, no un entorno con
proyectos aparte. Los postes del diseño son los del levantamiento, en vivo. Si el
diseño viviera aparte habría que migrar puntos cada vez que campo corrige uno.

**Un proyecto puede nacer en Diseño, sin postes.** El diseño puede ir antes que el
levantamiento. Se crea desde la lista de Diseño y es un proyecto normal de Kipo
(tipo levantamiento, con su Día 1, marcado `creadoDesde: 'diseno'`), para que la
cuadrilla levante después sobre él. La estructura sale de `armarProyectoNuevo()`
en `useProjectLogic.js`, la misma que usa el modal de Kipo.

**Aspecto.** Oscuro y sobrio, porque el diseño se hace en interior con
computadora, no al sol. Pero con **las formas de control de Kipo** (botones
`rounded-xl` con borde de 2, versalitas negras, naranja de marca) para que no
parezca otra aplicación. Paleta en `PALETA` dentro de `VistaDiseno.jsx`.

**Origen del poste.** `levantado` · `importado` · `proyectado`. Un solo modelo de
postes para toda la app. Se lee con respaldo (`origenDePunto()` en `helpers.js`),
**sin migración**: los puntos viejos se comportan como levantados y no se escribe
nada sobre lo que la cuadrilla está guardando.

**Estados.** Solo `proyectado` e `instalado`. Lo anulado se borra.

**Fibra: un registro, dos geometrías.** `vertices` (lo real, lo que Kipo ya edita)
y `proyeccion` (congelada al aprobar el diseño). Nunca dos objetos vivos que haya
que sincronizar. Los tres casos de la liquidación salen solos: ambas geometrías →
se comparan; `proyeccion: null` → adicional; `instalado: false` → no ejecutado.

**Quién edita qué lo decide el modo**, no el usuario: en Diseño se toca
`proyeccion`, en Kipo normal se tocan los `vertices`. Desde campo **no hay forma
de tocar la proyección**.

**Permisos.** Escribe solo el dueño del proyecto. Las capas de catastro las ven
todos. Queda aparcada la idea de entregar el proyecto al cliente transfiriendo la
propiedad.

**Poste movido.** Pasados **8 m** en liquidación se pregunta si es el mismo poste.
Solo rompe el diseño si el poste nuevo queda **fuera de la ruta proyectada**;
dentro de **5 m** de la ruta se ajusta solo a la línea, y eso únicamente al
liquidar.

**Versiones.** Reaprobar saca v2, v3… y **solo toca fibras no instaladas**. Lo ya
tendido conserva la proyección con la que se construyó.

**Sin diseño, nada cambia.** Un proyecto sin diseño funciona exactamente como hoy.

**Formato en Firestore.** Firestore no acepta un array dentro de otro. En memoria
el diseño trabaja con pares `[lat, lng]`; al guardar, `aFirestore()` los pasa a
`{lat, lng}` y al leer `desdeFirestore()` los devuelve (las dos en
`disenoGeo.js`, usadas por `disenoService.js`). Todo lo que se guarde en
`diseno` pasa por ahí.

### Decisiones del catastro

**Nada de OSM para dibujar.** Todo manual. Los postes de Kipo sí se muestran de
fondo como referencia al trazar. El **buscador de lugares** usa Nominatim (el
geocodificador de OpenStreetMap, el mismo que Kipo usa para poner dirección a los
puntos), pero solo mueve el mapa: no trae nada al diseño. Sus reglas no permiten
buscar a cada tecla, así que se busca con Enter o la lupa.

**Las calles son el esfuerzo principal.** Dibujar las manzanas a partir de las
calles es el camino; el reparto en lotes viene después, sobre los rectángulos ya
obtenidos.

**Se traza el borde, no el eje.** El borde de la manzana es una línea visible en
el satélite; el eje hay que adivinarlo y la mano falla. Y justo por eso **el ancho
tiene que poder variar a lo largo de la calle**: el ancho de arranque solo sirve
para generar el segundo borde, después cada borde se mueve por su cuenta.

**Frontis en lotes de esquina — regla nueva.** Un lote de esquina toca dos lados
de la manzana. Se cuenta cuántos **lotes intermedios** tienen su frontis en cada
uno de esos dos lados y el de esquina **se suma al lado que tenga más**. Empate →
gana el lado donde el lote tiene el frente más largo. (En App_Design se tomaban
los dos lados como frontis; eso cambia.)

**Precisión.** Los lotes deben salir lo más precisos posible, pero eso depende del
técnico que dibuja: nuestro trabajo es darle herramientas rápidas y exactas.

**Pendiente de confirmar con el usuario — qué se guarda de los lotes.** Se había
pensado guardar solo la *receta* (manzana + configuración) y recalcular los lotes
al abrir. La recomendación del 12/09 es guardar **los polígonos de los lotes, un
documento por manzana**, con la configuración dentro para poder regenerarlos a
propósito. Motivos: el diseño aprobado es contra lo que se liquida y no puede
cambiar solo si mañana se toca el código que parte los lotes; los NAPs se asignan
a lotes y recalcular rompería esos vínculos; y partir por manzana ya evita el tope
de 1 MB y las escrituras grandes. Es lo que hace App_Design: al reabrir una
manzana confirmada no la regenera, para no perder las fusiones.

**Geometría:** `polygon-clipping` (~30 KB) solo para unir, cortar y restar
polígonos, en vez de Turf entero (~500 KB). El resto escrito a mano en
`disenoGeo.js`. **Todavía no está instalado.**

---

## Qué está construido

| Pieza | Estado |
|---|---|
| Entrada DISEÑO en el menú, tras `esAdmin` | hecho |
| Vista con stepper de 6 pasos, carga diferida | hecho |
| Elegir proyecto y ver sus postes reales | hecho |
| **Nuevo proyecto** desde la lista de Diseño, sin postes | hecho |
| **Buscador de lugares** en la cabecera (ciudad, distrito, calle) | hecho |
| Encuadre al abrir: los postes o, si no hay, lo dibujado; aviso en proyecto vacío | hecho |
| Colección `proyectos/{id}/diseno` + reglas | hecho — **sin confirmar que las reglas estén desplegadas** |
| Guardado diferido de 600 ms, con su estado en la barra | hecho — **hasta el 12/09 no guardaba nada** (arrays anidados) |
| Cuadra rectangular (3 clics) y cuadra irregular | hecho |
| Áreas especiales (polígono y círculo) con sus tipos | hecho |
| Marcadores y etiquetas con sus tipos | hecho |
| Panel de capas con conteos | hecho |
| **Calles:** trazar borde A, imán a vértices, imán de ángulo 90°, medida en vivo, ancho de arranque, cambiar lado, confirmar | hecho |
| **Editar calle:** arrastrar vértices de los dos bordes con imán (16 px a vértices, 12 px a bordes de otras calles), ancho local en vivo, rango de ancho en el panel, Guardar / Cancelar | hecho |
| **Agregar vértice** tocando un borde y **cortar calle** con un clic en cada borde | hecho |

Archivos: `src/views/VistaDiseno.jsx`, `src/components/DisenoCatastro.jsx`,
`src/components/DisenoCalles.jsx`, `src/components/DisenoBuscador.jsx`,
`src/services/disenoService.js`, `src/utils/disenoGeo.js`, y
`crearProyectoDiseno()` en `src/hooks/useProjectLogic.js`.

Lo del 12/09 (guardado, edición de calles, proyecto nuevo y buscador) está probado
en Chrome con la página de prueba de abajo, pero **todavía no con el usuario admin
en la app real**.

## Qué sigue, en orden

1. **Probar en localhost con el admin**: crear un proyecto desde Diseño, buscar la
   ubicación, dibujar y editar calles, recargar y ver que siguen ahí. Si la barra
   dice "sin permiso de escritura", faltan desplegar las reglas de `diseno`.
2. **Cerrar esquinas**: prolongar cada extremo hasta 10 m y pegarlo al borde de
   otra calle si choca.
3. **Generar manzanas desde calles**, con candidatas revisables (naranja = entra,
   gris = no). Necesita `polygon-clipping`.
4. **Subdividir en lotes** con la regla nueva de frontis.
5. Divisores, familias por lote, selección múltiple y fusión.
6. Bloque de cuadras (baja prioridad: con las calles funcionando pierde sentido).
7. Exportar GeoJSON.

Después del catastro vienen las fases 2 a 5 del plan: tramos (grafo de vanos),
NAPs, rutas y aprobación, y reconciliación con la liquidación.

## Cómo probar el modo Diseño sin login

Claude no puede entrar con el usuario admin. En la laptop hay una página de
prueba local **fuera de git** (`harness-diseno/`, excluida en `.git/info/exclude`):
monta `VistaDiseno` con proyectos falsos y cambia `firebaseConfig.js` por un
Firestore que apunta a un emulador inexistente, así que nunca toca producción
pero las escrituras pasan por el SDK real. Se levanta con
`npx vite --config harness-diseno/vite.config.js` (puerto 5199) y se recorre con
`puppeteer-core` y el Chrome instalado; las búsquedas de Nominatim se responden
con datos falsos interceptando la petición.

---

## Cable de acero (dentro de FIBRA)

Mensajero de acero **de poste a poste**, para sostener la fibra en los cambios de
dirección. **No es fibra: es ferretería que se liquida por metro.** Decidido con el
usuario el 14/09; ese mismo día pasó a tipos fijos y a registrar qué fibras se apoyan
en el cable y en qué medio tramo.

- **Dónde se dibuja.** Selector FIBRA | ACERO arriba de la barra que abre el botón
  FIBRA. En ACERO la barra es otra (`src/components/BarraAcero.jsx`) y no comparte
  nada con la de fibra. Un cable lleva **dos postes** (sus puntas; un tercer poste
  cambia el segundo), **las fibras que se apoyan** (se tocan en el mapa; otro toque
  las desmarca) y **el medio tramo donde se apoyan** (tocar un medio tramo nunca lo
  toma como poste). Para GUARDAR basta con **los dos postes**: si faltan las fibras o el
  medio tramo, el panel lo avisa y deja guardar igual ("GUARDAR ASÍ"), y se completan
  después con EDITAR (en la lista salen marcados "SIN MEDIO TRAMO" o "SIN FIBRAS"). Las
  sugerencias de ferretería siguen saliendo de los postes. ATRÁS deshace en
  orden inverso: medio tramo, fibras y postes. La lista cambia el tipo, EDITA (el
  cable vuelve al trazo y al guardar se actualiza) y borra. Tocar el mapa vacío no
  hace nada. Las reglas del trazo son funciones puras en `src/utils/cablesAcero.js`
  (`tocarPuntoAcero`, `tocarFibraAcero`, `deshacerTrazoAcero`, `faltaEnTrazoAcero`).
  Al guardar, el cable toma el proyecto y el día de su **primer poste**, no del día
  elegido en el mapa: hasta el 15/09, sin día elegido (por ejemplo, tras "Ver en Mapa"
  desde un punto viejo sin día) no se guardaba y no avisaba. La fibra tenía el mismo
  problema y se corrigió igual; si falta de dónde sacarlo, ahora sale un aviso.
- **Datos.** Colección propia `cablesAcero`:
  `{ puntos: [A, B], ferrId, fibras: [idConexion…], medioTramo, proyectoId, diaId, ownerId, timestamp }`.
  Va aparte de `conexiones` a propósito: todo lo que lee fibras (metros por capacidad,
  reparto de postes en ramales, KMZ) lo contaría como fibra de 12 hilos, y las
  versiones viejas de la app lo verían como fibra. No guarda geometría: se mide
  siempre con la posición actual de sus dos postes.
- **Metros a liquidar.** Distancia entre postes **+ 1 m, redondeado al metro
  superior** (`metrosCableAcero` en `src/utils/cablesAcero.js`, probado con Node).
- **Tipos de cable: fijos**, como las capacidades de la fibra (`TIPOS_CABLE_ACERO`):
  MENSAJERO 1/8 (ítem `b13`) y MENSAJERO 3/16 (`b38`). El usuario no agrega ni quita
  tipos, y el `ferrId` es el ítem con el que se liquida. Ya no existen la marca
  `porMetro` ni el botón de regla de Configuración o de la base del admin.
- **No es ferretería del poste (decidido el 15/09).** `b13` y `b38` no aparecen en los
  contadores del punto, en su detalle, en los armados ni en Configuración →
  Ferretería (la base del admin sí los muestra, marcados "cable de acero", porque
  guardan nombre y código). Lo que se haya contado por poste antes **no suma en ningún
  lado** (`quitarCableAcero` en el cliente, `sinCableAcero` en el servidor): los metros
  salen solo de los cables trazados. En la liquidación y en Control Ferretería van
  siempre en `mts`, aunque el catálogo del usuario diga `und`.
- **Apoyos en medio tramo.** En Liquidación → Revisión (la etiqueta sobre la foto) un
  **poste** sigue contando apoyos y extremos por cercanía (3 m). En un **medio tramo**
  los apoyos son solo las fibras marcadas en los cables de acero que lo usan
  (`fibrasApoyadasEn` y el cuarto parámetro de `resumenFibrasEnPoste`), porque la
  cercanía contaba también las fibras que pasan de frente. Un medio tramo sin cable no
  tiene apoyos; los extremos se miden igual que siempre. Las columnas de apoyos de los
  listados (utilizados, col. L; postes eléctricos, col. O) siguen vacías.
- **Ferretería sugerida (15/09).** En la ferretería de un punto (formulario y
  FERRETERÍA → REVISIÓN) los cables de acero sugieren, sin cantidad y al inicio de la
  lista: **3/16** → PREFORMADO ROJO 3/16 en sus dos postes y CHAPA 3 HUECOS en su medio
  tramo; **1/8** → GRLLETE (grillete tipo candado) en sus postes y CHAPA BRAQUELITA en
  su medio tramo, que por su vínculo "van juntas" jala a CHAPA Q. La etiqueta dice el
  motivo ("SUGERIDA · ACERO 1/8"). Regla fija en `SUGERIDAS_CABLE_ACERO`
  (`src/utils/cablesAcero.js`), por id del catálogo base.
- **Dónde suma.** Excel de liquidación de materiales, Control Ferretería
  (consolidado), comparativo de ferretería del proyecto y, en el reporte de tendido
  del servidor, una tabla "CABLE DE ACERO" en metros dentro del RESUMEN, aparte del
  total de piezas. En los reportes de una fila por poste (cuantificado y listado de
  utilizados) cada cable va en la fila del **segundo de sus dos postes** según el
  orden de posición (`metrosAceroPorPoste`), así cuenta una sola vez, igual que la
  distancia al poste anterior. En el KMZ (cliente y servidor) va una carpeta
  "Cables de acero". No entra en la hoja DATOS del servidor, en las tablas de ferretería
  (del proyecto ni del ramal) ni en el RF de ferretería. La regla de metros y los ítems
  de cable de acero (`IDS_CABLE_ACERO`) están copiados en `functions/index.js`: si
  cambian, cambian en los dos.
- **En el reporte de tendido (19/09).** En el **croquis** de cada ramal los cables se
  dibujan en **rojo**, con la **mitad** del grosor de la fibra (`1.5 * ESC` contra
  `3 * ESC`), rotulados a mitad del vano con **solo la medida y los metros**
  (`3/16 - 34m`). Van **encima** de la fibra justamente por ser más finos, y su rótulo
  usa el mismo control de choques que los de poste: en un tramo apretado alguno queda
  sin rótulo antes que salir superpuesto. Los **postes que lo sostienen y el medio tramo**
  donde se apoyan las fibras salen en rojo; el resto de medios tramos sigue naranja.
  La medida sale del **nombre del catálogo** (`medidaAcero`: busca la fracción, y si no
  hay, quita las palabras del tipo), no de una lista fija, para que un tipo nuevo tampoco
  salga rotulado "CABLE DE ACERO". En la **hoja del ramal**, sus metros se suman al final
  de FERRETERÍA DEL RAMAL en negrita. En el **RESUMEN** ya **no hay tabla aparte**: sus
  filas van dentro de FERRETERÍA UTILIZADA, al final y en negrita (decidido con el
  usuario el 19/09). Metidos ahí, el TOTAL DE PIEZAS habría sumado piezas con metros, así
  que **se quitaron las filas de total de FERRETERÍA UTILIZADA y de ARMADOS UTILIZADOS**.
  Los totales que sí valen —POSTES y METROS POR CAPACIDAD— se quedan como estaban.
  Se **descartó** calcular LONGITUD CALCULADA con las reservas × 30: el armado que las
  representa cambia en cada proyecto, así que sigue anotándose a mano.
- **Ciclo de vida.** Borrar uno de sus dos postes borra el cable (papelera tipo
  `acero`, que lo restaura si existen sus dos postes). Borrar su **medio tramo** no lo
  borra: el cable se queda sin medio tramo, sale "SIN MEDIO TRAMO" en la lista y se
  completa con EDITAR; un cable restaurado cuyo medio tramo ya no existe vuelve igual,
  sin él. Borrar una fibra no toca los cables: esa fibra deja de contar como apoyo.
  Copiar/cortar puntos los lleva si van sus dos postes; al copiar, el medio tramo y las
  fibras pasan a las copias si también van. Borrar proyecto (lista, equipos, admin)
  los incluye. Salir de un equipo los copia con postes, medio tramo y fibras remapeados.
- **Elegirlo desde el mapa (19/09).** Con la barra de acero abierta y **el trazo vacío**,
  tocar la línea del cable lo elige, igual que tocarlo en la lista; tocarlo otra vez lo
  suelta. La línea visible es fina, así que el dedo lo recibe una polilínea invisible de
  22 px encima, el mismo recurso que ya usaban las fibras al trazar acero. Con un trazo
  empezado (o editando un cable) la línea queda sorda, y fuera del modo acero también:
  ahí cada toque es del dibujo (postes, fibras apoyadas, medio tramo) y no debe significar
  dos cosas. La barra suma un botón **EDITAR**, porque el que ya existía vive dentro de la
  fila desplegada de la lista y eligiendo el cable en el mapa no había por dónde llegar.
  **Cuidado con `dibujandoFibra`:** en acero queda encendido todo el rato (es lo que deja
  tocar los postes, `mapInteractions.handlePuntoClick`), así que **no** sirve para saber
  si se está trazando. Mirarlo dejó la selección apagada siempre en la primera versión;
  quien decide es el trazo (`hayTrazoAcero`).
- **La lista muestra los apoyos (19/09).** Cada cable lista las **fibras que se apoyan
  en él** (con el color de su capacidad) y el **medio tramo donde se apoyan**. El cable
  guarda solo ids: `lineasAcero` (App.jsx) los resuelve en `fibrasInfo` y
  `numeroMedioTramo`. Una fibra borrada simplemente deja de aparecer.
- **Despliegue.** La primera versión (tipos por catálogo, sin fibras ni medio tramo)
  quedó en producción el 14/09/26 (**SELLO: 14/09/26, 16:00**). **Lo del 15/09 está en
  producción desde el 15/09/26**: tipos fijos, fibras apoyadas, medio tramo, el cable
  fuera de la ferretería por poste, y postes y fibras independientes al borrar y al
  restaurar. Se subieron el hosting (**SELLO: 15/09/26, 00:31**) y la función
  `procesarExportacion`; las reglas no cambiaron. Después, solo hosting (**SELLO:
  15/09/26, 02:14**): el total de metros sin "(distancia + 1 m)" al guardar y la
  ferretería sugerida por los cables de acero. Y luego (**SELLO: 15/09/26, 02:32**) la
  corrección del guardado sin día elegido en el mapa. Y el 16/09/26 (**SELLO: 16/09/26,
  18:24**): guardar un cable solo con sus dos postes, con las fibras y el medio tramo
  como opcionales. Y el 19/09/26 (**SELLO: 19/09/26, 00:33**): elegir el cable tocando
  su línea en el mapa, el botón EDITAR en la barra y los apoyos en la lista. Salió sin
  poder elegir ningún cable (la guardia miraba `dibujandoFibra`); corregido y subido el
  mismo día (**SELLO: 19/09/26, 00:59**). Probado en el harness de acero con 20
  comprobaciones que **entran por los botones** (FIBRA y el selector ACERO) en vez de
  forzar el estado, que es lo que había tapado el fallo: elegir, soltar, no crear punto
  al tocar, la lista, empezar un trazo, ATRÁS, EDITAR desde el mapa y la vuelta a FIBRA.

Probado con Node (23 casos: metros, tipos, trazo, apoyos y reparto por poste) y la
copia del servidor contra el cliente; con lint (ningún error nuevo en los 22 archivos
tocados) y compilando. También en Chrome con una página local
(`harness-diseno/acero.html`, fuera de git): VistaMapa real con el mismo cableado que
App sobre tres postes, un medio tramo y dos fibras falsos. 15 casos: mapa vacío, el
medio tramo no es poste, dos postes → 31 m, marcar y desmarcar fibras, medio tramo,
tipos fijos, guardar, tercer poste, ATRÁS, lista, cambio de tipo, EDITAR/ACTUALIZAR,
borrar, vuelta a FIBRA y consola sin errores. **No probado todavía en la app real con
Firestore**: trazar, guardar, recargar, editar, ver los apoyos en Revisión y liquidar.

La liquidación no se rompe si se sube el hosting antes que las reglas: un "sin
permiso" al leer `cablesAcero` cuenta como cero cables, porque sin reglas tampoco
pudo guardarse ninguno. Cualquier otro error sí hace fallar la liquidación.

---

## Postes y fibras, independientes (15/09)

Desde el 30/08 la fibra guarda su propio trazo, pero borrar un poste seguía borrando
completas las fibras que lo tocaban: era la regla del modelo viejo, cuando la fibra
era solo una lista de postes. Decidido con el usuario: **la fibra se queda**.
`soltarFibraDePunto` (`src/utils/fibraUtils.js`, probado con Node) deja el vértice del
poste como vértice libre en su sitio y saca el poste de `puntos`/`from`/`to`; una fibra
vieja sin trazo propio toma antes el de sus postes. El aviso al borrar lo dice ("2
fibras se quedan en su sitio"). En la papelera también es cada cosa por su lado: una
fibra se restaura sola aunque sus postes ya no existan o se hayan movido
(`soltarDePostesBorrados` la suelta de los que faltan; a una fibra vieja sin trazo le
sirven las coordenadas guardadas al borrarla), y un poste se restaura solo.

---

## Editar posición: solo lo ordenado lleva posición (15/09)

Al guardar "editar posición" desde el mapa se numeraban también los puntos no tocados,
detrás de lo ordenado: con 10 de 50 tocados, los otros 40 quedaban del 11 al 50. Ahora
solo lleva posición lo ordenado (lo retomado y lo tocado o, al CORREGIR, lo que ya tenía
posición y lo que se movió) y el resto queda sin posición, como se ve en el mapa
(`posicionesAGuardar` en `src/utils/ordenTendido.js`, probado con Node). Si guardar
quitaría la posición a puntos que ya la tenían, se pide confirmación y se sugiere
RETOMAR. El editor de posición de la lista de puntos (VistaProyectos) sigue numerando
todos, porque ahí se ven todos numerados. En producción desde el 15/09/26 (**SELLO:
15/09/26, 09:07**).

---

## Copiar y cortar puntos: pantalla bloqueada hasta terminar (15/09)

Al confirmar copiar o cortar puntos a otro proyecto, `PantallaMigracion` bloquea toda la
app con el avance ("Puntos, fibras y cables: 32 de 58" y luego "Fotos: 20 de 50 puntos")
y no se puede cerrar. Se quita al terminar con un "Listo", o con un aviso si algo falla
(si fallan las fotos, dice que los puntos ya pasaron). Cortar ya no usa la cola de
sincronización: escribe directo y espera cada documento; sin señal, Firestore lo guarda
en el equipo y la pantalla sigue bloqueada avisando "Sin señal". Las fotos se
independizan esperando al servidor, de a 10 puntos por llamada para no pasar los 9
minutos de la función; sin señal se espera a que vuelva y se reintenta la tanda. En
producción desde el 15/09/26 (**SELLO: 15/09/26, 11:49**).

---

## Armados del proyecto: el nombre se escribe en el editor (16/09)

Crear un armado desde el proyecto (pestaña ARMADOS → + NUEVO) abría el editor sin
ningún sitio para el nombre: solo el buscador de ferretería, y al guardar pedía un
nombre que no se podía escribir. Ahora la cabecera de `EditorArmadoItems` es un campo
escribible —el mismo editor que usa Configuración—, GUARDAR queda deshabilitado
mientras el nombre esté vacío ("PONLE UN NOMBRE ARRIBA") y, al editar desde
Configuración, el nombre cambiado también se guarda: antes se perdía. En producción
desde el 16/09/26 (**SELLO: 16/09/26, 12:47**).

---

## Modo compacto automático en pantallas chicas (16/09)

En una laptop de 1366×768 los botones, formularios y listas no entraban: la app ocupa
justo el alto de la ventana y no se desplaza, así que lo que sobra se corta.
`usePantallaCompacta` mide en vivo el alto y el ancho útiles y pone la clase `compacto`
en la raíz: compacto bajo 800 px de alto o 1200 de ancho, y vuelve a normal recién sobre
840/1240 (histéresis para que no baile en el límite; la regla es pura, está en
`src/utils/pantalla.js` y se prueba con Node). **No cambia el diseño ni el mapa**: solo
achica rellenos, altos de filas y botones y las tipografías grandes, todo desde un bloque
de `src/index.css`, que es donde hay que afinarlo si algo queda raro. En equipos con
mouse los campos bajan a 14 px; en táctil se quedan en 16 para que iPhone no haga zoom al
escribir. En producción desde el 16/09/26 (**SELLO: 16/09/26, 15:44**). Sin decidir con
el usuario: REVISIÓN (cuántas filas de ferretería y qué tan grande la foto).

---

## Las listas de la barra son del proyecto activo (16/09)

La lista de la barra de FIBRA mostraba **todas** las fibras de los días visibles, de
todos los proyectos, mientras su contador contaba solo las del proyecto activo: no
cuadraban y parecía que se cruzaban los ramales. Venía así desde el inicio (no lo trajo
el cable de acero, que solo reusó el mismo filtro de visibilidad). Ahora el **mapa**
sigue dibujando todo lo visible —para ver cómo se conecta con los proyectos vecinos— y
la **lista** de fibra (`conexionesLista`) y la de cables de acero (`lineasProyecto`) son
solo del proyecto activo, con el contador contando exactamente eso. La comparación usa
`perteneceAProyecto`, así que aguanta los `proyectoId` numéricos de los puntos viejos;
antes era `===` y con un id numérico no casaba. En producción desde el 16/09/26
(**SELLO: 16/09/26, 18:07**).

---

## El ítem se numera solo al crear el punto (17/09)

Antes el técnico escribía el ITEM a mano en cada punto, y sin él no se puede guardar
(`validarPunto`). Ahora el formulario lo propone al crear: **P1, P2… P31** en los postes,
**MT1…** en los medios tramos y **C1…** en las cámaras. El número es la **cantidad** de
puntos de esa clase que ya tiene el proyecto, más uno (decidido con el usuario), sin
relleno de ceros. Los prefijos se eligen **al crear el proyecto** (`prefijosItem` en el
documento del proyecto), con P / MT / C por defecto; los proyectos viejos no traen el
campo y usan esos mismos. El FAT no entra: es un equipo pasivo montado en un poste y
lleva el ítem del poste, no uno propio.

La lógica está en `src/utils/itemsAuto.js` (pura, probada con Node). Clasifica igual que
Renumerar —MEDIO TRAMO manda; CÁMARA sobre el equipo pasivo; todo lo demás es poste, con
FAT o sin él— y no propone nada mientras no se sepa qué es el punto. El enganche son dos
sitios: `abrirFormulario`, donde el propietario se hereda del punto anterior y por eso el
ITEM ya sale escrito al abrir, y un envoltorio del setter en `Formulario.jsx` que reciben
solo `GrupoPropietario` y `GrupoElemento`, para recalcular si cambia el tipo. El input del
ITEM sigue con el setter crudo: escribir ahí nunca se interfiere.

**Manda el técnico:** si corrige el ITEM a mano no se le vuelve a tocar (se reconoce
porque lo escrito ya no coincide con ninguna de las tres propuestas). Editando un punto ya
guardado no se toca nunca. Y **esto no cambia nada del orden de posiciones ni de
Renumerar**: solo llena el ítem mientras se crea el punto.

---

## Renumerar items: alcance y los repetidos (19/09)

RENUMERAR ITEMS ya no reescribe siempre el proyecto entero. Arriba se elige **qué
renumerar**, con la cantidad de cada opción a la vista:

- **CON POSICIÓN**, que es lo que viene marcado: solo los puntos con `ordenTendido`.
- **TODOS**: también los que no la tienen, que van al final por orden de creación, como
  se hacía antes. Antes esto no se elegía: se avisaba y punto.

Los conteos de cada grupo y la vista previa siguen esa elección, y la elección se recuerda
por proyecto en `localStorage`, junto con los prefijos y los ceros.

**Los repetidos.** Dejar puntos fuera trae un riesgo: los que no se renumeran conservan su
ítem, y ese ítem puede ser el que el correlativo nuevo le da a otro. Se detecta comparando
los ítems nuevos contra los que se quedan como están —ignorando mayúsculas y espacios, o
avisaría de menos— y se resuelve **agregando una `b` al final** (`P50` → `P50b`); si esa ya
estuviera ocupada sigue con `P50bb`, para no cambiar un duplicado por otro. Se avisa
cuántos son y se hace: **no hay nada que elegir** (decidido con el usuario el 19/09). Los
renombres se escriben en el mismo viaje que el resto y salen marcados en la vista previa.
Ojo: un grupo **sin marcar** también conserva sus ítems, así que también puede chocar.

La cuenta vive en `src/utils/renumerarItems.js`, fuera de la pantalla: probada con Node
(31 casos) y la pantalla en Chrome con `harness-diseno/renumerar.html`, fuera de git (19
comprobaciones: el alcance, los conteos por grupo, el aviso, y que se manden exactamente
las escrituras esperadas). En producción desde el 19/09/26 (**SELLO: 19/09/26, 11:31**).

---

## Revisión de ferretería en tres columnas (19/09)

La pestaña **REVISIÓN** del modal FERRETERÍA (el tab interno se llama `definir`), **en
PC**, pasó de dos mitades a tres columnas, cada una con su propio scroll: la **foto**
(45%), los **ARMADOS** en una sola tira vertical (22%) y los **contadores de ferretería**
(33%). **En celular no cambia nada:** sigue siendo UNA columna hacia abajo, con los dos
bloques juntos y los armados de a 3.

`BloqueLiquidacion` (`Formulario.jsx`) gana dos props opcionales: `solo` (`'armados'` o
`'ferreteria'`), para pedirle una sola de sus dos mitades, y `armadosCols`, para la
grilla. Sin ellas se dibuja como siempre, así que el formulario del punto —su único otro
uso— no cambia. Las clases de la grilla van **literales** (`grid-cols-1` / `grid-cols-3`):
Tailwind no ve las que se arman con plantillas.

**Tres cosas que costaron esta tanda:**

- **`shrink-0` en las tres columnas.** Sin eso un hijo flex cede ancho según su contenido:
  la prueba midió la columna de la foto en **69 px** en vez de 517. Lo mismo le pasaba al
  **panel de días** del mapa: sus filas no lo llevaban y, con muchos días, la columna
  (`max-h-[65vh]`) las aplastaba en vez de desbordar — por eso tampoco llegaba a aparecer
  el scroll que ya estaba puesto. Un `shrink-0` arregla las dos cosas a la vez.
- **El panel de días se pliega cuando son muchos (19/09).** Los días sueltos nunca pasan de
  **7**: al aparecer el octavo, los 7 anteriores se pliegan en una **semana** (`S1`, `S2`…);
  y al aparecer la **quinta** semana, las 4 anteriores se pliegan en un **mes** (`M1`, `M2`…).
  Se pliega siempre **lo más viejo**, así que lo reciente —con lo que se trabaja— queda a la
  vista. Tocar un grupo lo abre y muestra lo que tiene dentro: un mes muestra sus **semanas**,
  una semana sus **días**, y se pueden abrir varios a la vez.
  **La regla es "al superar", no "al completar"**: con 4 semanas todavía no hay mes, hace
  falta la quinta, por simetría con los 7 días sueltos. Para que se pliegue al completar la
  cuarta, quitar el `-1` de `bloquesPlegados`.
  La cuenta vive en `src/utils/agruparDias.js`, fuera de la interfaz, probada con Node (26
  casos, incluido que con 7, 8, 14, 15, 28, 29, 36, 57 y 100 días no se pierda ni se repita
  ninguno). **El render no lleva prueba**: el panel vive dentro de `VistaMapa` y montarlo
  exige el mapa entero. En producción desde el 19/09/26 (**SELLO: 19/09/26, 21:40**).
- **Los grupos miden lo mismo que un día; lo que cambia es el borde (19/09).** Un día es un
  botón de 36 px dentro de un marco con `border-2`, o sea **40 px** de fuera a fuera. El
  grupo, al ser un botón suelto con el borde incluido, medía 36 y se veía más chico: ahora
  va `w-10` con `border-[3px]`, mismo exterior y borde más grueso como única diferencia.
  **FOTOS y MOVER se mudaron a la esquina izquierda**, porque a la derecha se montaban
  encima del panel abierto; la etiqueta del punto seleccionado, que vivía ahí, subió un
  piso. El panel **se arrastra para desplazarlo, solo con ratón**: en el teléfono el dedo
  ya lo mueve por `overflow-y-auto` y activarlo en ambos lo desplazaría el doble; si el
  arrastre movió de verdad, el clic posterior se cancela para no abrir el día donde
  empezaste (**SELLO: 19/09/26, 21:57**).
- **La nubecita SÍ medía menos, y el modo compacto era la causa (19/09).** Era el único
  botón del encabezado con `w-10 h-10`; los otros cinco usan `p-2`, que las reglas
  `.compacto` no tocan. En ventana chica salía de **32×32 contra 40×40**. Ahora usa `p-2`
  como los demás: queda igual **por construcción**, no por coincidencia de números. El
  cuadrado de las semanas y meses tenía exactamente el mismo fallo (el día usa `w-9`, que
  esa lista no redefine), así que ambos pasaron a **40 px en píxeles**, fuera del alcance
  de `.compacto`. Y el grupo **toma el color de los días que agrupa**, de modo que lo único
  que lo distingue es el borde más grueso (**SELLO: 19/09/26, 22:20**).
  **La primera medición dijo que estaban todas iguales, y era mentira**: el harness no
  llevaba la clase `compacto`. Ahora `harness-diseno/encabezado.html` la aplica y además
  incluye un botón de **control** con las clases viejas, que debe seguir saliendo 32×32;
  sin ese control, un verde no probaría nada. Los huecos entre botones sí eran correctos:
  4 px iguales.
- **FOTOS y MOVER se corren solo cuando el panel de días está abierto**, que es cuando se
  montarían encima: pasan de `right-4` a `right-16`, o sea **se corren lo justo y siguen a
  la derecha**; no cambian de lado. (Mudarlos a la esquina izquierda fue un malentendido y
  duró un despliegue.) El panel de días además **no lleva barra de desplazamiento**: la
  clase `sin-barra` de `index.css` la oculta, porque desde que se arrastra sobraba, se
  comía ancho y tapaba los cuadrados. Sigue desplazándose con el dedo, la rueda y el
  arrastre (**SELLO: 19/09/26, 22:34**).
- **Dos trampas del harness que hicieron que una prueba midiera de más (19/09).** Las dos
  salieron el mismo día y conviene recordarlas antes de fiarse de un verde:
  - **Una clase arbitraria de Tailwind que solo exista en `harness-diseno` NO se genera.**
    El escaneo mira `./src` y `./index.html` (ver `tailwind.config.js`), así que un
    `max-h-[300px]` puesto solo en el harness no llega nunca al CSS: el panel se quedó sin
    límite de alto, no desbordaba y la prueba medía otra cosa. En el harness, esas medidas
    van en **estilo inline**. (Las clases arbitrarias que además existen en `src`, como
    `w-[45%]`, sí se generan; por eso otras pruebas se salvaron de casualidad.)
  - **El Chrome de las pruebas usa barras SUPERPUESTAS**, que no reservan ancho: entonces
    `offsetWidth - clientWidth` da 0 con o sin la clase y no distingue nada (el flag
    `--disable-features=OverlayScrollbar` no lo cambió). Lo que sí separa los dos casos es
    la regla aplicada: `scrollbar-width: none` contra `auto`.
  En ambos casos **el panel de control fue lo que delató el problema**: al salir idéntico
  al caso bueno, quedó claro que la prueba no medía nada. Sin control, habría cantado
  victoria dos veces.
- **El mapa detrás del panel de fotos es OTRO mapa (19/09).** En PC, al abrir las fotos,
  `App.jsx` monta encima a pantalla completa un `MiniMapaRevision` — el mismo componente de
  Revisión—, que dibuja **sus propios** marcadores. Por eso parecía que el modo fotos
  "cambiaba" los iconos a celeste y encendía etiquetas: el mapa del usuario sigue debajo,
  intacto. Ahora ese minimapa acepta `obtenerColorDia` y `mostrarEtiquetas` (opcionales,
  así Revisión no cambia): respeta el color del día, **resalta el activo por tamaño y halo
  en vez de por color**, y solo rotula si el usuario tiene las etiquetas encendidas.
- **En el panel de fotos, el botón de salir dice ATRÁS hasta que se toca algo.** Antes
  decía siempre GUARDAR FOTOS aunque no guardara nada: cada foto se guarda sola al tomarla.
  Pasa a GUARDAR FOTOS si se tomó, se retomó o se borró alguna (**SELLO: 19/09/26, 23:33**).
- **Pantalla negra al abrir las fotos (19/09), y cómo se llegó a ella.** En `App.jsx`
  **no existe** ninguna variable `obtenerColorDia`: solo existe como *nombre de prop*, con
  la función armada en línea (`(diaId) => filtrosVisibilidad.obtenerColorDia(diaId, ...)`).
  Al pasarle `obtenerColorDia={obtenerColorDia}` al minimapa del panel de fotos se
  referenció algo inexistente y reventó al montar. **Ni ESLint ni Vite lo detectan y el
  build pasa**, tal como avisa `CLAUDE.md`. Detrás había un segundo fallo tapado por el
  primero: esa función recibe un **`diaId`**, no el punto, así que el color habría salido
  vacío igual. Antes de pasar una prop "que ya existe", comprobar que existe **como
  variable** en ese archivo y con qué argumento se la llama.
- **Dos cosas que salieron al verificar esa tanda, y conviene no repetir:**
  - **Un `const` no sube.** El estado nuevo quedó declarado *después* de sus usos y habría
    reventado al tomar la primera foto. Lo delató el grep de verificación, no el lint.
  - **El conteo de lint puede moverse sin que hayas roto nada.** El conjunto del mapa pasó
    de 46 a 47 por un error que **ya existe en HEAD** (`tabsConfig cannot be modified`,
    `react-hooks/immutability`): al correrse las líneas, el compilador corta en otro punto
    y lo deja ver. Antes de dar por propio un número que sube, lintear **ese archivo suelto
    desde HEAD** y comparar.
- **El modo `compacto` redefine alturas de Tailwind.** `src/index.css` trae reglas como
  `.compacto .h-14 { height: 2.5rem }` (y `h-24`, `h-20`, `h-16`, `h-12`, `h-10`, `w-10`)
  que se aplican cuando la ventana es chica: `App.jsx` le pone la clase `compacto` al
  contenedor raíz. **Cambian el alto pero casi nunca el ancho**, así que un `w-14 h-14`
  sale de 56×40 y parece achatado. Los botones flotantes del mapa (FOTOS / MOVER / DÍA)
  se arreglaron pasando de `h-14` a **`aspect-square`**: el alto sale del ancho y no hay
  altura que pisar (**SELLO: 19/09/26, 21:09**). Antes de eso se les puso `shrink-0`
  culpando a flex, **y no era la causa**: si algo con medidas fijas sale deformado en
  ventana chica, mirar primero las reglas `.compacto` de `index.css`.
  La prueba (`harness-diseno/botones.html`, fuera de git) mide los botones con la clase
  `compacto` activa **y también uno "como estaba"**, que debe salir 56×40: sin ese
  control la prueba no distinguiría el fallo y habría dado por bueno el arreglo anterior.
- **Los avisos del mapa no flotan sobre el nombre del proyecto: lo empujan.** El "Sin GPS"
  se pintaba dentro de `Mapas.jsx` con `position: absolute` y se montaba encima de los
  botones del `Header` y del rótulo del proyecto. Ahora `MapaReal` **solo avisa hacia
  afuera** (`onGpsError`) y el aviso se pinta como **primer hijo** de la columna de la
  esquina superior derecha de `VistaMapa.jsx`, la misma del nombre del proyecto: cuando
  aparece lo empuja hacia abajo y, cuando no está, el nombre sube solo. El reintento va por
  `gpsTrigger`, la misma vía del botón de GPS, para no duplicar la lógica interna del mapa
  (**SELLO: 19/09/26, 21:29**). Cualquier aviso nuevo de esa esquina va en esa columna, no
  flotando aparte.
- **`bg-brand-50` no existe.** La paleta `brand` de `tailwind.config.js` define **solo los
  tonos 500 y 600**. Los botones del encabezado (días, etiquetas, simbología) usaban
  `bg-brand-50` para el estado activo: Tailwind no genera esa clase, así que quedaban
  **sin fondo** y sobre el satélite se veía el mapa a través. El de sincronización tenía el
  mismo efecto con fondos al 10 % de opacidad (`bg-emerald-500/10`). Ahora todos llevan
  `bg-white` y el color del estado en el borde y el icono. **Antes de usar un tono de
  `brand`, comprobar que exista en la config.**
- **"PC" no mira el ancho.** `useIsDesktop` es `(hover: hover) and (pointer: fine)`, o sea
  "¿tiene mouse?": una ventana angosta en una laptop sigue contando como PC. Se decidió
  con el usuario **no** poner umbral de ancho, porque la app se usa a pantalla completa.
- **El harness puede mentir.** La maqueta ya tenía el 45% mientras el archivo real seguía
  en `w-1/2` (la edición no había aterrizado), así que la prueba estuvo midiendo algo
  distinto de lo que iba a producción: 50+22+33 = **105%**. Verificar el archivo real, no
  solo la maqueta.

**La grilla de posiciones dice qué es cada punto (19/09).** En la grilla que se abre al
tocar el título (ITEM / Posición) va ahora **arriba el ITEM, grande**, y debajo la
posición; antes era al revés. El fondo pasó a decir **qué es** cada punto, pero **solo una
vez aprobado**: medio tramo **amarillo**, cámara **azul**, poste con equipo pasivo
**naranja**, poste normal **verde**. Sin revisar va **blanco** (decidido con el usuario:
"cuando no está con el check") y **desaprobado sigue rojo**, porque es una marca puesta a
propósito y se perdería si también fuera blanco.

**El puntito naranja no marca los medios tramos**, aunque lo parezca: marca que falta
`datos.tipoPoste`, y coincidía porque un medio tramo nunca lo lleva. Se conserva, pero
**solo en postes**: en un medio tramo o una cámara estaría siempre encendido sin avisar de
nada.

La decisión de color vive en `src/utils/grillaPosiciones.js`, fuera de la interfaz, porque
**esta grilla está duplicada** en los dos modales (FERRETERÍA → Revisión y REVISIÓN) y se
cambian juntas para que no se separen. Probada con Node (28 casos); el render en sí no
lleva prueba, por lo mismo que lo de abajo. En producción desde el 19/09/26
(**SELLO: 19/09/26, 14:45**).

**La lista se ordena sola al guardar y al aprobar (19/09).** Antes solo se acomodaba con
el botón **ORDENAR**; ahora **ACTUALIZAR** y el **✓ verde** encienden el mismo orden, que
sube arriba la ferretería con cantidad. Va dentro de `guardarPuntoFerr` y de `aprobar`, no
en los botones: `aprobar` solo pasa por el guardado **si hay cambios**, así que aprobando
un punto ya guardado no se ordenaría. Se sigue apagando solo al pasar al siguiente punto
(el efecto que reinicia `subirActivas` con `idx`). Esto **no lleva prueba de pantalla**: el
modal depende de Firestore y el harness apunta a un emulador que no existe, donde un
`await updateDoc` no resuelve; el mecanismo que ordena es el del botón ORDENAR, ya en uso.
En producción desde el 19/09/26 (**SELLO: 19/09/26, 14:04**).

El reparto se calcula sobre el ancho **interior** del modal: está topado en `max-w-6xl`
(1152 px) y el borde descuenta 4, o sea 1148 px reales. Probado en Chrome con
`harness-diseno/revision3col.html`, fuera de git (14 comprobaciones: el reparto, los
armados en una sola tira, que cada mitad caiga en su columna y que en celular sigan
juntos). En producción desde el 19/09/26 (**SELLO: 19/09/26, 12:28**).

---

## El punto azul con cono de linterna (17/09)

El punto azul ahora lleva un cono que apunta hacia donde mira el equipo, como la
linterna de Google Maps. Sale de la brújula del teléfono, no del GPS: el rumbo del
GPS solo existe si te estás moviendo, y en campo se mira parado.

La cuenta está en `src/utils/rumbo.js` (pura, probada con Node). Cada sistema informa
distinto: el iPhone da `webkitCompassHeading`, que ya es un rumbo; Android da `alpha`,
que crece al revés, así que el rumbo es 360 − alpha. Una lectura que no sea absoluta
se descarta: dice cuánto giraste desde que empezaste, no hacia dónde mirás. El valor
se suaviza para que el cono no vibre, y **cuando el suavizado ya alcanzó la lectura
real se fija el valor exacto**: sin eso el cono quedaba para siempre tres o cuatro
grados corrido, porque cada paso es una fracción de lo que falta y los pasos chicos
dejaban de repintarse. Lo cazó la prueba en Chrome, no la vista.

`src/hooks/useRumbo.js` escucha el sensor y deduce el estado en el render (nada de
`setState` dentro del efecto, que el lint marca). **Escucha primero y pregunta
después:** el botón **ACTIVAR BRÚJULA** solo aparece si pasan 2,5 segundos sin una
sola lectura y además el sistema sabe pedir permiso. La primera versión preguntaba de
entrada —"¿el sistema expone `requestPermission`?"— y en campo el aviso salía también
en Android, porque Chrome la expone aunque no la necesite. Al conceder el permiso se
vuelve a suscribir, porque iOS no revive los oyentes viejos. El botón se limita a
equipos táctiles: en una PC con mouse sería puro ruido. Si no hay brújula, si el
equipo no informa nada o si el usuario rechaza, no hay cono y queda el punto azul.

El cono se dibuja con un degradado **anclado a la posición del técnico**
(`gradientUnits="userSpaceOnUse"` centrado en el vértice). Midiéndolo contra la caja
del triángulo —lo que hace SVG por defecto— quedaba tenue y descentrado.

No escribe nada: ni Firestore, ni red, ni almacenamiento. Es solo pantalla.

**Arreglado el 18/09: el cono y el punto eran dos piezas sueltas.** En campo se veía
"bailar" el cono respecto del punto, y el punto quedaba tapado. Dos causas, las dos
concretas:

1. **El ícono se rehacía en cada lectura de la brújula** (varias veces por segundo),
   así que Leaflet reemplazaba el elemento del DOM, la animación del punto se
   reiniciaba y el conjunto parecía descoserse. Ahora el ícono se construye **una sola
   vez** y al cambiar el rumbo solo se le escribe el giro al cono, directo en el DOM.
   Es la misma lección del giro del mapa: lo que cambia muchas veces por segundo no
   pasa por React.
2. **El punto estaba 3 px arriba y 3 a la izquierda** del origen del cono —4,24 px de
   separación, idéntica en todos los rumbos—. La causa: el reset de Tailwind pone
   `box-sizing: border-box`, con lo cual el punto de 20 px con borde de 3 mide 20 y no
   26, y la cuenta a mano (`left:25px`) quedaba corrida. Se centra por **porcentaje**
   (`left:50%; top:50%; translate(-50%,-50%)`), que es inmune al reset.

El cono va **detrás** del punto: el degradado arranca transparente en el primer tramo
y el punto se dibuja por encima. Verificado con 25 casos en Chrome, que miden la
separación entre ambos centros (0,00 px en todos los rumbos) y que el elemento del
ícono **sobrevive** a los cambios de rumbo.

---

## Girar el mapa: rehecho por dentro de Leaflet (18/09)

> **Estado:** `GIRO_MAPA_ACTIVO` en `App.jsx` está en `true`, detrás de `esAdmin`. Las
> cuadrillas siguen sin verlo. Para apagarlo, basta poner ese interruptor en `false`.

**Por qué se apagó.** Probado en campo el 17/09, el giro salió entrecortado, el zoom
saltaba al acercar y en iPhone el navegador se quedaba con el gesto (zoom de la página
y "tirar para refrescar"). Las tres cosas vienen del mismo error de enfoque: corregir a
Leaflet **desde afuera**. Cada agujero tapado abría otro —arreglar el clic obligó a
arreglar el arrastre, eso obligó a apagarle a Leaflet sus manejadores, y sin sus clases
Leaflet deja de poner `touch-action: none` ([leaflet.css](node_modules/leaflet/dist/leaflet.css)),
que es justo lo que protege el gesto en iOS—. Además, escribir el ángulo en el estado de
React en cada movimiento de dedo redibuja todos los postes por cuadro: de ahí el tirón.

**Cómo quedó hecho.** `src/utils/giroLeaflet.js` le enseña el ángulo a Leaflet parcheando
la **instancia** del mapa (no el prototipo: el mapa del modo Diseño no se entera). Son
dos piezas y nada más:

1. **`mouseEventToContainerPoint`**, que es el embudo por donde pasan el clic, el toque
   y **los dos dedos del pellizco** ([leaflet-src.js:14328](node_modules/leaflet/dist/leaflet-src.js#L14328)).
   Corregido ahí, el foco del zoom deja de saltar **solo**, sin tocar el zoom.
2. **El desplazamiento del arrastre**, enganchándose a `predrag`, el aviso que Leaflet
   lanza justo antes de aplicar la posición ([leaflet-src.js:6120](node_modules/leaflet/dist/leaflet-src.js#L6120)),
   en vez de copiar su código. Ahí se gira el corrimiento a la referencia del mapa y se
   deshace su corrección de escala, que mide con el rectángulo en pantalla y con el mapa
   torcido miente (la caja que envuelve a algo girado es más grande).

Sus manejadores quedan **encendidos**, así que conserva la inercia, el zoom suave y el
`touch-action`. Del gesto propio solo queda mirar el ángulo de los dos dedos, y **se
pinta en el DOM**, no en el estado de React: pasarlo por React redibujaba los cientos de
postes cuadro a cuadro, y de ahí venía el tirón. React se entera al soltar los dedos.

El contenedor se dibuja cuadrado (`150vmax`) **desde el arranque** mientras el giro esté
habilitado: si solo se agrandara al torcerlo, aparecerían esquinas vacías a mitad del
gesto.

**Verificado con 26 casos en Chrome:** el arrastre sigue al dedo con 0,00 m de error a
25°, 90°, 180°, 200° y 300°; el sitio entre los dedos no se mueve al acercar (0,04 m) y
el zoom sube de 19 a 20; tocar donde se ve un sitio devuelve ese sitio; los globitos
quedan derechos y encima del poste; y no hay errores en la consola. Sigue valiendo la
geometría de `src/utils/giroMapa.js` (64 casos en Node).

Una trampa del banco de pruebas, por si vuelve a aparecer: los toques hay que lanzarlos
**sobre el contenedor del mapa**. Leaflet toma el `touchstart` ahí y sigue el movimiento
en el `document`; lanzarlos directamente sobre el `document` no le llega a nadie de
abajo, y además Leaflet lo toma como objetivo del arrastre y revienta con `baseVal`.

---

## Lo que ya estaba construido y probado (17/09)

**Ya está en el código, detrás de la bandera de admin y sin nada que lo active
todavía** (no hay gesto ni botón: `giro` siempre vale 0, así que para las cuadrillas
el mapa es exactamente el de siempre). Lo construido:

- `src/utils/giroMapa.js`, pura y probada con Node (64 casos): des-girar un punto,
  tamaño del contenedor, ángulo de las etiquetas de fibra, el gesto de dos dedos y
  qué herramientas exigen el norte.
- En `Mapas.jsx`: un marco que recorta y, dentro, un cuadrado de `150vmax` que gira
  (cubre cualquier ángulo sin esquinas vacías); la corrección del toque antes de
  convertirlo a coordenada; el enderezado automático al activar herramientas —que no
  borra el giro elegido, lo ignora mientras dura y lo devuelve al terminar—; y el cono
  de la brújula compensado (`rumbo − giro`).
- `giro` vive en `useMapState`, para que el encabezado pueda leerlo después.

**Lo verificado, que era la condición para tocar la app:** con el mapa girado a 25°,
90°, 180° y 300°, tocar donde se ve un sitio devuelve ese sitio, con un error máximo
de **0,30 m — un píxel**, que es el redondeo del clic. Sin girar, 0,00. O sea: no hay
poste corrido. Dos pruebas en Chrome lo cubren: una sobre un mapa Leaflet armado a
mano y otra por el camino real de la app (`MapaReal` → `handleMapaClick`, que es quien
crea los puntos).

Un error que costó encontrar y conviene no repetir: la esquina del cuadrado que gira
**no se puede leer con `getBoundingClientRect`**, porque al estar girado el navegador
devuelve la caja que lo envuelve, no su esquina. Se deduce de su tamaño de maquetación
y del centro del marco. Con la cuenta mal, el error era de 42 m parejos a todos los
ángulos.

**El gesto y el botón, ya construidos.** Se gira con **dos dedos**: la separación la
sigue manejando Leaflet (es el zoom de siempre) y nosotros solo miramos el ángulo, así
que acercar y girar salen del mismo gesto. Hay una zona muerta de 12° para que un
pellizco apenas torcido no empiece a girar sin querer, y al cruzarla el giro **arranca
desde ahí**, no desde cero: si no, el mapa pegaría un tirón. Eso hace que girar los
dedos 60° deje el mapa en unos 45°, que es el comportamiento buscado.

El **botón de GPS** ahora depende de si el mapa está torcido: con giro, un toque lo
endereza al norte y dos toques van a mi ubicación, y la flecha se inclina mostrando
dónde quedó el norte. **Sin giro no cambia nada**: un solo toque va a la ubicación, sin
esperas, como siempre.

**Las etiquetas** también están: el globito del ítem cuelga de un punto sin tamaño
puesto en el centro del ícono y se contra-gira, así queda horizontal y encima del poste
en vez de orbitarlo; las de fibra siguen su línea pero deciden el volteo contra el
ángulo real en pantalla, para no leerse de cabeza. Probado en Chrome a 0°, 40°, 90° y
200°, midiendo que la caja que envuelve al globito coincida con su tamaño de
maquetación, que solo ocurre si está derecho.

**Lo que falló en campo y por qué (probado el 17/09).** Corregir el TOQUE no alcanzaba:
Leaflet también lee el **arrastre** y el **pellizco** como si el norte siguiera arriba.
Al desplazar con un dedo el mapa se iba en diagonal, y al acercar saltaba a otro lado
porque calculaba el punto entre los dedos contra el contenedor sin girar. Ninguno de
los dos ensuciaba datos —son navegación—, pero hacían el giro inservible. Ahora,
mientras el mapa está torcido, se le **apagan a Leaflet sus dos manejadores**
(`dragging` y `touchZoom`) y los lleva `MapaReal`: el arrastre gira la distancia al
revés antes de aplicarla, y el pellizco se ancla al sitio que quedó entre los dedos,
por pasos enteros de zoom. Al volver al norte se le devuelven y todo queda como siempre.

Una regresión que dejó la prueba a la vista: al principio condicioné **todo** el gesto a
que el mapa ya estuviera girado, y así **no se podía empezar a girar desde el norte**,
que es el caso normal. Girar está siempre disponible; lo que se toma prestado solo con
el mapa torcido es el arrastre y el pellizco.

**Lo único que queda del diseño acordado:** decidir si la camarita de la capa de fotos
se endereza o gira (da igual, es una línea), y abrirlo más allá del admin cuando el
usuario lo apruebe en campo.

---

## Girar el mapa: lo decidido (17/09)

Conversado a fondo el 17/09 y listo para programar. **Leaflet no gira de fábrica**, y
los dos complementos que existen quedaron descartados con datos: `leaflet-rotate` es
**GPL-3.0** (copyleft dentro del bundle que se distribuye: problema legal, no técnico,
en una app privada) y `leaflet-rotate-map` es BSD pero **no es un complemento, es un
Leaflet entero modificado** por una sola persona. MapLibre gira nativo y es BSD, pero
es rehacer la capa del mapa completa, necesita WebGL —que en celulares flojos puede
no andar— y **no arregla los nombres de calles**, que seguirían siendo una imagen
mientras usemos Google + CARTO.

Así que el giro se hace **con código propio**: girar el contenedor con CSS y corregir
a mano lo poco que eso descoloca. Lo acordado:

- Gesto de **dos dedos**, zoom y giro a la vez, con una zona muerta para no girar sin
  querer. Giro siempre a mano: el mapa nunca se mueve solo siguiendo la brújula.
- El botón de GPS: **un toque endereza al norte, dos toques van a mi ubicación**, y la
  flecha muestra dónde quedó el norte.
- **El mapa se endereza solo al activar** mover, dibujar fibra, acero, ajustar, ordenar
  o corregir. Esa regla es la que hace todo seguro: arrastrar y dibujar ocurren siempre
  con el norte arriba, como hoy.
- La conversión del toque a coordenada se corrige **en un solo lugar**: crear un punto y
  poner un vértice libre usan el mismo valor (`e.latlng` en `mapInteractions.js`), y
  tocar un poste ya usa su coordenada guardada, que es inmune al giro.
- **Los íconos giran** con el mapa (el cuadrado queda rombo, y está bien). **Las
  etiquetas no**: se contra-giran tomando el centro del ícono como referencia, así
  quedan horizontales y siguen encima del punto. El número de orden vive dentro del
  ícono, pero solo aparece en ordenar y corregir, que enderezan el mapa: se resuelve solo.
- Las etiquetas de fibra siguen la línea, calculadas **desde la pantalla** en vez de la
  geografía, para que el giro se corrija solo y nunca queden cabeza abajo.
- El contenedor se dibuja más grande mientras está girado (una pantalla girada deja las
  esquinas vacías). Las imágenes ya se cachean 30 días, así que el costo es menor.
- **El cono es el único que gira a propósito**: su ángulo es el rumbo menos el giro.
- Modo Diseño queda fuera y puede romperse; se rehará.
- Entra **detrás de la bandera de admin** y con interruptor: apagado, el mapa se comporta
  exactamente como hoy.

Pendiente de decidir: si la camarita de la capa de fotos se endereza o gira (da igual, es
una línea). Y una mejora que salió de la charla y vale por sí sola, con giro o sin él:
**dibujar solo los postes que entran en la pantalla** más un margen, en vez de todos los
del filtro de días (`getPuntosVisibles` no mira el encuadre). Hay que conservar siempre
el seleccionado, el temporal, el resaltado y los del trazo en curso.

---

## Mil puntos en pantalla: aligerar el mapa (18/09, en curso)

Un proyecto pasó los **mil puntos** y en el celular se siente al **alejarse y al mover**
el mapa. Dos causas medidas, no supuestas: hoy se dibuja **un elemento por cada punto
que pasa el filtro de días**, no por lo que entra en pantalla
([filtrosVisibilidad.js:11](src/utils/filtrosVisibilidad.js#L11)), y el HTML de cada
marcador **se arma de nuevo en cada redibujo** (no está memorizado).

Conviene no mezclar los dos casos, porque las soluciones difieren: **al mover** pesan
los mil elementos y su reconstrucción; **al alejarse** los mil entran en la vista y el
navegador los pinta todos — ahí dibujar solo lo visible **no sirve**, porque todo es
visible.

Plan acordado con el usuario, por fases:

1. **Hecho:** fuera las sombras de los tres marcadores masivos (el `drop-shadow` del
   triángulo era el peor, por ser un filtro). Se conservó el **anillo** del cuadrado,
   que es información de selección y no decoración.
2. **DESCARTADA**, y conviene no volver a intentarla tal cual. Memorizar los íconos
   exigía sacar el marcador a su propio componente, pero cada uno depende de **trece
   cosas** que se calculan dentro del bucle (`previewAjuste`, `apoyadosAjuste`,
   `correccionSel`, `prefijoOrden`, `ordenSeleccion`, `ordenTrabajo`,
   `puntosSeleccionadosMover`, `trazoAcero`, `postesEnFibra`, `puntosRecorrido`,
   `coloresArmado`, `etiquetasVisibles`, `iconSize`). Varias son arreglos y conjuntos
   que **se crean nuevos en cada render**, así que la comparación de `React.memo`
   fallaría siempre y saldría más caro que hoy. Estabilizarlas es reescribir el
   componente entero, con riesgo en los modos de ordenar, corregir, ajustar y acero.
   La fase 3 ataca el mismo síntoma sin tocar nada de eso.
3. **Hecho:** dibujar solo lo visible. `recortarAlEncuadre` descarta los puntos fuera
   del encuadre con un **margen del 60%** a cada lado, para que ya estén dibujados antes
   de asomar y no aparezcan de golpe al desplazar. El encuadre lo informa `MapController`
   al terminar cada movimiento (`moveend`), no en cada cuadro: recortar mientras el dedo
   arrastra sería peor que no recortar. La **lista de excepciones** se dibuja siempre,
   esté donde esté: el seleccionado, el resaltado, el trazo en curso, los marcados para
   mover, ordenar o corregir, y las puntas del cable de acero. Sin eso se rompen cosas
   que dan por hecho que el marcador existe, como arrastrar uno que se salió del borde.
4. **Hecho:** **etiquetas ocultas por zoom** (16 o más lejos), con un aviso de que están
   activas pero ocultas, para que nadie las dé por apagadas.

   Y la otra mitad, resuelta de raíz por decisión del usuario: en vez de simplificar el
   símbolo solo de lejos, **el mapa pasó a tener una sola geometría, siempre**. El
   triángulo del medio tramo y el cuadrado de la caja de equipo **ya no existen**:
   - **Medio tramo:** círculo **amarillo siempre**, borde y punto centrales **blancos**.
     El amarillo se mantiene incluso con la simbología encendida.
   - **Caja de equipo** (mufa, xbox, hbox, fat): círculo **del color del día**, como un
     poste, con borde y punto centrales **negros**.
   - Lo que cambia de color sigue siendo el **estado de trabajo** (ámbar si el ajuste lo
     va a mover, verde si ya está anclado, naranja al corregir): eso es información y se
     conservó.

   Con una sola forma, el dibujo es más barato en todos los zooms —no solo de lejos— y
   queda el camino abierto por si alguna vez se pasa a lienzo, donde el círculo sale casi
   gratis y un triángulo habría que pintarlo a mano. También desapareció la excepción de
   tamaño: el cuadrado se dibujaba más chico, y ahora miden todos igual. Las burbujas de
   grupo siguen el mismo lenguaje. Las formas vivían **solo** en `Mapas.jsx`; el minimapa
   de REVISIÓN ya usaba círculos, así que no quedó ninguna vista contradiciendo al mapa.
5. **Hecho:** **agrupar por cercanía**, en `src/utils/agruparPuntos.js` (puro, 29 casos
   en Node). Umbrales que eligió el usuario mirando el zoom en pantalla, **uno más por
   cada nivel que se aleja**: 18 o más cerca no se agrupa, **17 junta 2, 16 junta 3, 15
   junta 4**, y así. No se le puso techo: el freno real lo da la celda, porque solo se
   juntan los que están pegados en la pantalla.

   La burbuja se ve **igual que un marcador suelto** —mismo tamaño y mismo color del
   día, con la cantidad dentro—; el medio tramo conserva su triángulo amarillo. Fue una
   corrección del usuario: la primera versión los pintaba negros y más grandes, y el
   mapa cambiaba de aspecto al alejarse. **Nunca mezcla clases** (postes, medios tramos
   y cámaras van por separado) y tocarla acerca el mapa.

   Lo que está en juego jamás se agrupa: el seleccionado, el resaltado, el trazo en
   curso, los marcados para mover, ordenar o corregir, y las puntas del cable de acero.
   Y agrupar afecta **solo al dibujo**: el arrastre y el imantado siguen recibiendo la
   lista completa. Probado sobre el mapa real con 25 casos en Chrome, que verifican
   además que **no se pierda ni se repita ningún punto** en ningún zoom.

El lienzo (canvas) queda para el final y solo si hace falta: los círculos salen casi
gratis, pero triángulos, cuadrados y globitos habría que dibujarlos a mano. Sin decidir:
si a la distancia todo pasa a ser círculo —más rápido, pero se pierde la forma que hoy
dice de un vistazo qué es cada cosa—.

**El zoom se queda donde lo dejás (18/09).** Molestaba que al soltar el pellizco el
mapa "se regresara": Leaflet trae `zoomSnap` en **1**, así que solo admitía niveles
enteros y al terminar el gesto redondeaba. Ahora está en **0,5**, o sea que se queda
en medios (17 · 17,5 · 18). `zoomDelta` sigue en **1**, para que el doble toque salte
un nivel entero, que es predecible. El precio: entre niveles la imagen se estira un
poco, porque cada nivel entero tiene su propia foto. Si hace falta afinar más, los
siguientes escalones serían cuartos (0,25) o libre del todo (0).

Ojo con una consecuencia: los cortes de **agrupar** y de **ocultar etiquetas** usan el
zoom redondeado, así que 17,4 se comporta como 17 y 17,6 como 18. Con zoom fraccionario
esos cambios se notan a mitad del gesto, no al soltar.

Y un apunte de vocabulario, porque confunde: las lupas **+/−** de la barra superior
**no son zoom**, cambian el tamaño de los íconos (`iconSize`). El mapa no tiene botones
de zoom propios (`zoomControl={false}`).

> **PENDIENTE DE QUITAR:** el número de **ZOOM** flotante abajo a la izquierda es
> **temporal** y solo lo ve el admin (`mostrarZoom`). Está para fijar con datos los
> umbrales de las fases 4 y 5. Cuando estén decididos, se quita de `App.jsx`,
> `VistaMapa.jsx` y `Mapas.jsx`.

---

## Pendientes fuera del diseño

- **Adelgazar el bundle.** El arranque pesa 703 KB comprimidos, casi todo en un
  solo trozo: cualquier cambio obliga a rebajar 2,4 MB en cada actualización, y
  en campo con poca señal se siente. Candidatos: sacar ExcelJS a su propio trozo
  y revisar `jszip`, que sigue en `package.json` pero ya no se usa en `src/`.
- **`npm install` después de cada pull que traiga dependencias nuevas**, en la raíz
  y también dentro de `functions/` si cambió su `package-lock.json`. En la laptop
  faltaban `jsqr`, `qrcode` y `puppeteer-core` y la compilación fallaba.
- **La credencial del remoto de git va en la URL en texto plano** (en la otra PC).
  Conviene quitarla y autenticar por el gestor de credenciales de Windows o
  `gh auth login`.
- **Cloud Functions en Node 24 desde el 14/09: falta probar una exportación real.**
  Node.js 20 dejaba de estar soportado el 30/10/2026. Se desplegaron las 13
  funciones con Node 24 (GA hasta el 30/04/2028), `firebase-functions` 7.3.2 y
  `firebase-admin` 13.10.0; `firebase functions:list` las muestra en `nodejs24`.
  Antes, en local, cargaron con definiciones idénticas (triggers, memoria, tiempos).
  No se tomó `firebase-admin` 14: elimina `admin.firestore()`, `admin.storage()` y
  `admin.auth()`, que usa todo `functions/index.js`, y cambia el manejo de errores;
  pasar a 14 es reescribir las importaciones.
- Ferretería automática (cálculo de materiales), pausado.
- Endurecer reglas de Firestore y activar App Check antes del lanzamiento público.
- El aviso de actualización recarga la página: conviene que no aparezca mientras
  hay un formulario o una captura de foto abiertos.
