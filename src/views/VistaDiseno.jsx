import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft, Folder, Layers, Waypoints, Boxes, Route, Cable, FileDown, Lock,
  ZoomIn, ZoomOut, Square, PenTool, Undo2, Check, X, Trash2, Loader2,
  Circle as CircleIcon, MapPin, Type, PanelLeftClose, PanelLeft, ChevronDown,
  Spline, Minus, Plus, FlipHorizontal, Scissors, PenLine, FolderPlus, LayoutGrid,
  Menu, Search, Maximize, LocateFixed, RotateCw,
} from 'lucide-react';
import { perteneceAProyecto, contarPorProyecto } from '../utils/helpers';
import DisenoCatastro from '../components/DisenoCatastro';
import DisenoCalles from '../components/DisenoCalles';
import DisenoBuscador from '../components/DisenoBuscador';
import DisenoCandidatas from '../components/DisenoCandidatas';
import DisenoCasas from '../components/DisenoCasas';
import DisenoEdicionManzana from '../components/DisenoEdicionManzana';
import { manzanasDesdeCalles } from '../utils/disenoManzanas';
import {
  FORMATOS, MAX_CASAS, admiteFormatoRegular, formatoNuevo, generarCasas, girosDe, siguienteGiro, totalFamilias,
} from '../utils/disenoCasas';
import {
  suscribirCatastro, iniciarCatastro, crearGuardadoDiferido, CAPAS, suscribirCasas, borrarCasas, capaCasas,
} from '../services/disenoService';
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

/* Ids nuevos que NUNCA se repiten: el último número usado de cada tipo se guarda en el
   catastro (`ultimos`). Antes se tomaba el mayor de la lista y, al borrar la última,
   su número volvía a nacer (calle_003 otra vez); cuando las casas y las NAPs apunten a
   manzanas, eso las enlazaría con otra. Devuelve los ids y el `ultimos` a guardar. */
const nuevosIds = (catastro, lista, prefijo, n = 1) => {
  const nums = lista.map(x => parseInt(String(x.id).split('_')[1] || '0', 10) || 0);
  const base = Math.max(0, ...nums, catastro?.ultimos?.[prefijo] || 0);
  return {
    ids: Array.from({ length: n }, (_, k) => `${prefijo}_${String(base + k + 1).padStart(3, '0')}`),
    ultimos: { ...(catastro?.ultimos || {}), [prefijo]: base + n },
  };
};

// Cómo nació cada manzana: lo va a necesitar su configuración (regular o irregular)
const FORMA_TEXTO = { rect: 'Rectangular, dibujada', libre: 'Irregular, dibujada', calles: 'Desde calles (irregular)' };

/* Regular: la cuadra rectangular dibujada a mano (acordado el 24/09). Las de antes del
   24/09 no guardaban cómo nacieron: cuentan como regulares si tienen cuatro esquinas,
   como en App_Design. */
const esRegular = (m) => !!m && (m.forma ? m.forma === 'rect' : admiteFormatoRegular(m.latlngs));

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
      <ChevronDown size={16} className={`transition-transform ${abierta ? 'rotate-180' : ''}`} />
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
      {valor && <Check size={11} strokeWidth={4} className="text-white" />}
    </span>
    <span className="flex-1 text-left text-[11px] font-black uppercase tracking-widest text-[var(--d-texto)]">{label}</span>
    <span className="text-[10px] font-black text-[var(--d-suave)]">{cuenta}</span>
  </button>
);

/* ── Pantalla: PC, celular vertical o celular horizontal (24/09) ───────────────
   En la PC, los paneles de siempre a los costados. En el celular el mapa va entero:
   las herramientas en una barra (abajo en vertical, a la izquierda en horizontal) que
   abre su grupo en una hoja, y lo seleccionado en otra hoja (abajo en vertical, a la
   derecha en horizontal). Una tablet echada cuenta como PC. */
const modoPantalla = () => {
  const w = window.innerWidth, h = window.innerHeight;
  if (w >= 900 && h >= 560) return 'pc';
  return w > h ? 'horizontal' : 'vertical';
};
const useModoPantalla = () => {
  const [modo, setModo] = useState(modoPantalla);
  useEffect(() => {
    const actualizar = () => setModo(modoPantalla());
    window.addEventListener('resize', actualizar);
    window.addEventListener('orientationchange', actualizar);
    return () => {
      window.removeEventListener('resize', actualizar);
      window.removeEventListener('orientationchange', actualizar);
    };
  }, []);
  return modo;
};

/* Leaflet no se entera solo de que su caja cambió (girar el celular, plegar el panel):
   sin avisarle, el mapa queda corrido y con teselas grises. */
function AjustarTamano() {
  const map = useMap();
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !map.getContainer) return undefined;
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/* El guardado en chico, para el celular: un punto de color y una palabra. */
const IndicadorGuardado = ({ cargando, estado, error, soloPunto = false }) => {
  const [color, texto] = cargando ? ['bg-[var(--d-suave)]', 'Cargando…']
    : estado === 'error' ? ['bg-red-500', 'No se guardó']
    : (estado === 'pendiente' || estado === 'guardando') ? ['bg-amber-400', 'Guardando…']
    : ['bg-emerald-500', 'Guardado'];
  const titulo = estado === 'error'
    ? `No se guardó · ${error?.code === 'permission-denied' ? 'sin permiso de escritura' : (error?.code || 'error desconocido')}`
    : texto;
  return (
    <span className="flex items-center gap-1.5" title={titulo}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      {!soloPunto && <span className={`text-[10px] font-bold ${estado === 'error' ? 'text-red-400' : 'text-[var(--d-suave)]'}`}>{texto}</span>}
    </span>
  );
};

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
  const [capas, setCapas] = useState({ calles: true, manzanas: true, casas: true, areas: true, marcadores: true, etiquetas: true, postes: true });
  // Casas de las manzanas regulares, un documento por manzana (25/09)
  const [casasDoc, setCasasDoc] = useState(null);     // { proyectoId, porManzana: { [manzanaId]: { formato, casas, editadas } } }
  // Vértices con el dedo (25/09): el punto del dibujo marcado, y el vértice o lado
  // marcado de la manzana elegida, que se mueven desde lejos
  const [puntoMarcado, setPuntoMarcado] = useState(null);
  const [marcado, setMarcado] = useState(null);       // { tipo: 'vertice' | 'lado', i }
  const [formaViva, setFormaViva] = useState(null);   // { manzanaId, latlngs } mientras se arrastra
  const [avisoReset, setAvisoReset] = useState(null); // { manzanaId, formato?, latlngs? } a la espera del "sí"
  const [trazoCalle, setTrazoCalle] = useState([]);
  const [borrador, setBorrador] = useState(null);   // calle a la espera de ancho y lado
  const [edicion, setEdicion] = useState(null);     // { id, A, B, modo, corte, aviso } — calle en edición
  const [medida, setMedida] = useState(null);       // longitud del tramo en curso
  const [anchoDefecto, setAnchoDefecto] = useState(8);
  const [generacion, setGeneracion] = useState(null); // { candidatas, esquinasCerradas } — manzanas desde calles
  const [borrarId, setBorrarId] = useState(null);     // lo seleccionado que espera el "sí" para borrarse
  // Pantalla (24/09): en el celular, qué grupo de herramientas está abierto, el menú y el buscador
  const modo = useModoPantalla();
  const movil = modo !== 'pc';
  const [grupoAbierto, setGrupoAbierto] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [buscarAbierto, setBuscarAbierto] = useState(false);
  const [nonceEncuadre, setNonceEncuadre] = useState(0); // "centrar en el proyecto" vuelve a encuadrar
  const [miUbicacion, setMiUbicacion] = useState(null);
  const [avisoMapa, setAvisoMapa] = useState(null);
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

  // Postes de cada proyecto, para la lista: en una pasada y solo con la lista a la vista.
  // Antes se filtraban todos los puntos una vez por proyecto en cada render (24/09).
  const postesPorProyecto = useMemo(
    () => (proyecto ? null : contarPorProyecto(proyectos, puntos)),
    [proyecto, proyectos, puntos]
  );

  useEffect(() => {
    if (!proyectoId) return;
    const cortar = suscribirCatastro(proyectoId, (datos) => setCatastroDoc({ proyectoId, datos }));
    return () => cortar();
  }, [proyectoId]);

  useEffect(() => {
    if (!proyectoId) return undefined;
    const cortar = suscribirCasas(proyectoId, (porManzana) => setCasasDoc({ proyectoId, porManzana }));
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

  // Casas por manzana, solo de las manzanas que existen
  const casasListas = !!casasDoc && String(casasDoc.proyectoId) === String(proyectoId);
  const casasPorManzana = useMemo(() => {
    if (!casasListas) return {};
    const ids = new Set((catastro?.manzanas || []).map(m => String(m.id)));
    return Object.fromEntries(Object.entries(casasDoc.porManzana).filter(([id]) => ids.has(String(id))));
  }, [casasListas, casasDoc, catastro]);
  const totalCasas = Object.values(casasPorManzana).reduce((s, d) => s + (d.casas?.length || 0), 0);
  // Mientras se arrastra un vértice o un lado, las casas que le quedarían a la manzana
  const casasVivas = useMemo(() => {
    const doc = formaViva && casasPorManzana[formaViva.manzanaId];
    return doc ? { manzanaId: formaViva.manzanaId, casas: generarCasas(formaViva.latlngs, doc.formato) } : null;
  }, [formaViva, casasPorManzana]);

  /* Lo marcado vale para lo que se está tocando: cambiar la selección suelta el vértice
     y descarta el aviso pendiente; cambiar de herramienta o de cantidad de puntos suelta
     el punto del dibujo. Se ajusta en el render, como en el resto del repo. */
  const claveSel = seleccion ? `${seleccion.tipo}:${seleccion.manzanaId || ''}:${seleccion.id}` : '';
  const [claveSelAntes, setClaveSelAntes] = useState(claveSel);
  if (claveSel !== claveSelAntes) {
    setClaveSelAntes(claveSel);
    setMarcado(null);
    setFormaViva(null);
    setAvisoReset(null);
  }
  const claveDibujo = `${herramienta || ''}:${pts.length}`;
  const [claveDibujoAntes, setClaveDibujoAntes] = useState(claveDibujo);
  if (claveDibujo !== claveDibujoAntes) {
    setClaveDibujoAntes(claveDibujo);
    setPuntoMarcado(null);
  }

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
  const claveEncuadre = `${proyectoId}:${cargando ? 'cargando' : 'listo'}:${puntosProy.length > 0}:${nonceEncuadre}`;
  const proyectoVacio = !cargando && coordsEncuadre.length === 0;

  /* Proyecto nuevo desde Diseño: nace sin postes y se abre en el acto, sin esperar al
     servidor (24/09). onCrearProyecto ya dejó salir la escritura del proyecto; detrás va
     su catastro vacío, para que la escucha lo tenga en el equipo y no espere a nadie.
     Si el servidor rechaza el proyecto, se vuelve a la lista con el formulario abierto. */
  const crearProyecto = () => {
    const nombre = (nuevoNombre || '').trim();
    if (!nombre || !onCrearProyecto) return;
    setErrorCrear(null);
    const id = onCrearProyecto(nombre, () => {
      setProyectoId(actual => (String(actual) === String(id) ? null : actual));
      setNuevoNombre(nombre);
      setErrorCrear('El servidor no aceptó el proyecto. Vuelve a intentarlo.');
    });
    iniciarCatastro(id).catch((e) => console.error('No se pudo iniciar el catastro', e));
    setCasasDoc({ proyectoId: id, porManzana: {} }); // recién nacido: no tiene casas en ninguna parte
    setNuevoNombre(null);
    setProyectoId(id);
  };

  const guardar = (parche) => {
    const datos = { ...(catastro || {}), ...parche };
    setCatastroDoc({ proyectoId, datos }); // se pinta ya, sin esperar a Firestore
    guardado.encolar(proyectoId, CAPAS.CATASTRO, datos);
  };

  /* Casas: se escriben en el acto, sin el retardo del catastro. Así Firestore ya las
     tiene en el equipo cuando llega la primera respuesta de su escucha, y esa respuesta
     no las pisa. Cada cambio de casas es un toque (−/+, girar, familias), no un arrastre. */
  const guardarCasas = (manzanaId, datos) => {
    setCasasDoc(prev => ({
      proyectoId,
      porManzana: { ...(prev && String(prev.proyectoId) === String(proyectoId) ? prev.porManzana : {}), [manzanaId]: datos },
    }));
    guardado.encolar(proyectoId, capaCasas(manzanaId), { tipo: 'casas', manzanaId, ...datos });
    guardado.forzar().catch(() => {}); // el error ya llega al indicador de guardado
  };
  const quitarCasas = (manzanaId) => {
    if (!casasPorManzana[manzanaId]) return;
    setCasasDoc(prev => {
      if (!prev || String(prev.proyectoId) !== String(proyectoId)) return prev;
      const { [manzanaId]: _fuera, ...resto } = prev.porManzana;
      return { proyectoId, porManzana: resto };
    });
    borrarCasas(proyectoId, manzanaId).catch((e) => console.error('No se pudieron borrar las casas', e));
  };

  /* Cambiar el formato o la forma de una manzana rehace sus casas. Si ya se tocaron a mano
     (familias; más adelante fusiones y cortes), primero se avisa (acordado el 24-25/09). */
  const aplicarCambioManzana = (manzanaId, { formato, latlngs } = {}) => {
    const m = manzanas.find(x => String(x.id) === String(manzanaId));
    if (!m) return;
    const forma = latlngs || m.latlngs;
    if (latlngs) guardar({ manzanas: manzanas.map(x => (String(x.id) === String(manzanaId) ? { ...x, latlngs } : x)) });
    const f = formato || casasPorManzana[manzanaId]?.formato;
    if (f && admiteFormatoRegular(forma)) guardarCasas(manzanaId, { formato: f, casas: generarCasas(forma, f), editadas: false });
    setFormaViva(null);
    setAvisoReset(null);
  };
  const pedirCambioManzana = (manzanaId, cambio) => {
    if (casasPorManzana[manzanaId]?.editadas) {
      setMarcado(null);
      setAvisoReset({ manzanaId, ...cambio });
      return;
    }
    aplicarCambioManzana(manzanaId, cambio);
  };

  /* Las herramientas con tipo o texto no guardan al primer clic: dejan el
     elemento en espera y el panel derecho pide el dato que falta. */
  const finalizar = (tipo, geo) => {
    if (tipo === 'manzana') {
      if (!geo.latlngs || geo.latlngs.length < 3) return;
      const { ids, ultimos } = nuevosIds(catastro, manzanas, 'manzana');
      const forma = herramienta === 'manzanaRect' ? 'rect' : 'libre';
      guardar({ manzanas: [...manzanas, { id: ids[0], latlngs: geo.latlngs, forma }], ultimos });
      // La cuadra rectangular nace con sus casas (Dos filas, una cada 6 m) y queda
      // elegida, con el formato a la vista para ajustarlo (25/09)
      if (forma === 'rect' && admiteFormatoRegular(geo.latlngs)) {
        const formato = formatoNuevo(geo.latlngs);
        guardarCasas(ids[0], { formato, casas: generarCasas(geo.latlngs, formato), editadas: false });
        setSeleccion({ tipo: 'manzana', id: ids[0] });
      }
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
      const { ids, ultimos } = nuevosIds(catastro, areas, 'area');
      guardar({ areas: [...areas, { id: ids[0], subTipo, ...geo }], ultimos });
    } else if (pendiente.que === 'marcador') {
      const { ids, ultimos } = nuevosIds(catastro, marcadores, 'marcador');
      guardar({ marcadores: [...marcadores, { id: ids[0], latlng: pendiente.latlng, tipo: subTipo }], ultimos });
    } else if (pendiente.que === 'etiqueta') {
      const t = texto.trim();
      if (!t) return;
      const { ids, ultimos } = nuevosIds(catastro, etiquetas, 'etiqueta');
      guardar({ etiquetas: [...etiquetas, { id: ids[0], latlng: pendiente.latlng, texto: t }], ultimos });
    }
    setPendiente(null);
    setTexto('');
  };

  const borrarSeleccion = () => {
    if (!seleccion) return;
    const { tipo, id } = seleccion;
    if (tipo === 'manzana')  { guardar({ manzanas: manzanas.filter(x => x.id !== id) }); quitarCasas(id); }
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
    const { ids, ultimos } = nuevosIds(catastro, calles, 'calle');
    guardar({ calles: [...calles, {
      id: ids[0],
      A: borrador.A,
      B: paralela(borrador.A, borrador.ancho, borrador.lado),
      ancho: borrador.ancho,
    }], ultimos });
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
    const { ids, ultimos } = nuevosIds(catastro, calles, 'calle');
    const nueva = { ...calles.find(c => c.id === edicion.id), ...partes[1], id: ids[0] };
    guardar({ calles: [...calles.map(c => (c.id === edicion.id ? { ...c, ...partes[0] } : c)), nueva], ultimos });
    setEdicion(null);
  };

  const guardarEdicion = () => {
    if (!edicion) return;
    guardar({ calles: calles.map(c => (c.id === edicion.id ? { ...c, A: edicion.A, B: edicion.B } : c)) });
    setSeleccion({ tipo: 'calle', id: edicion.id });
    setEdicion(null);
  };

  /* MANZANAS DESDE CALLES (acordado el 24/09): los espacios cerrados entre calles salen
     como candidatas (naranja entra, gris no; un toque alterna) y al confirmar pasan a
     ser manzanas, siempre irregulares. Las calles no se tocan: cerrar las esquinas es
     solo para el cálculo (utils/disenoManzanas.js). */
  const generarDesdeCalles = () => {
    setPts([]); setHerramienta(null); setPendiente(null); setSeleccion(null); setEdicion(null);
    setGeneracion(manzanasDesdeCalles(calles, manzanas));
  };
  const alternarCandidata = (i) => setGeneracion(g => (g
    ? { ...g, candidatas: g.candidatas.map((c, k) => (k === i ? { ...c, incluida: !c.incluida } : c)) }
    : g));
  const confirmarGeneracion = () => {
    const elegidas = (generacion?.candidatas || []).filter(c => c.incluida);
    if (!elegidas.length) return;
    const { ids, ultimos } = nuevosIds(catastro, manzanas, 'manzana', elegidas.length);
    guardar({
      manzanas: [...manzanas, ...elegidas.map((c, k) => ({ id: ids[k], latlngs: c.latlngs, forma: 'calles' }))],
      ultimos,
    });
    setGeneracion(null);
  };

  const cancelarDibujo = () => {
    setPts([]); setHerramienta(null); setPendiente(null);
    setTrazoCalle([]); setBorrador(null); setMedida(null); setEdicion(null); setGeneracion(null);
  };
  const usar = (h) => { setPts([]); setPendiente(null); setSeleccion(null); setEdicion(null); setGeneracion(null); setHerramienta(v => v === h ? null : h); };

  const btn = 'h-10 px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all';
  const btnBase = `${btn} bg-[var(--d-alto)] border-[var(--d-borde)] text-[var(--d-texto)] hover:border-[var(--d-borde2)]`;
  /* Botón de solo ícono, cuadrado de 40 px y sin relleno. Antes era btnBase con "w-10 px-0",
     pero en Tailwind gana px-3 sobre px-0 (va después en la hoja de estilos): quedaban 12 px
     por lado y el ícono se encogía a 12 px, lo pusiera uno del tamaño que fuera (25/09). */
  const btnIcono = 'w-10 h-10 shrink-0 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-all bg-[var(--d-alto)] border-[var(--d-borde)] text-[var(--d-texto)] hover:border-[var(--d-borde2)]';

  // En el celular se toca: no hay doble clic ni ratón que pase por encima
  const AYUDA = {
    manzanaRect:  movil
      ? ['Toca el inicio de la base', 'Fin de la base: toca, o mantén y arrastra', 'Ancho: toca, o mantén y arrastra']
      : ['Clic: inicio de la base', 'Clic: fin de la base (o mantén y arrastra)', 'Clic: ancho (o mantén y arrastra)'],
    manzanaLibre: [movil ? 'Toca cada vértice · Cerrar para terminar' : 'Clic por vértice · doble clic para cerrar'],
    areaPoly:     [movil ? 'Toca cada vértice · Cerrar para terminar' : 'Clic por vértice · doble clic para cerrar'],
    areaCirc:     movil ? ['Toca el centro', 'Toca el borde'] : ['Clic: centro', 'Clic: borde'],
    marcador:     [movil ? 'Toca donde va el marcador' : 'Clic para colocar el marcador'],
    etiqueta:     [movil ? 'Toca donde va el texto' : 'Clic donde va el texto'],
  };

  const seleccionado = seleccion && (
    seleccion.tipo === 'manzana'  ? manzanas.find(x => x.id === seleccion.id)   :
    seleccion.tipo === 'area'     ? areas.find(x => x.id === seleccion.id)      :
    seleccion.tipo === 'marcador' ? marcadores.find(x => x.id === seleccion.id) :
    seleccion.tipo === 'calle'    ? calles.find(x => x.id === seleccion.id)      :
    seleccion.tipo === 'etiqueta' ? etiquetas.find(x => x.id === seleccion.id)  :
    null // una casa tiene su propio panel
  );
  const anchosSeleccion = seleccion?.tipo === 'calle' && seleccionado ? anchosCalle(seleccionado.A, seleccionado.B) : null;

  const anchosEdicion = edicion ? anchosCalle(edicion.A, edicion.B) : null;
  const ayudaEdicion = !edicion ? null
    : edicion.modo === 'agregar' ? 'Toca cualquiera de los dos bordes para insertar un vértice ahí.'
    : edicion.modo === 'cortar'
      ? (edicion.corte ? 'Ahora toca el borde de enfrente.' : 'Toca un borde y luego el de enfrente: la calle se parte en dos.')
      : 'Arrastra los vértices de cualquiera de los dos bordes. Se imantan a los de otras calles.';

  /* En el celular, la hoja de lo elegido tapa el mapa: abajo en vertical, a la derecha en
     horizontal. Si la manzana elegida queda debajo, el mapa se corre para dejarla a la
     vista (25/09). Solo cuando cambia la manzana, no a cada toque dentro de ella. */
  const manzanaEnfocada = seleccion?.tipo === 'manzana' ? seleccion.id : seleccion?.tipo === 'casa' ? seleccion.manzanaId : null;
  useEffect(() => {
    if (!mapa || !manzanaEnfocada || modo === 'pc' || !mapa.getSize) return;
    const m = (catastro?.manzanas || []).find(x => String(x.id) === String(manzanaEnfocada));
    if (!m?.latlngs?.length) return;
    const tam = mapa.getSize();
    const px = m.latlngs.map(p => mapa.latLngToContainerPoint(p));
    const cx = px.reduce((s, p) => s + p.x, 0) / px.length;
    const cy = px.reduce((s, p) => s + p.y, 0) / px.length;
    if (modo === 'vertical' && cy > tam.y * 0.5) mapa.panBy([0, cy - tam.y * 0.3]);
    if (modo === 'horizontal' && cx > tam.x - 300) mapa.panBy([cx - (tam.x - 300) / 2, 0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, manzanaEnfocada, modo]);

  // Los avisos del mapa (ubicación, centrar) se van solos
  useEffect(() => {
    if (!avisoMapa) return undefined;
    const t = setTimeout(() => setAvisoMapa(null), 3500);
    return () => clearTimeout(t);
  }, [avisoMapa]);

  const elegir = (h) => { usar(h); setGrupoAbierto(null); };
  const seleccionar = (s) => { setSeleccion(s); setGrupoAbierto(null); };

  /* ── Casas (formato regular, 25/09) ──────────────────────────────────────────
     Dos toques: el primero elige la manzana y, con ella elegida, el siguiente la casa. */
  const manzanaSel = seleccion?.tipo === 'manzana' ? manzanas.find(x => String(x.id) === String(seleccion.id)) || null : null;
  const docCasasSel = manzanaSel ? casasPorManzana[manzanaSel.id] || null : null;
  const casaSel = seleccion?.tipo === 'casa'
    ? (casasPorManzana[seleccion.manzanaId]?.casas || []).find(c => c.id === seleccion.id) || null
    : null;

  const tocarCasa = (manzanaId, casaId) => {
    if (edicion || generacion) return;
    const elegida = seleccion?.tipo === 'casa' ? seleccion.manzanaId : seleccion?.tipo === 'manzana' ? seleccion.id : null;
    seleccionar(String(elegida) === String(manzanaId)
      ? { tipo: 'casa', manzanaId, id: casaId }
      : { tipo: 'manzana', id: manzanaId });
  };

  // Otro formato conserva el sentido de las filas; las cantidades se vuelven a calcular
  const elegirFormato = (tipo) => {
    if (!manzanaSel) return;
    const actual = docCasasSel?.formato;
    if (actual?.tipo === tipo) return;
    pedirCambioManzana(manzanaSel.id, { formato: formatoNuevo(manzanaSel.latlngs, tipo, actual ? actual.giro % 2 : null) });
  };
  const cambiarCantidad = (campo, delta) => {
    const f = docCasasSel?.formato;
    if (!f) return;
    const valor = Math.max(1, Math.min(MAX_CASAS, (Number(f[campo]) || 1) + delta));
    if (valor === f[campo]) return;
    pedirCambioManzana(manzanaSel.id, { formato: { ...f, [campo]: valor } });
  };
  const girar = () => {
    const f = docCasasSel?.formato;
    if (!f) return;
    pedirCambioManzana(manzanaSel.id, { formato: formatoNuevo(manzanaSel.latlngs, f.tipo, siguienteGiro(f.tipo, f.giro)) });
  };
  const cambiarFamilias = (delta) => {
    if (seleccion?.tipo !== 'casa') return;
    const doc = casasPorManzana[seleccion.manzanaId];
    if (!doc) return;
    const casas = doc.casas.map(c => (c.id === seleccion.id
      ? { ...c, familias: Math.max(0, Math.min(99, (Number(c.familias) || 0) + delta)) }
      : c));
    guardarCasas(seleccion.manzanaId, { ...doc, casas, editadas: true });
  };

  const centrarProyecto = () => {
    if (coordsEncuadre.length === 0) { setAvisoMapa('El proyecto todavía no tiene nada que centrar.'); return; }
    setNonceEncuadre(n => n + 1);
  };
  const irAMiUbicacion = () => {
    if (!navigator.geolocation || !mapa) { setAvisoMapa('Este equipo no da su ubicación.'); return; }
    setAvisoMapa('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        setMiUbicacion(p);
        mapa.setView(p, Math.max(mapa.getZoom(), 18));
        setAvisoMapa(null);
      },
      () => setAvisoMapa('No se pudo obtener tu ubicación.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  /* ── Grupos de herramientas: los mismos en el panel de la PC y en la barra del celular ── */
  const GRUPOS = [
    { id: 'calles',    label: 'Calles',   icono: Spline,     herramientas: ['calle'] },
    { id: 'manzanas',  label: 'Manzanas', icono: Square,     herramientas: ['manzanaRect', 'manzanaLibre'] },
    { id: 'areas',     label: 'Áreas',    icono: CircleIcon, herramientas: ['areaPoly', 'areaCirc'] },
    { id: 'puntuales', label: 'Puntos',   icono: MapPin,     herramientas: ['marcador', 'etiqueta'] },
    { id: 'capas',     label: 'Capas',    icono: Layers,     herramientas: [] },
  ];
  const grupoActivo = (g) => g.herramientas.includes(herramienta) || (g.id === 'manzanas' && !!generacion);

  const stepperAncho = (
    <div className="flex items-center gap-1.5 pt-1">
      <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Ancho</span>
      <button onClick={() => setAnchoDefecto(v => Math.max(3, v - 1))}
        className="w-9 h-9 rounded-lg border-2 border-[var(--d-borde)] bg-[var(--d-alto)] flex items-center justify-center active:scale-95">
        <Minus size={16} strokeWidth={3} />
      </button>
      <span className="w-10 text-center text-sm font-black tabular-nums">{anchoDefecto}</span>
      <button onClick={() => setAnchoDefecto(v => Math.min(40, v + 1))}
        className="w-9 h-9 rounded-lg border-2 border-[var(--d-borde)] bg-[var(--d-alto)] flex items-center justify-center active:scale-95">
        <Plus size={16} strokeWidth={3} />
      </button>
    </div>
  );

  const contenidoGrupo = (id) => {
    if (id === 'calles') return (
      <>
        <Herramienta icono={<Spline size={17} strokeWidth={2.5} />} label="Dibujar calle" activa={herramienta === 'calle'} onClick={() => elegir('calle')} />
        {stepperAncho}
      </>
    );
    if (id === 'manzanas') return (
      <>
        <Herramienta icono={<LayoutGrid size={17} strokeWidth={2.5} />} label="Desde calles" activa={!!generacion} onClick={() => { generarDesdeCalles(); setGrupoAbierto(null); }} />
        <Herramienta icono={<Square size={17} strokeWidth={2.5} />}  label="Cuadra rectangular" activa={herramienta === 'manzanaRect'}  onClick={() => elegir('manzanaRect')} />
        <Herramienta icono={<PenTool size={17} strokeWidth={2.5} />} label="Cuadra irregular"   activa={herramienta === 'manzanaLibre'} onClick={() => elegir('manzanaLibre')} />
      </>
    );
    if (id === 'areas') return (
      <>
        <Herramienta icono={<PenTool size={17} strokeWidth={2.5} />}    label="Área (polígono)" activa={herramienta === 'areaPoly'} onClick={() => elegir('areaPoly')} />
        <Herramienta icono={<CircleIcon size={17} strokeWidth={2.5} />} label="Área (círculo)"  activa={herramienta === 'areaCirc'} onClick={() => elegir('areaCirc')} />
      </>
    );
    if (id === 'puntuales') return (
      <>
        <Herramienta icono={<MapPin size={17} strokeWidth={2.5} />} label="Marcador" activa={herramienta === 'marcador'} onClick={() => elegir('marcador')} />
        <Herramienta icono={<Type size={17} strokeWidth={2.5} />}   label="Etiqueta" activa={herramienta === 'etiqueta'} onClick={() => elegir('etiqueta')} />
      </>
    );
    return (
      <>
        <Interruptor label="Calles"     valor={capas.calles}     cuenta={calles.length}     onClick={() => setCapas(c => ({ ...c, calles: !c.calles }))} />
        <Interruptor label="Manzanas"   valor={capas.manzanas}   cuenta={manzanas.length}   onClick={() => setCapas(c => ({ ...c, manzanas: !c.manzanas }))} />
        <Interruptor label="Casas"      valor={capas.casas}      cuenta={totalCasas}        onClick={() => setCapas(c => ({ ...c, casas: !c.casas }))} />
        <Interruptor label="Áreas"      valor={capas.areas}      cuenta={areas.length}      onClick={() => setCapas(c => ({ ...c, areas: !c.areas }))} />
        <Interruptor label="Marcadores" valor={capas.marcadores} cuenta={marcadores.length} onClick={() => setCapas(c => ({ ...c, marcadores: !c.marcadores }))} />
        <Interruptor label="Etiquetas"  valor={capas.etiquetas}  cuenta={etiquetas.length}  onClick={() => setCapas(c => ({ ...c, etiquetas: !c.etiquetas }))} />
        <Interruptor label="Postes"     valor={capas.postes}     cuenta={puntosProy.length} onClick={() => setCapas(c => ({ ...c, postes: !c.postes }))} />
      </>
    );
  };

  /* ── Casas de la manzana elegida: formato, cantidades y girar en las regulares, o el
     aviso antes de rehacerlas. Las irregulares esperan su formato (pronto). ───────── */
  const stepperCasas = (label, campo) => {
    const valor = Number(docCasasSel?.formato?.[campo]) || 1;
    const clase = 'w-9 h-9 rounded-lg border-2 border-[var(--d-borde)] bg-[var(--d-alto)] flex items-center justify-center active:scale-95 disabled:opacity-30';
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">{label}</span>
        <button onClick={() => cambiarCantidad(campo, -1)} disabled={valor <= 1} title="Una casa menos" className={clase}>
          <Minus size={16} strokeWidth={3} />
        </button>
        <span className="w-9 text-center text-sm font-black tabular-nums">{valor}</span>
        <button onClick={() => cambiarCantidad(campo, 1)} disabled={valor >= MAX_CASAS} title="Una casa más" className={clase}>
          <Plus size={16} strokeWidth={3} />
        </button>
      </div>
    );
  };
  const avisoAqui = !!avisoReset && !!manzanaSel && String(avisoReset.manzanaId) === String(manzanaSel.id);
  const panelCasas = manzanaSel && (
    <div className="space-y-2">
      {avisoAqui ? (
        <div className="rounded-xl border-2 border-amber-500/70 p-2 space-y-2">
          <p className="text-[11px] font-black text-amber-300 leading-snug">
            Esta manzana tiene familias cambiadas a mano. Si sigues, sus casas se rehacen y vuelven a 1 familia.
          </p>
          <div className="flex gap-2">
            <button onClick={() => aplicarCambioManzana(avisoReset.manzanaId, avisoReset)}
              className={`${btn} flex-1 bg-amber-500 border-amber-600 text-[#0F1217]`}>
              Sí, rehacer
            </button>
            <button onClick={() => { setAvisoReset(null); setFormaViva(null); }} className={`${btnBase} flex-1`}>No</button>
          </div>
        </div>
      ) : !esRegular(manzanaSel) ? (
        <p className="text-[10px] font-bold text-[var(--d-suave)] leading-snug">Casas: con el formato irregular (pronto).</p>
      ) : !casasListas ? (
        <p className="text-[10px] font-bold text-[var(--d-suave)]">Cargando casas…</p>
      ) : (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Casas</p>
          <div className="grid grid-cols-3 gap-1.5">
            {FORMATOS.map(f => (
              <button key={f.id} onClick={() => elegirFormato(f.id)}
                className={`h-9 px-1 rounded-lg border-2 text-[10px] font-black uppercase tracking-wide leading-tight active:scale-95 transition-all
                  ${docCasasSel?.formato?.tipo === f.id
                    ? 'bg-brand-500 border-brand-600 text-white'
                    : 'bg-[var(--d-alto)] border-[var(--d-borde)] text-[var(--d-texto)]'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {docCasasSel ? (
            <>
              {docCasasSel.formato.tipo === 'tres-zonas'
                ? <>{stepperCasas('Costados', 'nLat')}{stepperCasas('Centro', 'nCentro')}</>
                : stepperCasas(docCasasSel.formato.tipo === 'dos-filas' ? 'Por fila' : 'Casas', 'n')}
              <button onClick={girar} className={`${btnBase} w-full`}>
                <RotateCw size={16} /> Girar
                <span className="text-[var(--d-suave)] normal-case tracking-normal">
                  {(docCasasSel.formato.giro || 0) + 1}/{girosDe(docCasasSel.formato.tipo)}
                </span>
              </button>
              <p className="text-[11px] font-bold text-[var(--d-suave)]">
                {docCasasSel.casas.length} casas · {totalFamilias(docCasasSel.casas)} familias · toca una casa para sus familias
              </p>
            </>
          ) : (
            <p className="text-[10px] font-bold text-[var(--d-suave)] leading-snug">Sin casas: elige un formato.</p>
          )}
        </>
      )}
      {!avisoAqui && (
        <p className="text-[10px] font-bold text-[var(--d-suave)] leading-snug">
          Toca un vértice{esRegular(manzanaSel) ? ' o un lado' : ''} para ajustarlo.
        </p>
      )}
    </div>
  );

  /* ── Lo que pide el dato que falta o describe lo seleccionado ─────────────── */
  let contexto = null;
  if (borrador) {
    contexto = (
      <>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Calle nueva</p>
        <p className="text-[11px] font-bold text-[var(--d-suave)]">
          {Math.round(largoPolilinea(borrador.A))} m de largo · {borrador.A.length} vértices
        </p>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)] mb-1.5">Ancho de arranque</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setBorrador(b => ({ ...b, ancho: Math.max(3, b.ancho - 1) }))}
              className={btnIcono}><Minus size={16} strokeWidth={3} /></button>
            <span className="flex-1 text-center text-lg font-black tabular-nums">{borrador.ancho} m</span>
            <button onClick={() => setBorrador(b => ({ ...b, ancho: Math.min(40, b.ancho + 1) }))}
              className={btnIcono}><Plus size={16} strokeWidth={3} /></button>
          </div>
        </div>
        <button onClick={() => setBorrador(b => ({ ...b, lado: b.lado * -1 }))} className={btnBase + ' w-full'}>
          <FlipHorizontal size={16} /> Cambiar lado
        </button>
        <p className="text-[10px] font-bold text-[var(--d-suave)] leading-snug">
          El ancho es solo el arranque: después se mueve cada borde por su cuenta.
        </p>
        <div className={movil ? 'grid grid-cols-2 gap-2' : 'space-y-3'}>
          <button onClick={confirmarCalle} className={btn + ' w-full bg-brand-500 border-brand-600 text-white'}>
            <Check size={16} /> Confirmar
          </button>
          <button onClick={() => setBorrador(null)} className={btn + ' w-full bg-[var(--d-alto)] border-red-500/60 text-red-400'}>
            <X size={16} /> Descartar
          </button>
        </div>
      </>
    );
  } else if (edicion) {
    contexto = (
      <>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Editando</p>
        <p className="text-sm font-black uppercase">{String(edicion.id).replace('_', ' ')}</p>
        <div className="space-y-1 text-[11px] font-bold text-[var(--d-suave)]">
          <p>{Math.round(largoPolilinea(edicion.A))} m de largo</p>
          {anchosEdicion && <p>Ancho {anchosEdicion.min.toFixed(1)} – {anchosEdicion.max.toFixed(1)} m</p>}
          <p>{edicion.A.length + edicion.B.length} vértices</p>
        </div>
        <div className={movil ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>
          <Herramienta icono={<Plus size={17} strokeWidth={2.5} />} label="Agregar vértice"
            activa={edicion.modo === 'agregar'} onClick={() => alternarModoEdicion('agregar')} />
          <Herramienta icono={<Scissors size={17} strokeWidth={2.5} />} label="Cortar calle"
            activa={edicion.modo === 'cortar'} onClick={() => alternarModoEdicion('cortar')} />
        </div>
        <p className="text-[10px] font-bold text-[var(--d-suave)] leading-snug">{ayudaEdicion}</p>
        {edicion.aviso && <p className="text-[11px] font-black text-red-400">{edicion.aviso}</p>}
        <div className={movil ? 'grid grid-cols-2 gap-2' : 'space-y-3'}>
          <button onClick={guardarEdicion} className={btn + ' w-full bg-brand-500 border-brand-600 text-white'}>
            <Check size={16} /> Guardar
          </button>
          <button onClick={() => setEdicion(null)} className={btn + ' w-full bg-[var(--d-alto)] border-red-500/60 text-red-400'}>
            <X size={16} /> Cancelar
          </button>
        </div>
      </>
    );
  } else if (pendiente) {
    contexto = (
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
              <Check size={16} /> Colocar
            </button>
          </>
        ) : (
          <div className={movil ? 'grid grid-cols-2 gap-2' : 'space-y-3'}>
            {(pendiente.que === 'marcador' ? TIPOS_MARCADOR
              : pendiente.tipo === 'circle' ? TIPOS_AREA_CIRC : TIPOS_AREA_POLY
            ).map(t => (
              <button key={t} onClick={() => confirmarPendiente(t)} className={`${btnBase} w-full justify-start`}>
                {t}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setPendiente(null)} className={`${btn} w-full bg-[var(--d-alto)] border-red-500/60 text-red-400`}>
          <X size={16} /> Descartar
        </button>
      </>
    );
  } else if (casaSel) {
    const familias = Number(casaSel.familias) || 0;
    contexto = (
      <>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Casa</p>
            <p className="text-sm font-black uppercase">
              {casaSel.id} · {String(seleccion.manzanaId).replace('_', ' ')}
            </p>
          </div>
          {movil && (
            <button onClick={() => setSeleccion(null)} title="Cerrar" className={btnIcono}>
              <X size={18} />
            </button>
          )}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)] mb-1.5">Familias</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => cambiarFamilias(-1)} disabled={familias <= 0} title="Una familia menos"
              className={`${btnIcono} disabled:opacity-30`}><Minus size={16} strokeWidth={3} /></button>
            <span className="flex-1 text-center text-lg font-black tabular-nums">{familias}</span>
            <button onClick={() => cambiarFamilias(1)} title="Una familia más"
              className={btnIcono}><Plus size={16} strokeWidth={3} /></button>
          </div>
          <p className="mt-1 text-[10px] font-bold text-[var(--d-suave)]">
            {familias === 0 ? 'No es vivienda (baldío, comercio, iglesia…)' : casaSel.esquina ? 'Casa de esquina' : ' '}
          </p>
        </div>
        <button onClick={() => seleccionar({ tipo: 'manzana', id: seleccion.manzanaId })} className={`${btnBase} w-full`}>
          <ArrowLeft size={16} /> Manzana
        </button>
        {!movil && (
          <button onClick={() => setSeleccion(null)} className={`${btnBase} w-full`}>
            Deseleccionar
          </button>
        )}
      </>
    );
  } else if (seleccionado) {
    contexto = (
      <>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Seleccionado</p>
            <p className="text-sm font-black uppercase">{String(seleccionado.id).replace('_', ' ')}</p>
          </div>
          {movil && (
            <button onClick={() => setSeleccion(null)} title="Cerrar" className={btnIcono}>
              <X size={18} />
            </button>
          )}
        </div>
        <div className="space-y-1 text-[11px] font-bold text-[var(--d-suave)]">
          {seleccion.tipo === 'manzana' && (
            // En una línea: el panel de la manzana ahora lleva sus casas debajo
            <p>
              {[seleccionado.forma && FORMA_TEXTO[seleccionado.forma],
                `${Math.round(areaM2(seleccionado.latlngs)).toLocaleString('es-PE')} m²`,
                `${seleccionado.latlngs.length} vértices`].filter(Boolean).join(' · ')}
            </p>
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
        {seleccion.tipo === 'manzana' && panelCasas}
        {seleccion.tipo === 'calle' && (
          <button onClick={() => editarCalle(seleccionado)} className={`${btnBase} w-full`}>
            <PenLine size={16} /> Editar
          </button>
        )}
        {/* Borrar pide un segundo toque: una calle borrada por error se perdía */}
        {borrarId === seleccionado.id ? (
          <div className="rounded-xl border-2 border-red-500/60 p-2 space-y-2">
            <p className="text-[11px] font-black text-red-400 leading-snug">
              ¿Borrar {String(seleccionado.id).replace('_', ' ')}? No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => { borrarSeleccion(); setBorrarId(null); }}
                className={`${btn} flex-1 bg-red-600 border-red-700 text-white`}>
                Sí, borrar
              </button>
              <button onClick={() => setBorrarId(null)} className={`${btnBase} flex-1`}>No</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setBorrarId(seleccionado.id)} className={`${btn} w-full bg-[var(--d-alto)] border-red-500/60 text-red-400`}>
            <Trash2 size={16} /> Borrar
          </button>
        )}
        {!movil && (
          <button onClick={() => setSeleccion(null)} className={`${btnBase} w-full`}>
            Deseleccionar
          </button>
        )}
      </>
    );
  }

  /* ── Menú ☰: el proyecto y los pasos (antes, una barra fija de pasos) ────────── */
  const menu = menuAbierto && proyecto && (
    <div className="fixed inset-0 z-[1200]" onClick={() => setMenuAbierto(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute rounded-2xl border-2 border-[var(--d-borde)] bg-[var(--d-panel)] shadow-2xl p-3 space-y-2 max-h-[calc(100%-1rem)] overflow-y-auto
          ${modo === 'pc' ? 'right-3 top-16 w-72' : modo === 'vertical' ? 'inset-x-2 top-14' : 'left-16 top-2 w-72'}`}
        style={modo === 'vertical' ? { top: 'calc(3.5rem + env(safe-area-inset-top))' } : undefined}
      >
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Proyecto</p>
        <p className="text-sm font-black truncate">{proyecto.nombre}</p>
        <button onClick={() => { cancelarDibujo(); setMenuAbierto(false); setProyectoId(null); }} className={`${btnBase} w-full`}>
          <Folder size={17} /> Cambiar de proyecto
        </button>
        <p className="pt-2 text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">Pasos del diseño</p>
        {PASOS.map(p => {
          const Icono = p.icono;
          const activo = paso === p.id;
          return (
            <button
              key={p.id}
              disabled={!p.listo}
              onClick={() => { cancelarDibujo(); setPaso(p.id); setMenuAbierto(false); }}
              className={`w-full h-10 px-3 rounded-xl border-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide transition-all
                ${!p.listo
                  ? 'border-dashed border-[var(--d-borde)] text-[#4C5462] cursor-not-allowed'
                  : activo
                    ? 'bg-brand-500 border-brand-600 text-white'
                    : 'bg-[var(--d-alto)] border-[var(--d-borde)] text-[var(--d-texto)] active:scale-95'}`}
            >
              {p.listo ? <Icono size={17} /> : <Lock size={14} />}
              <span className="flex-1 text-left">{p.num}. {p.label}</span>
              {!p.listo && <span className="text-[9px] font-bold normal-case tracking-normal">pronto</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ── Cabecera ─────────────────────────────────────────────────────────────── */
  const botonMenu = (
    <button onClick={() => setMenuAbierto(v => !v)} title="Menú" className={btnIcono}>
      <Menu size={22} strokeWidth={2.5} />
    </button>
  );
  const cabecera = (modo !== 'horizontal' || !proyecto) && (
    <div
      className="shrink-0 px-3 flex items-center gap-2 sm:gap-3 border-b border-[var(--d-borde)] bg-[var(--d-panel)]"
      style={{ paddingTop: `calc(${movil ? 6 : 10}px + env(safe-area-inset-top))`, paddingBottom: movil ? '6px' : '10px' }}
    >
      <button onClick={onVolver} className={btnIcono}>
        <ArrowLeft size={22} strokeWidth={2.5} />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`font-black uppercase truncate ${movil && proyecto ? 'text-[13px] tracking-wide' : 'text-sm tracking-[0.2em]'}`}>
          {movil && proyecto ? proyecto.nombre : 'Diseño'}
        </p>
        {movil && proyecto
          ? <IndicadorGuardado cargando={cargando} {...estadoGuardado} />
          : <p className="text-[10px] font-bold truncate text-[var(--d-suave)]">{proyecto ? proyecto.nombre : 'Elige un proyecto para empezar'}</p>}
      </div>
      {proyecto && !movil && <DisenoBuscador mapa={mapa} />}
      {proyecto && movil && (
        <button onClick={() => setBuscarAbierto(true)} title="Buscar lugar" className={btnIcono}>
          <Search size={21} strokeWidth={2.5} />
        </button>
      )}
      {proyecto && botonMenu}
    </div>
  );

  /* ── Barra de herramientas del celular ─────────────────────────────────────── */
  const botonGrupo = (g, vertical) => {
    const Icono = g.icono;
    const abierto = grupoAbierto === g.id;
    const activo = grupoActivo(g);
    return (
      <button
        key={g.id}
        onClick={() => {
          // Abrir un grupo suelta lo elegido: su hoja no se veía detrás de la de la selección
          if (grupoAbierto !== g.id) setSeleccion(null);
          setGrupoAbierto(v => (v === g.id ? null : g.id));
        }}
        title={g.label}
        className={`flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95
          ${vertical ? 'w-11 h-11' : 'flex-1 h-12'}
          ${activo ? 'bg-brand-500 text-white' : abierto ? 'bg-[var(--d-alto)] text-brand-500' : 'text-[var(--d-texto)]'}`}
      >
        <Icono size={vertical ? 22 : 21} strokeWidth={2.5} />
        {!vertical && <span className="text-[9px] font-black uppercase tracking-wide">{g.label}</span>}
      </button>
    );
  };
  const barraAbajo = modo === 'vertical' && proyecto && !cargando && (
    <div className="shrink-0 flex items-center gap-1 px-2 pt-1.5 border-t border-[var(--d-borde)] bg-[var(--d-panel)]"
      style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
      {GRUPOS.map(g => botonGrupo(g, false))}
    </div>
  );
  const barraIzquierda = modo === 'horizontal' && proyecto && (
    <div className="shrink-0 w-14 flex flex-col items-center gap-1 py-2 border-r border-[var(--d-borde)] bg-[var(--d-panel)] overflow-y-auto"
      style={{ paddingLeft: 'env(safe-area-inset-left)', boxSizing: 'content-box' }}>
      <button onClick={onVolver} title="Volver" className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95">
        <ArrowLeft size={22} strokeWidth={2.5} />
      </button>
      <IndicadorGuardado cargando={cargando} {...estadoGuardado} soloPunto />
      <div className="w-8 h-px my-1 bg-[var(--d-borde)]" />
      {!cargando && GRUPOS.map(g => botonGrupo(g, true))}
      <div className="flex-1" />
      <button onClick={() => setBuscarAbierto(true)} title="Buscar lugar" className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95">
        <Search size={22} strokeWidth={2.5} />
      </button>
      <button onClick={() => setMenuAbierto(v => !v)} title="Menú" className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95">
        <Menu size={22} strokeWidth={2.5} />
      </button>
    </div>
  );

  // Hojas del celular: el grupo abierto, o lo seleccionado / lo que falta completar
  const claseHoja = modo === 'vertical'
    ? 'absolute inset-x-0 bottom-0 z-[520] max-h-[45%] overflow-y-auto rounded-t-2xl border-t-2 border-[var(--d-borde2)] bg-[var(--d-panel)] shadow-2xl p-3'
    : 'absolute top-2 z-[520] w-64 max-h-[calc(100%-1rem)] overflow-y-auto rounded-2xl border-2 border-[var(--d-borde2)] bg-[var(--d-panel)] shadow-2xl p-3';
  const grupo = GRUPOS.find(g => g.id === grupoAbierto);
  const hojaGrupo = movil && grupo && !contexto && (
    <div className={`${claseHoja} ${modo === 'horizontal' ? 'left-2' : ''} space-y-1.5`}>
      <div className="flex items-center justify-between pb-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">{grupo.label}</p>
        <button onClick={() => setGrupoAbierto(null)} title="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--d-suave)] active:scale-95">
          <X size={18} />
        </button>
      </div>
      {contenidoGrupo(grupo.id)}
    </div>
  );
  const hojaContexto = movil && contexto && (
    <div className={`${claseHoja} ${modo === 'horizontal' ? 'right-2' : ''} space-y-3`}>
      {contexto}
    </div>
  );

  /* ── Barras de arriba del mapa: dibujo en curso y manzanas desde calles ─────── */
  const claseBarraSup = movil
    ? `absolute top-2 left-2 ${modo === 'horizontal' && contexto ? 'right-[17.5rem]' : 'right-2'} z-[500] flex flex-wrap items-center justify-center gap-1.5`
    : 'absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 max-w-[calc(100%-7rem)]';
  // Sobre el satélite, un botón apagado transparente no se ve: va sólido y en gris
  const apagadoSobreMapa = 'disabled:bg-[var(--d-alto)] disabled:border-[var(--d-borde)] disabled:text-[#5B6474] disabled:shadow-none';
  const barraGeneracion = generacion && (() => {
    const total = generacion.candidatas.length;
    const entran = generacion.candidatas.filter(c => c.incluida).length;
    return (
      <div className={claseBarraSup}>
        <div className="rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] px-3 py-1.5 min-h-10 flex flex-col justify-center shadow-xl">
          {total === 0 ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
              No salió ninguna manzana cerrada: revisa que las calles se toquen
            </p>
          ) : (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">
                {entran} de {total} manzana{total === 1 ? '' : 's'} · toca una para quitarla o ponerla
              </p>
              {generacion.esquinasCerradas > 0 && (
                <p className="text-[10px] font-bold text-[var(--d-suave)]">
                  Se cerraron {generacion.esquinasCerradas} punta{generacion.esquinasCerradas === 1 ? '' : 's'} de calle a menos de 10 m de otra (solo para el cálculo)
                </p>
              )}
            </>
          )}
        </div>
        {total > 0 && (
          <button onClick={confirmarGeneracion} disabled={entran === 0}
            className={`${btn} bg-brand-500 border-brand-600 text-white shadow-xl ${apagadoSobreMapa}`}>
            <Check size={16} /> Confirmar
          </button>
        )}
        <button onClick={() => setGeneracion(null)} title="Descartar"
          className={btn + ' bg-[var(--d-alto)] border-red-500/60 text-red-400 shadow-xl'}>
          <X size={18} />
        </button>
      </div>
    );
  })();
  const barraCalle = herramienta === 'calle' && (
    <div className={claseBarraSup}>
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
        className={`${btnBase} shadow-xl ${apagadoSobreMapa}`}>
        <Undo2 size={16} /> Atrás
      </button>
      <button onClick={terminarCalle} disabled={trazoCalle.length < 2}
        className={`${btn} bg-brand-500 border-brand-600 text-white shadow-xl ${apagadoSobreMapa}`}>
        <Check size={16} /> Terminar
      </button>
      <button onClick={cancelarDibujo} title="Cancelar" className={btn + ' bg-[var(--d-alto)] border-red-500/60 text-red-400 shadow-xl'}>
        <X size={18} />
      </button>
    </div>
  );
  // Un punto del dibujo marcado se mueve desde lejos; "Listo" lo suelta (25/09)
  const barraAyuda = herramienta && herramienta !== 'calle' && (
    <div className={claseBarraSup}>
      <div className="rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] px-3 min-h-10 flex items-center shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">
          {puntoMarcado != null
            ? (movil ? 'Punto marcado · arrastra un dedo en cualquier parte' : 'Punto marcado · arrastra en cualquier parte del mapa')
            : AYUDA[herramienta][Math.min(pts.length, AYUDA[herramienta].length - 1)]}
        </p>
      </div>
      {puntoMarcado != null && (
        <button onClick={() => setPuntoMarcado(null)} className={`${btn} bg-brand-500 border-brand-600 text-white shadow-xl`}>
          <Check size={16} /> Listo
        </button>
      )}
      <button onClick={() => setPts(v => v.slice(0, -1))} disabled={pts.length === 0}
        className={`${btnBase} shadow-xl ${apagadoSobreMapa}`}>
        <Undo2 size={16} /> Atrás
      </button>
      {(herramienta === 'manzanaLibre' || herramienta === 'areaPoly') && (
        <button
          onClick={() => finalizar(herramienta === 'manzanaLibre' ? 'manzana' : 'areaPoly', { latlngs: pts })}
          disabled={pts.length < 3}
          className={`${btn} bg-brand-500 border-brand-600 text-white shadow-xl ${apagadoSobreMapa}`}
        >
          <Check size={16} /> Cerrar
        </button>
      )}
      <button onClick={cancelarDibujo} title="Cancelar" className={`${btn} bg-[var(--d-alto)] border-red-500/60 text-red-400 shadow-xl`}>
        <X size={18} />
      </button>
    </div>
  );

  // Vértice o lado marcado de la manzana elegida: se mueve desde lejos (25/09)
  const barraMarcado = marcado && manzanaSel && !herramienta && (
    <div className={claseBarraSup}>
      <div className="rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] px-3 py-1.5 min-h-10 flex flex-col justify-center shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">
          {marcado.tipo === 'vertice' ? 'Vértice marcado' : 'Lado marcado'}
        </p>
        <p className="text-[10px] font-bold text-[var(--d-suave)]">
          {movil ? 'Arrastra un dedo en cualquier parte · con dos dedos se mueve el mapa' : 'Arrastra en cualquier parte del mapa para moverlo'}
        </p>
      </div>
      <button onClick={() => setMarcado(null)} className={`${btn} bg-brand-500 border-brand-600 text-white shadow-xl`}>
        <Check size={16} /> Listo
      </button>
    </div>
  );

  /* ── Botones sobre el mapa: postes más grandes o chicos, centrar, mi ubicación ── */
  const posBotones = modo === 'pc' ? 'top-3 right-3'
    : `top-1/3 ${modo === 'horizontal' && contexto ? 'right-[17.5rem]' : 'right-2'}`;
  const botonMapa = 'w-10 h-10 flex items-center justify-center hover:bg-white/5 active:bg-white/10';
  const botonesMapa = (
    <div className={`absolute ${posBotones} z-[500] flex flex-col rounded-xl border-2 border-[var(--d-borde)] overflow-hidden bg-[var(--d-alto)] shadow-xl`}>
      <button onClick={() => setLupa(s => Math.min(2.5, s + 0.2))} className={botonMapa} title="Agrandar postes">
        <ZoomIn size={21} strokeWidth={2.5} />
      </button>
      <div className="h-px bg-[var(--d-borde)]" />
      <button onClick={() => setLupa(s => Math.max(0.5, s - 0.2))} className={botonMapa} title="Reducir postes">
        <ZoomOut size={21} strokeWidth={2.5} />
      </button>
      <div className="h-px bg-[var(--d-borde)]" />
      <button onClick={centrarProyecto} className={botonMapa} title="Centrar en el proyecto">
        <Maximize size={20} strokeWidth={2.5} />
      </button>
      <div className="h-px bg-[var(--d-borde)]" />
      <button onClick={irAMiUbicacion} className={botonMapa} title="Mi ubicación">
        <LocateFixed size={20} strokeWidth={2.5} />
      </button>
    </div>
  );

  /* ── El mapa ──────────────────────────────────────────────────────────────── */
  const areaMapa = (
    <div className="flex-1 relative min-w-0 min-h-0">
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
        <AjustarTamano />
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
          onSeleccionar={(id) => { if (!generacion) seleccionar({ tipo: 'calle', id }); }}
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
          seleccion={seleccion} onSeleccionar={(s) => { if (!edicion && !generacion) seleccionar(s); }}
          puntoMarcado={puntoMarcado} setPuntoMarcado={setPuntoMarcado}
          onClicVacio={() => setMarcado(null)}
          manzanaViva={formaViva ? { id: formaViva.manzanaId, latlngs: formaViva.latlngs } : null}
        />

        {/* Casas encima de las manzanas: el primer toque elige la manzana y el segundo la casa */}
        <DisenoCasas
          casasPorManzana={casasPorManzana}
          vivas={casasVivas}
          visible={capas.casas && capas.manzanas}
          herramienta={paso === 'catastro' ? herramienta : null}
          seleccion={seleccion}
          onTocarCasa={tocarCasa}
        />

        {/* Vértices (y lados, en las regulares) de la manzana elegida, para ajustarlos */}
        {manzanaSel && paso === 'catastro' && !herramienta && !edicion && !generacion && !avisoAqui && (
          <DisenoEdicionManzana
            manzana={manzanaSel}
            forma={formaViva && String(formaViva.manzanaId) === String(manzanaSel.id) ? formaViva.latlngs : null}
            marcado={marcado}
            onMarcar={setMarcado}
            conLados={esRegular(manzanaSel)}
            manzanas={manzanas}
            onArrastre={(latlngs) => setFormaViva({ manzanaId: manzanaSel.id, latlngs })}
            onSoltar={(latlngs) => {
              if (!latlngs) { setFormaViva(null); return; }
              pedirCambioManzana(manzanaSel.id, { latlngs });
            }}
          />
        )}

        {/* Candidatas a manzana, encima de todo mientras se revisan */}
        {generacion && <DisenoCandidatas candidatas={generacion.candidatas} onAlternar={alternarCandidata} />}

        {capas.postes && puntosProy.map(p => (
          <CircleMarker
            key={p.id}
            center={[p.coords.lat, p.coords.lng]}
            radius={radioPoste(lupa)}
            pathOptions={{ color: '#E7EAEF', weight: 1.5, fillColor: colorPunto(p), fillOpacity: 1 }}
          />
        ))}

        {miUbicacion && (
          <CircleMarker center={miUbicacion} radius={8} interactive={false}
            pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: '#2563EB', fillOpacity: 1 }} />
        )}
      </MapContainer>

      {/* Plegar el panel (solo en la PC: en el celular no hay panel fijo) */}
      {modo === 'pc' && (
        <div className="absolute top-3 left-3 z-[500]">
          <button onClick={() => setPanelAbierto(v => !v)} className={`${btnIcono} shadow-xl`}>
            {panelAbierto ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
        </div>
      )}

      {botonesMapa}

      {/* Proyecto sin postes ni catastro: no hay nada que encuadrar todavía */}
      {proyectoVacio && !herramienta && !borrador && !edicion && !generacion && !grupoAbierto && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] w-[min(92%,26rem)] rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] px-4 py-3 shadow-xl text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">Proyecto sin postes</p>
          <p className="mt-1 text-[11px] font-bold text-[var(--d-suave)] leading-snug">
            Busca la ciudad o localidad {movil ? 'con la lupa' : 'arriba'} y empieza por las calles. Los postes pueden venir después, del levantamiento.
          </p>
        </div>
      )}

      {barraGeneracion}
      {barraMarcado}
      {barraCalle}
      {barraAyuda}

      {/* Buscador del celular: se abre sobre el mapa y se cierra al elegir un lugar */}
      {movil && buscarAbierto && (
        <div className="absolute top-2 inset-x-2 z-[1000] flex gap-2">
          <DisenoBuscador mapa={mapa} clase="flex-1 min-w-0" autoFocus alElegir={() => setBuscarAbierto(false)} />
          <button onClick={() => setBuscarAbierto(false)} title="Cerrar" className={`${btnIcono} shadow-xl`}>
            <X size={18} />
          </button>
        </div>
      )}

      {avisoMapa && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] px-4 py-2 shadow-xl">
          <p className="text-[11px] font-bold">{avisoMapa}</p>
        </div>
      )}

      {hojaGrupo}
      {hojaContexto}
    </div>
  );

  /* ── Lista de proyectos (antes de elegir uno) ─────────────────────────────── */
  const lista = (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">
          Proyectos disponibles
        </p>
        {onCrearProyecto && nuevoNombre === null && (
          <button onClick={() => setNuevoNombre('')} className={`${btn} bg-brand-500 border-brand-600 text-white`}>
            <FolderPlus size={17} strokeWidth={2.5} /> Nuevo proyecto
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
            <button onClick={crearProyecto} disabled={!nuevoNombre.trim()}
              className={`${btn} flex-1 bg-brand-500 border-brand-600 text-white disabled:opacity-30`}>
              <Check size={16} /> Crear
            </button>
            <button onClick={() => { setNuevoNombre(null); setErrorCrear(null); }} title="Cancelar"
              className={btnIcono}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      {proyectos.length === 0 ? (
        <p className="text-xs font-bold py-8 text-center text-[var(--d-suave)]">No tienes proyectos propios.</p>
      ) : (
        <div className="space-y-2">
          {proyectos.map(p => {
            const n = postesPorProyecto?.get(String(p.id)) || 0;
            return (
              <button
                key={p.id}
                onClick={() => setProyectoId(p.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-panel)] hover:border-[var(--d-borde2)] active:scale-95 transition-all"
              >
                <Folder size={22} className="text-brand-500 shrink-0" />
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
  );

  return (
    <div
      // [&_svg]:shrink-0: un ícono dentro de un botón flexible no se encoge si falta espacio
      className="fixed inset-0 z-[60] flex flex-col bg-[var(--d-fondo)] text-[var(--d-texto)] [&_svg]:shrink-0"
      style={PALETA}
    >
      {cabecera}

      {!proyecto ? lista : (
        <div className="flex-1 flex min-h-0">
          {barraIzquierda}

          {/* Panel de herramientas de la PC */}
          {modo === 'pc' && panelAbierto && (
            <div className="w-60 shrink-0 border-r border-[var(--d-borde)] bg-[var(--d-panel)] overflow-y-auto">
              {cargando ? (
                <div className="flex items-center gap-2 px-3 py-4 text-[var(--d-suave)]">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Cargando</span>
                </div>
              ) : GRUPOS.map(g => (
                <Seccion key={g.id} titulo={g.id === 'puntuales' ? 'Puntuales' : g.id === 'areas' ? 'Áreas especiales' : g.label}
                  abierta={secciones[g.id]}
                  onAlternar={() => setSecciones(s => ({ ...s, [g.id]: !s[g.id] }))}>
                  {contenidoGrupo(g.id)}
                </Seccion>
              ))}
            </div>
          )}

          {areaMapa}

          {/* Panel derecho de la PC: pide lo que falta, o describe lo seleccionado */}
          {modo === 'pc' && contexto && (
            <div className="w-60 shrink-0 border-l border-[var(--d-borde)] bg-[var(--d-panel)] overflow-y-auto p-3 space-y-3">
              {contexto}
            </div>
          )}
        </div>
      )}

      {barraAbajo}

      {/* Barra de estado (PC; en el celular el guardado va en la cabecera y los conteos, en Capas) */}
      {proyecto && modo === 'pc' && (
        <div className="shrink-0 h-8 px-3 flex items-center gap-4 border-t border-[var(--d-borde)] bg-[var(--d-panel)] text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)]">
          <span>{puntosProy.length} postes</span>
          <span>{calles.length} calles</span>
          <span>{manzanas.length} manzanas</span>
          <span>{totalCasas} casas</span>
          <span>{areas.length} áreas</span>
          <span>{marcadores.length + etiquetas.length} puntuales</span>
          <EstadoGuardado cargando={cargando} {...estadoGuardado} />
        </div>
      )}

      {menu}
    </div>
  );
}
