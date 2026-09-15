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
firebase deploy --only hosting
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
a la cuadrilla sin poder subir fotos en ese mismo segundo.

```bash
firebase deploy --only firestore:rules
```

Para las Cloud Functions, antes de desplegar:

```bash
node -c functions/index.js
cd functions && FIREBASE_CONFIG='{"projectId":"kipo-d29af","storageBucket":"kipo-d29af.appspot.com"}' \
  GCLOUD_PROJECT=kipo-d29af node -e "require('./index.js')"
firebase deploy --only functions:procesarExportacion
```

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

- `puntos` y `conexiones`: lectura y escritura para cualquier autenticado. La
  regla estricta rompía con puntos viejos que traen `proyectoId` numérico o sin
  `ownerId`, y no daba seguridad real porque editar ya estaba abierto.
- `proyectos/{id}/diseno`: la lee cualquiera que vea el proyecto, la escribe solo
  el dueño. El diseño es el compromiso contra el que después se liquida la obra.
- Los `armados` de un proyecto solo los cambia el dueño.
- Las fibras guardan su propio trazo (`vertices`). **Postes y fibras son
  independientes**: borrar un punto no borra fibras (las suelta con
  `soltarFibraDePunto`) y una fibra vuelve de la papelera aunque sus postes ya no
  existan (`soltarDePostesBorrados`).

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
