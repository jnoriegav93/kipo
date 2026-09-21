import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft, Folder, Layers, Waypoints, Boxes, Route, Cable, FileDown, Lock,
  ZoomIn, ZoomOut, Square, PenTool, Undo2, Check, X, Trash2, Loader2,
  Circle as CircleIcon, MapPin, Type, PanelLeftClose, PanelLeft, ChevronDown,
  Spline, Minus, Plus, FlipHorizontal, Scissors, PenLine, FolderPlus,
} from 'lucide-react';
import { perteneceAProyecto } from '../utils/helpers';
import DisenoCatastro from '../components/DisenoCatastro';
import DisenoCalles from '../components/DisenoCalles';
import DisenoBuscador from '../components/DisenoBuscador';
import { suscribirCatastro, crearGuardadoDiferido, CAPAS } from '../services/disenoService';
import {
  areaM2, paralela, largoPolilinea, proyectarEnPolilinea, insertarVertice, cortarCalle, anchosCalle,
} from '../utils/disenoGeo';

/* Modo DISEÑO — la proyección de la red, sobre los postes reales del proyecto.
   No migra nada: lee los mismos puntos que la cuadrilla está levantando.

   El aspecto es oscuro a propósito: Kipo va en blanco y negro de alto contraste
   porque se usa al sol, pero el diseño se hace en interior y ahí un fondo oscuro
   cansa menos y deja el protagonismo al satélite y a las capas. Las formas de los
   controles son las mismas de Kipo para que no parezca otra aplicación.

   El paso "Postes" de la herramienta original no está: importar, ordenar y
   corregir postes ya lo hace Kipo, y mejor. */

const PALETA = {
  '--d-fondo':  '#0F1217',
  '--d-panel':  '#171B22',
  '--d-alto':   '#1E232C',
  '--d-borde':  '#2B313C',
  '--d-borde2': '#3A4250',
  '--d-texto':  '#E7EAEF',
  '--d-suave':  '#8B94A5',
};

const PASOS = [
  { id: 'catastro', num: 1, label: 'Catastro', icono: Layers,    listo: true  },
  { id: 'tramos',   num: 2, label: 'Tramos',   icono: Waypoints, listo: false },
  { id: 'naps',     num: 3, label: 'NAPs',     icono: Boxes,     listo: false },
  { id: 'rutas',    num: 4, label: 'Rutas',    icono: Route,     listo: false },
  { id: 'empalmes', num: 5, label: 'Empalmes', icono: Cable,     listo: false },
  { id: 'exportar', num: 6, label: 'Exportar', icono: FileDown,  listo: false },
];

const TIPOS_AREA_POLY = ['Parque', 'Plaza', 'Losa deportiva', 'Área verde', 'Otro'];
const TIPOS_AREA_CIRC = ['Tanque de agua', 'Reservorio', 'Pozo', 'Otro'];
const TIPOS_MARCADOR  = ['Poste', 'Buzón', 'Cámara', 'Hito', 'Otro'];

/* Tamaño del poste, calcado del mapa de Kipo: lado 24 por el multiplicador de
   lupa menos la reducción del círculo. Aquí se dibuja con radio, que es la mitad. */
const radioPoste = (lupa) => (24 * Math.max(0.4, lupa - 0.2)) / 2;

const colorPunto = (p) => {
  const te = p.datos?.tipoElemento;
  const arr = Array.isArray(te) ? te : (te ? [te] : []);
  if (arr.includes('medioTramo')) return '#FF6600';
  if (['mufa', 'xbox', 'hbox', 'fat'].some(x => arr.includes(x))) return '#22c55e';
  return '#0F1217';
};

const siguienteId = (lista, prefijo) => {
  const nums = lista.map(x => parseInt(String(x.id).split('_')[1] || '0', 10) || 0);
  return `${prefijo}_${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
};

/* Encuadra el mapa al abrir el proyecto: sobre sus postes y, si todavía no tiene,
   sobre lo ya dibujado. Solo cuando cambia `clave` (otro proyecto, fin de la carga,
   primeros postes): encuadrar a cada cambio movería el mapa mientras se dibuja. Un
   proyecto sin nada deja el mapa donde está, para buscar la ubicación. */
function Encuadrar({ clave, coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) map.setView(coords[0], 18);
    else map.fitBounds(coords, { padding: [40, 40], maxZoom: 19 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return null;
}

/* ── Piezas de interfaz: forma de Kipo, color del modo oscuro ────────────── */

const Seccion = ({ titulo, abierta, onAlternar, children }) => (
  <div className="border-b border-[var(--d-borde)]">
    <button
      onClick={onAlternar}
      className="w-full flex items-center justify-between px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)] hover:text-[var(--d-texto)] transition-colors"
    >
      {titulo}
      <ChevronDown size={13} className={`transition-transform ${abierta ? 'rotate-180' : ''}`} />
    </button>
    {abierta && <div className="px-2.5 pb-3 space-y-1.5">{children}</div>}
  </div>
);

const Herramienta = ({ icono, label, activa, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full h-10 px-3 rounded-xl border-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all
      ${activa
        ? 'bg-brand-500 border-brand-600 text-white'
        : 'bg-[var(--d-alto)] border-[var(--d-borde)] text-[var(--d-texto)] hover:border-[var(--d-borde2)]'}`}
  >
    <span className="shrink-0">{icono}</span>
    <span className="truncate">{label}</span>
  </button>
);

const Interruptor = ({ label, valor, onClick, cuenta }) => (
  <button
    onClick={onClick}
    className="w-full h-9 px-3 rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] flex items-center gap-2.5 active:scale-95 transition-all hover:border-[var(--d-borde2)]"
  >
    <span className={`w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center
      ${valor ? 'bg-brand-500 border-brand-600' : 'border-[var(--d-borde2)]'}`}>
      {valor && <Check size={9} strokeWidth={4} className="text-white" />}
    </span>
    <span className="flex-1 text-left text-[11px] font-black uppercase tracking-widest text-[var(--d-texto)]">{label}</span>
    <span className="text-[10px] font-black text-[var(--d-suave)]">{cuenta}</span>
  </button>
);

/* Lo que dice la barra de estado sobre el guardado. Antes decía "Guardado"
   siempre, aunque Firestore rechazara la escritura: el error quedaba en la consola. */
const EstadoGuardado = ({ cargando, estado, error }) => {
  const clase = 'ml-auto normal-case tracking-normal font-bold';
  if (cargando) return <span className={clase}>Cargando…</span>;
  if (estado === 'error') {
    const motivo = error?.code === 'permission-denied' ? 'sin permiso de escritura' : (error?.code || 'error desconocido');
    return <span className={`${clase} text-red-400`} title={error?.message}>No se guardó · {motivo}</span>;
  }
  if (estado === 'pendiente' || estado === 'guardando') return <span className={clase}>Guardando…</span>;
  return <span className={clase}>Guardado</span>;
};

export default function VistaDiseno({ onVolver, proyectos = [], puntos = [], onCrearProyecto }) {
  const [proyectoId, setProyectoId] = useState(null);
  const [mapa, setMapa] = useState(null);              // el mapa de Leaflet, para el buscador
  const [nuevoNombre, setNuevoNombre] = useState(null); // null: formulario de proyecto nuevo cerrado
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState(null);
  const [lupa, setLupa] = useState(0.8);
  const [paso, setPaso] = useState('catastro');
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [secciones, setSecciones] = useState({ calles: true, manzanas: true, areas: true, puntuales: true, capas: false });

  const [catastroDoc, setCatastroDoc] = useState(null);
  const [herramienta, setHerramienta] = useState(null);
  const [pts, setPts] = useState([]);
  const [seleccion, setSeleccion] = useState(null);   // { tipo, id }
  const [pendiente, setPendiente] = useState(null);   // elemento a la espera de tipo o texto
  const [texto, setTexto] = useState('');
  const [capas, setCapas] = useState({ calles: true, manzanas: true, areas: true, marcadores: true, etiquetas: true, postes: true });
  const [trazoCalle, setTrazoCalle] = useState([]);
  const [borrador, setBorrador] = useState(null);   // calle a la espera de ancho y lado
  const [edicion, setEdicion] = useState(null);     // { id, A, B, modo, corte, aviso } — calle en edición
  const [medida, setMedida] = useState(null);       // longitud del tramo en curso
  const [anchoDefecto, setAnchoDefecto] = useState(8);
  const [estadoGuardado, setEstadoGuardado] = useState({ estado: 'guardado' });
  const [guardado] = useState(() => crearGuardadoDiferido(600, setEstadoGuardado));

  const proyecto = useMemo(
    () => proyectos.find(p => String(p.id) === String(proyectoId)) || null,
    [proyectos, proyectoId]
  );

  const puntosProy = useMemo(
    () => (proyecto ? puntos.filter(p => perteneceAProyecto(p, proyecto) && p.coords?.lat != null) : []),
    [puntos, proyecto]
  );

  useEffect(() => {
    if (!proyectoId) return;
    const cortar = suscribirCatastro(proyectoId, (datos) => setCatastroDoc({ proyectoId, datos }));
    return () => cortar();
  }, [proyectoId]);

  // Al cerrar la vista se escribe lo que quede pendiente, sin esperar el retardo
  useEffect(() => () => { guardado.forzar().catch(() => {}); }, [guardado]);

  const cargando = !catastroDoc || String(catastroDoc.proyectoId) !== String(proyectoId);
  const catastro = cargando ? null : catastroDoc.datos;

  const manzanas   = catastro?.manzanas   || [];
  const areas      = catastro?.areas      || [];
  const marcadores = catastro?.marcadores || [];
  const etiquetas  = catastro?.etiquetas  || [];
  const calles     = catastro?.calles     || [];

  // Dónde encuadrar al abrir: los postes y, si no hay, lo ya dibujado
  const coordsEncuadre = puntosProy.length
    ? puntosProy.map(p => [p.coords.lat, p.coords.lng])
    : [
      ...calles.flatMap(c => [...(c.A || []), ...(c.B || [])]),
      ...manzanas.flatMap(m => m.latlngs || []),
      ...areas.flatMap(a => a.latlngs || (a.center ? [a.center] : [])),
      ...marcadores.map(m => m.latlng),
      ...etiquetas.map(e => e.latlng),
    ];
  const claveEncuadre = `${proyectoId}:${cargando ? 'cargando' : 'listo'}:${puntosProy.length > 0}`;
  const proyectoVacio = !cargando && coordsEncuadre.length === 0;

  /* Proyecto nuevo desde Diseño: nace sin postes y se abre en el acto. */
  const crearProyecto = async () => {
    const nombre = (nuevoNombre || '').trim();
    if (!nombre || creando || !onCrearProyecto) return;
    setCreando(true);
    setErrorCrear(null);
    try {
      const id = await onCrearProyecto(nombre);
      setNuevoNombre(null);
      setProyectoId(id);
    } catch (e) {
      console.error('No se pudo crear el proyecto', e);
      setErrorCrear('No se pudo crear el proyecto. Revisa la conexión.');
    } finally {
      setCreando(false);
    }
  };

  const guardar = (parche) => {
    const datos = { ...(catastro || {}), ...parche };
    setCatastroDoc({ proyectoId, datos }); // se pinta ya, sin esperar a Firestore
    guardado.encolar(proyectoId, CAPAS.CATASTRO, datos);
  };

  /* Las herramientas con tipo o texto no guardan al primer clic: dejan el
     elemento en espera y el panel derecho pide el dato que falta. */
  const finalizar = (tipo, geo) => {
    if (tipo === 'manzana') {
      if (!geo.latlngs || geo.latlngs.length < 3) return;
      guardar({ manzanas: [...manzanas, { id: siguienteId(manzanas, 'manzana'), latlngs: geo.latlngs }] });
      setHerramienta(null);
      setPts([]);
      return;
    }
    if (tipo === 'areaPoly') {
      if (!geo.latlngs || geo.latlngs.length < 3) return;
      setPendiente({ que: 'area', tipo: 'polygon', latlngs: geo.latlngs });
    } else if (tipo === 'areaCirc') {
      setPendiente({ que: 'area', tipo: 'circle', center: geo.center, radius: geo.radius });
    } else if (tipo === 'marcador') {
      setPendiente({ que: 'marcador', latlng: geo.latlng });
    } else if (tipo === 'etiqueta') {
      setPendiente({ que: 'etiqueta', latlng: geo.latlng });
      setTexto('');
    }
    setHerramienta(null);
    setPts([]);
  };

  const confirmarPendiente = (subTipo) => {
    if (!pendiente) return;
    if (pendiente.que === 'area') {
      const geo = { tipo: pendiente.tipo, latlngs: pendiente.latlngs || null, center: pendiente.center || null, radius: pendiente.radius || null };
      guardar({ areas: [...areas, { id: siguienteId(areas, 'area'), subTipo, ...geo }] });
    } else if (pendiente.que === 'marcador') {
      guardar({ marcadores: [...marcadores, { id: siguienteId(marcadores, 'marcador'), latlng: pendiente.latlng, tipo: subTipo }] });
    } else if (pendiente.que === 'etiqueta') {
      const t = texto.trim();
      if (!t) return;
      guardar({ etiquetas: [...etiquetas, { id: siguienteId(etiquetas, 'etiqueta'), latlng: pendiente.latlng, texto: t }] });
    }
    setPendiente(null);
    setTexto('');
  };

  const borrarSeleccion = () => {
    if (!seleccion) return;
    const { tipo, id } = seleccion;
    if (tipo === 'manzana')  guardar({ manzanas: manzanas.filter(x => x.id !== id) });
    if (tipo === 'area')     guardar({ areas: areas.filter(x => x.id !== id) });
    if (tipo === 'marcador') guardar({ marcadores: marcadores.filter(x => x.id !== id) });
    if (tipo === 'etiqueta') guardar({ etiquetas: etiquetas.filter(x => x.id !== id) });
    if (tipo === 'calle')    guardar({ calles: calles.filter(x => x.id !== id) });
    setSeleccion(null);
  };

  /* El trazo pasa a borrador: ahí se elige ancho y lado viendo los dos bordes. */
  const terminarCalle = () => {
    if (trazoCalle.length < 2) return;
    setBorrador({ A: trazoCalle, ancho: anchoDefecto, lado: 1 });
    setTrazoCalle([]);
    setHerramienta(null);
    setMedida(null);
  };

  const confirmarCalle = () => {
    if (!borrador) return;
    setAnchoDefecto(borrador.ancho);
    guardar({ calles: [...calles, {
      id: siguienteId(calles, 'calle'),
      A: borrador.A,
      B: paralela(borrador.A, borrador.ancho, borrador.lado),
      ancho: borrador.ancho,
    }] });
    setBorrador(null);
  };

  /* Edición de calle: se trabaja sobre una copia de los dos bordes y nada se
     guarda hasta pulsar Guardar. Cortar sí guarda en el acto, porque crea otra
     calle. */
  const editarCalle = (c) => {
    setSeleccion(null);
    setHerramienta(null);
    setEdicion({ id: c.id, A: c.A.map(p => [...p]), B: c.B.map(p => [...p]), modo: null, corte: null, aviso: null });
  };

  const alternarModoEdicion = (modo) =>
    setEdicion(ed => ({ ...ed, modo: ed.modo === modo ? null : modo, corte: null, aviso: null }));

  const moverVertice = (borde, idx, punto) =>
    setEdicion(ed => ({ ...ed, [borde]: ed[borde].map((p, i) => (i === idx ? punto : p)), aviso: null }));

  const clicBorde = (borde, punto) => {
    if (!edicion) return;
    if (edicion.modo === 'agregar') {
      setEdicion(ed => ({ ...ed, [borde]: insertarVertice(ed[borde], punto), aviso: null }));
      return;
    }
    if (edicion.modo !== 'cortar') return;
    const enBorde = proyectarEnPolilinea(edicion[borde], punto)?.punto || punto;
    // Primer clic, o el mismo borde otra vez: la marca se mueve ahí
    if (!edicion.corte || edicion.corte.borde === borde) {
      setEdicion(ed => ({ ...ed, corte: { borde, punto: enBorde }, aviso: null }));
      return;
    }
    const pA = borde === 'A' ? enBorde : edicion.corte.punto;
    const pB = borde === 'B' ? enBorde : edicion.corte.punto;
    const partes = cortarCalle(edicion.A, edicion.B, pA, pB);
    if (!partes) {
      setEdicion(ed => ({ ...ed, corte: null, aviso: 'Corta más hacia el centro de la calle.' }));
      return;
    }
    const nueva = { ...calles.find(c => c.id === edicion.id), ...partes[1], id: siguienteId(calles, 'calle') };
    guardar({ calles: [...calles.map(c => (c.id === edicion.id ? { ...c, ...partes[0] } : c)), nueva] });
    setEdicion(null);
  };

  const guardarEdicion = () => {
    if (!edicion) return;
    guardar({ calles: calles.map(c => (c.id === edicion.id ? { ...c, A: edicion.A, B: edicion.B } : c)) });
    setSeleccion({ tipo: 'calle', id: edicion.id });
    setEdicion(null);
  };

  const cancelarDibujo = () => {
    setPts([]); setHerramienta(null); setPendiente(null);
    setTrazoCalle([]); setBorrador(null); setMedida(null); setEdicion(null);
  };
  const usar = (h) => { setPts([]); setPendiente(null); setSeleccion(null); setEdicion(null); setHerramienta(v => v === h ? null : h); };

  const btn = 'h-10 px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all';
  const btnBase = `${btn} bg-[var(--d-alto)] border-[var(--d-borde)] text-[var(--d-texto)] hover:border-[var(--d-borde2)]`;

  const AYUDA = {
    manzanaRect:  ['Clic: inicio de la base', 'Clic: fin de la base', 'Clic: ancho'],
    manzanaLibre: ['Clic por vértice · doble clic para cerrar'],
    areaPoly:     ['Clic por vértice · doble clic para cerrar'],
    areaCirc:     ['Clic: centro', 'Clic: borde'],
    marcador:     ['Clic para colocar el marcador'],
    etiqueta:     ['Clic donde va el texto'],
  };

  const seleccionado = seleccion && (
    seleccion.tipo === 'manzana'  ? manzanas.find(x => x.id === seleccion.id)   :
    seleccion.tipo === 'area'     ? areas.find(x => x.id === seleccion.id)      :
    seleccion.tipo === 'marcador' ? marcadores.find(x => x.id === seleccion.id) :
    seleccion.tipo === 'calle'    ? calles.find(x => x.id === seleccion.id)      :
    etiquetas.find(x => x.id === seleccion.id)
  );
  const anchosSeleccion = seleccion?.tipo === 'calle' && seleccionado ? anchosCalle(seleccionado.A, seleccionado.B) : null;

  const anchosEdicion = edicion ? anchosCalle(edicion.A, edicion.B) : null;
  const ayudaEdicion = !edicion ? null
    : edicion.modo === 'agregar' ? 'Toca cualquiera de los dos bordes para insertar un vértice ahí.'
    : edicion.modo === 'cortar'
      ? (edicion.corte ? 'Ahora toca el borde de enfrente.' : 'Toca un borde y luego el de enfrente: la calle se parte en dos.')
      : 'Arrastra los vértices de cualquiera de los dos bordes. Se imantan a los de otras calles.';

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[var(--d-fondo)] text-[var(--d-texto)]"
      style={PALETA}
    >
      {/* Cabecera */}
      <div
        className="shrink-0 px-3 flex items-center gap-3 border-b border-[var(--d-borde)] bg-[var(--d-panel)]"
        style={{ paddingTop: 'calc(10px + env(safe-area-inset-top))', paddingBottom: '10px' }}
      >
        <button onClick={onVolver} className={`${btnBase} w-10 px-0`}>
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black uppercase tracking-[0.2em]">Diseño</p>
          <p className="text-[10px] font-bold truncate text-[var(--d-suave)]">
            {proyecto ? proyecto.nombre : 'Elige un proyecto para empezar'}
          </p>
        </div>
        {proyecto && <DisenoBuscador mapa={mapa} />}
        {proyecto && (
          <button onClick={() => { cancelarDibujo(); setProyectoId(null); }} className={btnBase}>
            Cambiar
          </button>
        )}
      </div>

      {/* Pasos */}
      <div className="shrink-0 flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-[var(--d-borde)] bg-[var(--d-panel)]">
        {PASOS.map(p => {
          const Icono = p.icono;
          const activo = paso === p.id;
          return (
            <button
              key={p.id}
              disabled={!p.listo}
              onClick={() => { cancelarDibujo(); setPaso(p.id); }}
              title={p.listo ? p.label : 'Todavía no disponible'}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-[11px] font-black uppercase tracking-wide transition-all
                ${!p.listo
                  ? 'border-dashed border-[var(--d-borde)] text-[#4C5462] cursor-not-allowed'
                  : activo
                    ? 'bg-brand-500 border-brand-600 text-white'
                    : 'bg-[var(--d-alto)] border-[var(--d-borde)] text-[var(--d-texto)] active:scale-95'}`}
            >
              {p.listo ? <Icono size={13} /> : <Lock size={11} />}
              {p.num}. {p.label}
            </button>
          );
        })}
      </div>

      {!proyecto ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">
              Proyectos disponibles
            </p>
            {onCrearProyecto && nuevoNombre === null && (
              <button onClick={() => setNuevoNombre('')} className={`${btn} bg-brand-500 border-brand-600 text-white`}>
                <FolderPlus size={14} strokeWidth={2.5} /> Nuevo proyecto
              </button>
            )}
          </div>

          {/* Un proyecto de diseño puede nacer sin postes: la cuadrilla levanta
              después sobre este mismo proyecto. */}
          {nuevoNombre !== null && (
            <div className="mb-4 p-3 rounded-xl border-2 border-brand-600 bg-[var(--d-panel)] space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Nuevo proyecto de diseño</p>
              <input
                autoFocus
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') crearProyecto(); if (e.key === 'Escape') setNuevoNombre(null); }}
                placeholder="Nombre del proyecto"
                className="w-full h-10 px-3 rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] text-sm font-bold outline-none focus:border-brand-500"
              />
              <p className="text-[10px] font-bold text-[var(--d-suave)] leading-snug">
                Nace sin postes. Se diseña primero y la cuadrilla puede levantar después sobre este mismo proyecto.
              </p>
              {errorCrear && <p className="text-[11px] font-black text-red-400">{errorCrear}</p>}
              <div className="flex gap-2">
                <button onClick={crearProyecto} disabled={!nuevoNombre.trim() || creando}
                  className={`${btn} flex-1 bg-brand-500 border-brand-600 text-white disabled:opacity-30`}>
                  {creando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Crear
                </button>
                <button onClick={() => { setNuevoNombre(null); setErrorCrear(null); }} title="Cancelar"
                  className={`${btnBase} w-10 px-0`}>
                  <X size={13} />
                </button>
              </div>
            </div>
          )}
          {proyectos.length === 0 ? (
            <p className="text-xs font-bold py-8 text-center text-[var(--d-suave)]">No tienes proyectos propios.</p>
          ) : (
            <div className="space-y-2">
              {proyectos.map(p => {
                const n = puntos.filter(x => perteneceAProyecto(x, p)).length;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProyectoId(p.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-panel)] hover:border-[var(--d-borde2)] active:scale-95 transition-all"
                  >
                    <Folder size={18} className="text-brand-500 shrink-0" />
                    <span className="flex-1 text-left text-sm font-black truncate">{p.nombre}</span>
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg border-2 border-[var(--d-borde)] text-[var(--d-suave)]">
                      {n} pts
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">

          {/* Panel de herramientas */}
          {panelAbierto && (
            <div className="w-60 shrink-0 border-r border-[var(--d-borde)] bg-[var(--d-panel)] overflow-y-auto">
              {cargando ? (
                <div className="flex items-center gap-2 px-3 py-4 text-[var(--d-suave)]">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Cargando</span>
                </div>
              ) : (
                <>
                  <Seccion titulo="Calles" abierta={secciones.calles}
                    onAlternar={() => setSecciones(s => ({ ...s, calles: !s.calles }))}>
                    <Herramienta icono={<Spline size={14} strokeWidth={2.5} />} label="Dibujar calle"
                      activa={herramienta === 'calle'} onClick={() => usar('calle')} />
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Ancho</span>
                      <button onClick={() => setAnchoDefecto(v => Math.max(3, v - 1))}
                        className="w-8 h-8 rounded-lg border-2 border-[var(--d-borde)] bg-[var(--d-alto)] flex items-center justify-center active:scale-95">
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <span className="w-10 text-center text-sm font-black tabular-nums">{anchoDefecto}</span>
                      <button onClick={() => setAnchoDefecto(v => Math.min(40, v + 1))}
                        className="w-8 h-8 rounded-lg border-2 border-[var(--d-borde)] bg-[var(--d-alto)] flex items-center justify-center active:scale-95">
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </Seccion>

                  <Seccion titulo="Manzanas" abierta={secciones.manzanas}
                    onAlternar={() => setSecciones(s => ({ ...s, manzanas: !s.manzanas }))}>
                    <Herramienta icono={<Square size={14} strokeWidth={2.5} />}  label="Cuadra rectangular" activa={herramienta === 'manzanaRect'}  onClick={() => usar('manzanaRect')} />
                    <Herramienta icono={<PenTool size={14} strokeWidth={2.5} />} label="Cuadra irregular"   activa={herramienta === 'manzanaLibre'} onClick={() => usar('manzanaLibre')} />
                  </Seccion>

                  <Seccion titulo="Áreas especiales" abierta={secciones.areas}
                    onAlternar={() => setSecciones(s => ({ ...s, areas: !s.areas }))}>
                    <Herramienta icono={<PenTool size={14} strokeWidth={2.5} />}    label="Área (polígono)" activa={herramienta === 'areaPoly'} onClick={() => usar('areaPoly')} />
                    <Herramienta icono={<CircleIcon size={14} strokeWidth={2.5} />} label="Área (círculo)"  activa={herramienta === 'areaCirc'} onClick={() => usar('areaCirc')} />
                  </Seccion>

                  <Seccion titulo="Puntuales" abierta={secciones.puntuales}
                    onAlternar={() => setSecciones(s => ({ ...s, puntuales: !s.puntuales }))}>
                    <Herramienta icono={<MapPin size={14} strokeWidth={2.5} />} label="Marcador" activa={herramienta === 'marcador'} onClick={() => usar('marcador')} />
                    <Herramienta icono={<Type size={14} strokeWidth={2.5} />}   label="Etiqueta" activa={herramienta === 'etiqueta'} onClick={() => usar('etiqueta')} />
                  </Seccion>

                  <Seccion titulo="Capas" abierta={secciones.capas}
                    onAlternar={() => setSecciones(s => ({ ...s, capas: !s.capas }))}>
                    <Interruptor label="Calles"     valor={capas.calles}     cuenta={calles.length}     onClick={() => setCapas(c => ({ ...c, calles: !c.calles }))} />
                    <Interruptor label="Manzanas"   valor={capas.manzanas}   cuenta={manzanas.length}   onClick={() => setCapas(c => ({ ...c, manzanas: !c.manzanas }))} />
                    <Interruptor label="Áreas"      valor={capas.areas}      cuenta={areas.length}      onClick={() => setCapas(c => ({ ...c, areas: !c.areas }))} />
                    <Interruptor label="Marcadores" valor={capas.marcadores} cuenta={marcadores.length} onClick={() => setCapas(c => ({ ...c, marcadores: !c.marcadores }))} />
                    <Interruptor label="Etiquetas"  valor={capas.etiquetas}  cuenta={etiquetas.length}  onClick={() => setCapas(c => ({ ...c, etiquetas: !c.etiquetas }))} />
                    <Interruptor label="Postes"     valor={capas.postes}     cuenta={puntosProy.length} onClick={() => setCapas(c => ({ ...c, postes: !c.postes }))} />
                  </Seccion>
                </>
              )}
            </div>
          )}

          {/* Mapa */}
          <div className="flex-1 relative min-w-0">
            <MapContainer
              ref={setMapa}
              center={[-16.409, -71.537]}
              zoom={17}
              maxZoom={22}
              zoomControl={false}
              attributionControl={false}
              doubleClickZoom={false}
              style={{ height: '100%', width: '100%', background: '#0F1217' }}
            >
              {/* `crossOrigin` obligatorio, igual que en Mapas.jsx: la caché de teselas
                  es compartida por url, así que una capa que las pida sin CORS guarda
                  respuestas opacas —que Chrome contabiliza a ~8 MB cada una— y vuelve
                  a disparar la purga que borra el mapa guardado en cada arranque. */}
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" maxZoom={22} maxNativeZoom={21} crossOrigin="anonymous" />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                subdomains="abcd" maxZoom={22} maxNativeZoom={20} opacity={0.85}
                crossOrigin="anonymous"
              />
              <Encuadrar clave={claveEncuadre} coords={coordsEncuadre} />

              <DisenoCalles
                calles={calles}
                visible={capas.calles}
                dibujando={paso === 'catastro' && herramienta === 'calle'}
                trazo={trazoCalle}
                setTrazo={setTrazoCalle}
                onTerminar={terminarCalle}
                onMedida={setMedida}
                borrador={borrador}
                seleccionId={seleccion && seleccion.tipo === 'calle' ? seleccion.id : null}
                onSeleccionar={(id) => setSeleccion({ tipo: 'calle', id })}
                edicion={paso === 'catastro' ? edicion : null}
                onMoverVertice={moverVertice}
                onClicBorde={clicBorde}
              />

              <DisenoCatastro
                manzanas={manzanas} areas={areas} marcadores={marcadores} etiquetas={etiquetas}
                capas={capas}
                herramienta={paso === 'catastro' ? herramienta : null}
                pts={pts} setPts={setPts}
                onFinalizar={finalizar}
                seleccion={seleccion} onSeleccionar={(s) => { if (!edicion) setSeleccion(s); }}
              />

              {capas.postes && puntosProy.map(p => (
                <CircleMarker
                  key={p.id}
                  center={[p.coords.lat, p.coords.lng]}
                  radius={radioPoste(lupa)}
                  pathOptions={{ color: '#E7EAEF', weight: 1.5, fillColor: colorPunto(p), fillOpacity: 1 }}
                />
              ))}
            </MapContainer>

            {/* Plegar el panel */}
            <div className="absolute top-3 left-3 z-[500]">
              <button onClick={() => setPanelAbierto(v => !v)} className={`${btnBase} w-10 px-0 shadow-xl`}>
                {panelAbierto ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
              </button>
            </div>

            {/* Lupas */}
            <div className="absolute top-3 right-3 z-[500] flex flex-col rounded-xl border-2 border-[var(--d-borde)] overflow-hidden bg-[var(--d-alto)] shadow-xl">
              <button onClick={() => setLupa(s => Math.min(2.5, s + 0.2))} className="w-10 h-10 flex items-center justify-center hover:bg-white/5" title="Agrandar postes">
                <ZoomIn size={17} strokeWidth={2.5} />
              </button>
              <div className="h-px bg-[var(--d-borde)]" />
              <button onClick={() => setLupa(s => Math.max(0.5, s - 0.2))} className="w-10 h-10 flex items-center justify-center hover:bg-white/5" title="Reducir postes">
                <ZoomOut size={17} strokeWidth={2.5} />
              </button>
            </div>

            {/* Proyecto sin postes ni catastro: no hay nada que encuadrar todavía */}
            {proyectoVacio && !herramienta && !borrador && !edicion && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] w-[min(92%,26rem)] rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] px-4 py-3 shadow-xl text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">Proyecto sin postes</p>
                <p className="mt-1 text-[11px] font-bold text-[var(--d-suave)] leading-snug">
                  Busca la ciudad o localidad arriba y empieza por las calles. Los postes pueden venir después, del levantamiento.
                </p>
              </div>
            )}

            {/* Calle en curso: medida en vivo y cierre del trazo */}
            {herramienta === 'calle' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2">
                <div className="rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] px-3 h-10 flex items-center gap-3 shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">
                    {trazoCalle.length === 0 ? 'Traza el borde de la manzana' : trazoCalle.length + ' vértices'}
                  </p>
                  {medida && trazoCalle.length > 0 && (
                    <p className="text-[11px] font-black tabular-nums">
                      {medida.largo.toFixed(1)} m
                      {medida.imantado === 'angulo' && <span className="text-[#FACC15] ml-1.5">90°</span>}
                      {medida.imantado === 'vertice' && <span className="text-[#22c55e] ml-1.5">unido</span>}
                    </p>
                  )}
                </div>
                <button onClick={() => setTrazoCalle(v => v.slice(0, -1))} disabled={trazoCalle.length === 0}
                  className={btnBase + ' shadow-xl disabled:opacity-30'}>
                  <Undo2 size={13} /> Atrás
                </button>
                <button onClick={terminarCalle} disabled={trazoCalle.length < 2}
                  className={btn + ' bg-brand-500 border-brand-600 text-white shadow-xl disabled:opacity-30'}>
                  <Check size={13} /> Terminar
                </button>
                <button onClick={cancelarDibujo} className={btn + ' bg-[var(--d-alto)] border-red-500/60 text-red-400 shadow-xl'}>
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Ayuda y control del dibujo en curso */}
            {herramienta && herramienta !== 'calle' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2">
                <div className="rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] px-3 h-10 flex items-center shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">
                    {AYUDA[herramienta][Math.min(pts.length, AYUDA[herramienta].length - 1)]}
                  </p>
                </div>
                <button onClick={() => setPts(v => v.slice(0, -1))} disabled={pts.length === 0}
                  className={`${btnBase} shadow-xl disabled:opacity-30`}>
                  <Undo2 size={13} /> Atrás
                </button>
                {(herramienta === 'manzanaLibre' || herramienta === 'areaPoly') && (
                  <button
                    onClick={() => finalizar(herramienta === 'manzanaLibre' ? 'manzana' : 'areaPoly', { latlngs: pts })}
                    disabled={pts.length < 3}
                    className={`${btn} bg-brand-500 border-brand-600 text-white shadow-xl disabled:opacity-30`}
                  >
                    <Check size={13} /> Cerrar
                  </button>
                )}
                <button onClick={cancelarDibujo} className={`${btn} bg-[var(--d-alto)] border-red-500/60 text-red-400 shadow-xl`}>
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Panel derecho: pide lo que falta, o describe lo seleccionado */}
          {borrador && (
            <div className="w-60 shrink-0 border-l border-[var(--d-borde)] bg-[var(--d-panel)] overflow-y-auto p-3 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Calle nueva</p>
              <p className="text-[11px] font-bold text-[var(--d-suave)]">
                {Math.round(largoPolilinea(borrador.A))} m de largo · {borrador.A.length} vértices
              </p>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)] mb-1.5">Ancho de arranque</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setBorrador(b => ({ ...b, ancho: Math.max(3, b.ancho - 1) }))}
                    className={btnBase + ' w-10 px-0'}><Minus size={13} strokeWidth={3} /></button>
                  <span className="flex-1 text-center text-lg font-black tabular-nums">{borrador.ancho} m</span>
                  <button onClick={() => setBorrador(b => ({ ...b, ancho: Math.min(40, b.ancho + 1) }))}
                    className={btnBase + ' w-10 px-0'}><Plus size={13} strokeWidth={3} /></button>
                </div>
              </div>

              <button onClick={() => setBorrador(b => ({ ...b, lado: b.lado * -1 }))} className={btnBase + ' w-full'}>
                <FlipHorizontal size={13} /> Cambiar lado
              </button>

              <p className="text-[10px] font-bold text-[var(--d-suave)] leading-snug">
                El ancho es solo el arranque: después se mueve cada borde por su cuenta.
              </p>

              <button onClick={confirmarCalle} className={btn + ' w-full bg-brand-500 border-brand-600 text-white'}>
                <Check size={13} /> Confirmar
              </button>
              <button onClick={() => setBorrador(null)} className={btn + ' w-full bg-[var(--d-alto)] border-red-500/60 text-red-400'}>
                <X size={13} /> Descartar
              </button>
            </div>
          )}

          {!borrador && edicion && (
            <div className="w-60 shrink-0 border-l border-[var(--d-borde)] bg-[var(--d-panel)] overflow-y-auto p-3 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Editando</p>
              <p className="text-sm font-black uppercase">{String(edicion.id).replace('_', ' ')}</p>
              <div className="space-y-1 text-[11px] font-bold text-[var(--d-suave)]">
                <p>{Math.round(largoPolilinea(edicion.A))} m de largo</p>
                {anchosEdicion && <p>Ancho {anchosEdicion.min.toFixed(1)} – {anchosEdicion.max.toFixed(1)} m</p>}
                <p>{edicion.A.length + edicion.B.length} vértices</p>
              </div>

              <Herramienta icono={<Plus size={14} strokeWidth={2.5} />} label="Agregar vértice"
                activa={edicion.modo === 'agregar'} onClick={() => alternarModoEdicion('agregar')} />
              <Herramienta icono={<Scissors size={14} strokeWidth={2.5} />} label="Cortar calle"
                activa={edicion.modo === 'cortar'} onClick={() => alternarModoEdicion('cortar')} />

              <p className="text-[10px] font-bold text-[var(--d-suave)] leading-snug">{ayudaEdicion}</p>
              {edicion.aviso && <p className="text-[11px] font-black text-red-400">{edicion.aviso}</p>}

              <button onClick={guardarEdicion} className={btn + ' w-full bg-brand-500 border-brand-600 text-white'}>
                <Check size={13} /> Guardar
              </button>
              <button onClick={() => setEdicion(null)} className={btn + ' w-full bg-[var(--d-alto)] border-red-500/60 text-red-400'}>
                <X size={13} /> Cancelar
              </button>
            </div>
          )}

          {!borrador && !edicion && (pendiente || seleccionado) && (
            <div className="w-60 shrink-0 border-l border-[var(--d-borde)] bg-[var(--d-panel)] overflow-y-auto p-3 space-y-3">
              {pendiente ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">
                    {pendiente.que === 'etiqueta' ? 'Texto de la etiqueta' : 'Tipo'}
                  </p>
                  {pendiente.que === 'etiqueta' ? (
                    <>
                      <input
                        autoFocus
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmarPendiente(); }}
                        placeholder="Escribe aquí"
                        className="w-full h-10 px-3 rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] text-sm font-bold outline-none focus:border-brand-500"
                      />
                      <button onClick={() => confirmarPendiente()} disabled={!texto.trim()}
                        className={`${btn} w-full bg-brand-500 border-brand-600 text-white disabled:opacity-30`}>
                        <Check size={13} /> Colocar
                      </button>
                    </>
                  ) : (
                    (pendiente.que === 'marcador' ? TIPOS_MARCADOR
                      : pendiente.tipo === 'circle' ? TIPOS_AREA_CIRC : TIPOS_AREA_POLY
                    ).map(t => (
                      <button key={t} onClick={() => confirmarPendiente(t)} className={`${btnBase} w-full justify-start`}>
                        {t}
                      </button>
                    ))
                  )}
                  <button onClick={() => setPendiente(null)} className={`${btn} w-full bg-[var(--d-alto)] border-red-500/60 text-red-400`}>
                    <X size={13} /> Descartar
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Seleccionado</p>
                  <p className="text-sm font-black uppercase">{String(seleccionado.id).replace('_', ' ')}</p>
                  <div className="space-y-1 text-[11px] font-bold text-[var(--d-suave)]">
                    {seleccion.tipo === 'manzana' && (
                      <>
                        <p>{Math.round(areaM2(seleccionado.latlngs)).toLocaleString('es-PE')} m²</p>
                        <p>{seleccionado.latlngs.length} vértices</p>
                      </>
                    )}
                    {seleccion.tipo === 'area' && (
                      <>
                        <p>{seleccionado.subTipo}</p>
                        <p>{seleccionado.tipo === 'circle'
                          ? `Radio ${Math.round(seleccionado.radius)} m`
                          : `${Math.round(areaM2(seleccionado.latlngs)).toLocaleString('es-PE')} m²`}</p>
                      </>
                    )}
                    {seleccion.tipo === 'calle' && (
                      <>
                        <p>{Math.round(largoPolilinea(seleccionado.A))} m de largo</p>
                        {anchosSeleccion && <p>Ancho {anchosSeleccion.min.toFixed(1)} – {anchosSeleccion.max.toFixed(1)} m</p>}
                      </>
                    )}
                    {seleccion.tipo === 'marcador' && <p>{seleccionado.tipo}</p>}
                    {seleccion.tipo === 'etiqueta' && <p>“{seleccionado.texto}”</p>}
                  </div>
                  {seleccion.tipo === 'calle' && (
                    <button onClick={() => editarCalle(seleccionado)} className={`${btnBase} w-full`}>
                      <PenLine size={13} /> Editar
                    </button>
                  )}
                  <button onClick={borrarSeleccion} className={`${btn} w-full bg-[var(--d-alto)] border-red-500/60 text-red-400`}>
                    <Trash2 size={13} /> Borrar
                  </button>
                  <button onClick={() => setSeleccion(null)} className={`${btnBase} w-full`}>
                    Deseleccionar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Barra de estado */}
      {proyecto && (
        <div className="shrink-0 h-8 px-3 flex items-center gap-4 border-t border-[var(--d-borde)] bg-[var(--d-panel)] text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">
          <span>{puntosProy.length} postes</span>
          <span>{calles.length} calles</span>
          <span>{manzanas.length} manzanas</span>
          <span>{areas.length} áreas</span>
          <span>{marcadores.length + etiquetas.length} puntuales</span>
          <EstadoGuardado cargando={cargando} {...estadoGuardado} />
        </div>
      )}
    </div>
  );
}
