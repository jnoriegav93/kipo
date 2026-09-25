// Render en Node del paso 4a: qué botones ve el dueño y cuáles el supervisor en el mapa
// (escritorio y celular), en las barras de fibra y de acero, y en el detalle del punto.
// Se cargan los componentes REALES de src/ con Vite (SSR); solo se cambian por vacíos el
// mapa de Leaflet y firebaseConfig. Cada caso mira las dos caras: lo que tiene que estar y
// lo que no.
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
      { find: /^\.\.\/components\/Mapas$/, replacement: `${SCR}/stub-Mapas.jsx` },
      { find: /^file-saver$/, replacement: `${SCR}/stub-file-saver.js` },
    ],
  },
});

const fallas = [];
const revisar = (nombre, cond) => { if (!cond) fallas.push(nombre); console.log(`${cond ? '✓' : '✗'} ${nombre}`); };
const nada = () => {};

try {
  const { default: VistaMapa } = await server.ssrLoadModule('/src/views/VistaMapa.jsx');
  const { default: VerDetalle } = await server.ssrLoadModule('/src/components/VerDetalle.jsx');
  const theme = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? `t-${k}` : undefined) });

  const base = {
    theme, isDesktop: true, mapStyle: 'calles', mapViewState: { center: [-13.16, -74.22], zoom: 17 }, setMapViewState: nada,
    tomarDestino: () => null, handleMapaClick: nada, puntosVisiblesMapa: [], iconSize: 30, obtenerColorDia: () => '#000',
    puntoSeleccionado: null, handlePuntoClick: nada, puntoTemporal: null, gpsTrigger: 0, setGpsTrigger: nada,
    yaSaltoAlInicio: true, setYaSaltoAlInicio: nada, isDark: false, verDetalle: nada, iniciarEdicion: nada,
    solicitarBorrarPunto: nada, intentarAgregarDatos: nada, setVistaAnterior: nada,
    modoMover: false, pendingCoords: null, iniciarMover: nada, cancelarMover: nada, confirmarMover: nada, onPuntoDragEnd: nada,
    modoFibra: false, setModoFibra: nada, dibujandoFibra: false, setDibujandoFibra: nada, capacidadFibra: 12, setCapacidadFibra: nada,
    fibrasVisibles: true, setFibrasVisibles: nada, puntosRecorrido: [], setPuntosRecorrido: nada,
    conexionesVisiblesMapa: [], conexionesLista: [], conexionSeleccionada: null, setConexionSeleccionada: nada,
    handleConexionClick: nada, onGuardarFibra: nada, onActualizarConexion: nada, onEliminarConexion: nada, totalFibras: 0,
    modoLinea: 'fibra', onCambiarModoLinea: nada, acero: null,
    nombreProyecto: 'OBRA PRUEBA', totalPuntosProyecto: 3, setMostrarEtiquetas: nada,
    diasPanelData: [], diasVisibles: [], toggleVisibilidadDia: nada, cambiarColorDia: nada, uniformizarColorDias: nada,
    coloresDia: ['#f97316', '#3b82f6'], proyectoActivoId: 'P1', tabsConfig: {}, puntos: [], abrirCamaraDirecta: nada,
  };
  const mapa = (extra) => renderToString(React.createElement(VistaMapa, { ...base, ...extra }));
  const tiene = (html, s) => html.includes(s);

  for (const isDesktop of [true, false]) {
    const donde = isDesktop ? 'escritorio' : 'celular';
    // Sin nada elegido
    const dueno = mapa({ isDesktop });
    const sup = mapa({ isDesktop, soloLectura: true });
    revisar(`${donde} · dueño sin elegir: FIBRA y AGREGAR`, tiene(dueno, ' FIBRA</button>') && tiene(dueno, ' AGREGAR</button>'));
    revisar(`${donde} · supervisor sin elegir: FIBRA sí, AGREGAR no`, tiene(sup, ' FIBRA</button>') && !tiene(sup, 'AGREGAR'));
    revisar(`${donde} · supervisor: aviso "Solo ver" bajo el nombre`, tiene(sup, 'Solo ver: eres supervisor') && !tiene(dueno, 'Solo ver: eres supervisor'));
    // Instalación de postes: FOTO crea una foto en la obra
    const duenoInst = mapa({ isDesktop, proyectoTipo: 'instalacionPostes' });
    const supInst = mapa({ isDesktop, proyectoTipo: 'instalacionPostes', soloLectura: true });
    revisar(`${donde} · instalación: FOTO para el dueño, no para el supervisor`, tiene(duenoInst, 'FOTO') && !tiene(supInst, 'FOTO<') && !tiene(supInst, ' FOTO</button>'));
    // Con un punto elegido
    const editable = mapa({ isDesktop, puntoSeleccionado: 'p1', puntoEditable: true });
    const ajeno = mapa({ isDesktop, puntoSeleccionado: 'p1', puntoEditable: false });
    revisar(`${donde} · punto que se puede cambiar: VER, EDITAR, BORRAR, MOVER`,
      tiene(editable, ' VER</button>') && tiene(editable, ' EDITAR</button>') && tiene(editable, 'BORRAR') && tiene(editable, '>MOVER<'));
    revisar(`${donde} · punto de obra supervisada: solo VER`,
      tiene(ajeno, ' VER</button>') && !tiene(ajeno, 'EDITAR') && !tiene(ajeno, 'BORRAR') && !tiene(ajeno, '>MOVER<') && !tiene(ajeno, '>FOTOS<'));
  }

  // Barra de fibra
  const fibraDueno = mapa({ modoFibra: true });
  const fibraSup = mapa({ modoFibra: true, soloLectura: true });
  const fibraAjena = mapa({ modoFibra: true, conexionSeleccionada: { id: 'f1', proyectoId: 'P2', nombre: 'R1', capacidad: 12 }, conexionEditable: false });
  revisar('fibra · dueño: empezar, retroceder, eliminar, lista', tiene(fibraDueno, 'title="Empezar un ramal nuevo"') && tiene(fibraDueno, 'title="Quitar el último vértice"') && tiene(fibraDueno, 'title="Eliminar la fibra seleccionada"') && tiene(fibraDueno, 'title="Lista de fibras"'));
  revisar('fibra · supervisor: lista, ver/ocultar y cerrar; nada que escriba',
    tiene(fibraSup, 'title="Lista de fibras"') && tiene(fibraSup, 'title="Ocultar"') && tiene(fibraSup, 'title="Cerrar"')
    && !tiene(fibraSup, 'Empezar un ramal nuevo') && !tiene(fibraSup, 'Quitar el último vértice') && !tiene(fibraSup, 'Eliminar la fibra seleccionada'));
  const botonEliminar = (html) => (html.match(/<button[^>]*title="Eliminar la fibra seleccionada"[^>]*>/) || [''])[0];
  revisar('fibra · la elegida es de otra obra (supervisor ahí): ELIMINAR apagado', /disabled=""/.test(botonEliminar(fibraAjena)));
  revisar('fibra · la elegida es propia: ELIMINAR prendido',
    !/disabled=""/.test(botonEliminar(mapa({ modoFibra: true, conexionSeleccionada: { id: 'f1', proyectoId: 'P1', nombre: 'R1', capacidad: 12 }, conexionEditable: true }))));

  // Barra de acero
  const acero = {
    lineas: [], lineasProyecto: [], trazo: { id: null, ferrId: null, postes: [], fibras: [], medioTramo: null }, setTrazo: nada,
    descripcionTrazo: null, fibrasTrazo: [], medioTramoTrazo: null, tipoId: null, setTipoId: nada, onGuardar: nada,
    seleccionado: null, setSeleccionado: nada, onCambiarTipo: nada, onEditar: nada, onEliminar: nada,
    visibles: true, setVisibles: nada, mediosTramosSueltos: [], total: 0, onCerrar: nada,
  };
  const aceroDueno = mapa({ modoFibra: true, modoLinea: 'acero', acero });
  const aceroSup = mapa({ modoFibra: true, modoLinea: 'acero', acero, soloLectura: true });
  revisar('acero · dueño: deshacer, guardar, editar, eliminar y el aviso de qué falta',
    tiene(aceroDueno, 'title="Deshacer lo último"') && tiene(aceroDueno, 'title="Guardar cable de acero"')
    && tiene(aceroDueno, 'title="Editar el cable seleccionado"') && tiene(aceroDueno, 'title="Eliminar el cable seleccionado"'));
  revisar('acero · supervisor: lista, ver/ocultar y cerrar; nada que escriba',
    tiene(aceroSup, 'title="Lista de cables de acero"') && tiene(aceroSup, 'title="Cerrar"')
    && !tiene(aceroSup, 'Deshacer lo último') && !tiene(aceroSup, 'Guardar cable de acero')
    && !tiene(aceroSup, 'Editar el cable seleccionado') && !tiene(aceroSup, 'Eliminar el cable seleccionado'));
  // Con el trazo vacío, el aviso dice lo primero que falta (AVISOS.poste1 de BarraAcero)
  const avisoAcero = (html) => /TOCA EL PRIMER POSTE|LISTO PARA GUARDAR/.test(html.replace(/<[^>]+>/g, ' '));
  revisar('acero · el aviso de "qué falta para guardar" no sale al supervisor', avisoAcero(aceroDueno) && !avisoAcero(aceroSup));

  // Detalle del punto
  const detalle = (extra) => renderToString(React.createElement(VerDetalle, {
    datos: { numero: 'P1', fotos: {} }, config: { catalogoFerreteria: [], armados: [] }, theme,
    onVolver: nada, onEditar: nada, proyectoId: 'P1', user: { uid: 'S' }, logoApp: null,
    proyectoActual: { id: 'P1', tipo: 'liquidacion', modoFotos: 'comprimido' }, ...extra,
  }));
  const detDueno = detalle({ readOnly: false, esSupervision: false });
  const detSup = detalle({ readOnly: true, esSupervision: true });
  revisar('detalle · dueño: EDITAR PUNTO', tiene(detDueno, 'EDITAR PUNTO'));
  revisar('detalle · supervisor: sin EDITAR PUNTO', !tiene(detSup, 'EDITAR PUNTO'));
  revisar('detalle · supervisor: puede compartir fotos', tiene(detSup, 'title="Compartir fotos"'));
  revisar('detalle · supervisor: deja observaciones a la bitácora', tiene(detSup, 'Observación del Supervisor') && !tiene(detDueno, 'Observación del Supervisor'));
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e);
} finally {
  await server.close();
}
console.log(fallas.length ? `RESULTADO: MAL (${fallas.length})` : 'RESULTADO: OK');
process.exit(fallas.length ? 1 : 0);
