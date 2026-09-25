# Pruebas de Kipo

Las pruebas automáticas del rediseño de equipos y de los armados (23-24/09/26). No son
parte de la app ni se despliegan. Las rutas se calculan desde cada archivo, así que corren
en cualquier máquina. Todo se corre **desde la raíz del proyecto**.

La primera vez, instalar lo que usan (jsdom y el kit de reglas de Firebase):

```bash
npm install --prefix pruebas
```

Casi todas traen **mutantes**: copias con un error metido a propósito que TIENEN que
fallar. Si un mutante pasa, la prueba no está mirando nada. Al final cada una imprime
`RESULTADO: OK` o `RESULTADO: MAL`.

## Lógica pura

```bash
node pruebas/test-equipoProyecto.mjs      # roles por obra (y que la copia del servidor dé lo mismo)
node pruebas/test-amigos.mjs              # amistades y gente con la que se coincide
node pruebas/test-paso4.mjs               # candado por rol y colores de día por persona
node pruebas/test-traspaso.mjs            # qué ferretería se copia al traspasar una obra
node pruebas/test-armados-materiales.mjs  # llevar armados de un catálogo a otro
node pruebas/test-manzanas-calles.mjs     # modo Diseño: manzanas desde las calles (geometría)
node pruebas/test-escuchas-proyecto.mjs   # escuchas de puntos/fibras/cables al cambiar la lista de proyectos
node pruebas/test-casas.mjs               # modo Diseño: casas del formato regular (formatos, giros, frentes)
```

## Cloud Functions sobre una Firestore falsa

Cargan `functions/index.js` de verdad, con `firebase-admin` reemplazado por una base en
memoria. No tocan producción.

```bash
node pruebas/test-traspasar-fn.cjs   # traspasarProyecto
node pruebas/test-aceptar-fn.cjs     # aceptarInvitacion
node pruebas/test-copiar-fn.cjs      # copiarMateriales
```

## Pantallas

Dibujan componentes reales con Vite, sin navegador. Firebase se reemplaza con los
`stub-*` de esta carpeta.

```bash
node pruebas/render-equipo.mjs          # miembros de la obra y avisos
node pruebas/render-4a-proyectos.mjs    # lista de proyectos (supervisor, obras compartidas)
node pruebas/render-4a.mjs
node pruebas/render-4b.mjs
node pruebas/test-armados-ui.mjs        # CON TOQUES (jsdom): FIJAR, IMPORTAR, CONSERVAR
node pruebas/test-diseno-manzanas-ui.mjs  # CON TOQUES: Diseño, generar manzanas, borrar, números
node pruebas/test-diseno-movil-ui.mjs     # CON TOQUES: Diseño en celular vertical, horizontal y PC
node pruebas/test-diseno-crear-ui.mjs     # CON TOQUES: crear proyecto en Diseño sin señal, orden de escrituras, rechazo
node pruebas/test-diseno-casas-ui.mjs     # CON TOQUES Y GESTOS: formato regular, familias, vértices y lados con el dedo
node pruebas/test-datos-proyectos-ui.mjs  # useFirebaseData con React: qué escuchas se abren y cierran
```

Las dos últimas usan `stub-firestore-vivo.js`, una Firestore de mentira que anota en orden
lo que se escribe y se escucha, y cuyas escuchas responde la prueba a mano (la de
`stub-firestore.js` responde sola). Con `stub-firebaseConfig-vivo.js` hay sesión abierta.

El modo Diseño se toca con `stub-react-leaflet.jsx`: Leaflet no dibuja en jsdom, así que
cada polígono es un `<div>` con su color, su trazo y sus puntos, y el clic llama a su
`eventHandlers.click`. Los círculos y líneas que se tocan también son `<div>` (con
`data-clase`, el `className` de Leaflet: `toque-vertice`, `toque-lado`, `toque-punto`).
El mapa convierte x = lng·1e5, y = −lat·1e5; los gestos se prueban mandando eventos de
puntero a `getContainer()` (jsdom no trae PointerEvent: se usa MouseEvent con
`pointerId`), y `__mapaFalso.dragging` dice si el mapa se puede arrastrar. Para una corrida de control contra otra versión de la vista, se le
pasa su ruta (en Git Bash, con `MSYS_NO_PATHCONV=1`, o convierte `/src/...` en una ruta de
Windows).

## Reglas de Firestore en el emulador

Necesitan **Java 21 o más** (el emulador de Firestore es Java; en la PC del 24/09 se usó
uno portátil con `JAVA_HOME` apuntándolo). Usan el proyecto de demostración `demo-kipo`:
nada toca producción. Con `final` se prueban las reglas de hoy.

```bash
firebase emulators:exec --only firestore --project demo-kipo "node pruebas/test-reglas.mjs firestore.rules final"
firebase emulators:exec --only firestore --project demo-kipo "node pruebas/test-reglas-obra.mjs firestore.rules final"
firebase emulators:exec --only firestore --project demo-kipo "node pruebas/test-limite-umbral.mjs firestore.rules"
```

- `test-reglas.mjs`: `usuarios`, proyectos (quién cambia qué, salir, el nombre propio) y
  fotos del mapa. 45 casos.
- `test-reglas-obra.mjs`: postes, fibras, acero y papelera por rol, incluidos los puntos
  viejos y los lotes de 450. 57 casos.
- `test-limite-umbral.mjs`: cuántas obras distintas caben en un lote (20).

Antes de restringir una regla: correr las pruebas contra la regla nueva y también una
**corrida de control** contra la regla de producción, donde los casos "NO…" tienen que
salir mal. Si no salen mal, la prueba no está mirando nada. Emulador y Firebase CLI dejan
un `firestore-debug.log` en la raíz: se borra, no va a git.

## Herramientas

```bash
node pruebas/barrido-jsx.mjs                    # componentes JSX usados sin importar (sin argumentos: todo src/)
node pruebas/lint-antes-despues.mjs src/App.jsx # lint del archivo contra el último commit
```

ESLint no detecta un componente sin importar (`react/jsx-no-undef` está apagado), y Vite
tampoco: sale como pantalla negra recién en el navegador. Por eso existe el barrido.
