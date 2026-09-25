// Render en Node de la lista de PROYECTOS (paso 4a): la tarjeta del supervisor ahora abre
// el proyecto como todos (ojo + botón de ver), sin el VER del modo supervisión.
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const KIPO = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const SCR = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const require = createRequire(`${KIPO}/package.json`);
const { createServer } = await import(pathToFileURL(`${KIPO}/node_modules/vite/dist/node/index.js`).href);
const React = require('react');
const { renderToString } = require('react-dom/server');

const server = await createServer({
  root: KIPO, configFile: false, logLevel: 'error',
  server: { middlewareMode: true, hmr: false }, appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: /^\.\.\/firebaseConfig$/, replacement: `${SCR}/stub-firebaseConfig.js` },
      { find: /^\.\.\/services\/exportacionService$/, replacement: `${SCR}/stub-exportacionService.js` },
      { find: /^\.\.\/components\/Mapas$/, replacement: `${SCR}/stub-Mapas.jsx` },
      { find: /^\.\/Mapas$/, replacement: `${SCR}/stub-Mapas.jsx` },
      { find: /^file-saver$/, replacement: `${SCR}/stub-file-saver.js` },
    ],
  },
});

const fallas = [];
const revisar = (nombre, cond) => { if (!cond) fallas.push(nombre); console.log(`${cond ? '✓' : '✗'} ${nombre}`); };
const nada = () => {};
try {
  const { default: VistaProyectos } = await server.ssrLoadModule('/src/views/VistaProyectos.jsx');
  const theme = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? `t-${k}` : undefined) });
  const propio = { id: '200', nombre: 'OBRA PROPIA', ownerId: 'U', dias: [{ id: 'd1', color: '#f00' }], miembros: { U: { rol: 'dueno' } } };
  const supervisada = {
    id: '100', nombre: 'OBRA SUPERVISADA', ownerId: 'O', ownerNombre: 'Ana', esCompartido: true, permisoActual: 'lectura',
    compartidoCon: ['U'], permisos: { U: 'lectura' }, miembros: { O: { rol: 'dueno' }, U: { rol: 'supervisor' } },
    dias: [{ id: 'd9', color: '#00f' }],
  };
  // Obra propia con otros miembros, y una del equipo viejo (solo grupoId, sin miembros)
  const compartida = { id: '300', nombre: 'OBRA COMPARTIDA', ownerId: 'U', dias: [{ id: 'd3', color: '#0f0' }],
    miembros: { U: { rol: 'dueno' }, X: { rol: 'editor' }, Y: { rol: 'supervisor' } }, miembrosUids: ['U', 'X', 'Y'] };
  // (id 250: la lista va por id de mayor a menor, y la supervisada tiene que quedar última
  // para que su recorte, de su nombre hasta el final, sea solo su tarjeta)
  const equipoViejo = { id: '250', nombre: 'OBRA EQUIPO VIEJO', ownerId: 'U', grupoId: 'g1', dias: [{ id: 'd5', color: '#ff0' }],
    miembros: { U: { rol: 'dueno' } }, miembrosUids: ['U'] };
  const html = renderToString(React.createElement(VistaProyectos, {
    theme, isDark: false, proyectos: [propio, supervisada, compartida, equipoViejo], proyectoActual: null, puntos: [], diasVisibles: ['d1', 'd9'],
    config: { catalogoFerreteria: [], armados: [] }, vista: 'proyectos', setVista: nada, setTempData: nada,
    setModalOpen: nada, modalOpen: null, seleccionarProyecto: nada, diaActual: null, setDiaActual: nada,
    toggleVisibilidadDia: nada, cambiarColorDia: nada, uniformizarColorDias: nada, toggleVisibilidadProyecto: nada,
    cambiarColorProyecto: nada, solicitarBorrarProyecto: nada, irUbicacionProyecto: nada, setExportData: nada,
    selectorColorAbierto: null, setSelectorColorAbierto: nada, tempData: {}, confirmarCrearProyecto: nada,
    confirmarCrearDia: nada, user: { uid: 'U', email: 'u@x.com' }, setAlertData: nada, setConfirmData: nada,
    setPuntoSeleccionado: nada, setModoLectura: nada, setModoEdicion: nada, setDatosFormulario: nada,
    setVistaAnterior: nada, setMapViewState: nada, setModalPendiente: nada, setMostrarOverlayGPS: nada,
    onVolver: nada, conexiones: [], proyectosArchivados: [],
  }));
  // Cada tarjeta, por su nombre: desde su <h3> hasta el <h3> siguiente
  const tarjeta = (nombre) => {
    const i = html.indexOf(`>${nombre}</h3>`);
    const j = html.indexOf('</h3>', i + nombre.length + 6);
    return i < 0 ? '' : html.slice(Math.max(0, i - 4000), j < 0 ? undefined : j);
  };
  const sup = html.slice(html.indexOf('>OBRA SUPERVISADA</h3>'), html.indexOf('>OBRA PROPIA</h3>') > html.indexOf('>OBRA SUPERVISADA</h3>') ? html.indexOf('>OBRA PROPIA</h3>') : undefined);
  const prop = html.slice(html.indexOf('>OBRA PROPIA</h3>'), html.indexOf('>OBRA SUPERVISADA</h3>') > html.indexOf('>OBRA PROPIA</h3>') ? html.indexOf('>OBRA SUPERVISADA</h3>') : undefined);
  revisar('las dos tarjetas salen', html.includes('>OBRA PROPIA</h3>') && html.includes('>OBRA SUPERVISADA</h3>'));
  revisar('supervisor: botón para abrirlo, "Ver (solo lectura)"', sup.includes('title="Ver (solo lectura)"'));
  revisar('supervisor: tiene el ojo del mapa', /title="(Apagar|Prender) puntos en el mapa"/.test(sup));
  revisar('dueño: lápiz "Editar" y su ojo', prop.includes('title="Editar"') && /title="(Apagar|Prender) puntos en el mapa"/.test(prop));
  revisar('supervisor: el lápiz de editar no aparece en su tarjeta', !sup.includes('title="Editar"'));
  const trozo = (nombre) => { const i = html.indexOf(`>${nombre}</h3>`); const j = html.indexOf('</h3>', i + nombre.length + 6); return i < 0 ? '' : html.slice(i, j < 0 ? undefined : j); };
  revisar('obra propia compartida: "Compartido con 2 personas"', trozo('OBRA COMPARTIDA').includes('Compartido con 2 personas'));
  revisar('obra propia compartida: tarjeta naranja', /border-\[#FCBF26\] bg-\[#FCBF26\]\/10[^>]*>(?:(?!<\/h3>)[\s\S])*>OBRA COMPARTIDA<\/h3>/.test(html));
  revisar('nadie dice "Compartido en equipo"', !html.includes('Compartido en equipo'));
  revisar('la del equipo viejo sin miembros no dice "Compartido"', !trozo('OBRA EQUIPO VIEJO').includes('Compartido'));
  revisar('la propia sin miembros no dice "Compartido"', !trozo('OBRA PROPIA').includes('Compartido'));
  void tarjeta;
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e);
} finally {
  await server.close();
}
console.log(fallas.length ? `RESULTADO: MAL (${fallas.length})` : 'RESULTADO: OK');
process.exit(fallas.length ? 1 : 0);
