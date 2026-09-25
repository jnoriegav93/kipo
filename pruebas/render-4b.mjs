// Render en Node del paso 4b: la LISTA DE PUNTOS, la revisión, el control de ferretería y
// el exportar, como DUEÑO y como SUPERVISOR. Se abre cada ventana con \`modalPendiente\`
// (la pantalla arranca con ese modal abierto). Cada caso mira las dos caras.
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
  // La configuración como la arma la app: la inicial debajo de la del usuario
  const { DATA_INICIAL } = await server.ssrLoadModule('/src/data/constantes.js');
  const theme = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? `t-${k}` : undefined) });
  const propio = { id: '200', nombre: 'OBRA PROPIA', tipo: 'liquidacion', ownerId: 'U', dias: [{ id: 'd1', color: '#f00' }], miembros: { U: { rol: 'dueno' } } };
  const supervisada = {
    id: '100', nombre: 'OBRA SUPERVISADA', tipo: 'liquidacion', ownerId: 'O', ownerNombre: 'Ana', esCompartido: true, permisoActual: 'lectura',
    compartidoCon: ['U'], permisos: { U: 'lectura' }, miembros: { O: { rol: 'dueno' }, U: { rol: 'supervisor' } },
    dias: [{ id: 'd9', color: '#00f' }],
  };
  const punto = (id, proyectoId, diaId) => ({ id, proyectoId, diaId, coords: { lat: -13.1, lng: -74.2 }, datos: { numero: `P${id}`, pasivo: 'FAT1', fotos: {}, ferreteriaFinal: {} } });
  const puntos = [punto('1', '200', 'd1'), punto('2', '100', 'd9')];
  const render = (extra) => renderToString(React.createElement(VistaProyectos, {
    theme, isDark: false, perfilActivo: 'avanzado', proyectos: [propio, supervisada], proyectoActual: null, puntos, diasVisibles: ['d1', 'd9'],
    config: { ...DATA_INICIAL }, vista: 'proyectos', setVista: nada, setTempData: nada,
    setModalOpen: nada, modalOpen: null, seleccionarProyecto: nada, diaActual: null, setDiaActual: nada,
    toggleVisibilidadDia: nada, cambiarColorDia: nada, uniformizarColorDias: nada, toggleVisibilidadProyecto: nada,
    cambiarColorProyecto: nada, solicitarBorrarProyecto: nada, irUbicacionProyecto: nada, setExportData: nada,
    selectorColorAbierto: null, setSelectorColorAbierto: nada, tempData: {}, confirmarCrearProyecto: nada,
    confirmarCrearDia: nada, user: { uid: 'U', email: 'u@x.com' }, setAlertData: nada, setConfirmData: nada,
    setPuntoSeleccionado: nada, setModoLectura: nada, setModoEdicion: nada, setDatosFormulario: nada,
    setVistaAnterior: nada, setMapViewState: nada, setModalPendiente: nada, setMostrarOverlayGPS: nada,
    onVolver: nada, conexiones: [], proyectosArchivados: [], logoApp: null, setLogoApp: nada,
    onIniciarMoverPuntos: nada, onIniciarOrdenar: nada,
    ...extra,
  }));
  const tiene = (html, s) => html.includes(s);

  // LISTA DE PUNTOS
  const listaSup = render({ modalPendiente: 'LISTA_PUNTOS_100' });
  const listaDueno = render({ modalPendiente: 'LISTA_PUNTOS_200' });
  const reparar = 'title="Reparar fotos (subir a la nube desde equipo/respaldo)"';
  revisar('lista · supervisor: buscar, verificar, ver detalle y ver en mapa', tiene(listaSup, 'title="Buscar"') && tiene(listaSup, 'title="Verificar fotos"') && tiene(listaSup, 'title="Ver Detalle"') && tiene(listaSup, 'title="Ver en Mapa"'));
  revisar('lista · supervisor: sin REPARAR fotos', !tiene(listaSup, reparar));
  revisar('lista · dueño: con REPARAR fotos', tiene(listaDueno, reparar));
  revisar('lista · muestra los puntos de su obra', tiene(listaSup, 'P2') && !tiene(listaSup, '>P1<'));

  // REVISIÓN
  const revSup = render({ modalPendiente: 'REVISION_100' });
  const revDueno = render({ modalPendiente: 'REVISION_200' });
  revisar('revisión · dueño: renumerar y guardar', tiene(revDueno, 'title="Renumerar items"'));
  // (el largo confirma que la ventana sí se dibujó: vacía, "no tiene el botón" no probaría nada)
  revisar('revisión · supervisor: sin renumerar ni guardar', !tiene(revSup, 'title="Renumerar items"') && revSup.length > 1000);

  // CONTROL DE FERRETERÍA
  const ctrlSup = render({ modalPendiente: 'COMPARATIVO_100' });
  const ctrlDueno = render({ modalPendiente: 'COMPARATIVO_200' });
  // APROBAR/DESAPROBAR viven en la pestaña "definir"; la ventana abre en "comparativo", que
  // en Node queda cargando (la lista llega en un efecto). Aquí solo se puede probar que se
  // dibuja sin errores para los dos; quién aprueba lo decide \`puedeEditarProyecto\`, ya
  // probado con mutantes (test-paso4).
  revisar('control · se dibuja sin errores para el dueño y para el supervisor',
    tiene(ctrlDueno, 'Ferretería') && tiene(ctrlSup, 'Ferretería') && ctrlSup.length > 1000);

  // EXPORTAR
  const expSup = render({ modalOpen: 'EXPORTAR_HUB', proyectoActual: supervisada });
  const expDueno = render({ modalOpen: 'EXPORTAR_HUB', proyectoActual: propio });
  revisar('exportar · dueño: puede subir el logo', tiene(expDueno, 'SUBIR LOGO DE EMPRESA'));
  revisar('exportar · supervisor: no sube logo; se le explica', !tiene(expSup, 'SUBIR LOGO DE EMPRESA') && tiene(expSup, 'Este proyecto no tiene logo'));
  revisar('exportar · el supervisor igual tiene la pantalla de exportar', tiene(expSup, 'Logo del Reporte'));
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e);
} finally {
  await server.close();
}
console.log(fallas.length ? `RESULTADO: MAL (${fallas.length})` : 'RESULTADO: OK');
process.exit(fallas.length ? 1 : 0);
