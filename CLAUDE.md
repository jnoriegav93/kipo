# Kipo — guía para Claude Code

PWA de gestión de proyectos de fibra óptica. React 19 + Vite 7 + Firebase 12 + Leaflet.
Proyecto Firebase `kipo-d29af` → https://kipo-d29af.web.app

Para poner el proyecto a andar en otra máquina: `SETUP_NUEVA_MAQUINA.md`.
Para saber en qué punto va el trabajo: `CONTEXTO.md`.

---

## Lo primero: todo despliega a producción

No hay entorno de pruebas. `firebase deploy` sube a la app que usan las cuadrillas
en campo. Antes de desplegar hay que pasar por todo esto:

```bash
npx eslint <archivos tocados>    # comparar contra la línea base, no contra cero
npm run build
node scratchpad/smoke.js         # opcional: Chrome sin ventana, llega al login
firebase deploy --only hosting --project kipo-d29af   # no hay .firebaserc: el proyecto va explícito
```

**Tras cada despliegue hay que reportar el sello de compilación** con el formato
`SELLO: DD/MM/YY, HH:MM`. Sale del bundle:

```bash
grep -o "[0-9][0-9]/[0-9][0-9]/[0-9][0-9], [0-9][0-9]:[0-9][0-9]" dist/assets/index-*.js | head -1
```

El usuario lo compara en Diagnóstico para confirmar que su dispositivo tiene la
versión nueva. Hace falta porque **la PWA no se actualiza sola**: está en
`registerType: 'prompt'` y el usuario tiene que aceptar el aviso. Varias veces se
reportó "no funciona" cuando en realidad el dispositivo corría la versión vieja.

Las **reglas de Firestore van en despliegue aparte** y solo sumando permisos,
nunca restringiendo: se aplican al instante y a todos. Una regla mal escrita deja
a la cuadrilla sin poder subir fotos en ese mismo segundo. Las pocas veces que hubo
que restringir (paso 6 del rediseño de equipos) fue con el visto bueno del usuario,
probando antes en el emulador de Firestore casos que tienen que pasar y casos que
tienen que fallar, más una corrida de control con la regla vieja.

```bash
firebase deploy --only firestore:rules --project kipo-d29af
```

Para las Cloud Functions, antes de desplegar:

```bash
node -c functions/index.js
cd functions && FIREBASE_CONFIG='{"projectId":"kipo-d29af","storageBucket":"kipo-d29af.appspot.com"}' \
  GCLOUD_PROJECT=kipo-d29af node -e "require('./index.js')"
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions:procesarExportacion --project kipo-d29af
```

`index.js` tarda unos 9 s en cargar (canvas, Excel y fuentes) y la CLI da 10 s para
descubrir las funciones: sin `FUNCTIONS_DISCOVERY_TIMEOUT`, el despliegue falla a
veces con "User code failed to load". Solo afecta al despliegue, no a cómo corren.
Y ojo: `index.js` empieza con `/* eslint-disable */`, así que el lint no lo revisa;
lo que vale ahí es `node -c` y el `require` de prueba.

---

## Cómo trabaja el usuario

Viene de la memoria de Claude en la PC del rediseño de equipos (23-24/09). Está aquí
para que viaje con el proyecto a cualquier máquina.

- **Commit y push al cerrar cada tanda, con `CONTEXTO.md` al día.** Alterna entre dos
  PCs y lo único que viaja es git (GitHub `jnoriegav93/kipo`, ramas `main` y
  `equipos-por-proyecto`). Un commit sin push no llega a la otra PC.
- **Desplegar cada cambio verificado sin preguntar** y reportar el SELLO ("súbelo,
  siempre súbelo", 15/09). Las reglas de Firestore van aparte (ver arriba).
- **Prueba en producción, con varios celulares y cuentas.** Desde su PC no puede usar
  más de una cuenta (bloqueo por dispositivo). Nada de servidor local ni páginas en
  localhost: lo que haya que correr como admin va en el panel Admin de la app, con
  simulacro antes de escribir.
- **Conversar antes de codear una función nueva:** una propuesta corta y dudas numeradas
  en términos de campo, que contesta por número. Después, un resumen de lo acordado, y
  recién ahí programar. No volver a preguntar lo ya acordado: está en CONTEXTO.md.
- **No parchar:** al segundo o tercer parche sobre la misma pieza, parar y proponer
  alternativas con su costo, incluida la de descartar el enfoque.
- **No hacerlo esperar a ciegas.** Las tareas en segundo plano se vigilan a tiempo, y
  para mapear código conviene buscar directo en vez de delegar.
- **Despliegues y commits, como comandos sueltos:** `firebase deploy …` y `git commit …`
  solos, sin `cd … &&` ni otros comandos encadenados. Así calzan con los permisos de
  `.claude/settings.json` y el filtro automático de Claude Code no los frena (24/09).
- **App_Design (GPON Design)** es un prototipo local que nunca se despliega: solo sirve
  de referencia para portar herramientas al modo Diseño de Kipo.

---

## Trampas que ya costaron caro

**Finales de línea mezclados.** El repo tiene CRLF y LF. Cualquier script que
busque y reemplace texto tiene que probar los dos, o no encuentra nada:

```js
for (const E of ['\r\n', '\n']) { const A = a.split('\n').join(E); if (t.includes(A)) { ... } }
```

**Los scripts de reemplazo van en un archivo**, nunca como `node -e` en línea: las
comillas, los acentos graves y los `${}` se destrozan al pasar por el shell.

**ESLint no detecta componentes JSX indefinidos** (`react/jsx-no-undef` está
apagado) y Vite tampoco. Mover código entre archivos exige revisar los imports a
mano: ya hubo dos pantallas negras por eso.

**La línea base de lint no es cero.** Hay decenas de errores previos. Antes de
tocar, medir; después, comparar. Lo que importa es no sumar.

**`setState` es asíncrono.** Leer el estado justo después de fijarlo en el mismo
manejador devuelve el valor viejo. Para evitar el `useEffect` con setState
síncrono (que el lint marca), el patrón usado en este repo es ajustar el estado
durante el render.

**Flexbox:** un hijo con `flex-1` necesita `min-h-0` para poder encogerse.

**Firestore no acepta arrays dentro de arrays.** Con `[[lat, lng], ...]`, `setDoc`
lanza en el acto y no se guarda nada del documento. Los vértices van como
`{lat, lng}`, como en las fibras; el modo Diseño convierte al guardar y al leer
con `aFirestore` / `desdeFirestore`. Pasó una tanda entera sin guardar nada
porque el error solo salía en la consola.

**El smoke test solo llega al login**, así que no ve errores dentro de modales.

**La hora de Lima, con Node, no con `date`.** En Git Bash, `TZ=America/Lima date`
devuelve la hora **UTC** sin avisar: cinco horas de más. El 23/09 eso hizo creer que
eran las 8:39 cuando eran las 3:39, y se frenó un despliegue por "jornada empezada".
Lo confiable es lo mismo que usa el sello de compilación:

```bash
node -e "console.log(new Date().toLocaleString('es-PE',{timeZone:'America/Lima'}))"
```

---

## Datos

Colecciones: `proyectos`, `puntos`, `conexiones`, `cablesAcero`, `bitacora`,
`configuraciones`, `usuarios`, `exportaciones`, y las subcolecciones
`proyectos/{id}/fotosProyecto` y `proyectos/{id}/diseno`.

- `cablesAcero`: mensajero de poste a poste, con las fibras que se apoyan en él y el
  medio tramo donde se apoyan. **No va en `conexiones`**: todo lo que lee fibras lo
  contaría como fibra. Los tipos son fijos (`TIPOS_CABLE_ACERO` en
  `src/utils/cablesAcero.js`) y se liquidan por metro. **No es ferretería del poste**:
  todo consolidado por poste pasa por `quitarCableAcero` (en el servidor,
  `sinCableAcero`). Cualquier código nuevo que
  borre, copie o mueva puntos, fibras o proyectos tiene que llevar también sus cables:
  postes, medio tramo y fibras.

- `puntos`, `conexiones`, `cablesAcero` y `papelera`: los lee cualquier autenticado;
  los cambian solo el dueño y los editores de SU obra, y el admin (`editaLaObra` en
  firestore.rules, paso 6 del rediseño de equipos). Cada escritura lee su proyecto una
  vez: caben 20 obras distintas por lote, y la misma obra repetida cuenta una sola.
  Los puntos viejos sin `proyectoId`, o de una obra que ya no existe, quedan abiertos
  como antes, y el `proyectoId` numérico se compara como texto: una regla estricta
  anterior rompió justo con esos puntos.
- `proyectos/{id}/diseno`: la lee cualquiera que vea el proyecto, la escribe solo
  el dueño. El diseño es el compromiso contra el que después se liquida la obra.
- Los `armados` de un proyecto los cambian el dueño y los editores (rediseño de
  equipos: el editor hace todo menos borrar el proyecto); el supervisor, no.
- **Un armado nombra sus materiales por id del catálogo de UNA persona:** el del dueño
  de la obra si vive en el proyecto, el propio si está en la colección. Llevarlo de un
  catálogo a otro (FIJAR, IMPORTAR, CONSERVAR) pasa por `llevarArmados`
  (`src/utils/armadosMateriales.js`): lo que falta se copia con el mismo id con la
  función `copiarMateriales`, después de mostrarlo y confirmar. Código nuevo que mueva
  armados entre catálogos tiene que pasar por ahí, o quedan "material no encontrado".
- Las fibras guardan su propio trazo (`vertices`). **Postes y fibras son
  independientes**: borrar un punto no borra fibras (las suelta con
  `soltarFibraDePunto`) y una fibra vuelve de la papelera aunque sus postes ya no
  existan (`soltarDePostesBorrados`).
- El **ITEM** (`datos.numero`) se propone solo al crear el punto: P1 / MT1 / C1 según
  la clase, con la cantidad que ya tiene el proyecto más uno (`src/utils/itemsAuto.js`).
  Los prefijos viven en el proyecto (`prefijosItem`, elegidos al crearlo; los proyectos
  viejos caen a P/MT/C). Lo escrito a mano no se pisa y editando un punto guardado no se
  toca: renumerar al reordenar sigue siendo trabajo aparte (`RenumerarItems`).

- **Miembros de un proyecto:** `miembros` (`{ uid: { rol, desde, nombre, … } }`) y
  `miembrosUids`, y nada más. Los campos del sistema viejo (`compartidoCon`, `permisos`,
  `supervisoresInfo`, `enListaDe`, `grupoId`, `solicitudesPendientes`, `codigoAcceso`) y
  la colección `equipos` se retiraron en el paso 6 (CONTEXTO.md): ni la app, ni las
  funciones, ni las reglas los leen o escriben, y el 24/09 se borraron de los datos, con
  respaldo en `respaldoPaso6` y `respaldoPaso6Equipos` (solo los lee el servidor). No
  volver a usarlos. Cada miembro pone al día su propio nombre y empresa en `miembros`
  (regla aparte).
- **Rol por obra (paso 4 del rediseño de equipos).** Dueño y editor cambian cosas;
  el supervisor solo mira y exporta. Todo lo que escribe en una obra pasa por
  `exigirEdicion(proyectoId)` en App.jsx, con el proyecto DE ESO que se toca (el punto,
  la fibra, el cable), no el activo: en el mapa pueden verse varias obras a la vez.
  Código nuevo que escriba tiene que llevarlo, además de esconder su botón. Desde el
  paso 6 el servidor también lo exige (ver `puntos` arriba).
- **Los colores de día son de cada usuario** (`configuraciones/{uid}.coloresDia`), no
  del proyecto: el color que el día trae en el proyecto es solo el de partida. No
  volver a escribirlos en el proyecto.

**Puntos viejos:** pueden traer `ownerId` ajeno o ausente, y `proyectoId`/`diaId`
numéricos. Por eso existe `perteneceAProyecto()` en `src/utils/helpers.js`, que
compara como texto y cae al día si falta el proyecto. Usarla siempre en vez de
comparar ids a pelo.

---

## Modo Diseño

Vive en `src/views/VistaDiseno.jsx` y sus componentes `Diseno*`. Dos cosas que
conviene no romper:

- **Carga diferida.** Entra por `React.lazy` en `App.jsx`, así que su código no
  pesa en el arranque de la app. Es el único trozo diferido del proyecto; el
  resto del bundle es un monolito de 2,4 MB.
- **Solo lo ve el admin.** La entrada del menú está detrás de `esAdmin`, que hace
  de bandera mientras se construye: el código puede subirse a producción sin que
  exista para nadie más.

La geometría propia está en `src/utils/disenoGeo.js`, sin dependencias de
Leaflet, para poder probarla con Node.
