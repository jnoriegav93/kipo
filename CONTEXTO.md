# Contexto de trabajo — dónde va todo

Documento de traspaso entre sesiones y entre máquinas. Se actualiza al cerrar
cada tanda de trabajo. Las reglas de cómo trabajar en el repo están en
`CLAUDE.md`; esto es el **estado**.

Última actualización: 14 de septiembre de 2026.

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
usuario el 14/09.

- **Dónde se dibuja.** Selector FIBRA | ACERO arriba de la barra que abre el botón
  FIBRA. En ACERO la barra es otra (`src/components/BarraAcero.jsx`) y no comparte
  nada con la de fibra: trazo de **exactamente dos postes** (tocar el mapa vacío no
  hace nada; un tercer poste cambia el segundo), lista, borrar y ver/ocultar.
- **Datos.** Colección propia `cablesAcero`:
  `{ puntos: [A, B], ferrId, proyectoId, diaId, ownerId, timestamp }`. Va aparte de
  `conexiones` a propósito: todo lo que lee fibras (metros por capacidad, reparto
  de postes en ramales, KMZ) lo contaría como fibra de 12 hilos, y las versiones
  viejas de la app lo verían como fibra. No guarda geometría: se mide siempre con
  la posición actual de sus dos postes.
- **Metros a liquidar.** Distancia entre postes **+ 1 m, redondeado al metro
  superior** (`metrosCableAcero` en `src/utils/cablesAcero.js`, probado con Node).
- **Tipos de cable.** Ítems del catálogo marcados `porMetro` (en la semilla: CABLE
  MENSAJERO 1/8 y 3/16, con unidad `mts`). Se marcan en Configuración → Ferretería
  (botón de regla) o en la ferretería base del admin. Salen del catálogo del
  dueño del proyecto, como el resto de la ferretería.
- **Fuera de la ferretería por poste.** Los ítems `porMetro` no se ofrecen en los
  contadores del punto ni en los armados, y al aplicar un armado se ignoran. Solo
  aparecen si un punto ya traía cantidad, para poder quitarla: las cantidades
  viejas las corrige el usuario, el código no las compensa.
- **Dónde suma.** Excel de liquidación de materiales, Control Ferretería
  (consolidado), comparativo de ferretería del proyecto y, en el reporte de tendido
  del servidor, una tabla "CABLE DE ACERO" en metros dentro del RESUMEN, aparte del
  total de piezas. En los reportes de una fila por poste (cuantificado y listado de
  utilizados) cada cable va en la fila del **segundo de sus dos postes** según el
  orden de posición (`metrosAceroPorPoste`), así cuenta una sola vez, igual que la
  distancia al poste anterior. En el KMZ (cliente y servidor) va una carpeta
  "Cables de acero". No entra en la hoja DATOS del servidor ni en el RF de ferretería.
  La regla de metros está copiada en `functions/index.js`: si cambia, cambia en los dos.
- **Ciclo de vida.** Borrar un poste borra sus cables (papelera tipo `acero`, que
  restaura si los dos postes existen). Copiar/cortar puntos los lleva si van sus
  dos postes. Borrar proyecto (lista, equipos, admin) los incluye. Salir de un
  equipo los copia.
- **Despliegue.** **Todo en producción el 14/09/26**, desde la laptop (que ya tiene
  `firebase login` hecho): reglas, hosting (**SELLO: 14/09/26, 16:00**) y la función
  `procesarExportacion`. Antes de desplegar las reglas se comparó lo publicado con el
  repo y no había nada que existiera solo en producción. El orden importa: sin las
  reglas, guardar un cable falla por permisos (los reportes del cliente no se
  rompen: cuentan cero cables).

Probado con Node (regla de metros), con lint (ningún error nuevo en los 22 archivos
tocados) y compilando. También en Chrome con una página local (`harness-diseno/acero.html`,
fuera de git): VistaMapa real con el mismo cableado que App sobre tres postes
falsos. Se probó el selector, que el mapa vacío no agrega nada, dos postes →
31 m, tipos solo por metro, guardar, tercer poste, ATRÁS, lista, cambio de tipo,
borrar y vuelta a FIBRA. **No probado todavía en la app real con Firestore**:
tocar dos postes, guardar, recargar, ver la lista y liquidar.

La liquidación no se rompe si se sube el hosting antes que las reglas: un "sin
permiso" al leer `cablesAcero` cuenta como cero cables, porque sin reglas tampoco
pudo guardarse ninguno. Cualquier otro error sí hace fallar la liquidación.

---

## Pendientes fuera del diseño

- **Adelgazar el bundle.** El arranque pesa 703 KB comprimidos, casi todo en un
  solo trozo: cualquier cambio obliga a rebajar 2,4 MB en cada actualización, y
  en campo con poca señal se siente. Candidatos: sacar ExcelJS a su propio trozo
  y revisar `jszip`, que sigue en `package.json` pero ya no se usa en `src/`.
- **`npm install` después de cada pull que traiga dependencias nuevas.** En la
  laptop faltaban `jsqr`, `qrcode` y `puppeteer-core` y la compilación fallaba.
- **La credencial del remoto de git va en la URL en texto plano** (en la otra PC).
  Conviene quitarla y autenticar por el gestor de credenciales de Windows o
  `gh auth login`.
- **Cloud Functions a Node 24: código listo, falta desplegar.** Node.js 20 deja de
  estar soportado el 30/10/2026. El 14/09 `functions/package.json` pasó a Node 24
  (GA hasta el 30/04/2028), `firebase-functions` 7.3.2 y `firebase-admin` 13.10.0.
  Verificado en local: las 13 funciones cargan con definiciones idénticas a las de
  antes (triggers, memoria, tiempos) y `firebase deploy --only functions --dry-run`
  pasa. Falta `firebase deploy --only functions --project kipo-d29af` y probar una
  exportación. No se tomó `firebase-admin` 14: elimina `admin.firestore()`,
  `admin.storage()` y `admin.auth()`, que usa todo `functions/index.js`, y cambia
  el manejo de errores; pasar a 14 es reescribir las importaciones.
- Ferretería automática (cálculo de materiales), pausado.
- Endurecer reglas de Firestore y activar App Check antes del lanzamiento público.
- El aviso de actualización recarga la página: conviene que no aparezca mientras
  hay un formulario o una captura de foto abiertos.
