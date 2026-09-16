import React, { useEffect } from 'react';
import { logError } from './utils/errorLogger';

class PhotoManagerErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, intentos: 0 }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    logError({ mensaje: error.message, stack: (error.stack || '') + '\n\nComponentStack:\n' + info.componentStack, contexto: 'PhotoManagerErrorBoundary', uid: this.props.userUid || null, email: this.props.userEmail || null });
  }
  reintentar() { this.setState(prev => ({ error: null, intentos: prev.intentos + 1 })); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <p style={{ fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>Error al abrir la cámara</p>
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>Ocurrió un error inesperado.</p>
          <button onClick={() => this.reintentar()} style={{ background: '#FF6600', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 'bold', fontSize: 14 }}>Reintentar</button>
          <button onClick={this.props.onClose} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 'bold', fontSize: 14 }}>Cerrar</button>
        </div>
      );
    }
    return <React.Fragment key={this.state.intentos}>{this.props.children}</React.Fragment>;
  }
}
import { doc, setDoc, addDoc, updateDoc as fbUpdateDoc, deleteDoc, deleteField, getDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Componentes principales
import Login from './Login';
import Header from './components/Header';
import QueueModal from './components/QueueModal';
import Sidebar from './components/Sidebar';
import Configurador from './components/Configurador';
import Formulario from './components/Formulario';
import PhotoManager, { TABS_CONFIG } from './components/PhotoManager';
import { ConfirmModal, AlertModal, ExportModal } from './components/UI';
import VerDetalle from './components/VerDetalle';
import { enviarMensajeSistema, detectarCambiosFotos, formatId } from './utils/bitacoraAuto';
import { verticesDeConexion, longitudFibra, mejorProyeccion, separarDeFibras } from './utils/fibraUtils';
import { postesDeCable, metrosCableAcero, nombreTipoAcero, esMedioTramo, TRAZO_ACERO_VACIO, hayTrazoAcero, faltaEnTrazoAcero, tocarFibraAcero, trazoDesdeCable, sugeridasPorAcero } from './utils/cablesAcero';
import { perteneceAProyecto } from './utils/helpers';
import { posicionesAGuardar } from './utils/ordenTendido';
import { normalizarPerfil, etiquetaPerfil } from './utils/perfiles';
import BloqueoHerramienta from './components/BloqueoHerramienta';
import PantallaMigracion from './components/PantallaMigracion';

// Vistas
import VistaMapa from './views/VistaMapa';
import { MiniMapaRevision } from './components/Mapas';
import VistaProyectos from './views/VistaProyectos';
import VistaEquipos from './views/VistaEquipos';
import VistaControlFerreteria from './views/VistaControlFerreteria';
import VistaDatosUsuario from './views/VistaDatosUsuario';
import VistaAdmin from './views/VistaAdmin';
import VistaDiagnostico from './views/VistaDiagnostico';
import VistaPapelera from './views/VistaPapelera';
// Carga diferida: el módulo de diseño no entra en el arranque de la app.
const VistaDiseno = React.lazy(() => import('./views/VistaDiseno'));

// Hooks personalizados
import { useAuth, ADMIN_UID } from './hooks/useAuth';
import useIsDesktop from './hooks/useIsDesktop';
import usePantallaCompacta from './hooks/usePantallaCompacta';
import { useTheme } from './hooks/useTheme';
import { useMapState } from './hooks/useMapState';
import { useUIState } from './hooks/useUIState';
import { useFormulario } from './hooks/useFormulario';
import { useLogo } from './hooks/useLogo';
import { useFirebaseData } from './hooks/useFirebaseData';
import { useProjectLogic } from './hooks/useProjectLogic';
import { usePuntosLogic } from './hooks/usePuntosLogic';
import { useCablesAceroProyecto } from './hooks/useCablesAceroProyecto';
import { useSync } from './context/SyncContext';

// Utilidades
import { descargarFotosZip, handleExportKML } from './utils/exporters';
import { mapInteractions } from './utils/mapInteractions';
import { getCandidatas, quitarCandidata } from './utils/fotoHuerfanas';
import { filtrosVisibilidad } from './utils/filtrosVisibilidad';

// Constantes
import { DATA_INICIAL, COLORES_DIA, colorParaNuevoDia } from './data/constantes';

function App() {
  // Autenticación y sincronización
  const { user, deviceBlocked, cerrarSesion } = useAuth();
  const { estadoSync, cola, agregarTarea, erroresTareas, procesando: syncProcesando, eliminarTarea, reintentarTarea, guardarComoNuevo, isOnline } = useSync();
  const [queueModalAbierto, setQueueModalAbierto] = React.useState(false);
  const { logoApp, setLogoApp, handleCargarLogo } = useLogo(user);

  // Sesión admin — limpiar cuando el admin vuelve a su cuenta
  const adminReturnEmail = React.useMemo(() => {
    try { return localStorage.getItem('kipoAdminSession') || null; } catch { return null; }
  }, [user?.uid]);

  React.useEffect(() => {
    if (user?.uid === ADMIN_UID) localStorage.removeItem('kipoAdminSession');
  }, [user?.uid]);

  const volverAAdmin = React.useCallback(async (passwordDirecto) => {
    if (!adminReturnEmail) return;
    try {
      let password = passwordDirecto;
      if (!password) {
        const snap = await getDoc(doc(db, 'usuarios', adminReturnEmail));
        password = snap.exists() ? snap.data().password : null;
      }
      if (!password) return;
      localStorage.removeItem('kipoAdminSession');
      await signInWithEmailAndPassword(auth, adminReturnEmail, password);
    } catch (e) {
      console.error('Error volviendo al admin:', e);
    }
  }, [adminReturnEmail]);

  // Tema
  const { isDark, setIsDark, theme } = useTheme();
  const isDesktop = useIsDesktop();
  // Ventana chica (laptop): mismo diseño, medidas más chicas (clase `compacto` en index.css)
  const pantallaCompacta = usePantallaCompacta();

  // ── Perfil empresarial ──────────────────────────────────────────────
  // El admin puede previsualizar la app como cualquier perfil (base/claro).
  // Para el resto, perfilActivo = su propio perfil.
  const esAdmin = user?.uid === ADMIN_UID;
  const [perfilPreview, setPerfilPreview] = React.useState(() => {
    try { return localStorage.getItem('kipo_perfil_preview') || null; } catch { return null; }
  });
  const cambiarPerfilPreview = React.useCallback((p) => {
    setPerfilPreview(p);
    try { if (p) localStorage.setItem('kipo_perfil_preview', p); else localStorage.removeItem('kipo_perfil_preview'); } catch {}
  }, []);
  // Normalizado a los niveles nuevos: basico | estandar | avanzado
  const perfilActivo = normalizarPerfil((esAdmin && perfilPreview) ? perfilPreview : user?.perfil);

  // Estado del mapa
  const {
    mapViewState, setMapViewState,
    iconSize, setIconSize,
    mapStyle, setMapStyle,
    mostrarEtiquetas, setMostrarEtiquetas,
    menuEtiquetasAbierto, setMenuEtiquetasAbierto, toggleMenuEtiquetas,
    gpsTrigger, setGpsTrigger,
    yaSaltoAlInicio, setYaSaltoAlInicio
  } = useMapState();

  // Estado de UI
  const {
    vista, setVista,
    menuAbierto, setMenuAbierto,
    modalCodigoAbierto, setModalCodigoAbierto,
    puntoTemporal, setPuntoTemporal,
    modoFibra, setModoFibra,
    dibujandoFibra, setDibujandoFibra,
    capacidadFibra, setCapacidadFibra,
    fibrasVisibles, setFibrasVisibles,
    puntosRecorrido, setPuntosRecorrido,
    puntoSeleccionado, setPuntoSeleccionado,
    conexionSeleccionada, setConexionSeleccionada,
    modoLinea, setModoLinea,
    trazoAcero, setTrazoAcero,
    cableAceroSeleccionado, setCableAceroSeleccionado,
    acerosVisibles, setAcerosVisibles,
    tipoAceroId, setTipoAceroId,
    modoEdicion, setModoEdicion,
    modoLectura, setModoLectura,
    configTab, setConfigTab,
    selectorColorAbierto, setSelectorColorAbierto,
    acordeonAbierto, setAcordeonAbierto,
    modalOpen, setModalOpen,
    tempData, setTempData,
    confirmData, setConfirmData,
    alertData, setAlertData,
    exportData, setExportData
  } = useUIState();

  // Estado del formulario
  const {
    memoriaUltimoPunto,
    setMemoriaUltimoPunto,
    datosFormulario,
    setDatosFormulario,
    inputCamaraRef
  } = useFormulario();

  // Estado para pestaña de fotos
  const [photoTab, setPhotoTab] = React.useState('poste');

  // Modo "Instalación de postes": AGREGAR abre directo las fotos (subtab instalación) con ITEM + GUARDAR
  const [modoInstalacionFotos, setModoInstalacionFotos] = React.useState(false);

  // ID temporal local para nuevo punto al abrir PhotoManager desde Formulario
  const [tempPuntoId, setTempPuntoId] = React.useState(null);

  // Capa de fotos en mapa
  const [fotoPuntosActivo, setFotoPuntosActivo] = React.useState(false);
  const [fotosConCoordenadas, setFotosConCoordenadas] = React.useState([]);

  // Estado para recordar desde dónde se abrió la edición
  const [vistaAnterior, setVistaAnterior] = React.useState('mapa');

  // Estado para recordar qué modal debe abrirse al volver a proyectos
  const [modalPendiente, setModalPendiente] = React.useState(null);

  // Estado para mostrar overlay de navegación después de GPS desde lista
  const [mostrarOverlayGPS, setMostrarOverlayGPS] = React.useState(null);

  // Modo mapa supervisión: { proyecto, puntos } o null
  const [mapaSupervision, setMapaSupervision] = React.useState(null);

  // Solicitudes pendientes de MIS equipos → badge "Equipos" del menú
  const [notifEquipos, setNotifEquipos] = React.useState(0);
  React.useEffect(() => {
    if (!user?.uid) { setNotifEquipos(0); return; }
    const unsub = onSnapshot(
      query(collection(db, 'equipos'), where('ownerId', '==', user.uid)),
      s => setNotifEquipos(s.docs.reduce((t, d) => t + (d.data().pendientes?.length || 0), 0)),
      () => setNotifEquipos(0)
    );
    return unsub;
  }, [user?.uid]);

  // BLOQUE 5: invitación a equipo por enlace (?equipo=ID en la URL)
  const [invitacionEquipoId, setInvitacionEquipoId] = React.useState(null);
  React.useEffect(() => {
    if (!user?.uid) return;
    const eqId = new URLSearchParams(window.location.search).get('equipo');
    if (eqId) {
      setInvitacionEquipoId(eqId);
      window.history.replaceState({}, '', window.location.pathname);
      setVista('equipos');
    }
  }, [user?.uid]);

  // Notificaciones centralizadas de chat
  const [notifProyectos, setNotifProyectos] = React.useState({});
  const [notifEditor, setNotifEditor] = React.useState({});      // proyectos donde soy editor
  const [notifSupervisados, setNotifSupervisados] = React.useState({}); // proyectos solo lectura
  const totalNotifProyectos = Object.values(notifProyectos).reduce((s, n) => s + n, 0);
  const totalNotifEditor = Object.values(notifEditor).reduce((s, n) => s + n, 0);
  const totalNotifSupervisados = Object.values(notifSupervisados).reduce((s, n) => s + n, 0);
  // Proyectos button: propios + editor (ambos aparecen en VistaProyectos)
  const totalNotifVistaProyectos = totalNotifProyectos + totalNotifEditor;
  const totalNotificaciones = totalNotifVistaProyectos + totalNotifSupervisados;

  const marcarChatLeido = React.useCallback((proyectoId) => {
    localStorage.setItem(`lastChatRead_${proyectoId}`, new Date().toISOString());
    setNotifProyectos(prev => ({ ...prev, [proyectoId]: 0 }));
    setNotifEditor(prev => ({ ...prev, [proyectoId]: 0 }));
    setNotifSupervisados(prev => ({ ...prev, [proyectoId]: 0 }));
  }, []);

  // Geocodificación al abrir formulario de nuevo punto
  useEffect(() => {
    if (vista !== 'formulario' || modoEdicion) return;
    const lat = puntoTemporal?.lat;
    const lng = puntoTemporal?.lng;
    if (!lat || !lng || datosFormulario.direccion) return;
    const nominatimBase = import.meta.env.DEV ? '/api/nominatim' : 'https://nominatim.openstreetmap.org';
    fetch(`${nominatimBase}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
      .then(r => r.json())
      .then(data => {
        if (data.address) {
          const a = data.address;
          const road = a.road || a.street || a.pedestrian || a.footway || '';
          const house = a.house_number || '';
          const direccion = `${road} ${house}`.trim() || '-';
          const city = a.city || a.town || a.village || a.municipality || '';
          const state = a.state || a.region || '';
          const ubicacion = [city, state].filter(Boolean).join(', ') || '';
          // Componentes separados (para reportes que los necesitan por separado).
          // No reemplazan a direccion/ubicacion (que mantienen el sello igual).
          const distrito = a.city_district || a.suburb || a.town || a.village || city || '';
          const provincia = a.province || a.county || a.state_district || '';
          const estado = a.state || a.region || '';
          setDatosFormulario(prev => ({
            ...prev,
            direccion, ubicacion,
            via: road || '', numeroLote: house || '',
            distrito, provincia, estado,
          }));
        } else {
          setDatosFormulario(prev => ({ ...prev, direccion: '-' }));
        }
      })
      .catch(() => setDatosFormulario(prev => ({ ...prev, direccion: '-' })));
  }, [vista, puntoTemporal?.lat, puntoTemporal?.lng]);

  // ID del punto nuevo al abrir PhotoManager: se UNIFICA con puntoTemporal.id
  // (el mismo id con el que GUARDAR crea el punto). Así las fotos se enganchan al
  // mismo id que tendrá el punto → la recuperación las encuentra. Fallback a un id
  // Firestore solo si no hay puntoTemporal (flujos sin tapón en el mapa).
  useEffect(() => {
    if (modalOpen === 'MODO_FOTOS' && !puntoSeleccionado) {
      setTempPuntoId(puntoTemporal?.id || doc(collection(db, 'puntos')).id);
    } else if (modalOpen !== 'MODO_FOTOS') {
      setTempPuntoId(null);
      setModoInstalacionFotos(false);
    }
  }, [modalOpen, puntoSeleccionado, puntoTemporal?.id]);

  // Cuando la cola termina de subir una foto pendiente, reemplazarla en el formulario
  // por la versión de la nube (URL), para que deje de decir "sin subir" y se vea el full.
  useEffect(() => {
    const handler = (e) => {
      const { section, item, fotoData } = e.detail || {};
      if (!section || !item || !fotoData) return;
      setDatosFormulario(prev => {
        const slot = prev?.fotos?.[section]?.[item];
        if (!slot || typeof slot !== 'object' || !slot.uploading || slot._path !== fotoData._path) return prev;
        return { ...prev, fotos: { ...prev.fotos, [section]: { ...prev.fotos[section], [item]: fotoData } } };
      });
    };
    window.addEventListener('kipo-foto-subida', handler);
    return () => window.removeEventListener('kipo-foto-subida', handler);
  }, [setDatosFormulario]);

  // Captura global de errores JS no manejados
  useEffect(() => {
    const onError = (e) => {
      logError({ mensaje: e.message, stack: e.error?.stack, contexto: 'window.onerror', uid: user?.uid || null, email: user?.email || null });
    };
    const onRejection = (e) => {
      logError({ mensaje: String(e.reason), stack: e.reason?.stack, contexto: 'unhandledrejection', uid: user?.uid || null, email: user?.email || null });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, [user?.uid]);

  // Historial de vistas para navegación "Volver"
  const vistaHistorial = React.useRef(['mapa']);
  const setVistaConHistorial = React.useCallback((nuevaVista) => {
    vistaHistorial.current.push(vista);
    // Mantener máximo 5 entradas
    if (vistaHistorial.current.length > 5) vistaHistorial.current.shift();
    setVista(nuevaVista);
  }, [vista, setVista]);
  const volverVistaAnterior = React.useCallback(() => {
    const anterior = vistaHistorial.current.pop() || 'mapa';
    setVista(anterior);
  }, [setVista]);

  // Datos de Firebase
  const {
    proyectos, setProyectos,
    proyectosSupervisados, setProyectosSupervisados,
    puntos, setPuntos,
    puntosCompartidos,
    puntosDeProyectosProxios,
    conexiones, setConexiones,
    cablesAcero, setCablesAcero,
    config: configNube, setConfig
  } = useFirebaseData(user);

  // Total de solicitudes de colaboración pendientes en mis proyectos (para badge en menú)
  const totalSolicitudesColaboracion = React.useMemo(
    () => proyectos.reduce((s, p) => s + (p.solicitudesPendientes?.length || 0), 0),
    [proyectos]
  );

  // BLOQUE 6 (corte del sistema viejo): una sola vez, desvincula colaboradores y
  // solicitudes de MIS proyectos que no pertenecen a ningún equipo. Compartir ahora
  // pasa SIEMPRE por Equipos.
  React.useEffect(() => {
    if (!user?.uid || proyectos.length === 0) return;
    if (localStorage.getItem('limpiezaColabViejos_v1')) return;
    const viejos = proyectos.filter(p => !p.grupoId &&
      ((p.compartidoCon || []).length > 0 || (p.solicitudesPendientes || []).length > 0));
    if (viejos.length === 0) { localStorage.setItem('limpiezaColabViejos_v1', '1'); return; }
    (async () => {
      try {
        for (const p of viejos) {
          await fbUpdateDoc(doc(db, 'proyectos', String(p.id)), {
            compartidoCon: [], permisos: {}, supervisoresInfo: {}, solicitudesPendientes: [],
          });
        }
        localStorage.setItem('limpiezaColabViejos_v1', '1');
        console.log('Sistema viejo: ' + viejos.length + ' proyecto(s) desvinculados de colaboradores.');
      } catch (e) { console.error('Limpieza colaboradores viejos:', e); }
    })();
  }, [user?.uid, proyectos]);


  // Todos los puntos visibles: propios + de proyectos donde soy editor + de proyectos que poseo (deduplicados)
  const todosLosPuntos = React.useMemo(() => {
    const map = new Map();
    [...puntos, ...puntosDeProyectosProxios, ...puntosCompartidos].forEach(p => map.set(p.id, p));
    return Array.from(map.values());
  }, [puntos, puntosDeProyectosProxios, puntosCompartidos]);

  // Separar proyectos compartidos: solo supervisión vs con permiso de edición
  const proyectosEditor = React.useMemo(() =>
    proyectosSupervisados.filter(p => p.permisoActual === 'edicion' || p.permisoActual === 'ambos'),
    [proyectosSupervisados]
  );
  const todosLosProyectos = React.useMemo(() => [...proyectos, ...proyectosEditor], [proyectos, proyectosEditor]);

  // ARCHIVADOS: siguen existiendo (nada se borra) pero salen de la lista y del mapa.
  const proyectosActivos = React.useMemo(() => todosLosProyectos.filter(p => !p.archivado), [todosLosProyectos]);
  const proyectosArchivados = React.useMemo(() => todosLosProyectos.filter(p => p.archivado), [todosLosProyectos]);

  // Lista PERSONAL de proyectos: excluye los proyectos del grupo que el dueño aún no
  // "jaló" a su lista (viven solo en la vista del equipo hasta presionar EDITAR ahí).
  const proyectosLista = React.useMemo(() =>
    proyectosActivos.filter(p => p.esCompartido || !p.grupoId || (p.enListaDe || []).includes(user?.uid)),
    [proyectosActivos, user?.uid]
  );


  // Ferretería = COPIA por usuario. config.catalogoFerreteria es la lista del usuario (se
  // sembró de la base al crear la cuenta; luego él la edita libre). La base master (admin)
  // solo se copia al crear el usuario o cuando presiona "Importar base" en el Configurador.
  const config = configNube ? {
    ...DATA_INICIAL,
    ...configNube,
    catalogoFerreteria: configNube.catalogoFerreteria ?? DATA_INICIAL.catalogoFerreteria,
    armados: configNube.armados ?? DATA_INICIAL.armados,
    botonesPoste: configNube.botonesPoste
      ? { ...DATA_INICIAL.botonesPoste, ...configNube.botonesPoste }
      : DATA_INICIAL.botonesPoste,
  } : DATA_INICIAL;

  // Estado local de proyectos y días
  const [proyectoActual, setProyectoActual] = React.useState(null);
  const [diaActual, setDiaActual] = React.useState(null);
  const [diasVisibles, setDiasVisibles] = React.useState([]);
  const [menuDiasAbierto, setMenuDiasAbierto] = React.useState(false);
  const [diaExpandido, setDiaExpandido] = React.useState(null); // id del día expandido en el panel del mapa
  const toggleMenuDias = React.useCallback(() => setMenuDiasAbierto(v => !v), []);

  // Cambia el día activo y lo persiste en Firestore para que los editores lo vean
  const cambiarDiaActivo = React.useCallback((diaId) => {
    setDiaActual(diaId);
    if (proyectoActual && !proyectoActual.esCompartido && diaId) {
      fbUpdateDoc(doc(db, "proyectos", String(proyectoActual.id)), { diaActivoId: diaId })
        .catch(e => console.error("Error guardando diaActivoId:", e));
    }
  }, [proyectoActual]);

  // Guardar el día seleccionado por proyecto en localStorage
  useEffect(() => {
    if (diaActual && proyectoActual && !proyectoActual.esCompartido) {
      try { localStorage.setItem(`ultimoDia_${proyectoActual.id}`, diaActual); } catch(e) {}
    }
  }, [diaActual, proyectoActual?.id]);

  // Lógica de proyectos
  const {
    confirmarCrearProyecto,
    confirmarCrearDia,
    seleccionarProyecto,
    toggleVisibilidadDia,
    toggleVisibilidadProyecto,
    cambiarColorDia,
    uniformizarColorDias,
    cambiarColorProyecto,
    solicitarBorrarProyecto,
    irUbicacionProyecto,
    aprobarSupervisor,
    rechazarSupervisor,
    eliminarSupervisor,
    crearProyectoDiseno
  } = useProjectLogic({
    user,
    proyectos, setProyectos,
    theme,
    proyectoActual, setProyectoActual,
    setDiaActual,
    diasVisibles, setDiasVisibles,
    puntos: todosLosPuntos,
    tempData,
    setPuntos, setConexiones,
    setModalOpen, setConfirmData, setAlertData,
    setMapViewState, setVista, setMenuAbierto,
    config
  });

  // Lógica de puntos
  const [modoMover, setModoMover] = React.useState(false);
  const [pendingCoords, setPendingCoords] = React.useState(null);

  // Modo reasignación de puntos a otro proyecto.
  // moverProyId = proyecto de la LISTA desde la que se entró. No vale asumir
  // proyectoActual: el mapa puede tener varios proyectos encendidos a la vez, y
  // se entra a migrar desde la lista de cualquiera de ellos.
  const [modoMoverPuntos, setModoMoverPuntos] = React.useState(false);
  const [moverProyId, setMoverProyId] = React.useState(null);
  const [puntosSeleccionadosMover, setPuntosSeleccionadosMover] = React.useState([]);
  const proyMover = React.useMemo(
    () => todosLosProyectos.find(p => String(p.id) === String(moverProyId)) || proyectoActual,
    [todosLosProyectos, moverProyId, proyectoActual]
  );

  // Modo ORDENAR (editar posición): seleccionar puntos en el mapa en orden de tendido.
  // ordenarProyId = proyecto de la LISTA desde la que se inició (NO asumir proyectoActual:
  // EDITANDO es independiente del desglose/modal).
  const [modoOrdenar, setModoOrdenar] = React.useState(false);
  const [ordenarProyId, setOrdenarProyId] = React.useState(null);
  const [ordenSeleccion, setOrdenSeleccion] = React.useState([]); // ids en orden de selección
  const [guardandoOrden, setGuardandoOrden] = React.useState(false);
  const proyOrdenar = React.useMemo(
    () => todosLosProyectos.find(p => String(p.id) === String(ordenarProyId)) || proyectoActual,
    [todosLosProyectos, ordenarProyId, proyectoActual]
  );

  // ── CORREGIR (dentro de editar posición) ────────────────────────────────
  // El modo normal reconstruye el orden desde cero: lo que tocas va al principio.
  // CORREGIR es lo contrario: parte del orden YA guardado y mueve unos pocos puntos
  // detrás de otro. Por eso lleva su propio "orden de trabajo" y bloquea el modo
  // normal mientras está activo — mezclarlos haría perder la corrección sin aviso.
  const [modoCorregir, setModoCorregir] = React.useState(null); // null | 'seleccion' | 'destino'
  const [correccionSel, setCorreccionSel] = React.useState([]); // ids EN ORDEN DE TOQUE
  const [ordenTrabajo, setOrdenTrabajo] = React.useState([]);   // orden completo en edición
  const [huboCorreccion, setHuboCorreccion] = React.useState(false);
  const [movidosCorreccion, setMovidosCorreccion] = React.useState([]); // ids movidos: quedan con posición

  // Orden de partida: el ordenTendido guardado; los puntos que nunca se ordenaron
  // van al final por id. Mismo criterio que usa la lista de puntos.
  const ordenBaseTendido = React.useCallback(() => {
    const pts = todosLosPuntos.filter(p => perteneceAProyecto(p, proyOrdenar));
    return [...pts].sort((a, b) => {
      const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return parseInt(a.id) - parseInt(b.id);
    }).map(p => p.id);
  }, [todosLosPuntos, proyOrdenar]);

  const iniciarCorreccion = React.useCallback(() => {
    setOrdenTrabajo(ordenBaseTendido());
    setCorreccionSel([]);
    setHuboCorreccion(false);
    setMovidosCorreccion([]);
    setModoCorregir('seleccion');
  }, [ordenBaseTendido]);

  const limpiarCorreccion = React.useCallback(() => {
    setModoCorregir(null); setCorreccionSel([]); setOrdenTrabajo([]); setHuboCorreccion(false); setMovidosCorreccion([]);
  }, []);

  // Saca los marcados de donde estén y los reinserta justo después del ancla,
  // respetando el orden en que se tocaron. El resto se corre solo.
  const aplicarCorreccion = React.useCallback((idAncla) => {
    setOrdenTrabajo(prev => {
      const sel = correccionSel.filter(id => prev.some(x => String(x) === String(id)));
      if (sel.length === 0) return prev;
      const marcados = new Set(sel.map(String));
      const resto = prev.filter(id => !marcados.has(String(id)));
      const idx = resto.findIndex(id => String(id) === String(idAncla));
      if (idx === -1) return prev; // ancla inválida: no se toca nada
      resto.splice(idx + 1, 0, ...sel);
      return resto;
    });
    setMovidosCorreccion(prev => [...new Set([...prev, ...correccionSel.map(String)])]);
    setCorreccionSel([]);
    setHuboCorreccion(true);
    setModoCorregir('seleccion'); // vuelve al inicio, listo para otra corrección
  }, [correccionSel]);

  // REINICIAR es contextual: limpia marcados → descarta correcciones → VOLVER al modo normal.
  const reiniciarOrden = React.useCallback(() => {
    if (!modoCorregir) { setOrdenSeleccion([]); setRetomarOrden(false); return; }
    if (correccionSel.length > 0) { setCorreccionSel([]); return; }
    if (huboCorreccion) { setOrdenTrabajo(ordenBaseTendido()); setHuboCorreccion(false); setMovidosCorreccion([]); return; }
    limpiarCorreccion();
  }, [modoCorregir, correccionSel, huboCorreccion, ordenBaseTendido, limpiarCorreccion]);

  // RETOMAR una edición anterior: los postes que YA tienen posición guardada se
  // muestran verdes con su número y quedan bloqueados; lo que se toque a partir de
  // ahí sigue numerando después de ellos. Evita rehacer 200 postes para agregar 10.
  const [retomarOrden, setRetomarOrden] = React.useState(false);
  const prefijoOrden = React.useMemo(() => {
    if (!retomarOrden || !proyOrdenar) return [];
    return todosLosPuntos
      .filter(p => perteneceAProyecto(p, proyOrdenar) && p.datos?.ordenTendido != null)
      .sort((a, b) => a.datos.ordenTendido - b.datos.ordenTendido)
      .map(p => p.id);
  }, [retomarOrden, todosLosPuntos, proyOrdenar]);

  const guardarOrdenTendido = React.useCallback(() => {
    if (guardandoOrden || !proyOrdenar?.id) return;
    const ptsProy = todosLosPuntos.filter(p => perteneceAProyecto(p, proyOrdenar));
    // Solo lleva posición lo ordenado: lo retomado y lo tocado o, al corregir, lo que ya la
    // tenía y lo movido. Lo demás queda sin posición, como se ve en el mapa. Antes se
    // numeraban también los puntos no tocados, detrás de lo ordenado.
    const { orden, sinPosicion } = posicionesAGuardar({
      puntos: ptsProy, prefijo: prefijoOrden, seleccion: ordenSeleccion,
      ordenTrabajo: modoCorregir ? ordenTrabajo : null, movidos: movidosCorreccion,
    });
    const guardar = async () => {
      setGuardandoOrden(true);
      try {
        for (let i = 0; i < orden.length; i++) {
          await fbUpdateDoc(doc(db, 'puntos', String(orden[i])), { 'datos.ordenTendido': i + 1 });
        }
        for (const id of sinPosicion) {
          await fbUpdateDoc(doc(db, 'puntos', String(id)), { 'datos.ordenTendido': deleteField() });
        }
        const posicion = new Map(orden.map((id, i) => [String(id), i + 1]));
        const quitar = new Set(sinPosicion.map(String));
        setPuntos(prev => prev.map(p => {
          if (posicion.has(String(p.id))) return { ...p, datos: { ...p.datos, ordenTendido: posicion.get(String(p.id)) } };
          if (!quitar.has(String(p.id))) return p;
          const datos = { ...(p.datos || {}) };
          delete datos.ordenTendido;
          return { ...p, datos };
        }));
        setModoOrdenar(false);
        setOrdenSeleccion([]);
        setRetomarOrden(false);
        limpiarCorreccion();
        setOrdenarProyId(null);
        setModalPendiente(`LISTA_PUNTOS_${proyOrdenar.id}`);
        setVista('proyectos');
        setAlertData({ title: 'Orden guardado', message: 'La lista quedó ordenada por la nueva posición.' });
      } catch (e) {
        console.error('Error guardando orden de tendido:', e);
        setAlertData({ title: 'Error', message: 'No se pudo guardar el orden.' });
      } finally {
        setGuardandoOrden(false);
      }
    };
    if (sinPosicion.length === 0) { guardar(); return; }
    // Puntos que ya tenían posición y no se ordenaron ahora la perderían: se pregunta antes
    const n = sinPosicion.length;
    setConfirmData({
      title: 'Quitar posiciones',
      message: `${n} ${n === 1 ? 'punto que ya tenía posición no se ordenó y quedará' : 'puntos que ya tenían posición no se ordenaron y quedarán'} sin posición. Para conservar las posiciones guardadas, usa RETOMAR antes de tocar puntos.`,
      actionText: 'GUARDAR',
      theme,
      onConfirm: () => { setConfirmData(null); guardar(); },
    });
  }, [guardandoOrden, proyOrdenar, todosLosPuntos, ordenSeleccion, prefijoOrden, modoCorregir, ordenTrabajo, movidosCorreccion, limpiarCorreccion, setPuntos, setModalPendiente, setVista, setAlertData, setConfirmData, theme]);

  // Corrigiendo, el mapa numera solo lo que va a quedar con posición: lo que ya la tenía y
  // lo que se movió. Lo demás se ve en blanco, igual que después de guardar.
  const ordenTrabajoVisible = React.useMemo(() => (modoCorregir
    ? posicionesAGuardar({ puntos: todosLosPuntos.filter(p => perteneceAProyecto(p, proyOrdenar)), ordenTrabajo, movidos: movidosCorreccion }).orden
    : ordenTrabajo), [modoCorregir, ordenTrabajo, movidosCorreccion, todosLosPuntos, proyOrdenar]);

  // Avance de copiar/cortar puntos: mientras no es null, PantallaMigracion bloquea la app
  const [migracion, setMigracion] = React.useState(null);

  // Copiar o cortar puntos seleccionados hacia un proyecto destino (existente o nuevo).
  // modo: 'copiar' (duplica, deja originales) | 'cortar' (reasigna, los saca del origen).
  // Preserva la fecha de cada punto (crea/usa el día por fecha en el destino) e incluye las fibras.
  const ejecutarCopiarCortar = React.useCallback(async (proyectoDestinoArg, modo) => {
    const idsSet = new Set(puntosSeleccionadosMover);
    const puntosSel = todosLosPuntos.filter(p => idsSet.has(p.id));
    if (puntosSel.length === 0) { setModoMoverPuntos(false); setMoverProyId(null); setPuntosSeleccionadosMover([]); return; }
    const conexionesSel = conexiones.filter(c => {
      const ids = c.puntos?.length >= 2 ? c.puntos : [c.from, c.to].filter(Boolean);
      return ids.length >= 2 && ids.every(id => idsSet.has(id));
    });
    // Cables de acero con sus DOS postes entre los elegidos: sin uno de ellos no existen.
    // Al copiar, su medio tramo y sus fibras apoyadas pasan a las copias si también van.
    const idsTexto = new Set([...idsSet].map(String));
    const cablesSel = cablesAcero.filter(c => (c.puntos || []).length === 2 && c.puntos.every(id => idsTexto.has(String(id))));

    const origen = proyMover;
    const fechaDeDia = (diaId) => (origen?.dias || []).find(d => d.id === diaId)?.fecha || new Date().toLocaleDateString();

    // Crear proyecto nuevo si corresponde (mismas características del origen, nombre "nuevo")
    let proyectoDestino = proyectoDestinoArg;
    let esNuevo = false;
    if (proyectoDestinoArg === 'NUEVO') {
      esNuevo = true;
      proyectoDestino = {
        id: String(Date.now()),
        nombre: 'nuevo',
        tipo: origen?.tipo || 'levantamiento',
        modoFotos: origen?.modoFotos || 'comprimido',
        dias: [],
        ownerId: user.uid,
        ownerNombre: config?.nombrePersonal || user?.displayName || '',
        ownerEmpresa: config?.empresaPersonal || '',
        compartidoCon: [], permisos: {},
        createdAt: new Date().toISOString(),
      };
    }

    // Construir días del destino preservando fechas (find-or-create por fecha)
    let diasDestino = [...(proyectoDestino.dias || [])];
    const fechaToDiaId = {};
    const asegurarDia = (fecha) => {
      if (fechaToDiaId[fecha]) return fechaToDiaId[fecha];
      const ex = diasDestino.find(d => d.fecha === fecha);
      if (ex) { fechaToDiaId[fecha] = ex.id; return ex.id; }
      const nuevo = { id: `d_${Date.now()}_${diasDestino.length}`, nombre: `Día ${diasDestino.length + 1}`, fecha, color: colorParaNuevoDia(diasDestino) };
      diasDestino.push(nuevo);
      fechaToDiaId[fecha] = nuevo.id;
      return nuevo.id;
    };
    const diaPunto = {}; puntosSel.forEach(p => { diaPunto[p.id] = asegurarDia(fechaDeDia(p.diaId)); });
    const diaConex = {}; conexionesSel.forEach(c => { diaConex[c.id] = asegurarDia(fechaDeDia(c.diaId)); });
    const diaCable = {}; cablesSel.forEach(c => { diaCable[c.id] = asegurarDia(fechaDeDia(c.diaId)); });

    // Pantalla bloqueada hasta que estén los datos y las fotos (PantallaMigracion)
    const nombreDestino = proyectoDestinoArg === 'NUEVO' ? 'nuevo' : (proyectoDestinoArg?.nombre || '');
    const avanzar = () => setMigracion(m => (m ? { ...m, hechos: m.hechos + 1 } : m));
    setMigracion({
      modo, n: puntosSel.length, destino: nombreDestino, etapa: 'datos',
      hechos: 0, total: puntosSel.length + conexionesSel.length + cablesSel.length,
      fotosHechos: 0, fotosTotal: 0,
    });
    let etapa = 'datos';
    let erroresFotos = 0;

    try {
      // Persistir el proyecto destino con sus días (crear o actualizar)
      if (esNuevo) {
        await setDoc(doc(db, 'proyectos', proyectoDestino.id), { ...proyectoDestino, dias: diasDestino });
        const proyLocal = { ...proyectoDestino, dias: diasDestino };
        setProyectos(prev => [...prev, proyLocal]);
      } else {
        await fbUpdateDoc(doc(db, 'proyectos', String(proyectoDestino.id)), { dias: diasDestino });
        setProyectos(prev => prev.map(p => p.id === proyectoDestino.id ? { ...p, dias: diasDestino } : p));
        setProyectoActual(prev => (prev && prev.id === proyectoDestino.id) ? { ...prev, dias: diasDestino } : prev);
      }

      // Ids de los puntos DESTINO cuyas fotos hay que independizar (copiar los archivos a
      // la carpeta del proyecto destino y re-vincular URLs).
      let puntosAIndependizar = [];

      if (modo === 'cortar') {
        setPuntos(prev => prev.map(p => idsSet.has(p.id) ? { ...p, proyectoId: proyectoDestino.id, diaId: diaPunto[p.id] } : p));
        setConexiones(prev => prev.map(c => (c.id in diaConex) ? { ...c, proyectoId: proyectoDestino.id, diaId: diaConex[c.id] } : c));
        setCablesAcero(prev => prev.map(c => (c.id in diaCable) ? { ...c, proyectoId: proyectoDestino.id, diaId: diaCable[c.id] } : c));
        // Se escribe directo y se espera cada uno, para mostrar el avance y desbloquear solo
        // al final. Sin señal, Firestore lo guarda en el equipo y lo manda al volver. Al
        // mover, el punto pasa a ser del usuario, igual que en la tarea reasignar_punto.
        const reasignar = (coleccion, id, diaId) => {
          const campos = { proyectoId: proyectoDestino.id, ownerId: user.uid };
          if (diaId) campos.diaId = diaId;
          return fbUpdateDoc(doc(db, coleccion, String(id)), campos).then(avanzar);
        };
        await Promise.all([
          ...puntosSel.map(p => reasignar('puntos', p.id, diaPunto[p.id])),
          ...conexionesSel.map(c => reasignar('conexiones', c.id, diaConex[c.id])),
          ...cablesSel.map(c => reasignar('cablesAcero', c.id, diaCable[c.id])),
        ]);
        puntosAIndependizar = puntosSel.map(p => String(p.id));
      } else {
        // COPIAR: crear puntos nuevos (ids numéricos propios) y fibras remapeadas
        let cont = Date.now();
        const mapaIds = {};
        const nuevosPuntos = [];
        for (const p of puntosSel) {
          const nuevoId = String(cont++);
          mapaIds[p.id] = nuevoId;
          const { id: _oid, ...rest } = p;
          nuevosPuntos.push({ ...rest, id: nuevoId, proyectoId: proyectoDestino.id, diaId: diaPunto[p.id], ownerId: user.uid });
        }
        setPuntos(prev => [...prev, ...nuevosPuntos]);
        await Promise.all(nuevosPuntos.map(np => setDoc(doc(db, 'puntos', np.id), np).then(avanzar)));
        puntosAIndependizar = nuevosPuntos.map(np => np.id);

        const conexLocal = [];
        const mapaConex = {};
        for (const c of conexionesSel) {
          const { id: _ocid, ...rest } = c;
          const data = {
            ...rest,
            proyectoId: proyectoDestino.id,
            diaId: diaConex[c.id],
            ownerId: user.uid,
            puntos: (c.puntos || []).map(pid => mapaIds[pid] || pid),
            from: mapaIds[c.from] || c.from,
            to: mapaIds[c.to] || c.to,
            timestamp: new Date().toISOString(),
          };
          const ref = await addDoc(collection(db, 'conexiones'), data);
          avanzar();
          mapaConex[c.id] = ref.id;
          conexLocal.push({ id: ref.id, ...data });
        }
        if (conexLocal.length) setConexiones(prev => [...prev, ...conexLocal]);

        // Cables de acero, con sus postes, su medio tramo y sus fibras cambiados por las copias
        const cablesLocal = [];
        for (const c of cablesSel) {
          const { id: _idCable, ...rest } = c;
          const data = {
            ...rest,
            proyectoId: proyectoDestino.id,
            diaId: diaCable[c.id],
            ownerId: user.uid,
            puntos: c.puntos.map(pid => mapaIds[pid] || pid),
            fibras: (c.fibras || []).map(fid => mapaConex[fid] || fid),
            medioTramo: c.medioTramo != null ? (mapaIds[c.medioTramo] || c.medioTramo) : null,
            timestamp: new Date().toISOString(),
          };
          const ref = await addDoc(collection(db, 'cablesAcero'), data);
          avanzar();
          cablesLocal.push({ id: ref.id, ...data });
        }
        if (cablesLocal.length) setCablesAcero(prev => [...prev, ...cablesLocal]);
      }

      // Independizar las fotos: copiar los archivos al proyecto destino y re-vincular URLs
      // (server-side). Así el punto deja de depender de las fotos del proyecto origen y la
      // verificación no las marca "caídas". Se espera con la pantalla bloqueada, por tandas
      // para mostrar el avance y no pasar el tiempo máximo de la función (9 min); sin
      // señal, se espera a que vuelva y se reintenta la tanda.
      if (puntosAIndependizar.length) {
        etapa = 'fotos';
        setMigracion(m => (m ? { ...m, etapa: 'fotos', fotosHechos: 0, fotosTotal: puntosAIndependizar.length } : m));
        const { independizarFotosPuntos } = await import('./services/exportacionService');
        const esperarConexion = () => new Promise(listo => {
          if (navigator.onLine) listo();
          else window.addEventListener('online', listo, { once: true });
        });
        const TANDA = 10; // puntos por llamada
        for (let i = 0; i < puntosAIndependizar.length; i += TANDA) {
          const tanda = puntosAIndependizar.slice(i, i + TANDA);
          for (let intento = 1; ; intento++) {
            try {
              const r = await independizarFotosPuntos(tanda, proyectoDestino.id);
              erroresFotos += r?.errores || 0;
              break;
            } catch (e) {
              if (!navigator.onLine) { await esperarConexion(); continue; }
              if (intento >= 3) throw e;
            }
          }
          setMigracion(m => (m ? { ...m, fotosHechos: Math.min(m.fotosTotal, i + tanda.length) } : m));
        }
      }

      setMigracion(null);
      const n = puntosSel.length;
      setAlertData({
        title: 'Listo',
        message: `${n} punto${n === 1 ? '' : 's'} ${modo === 'copiar' ? 'copiado' : 'movido'}${n === 1 ? '' : 's'} a "${nombreDestino}", con sus fibras, cables y fotos.`
          + (erroresFotos ? ` Ojo: en ${erroresFotos} punto${erroresFotos === 1 ? '' : 's'} no se pudieron copiar las fotos; se siguen viendo desde el proyecto de origen.` : ''),
      });
    } catch (e) {
      console.error('Error en copiar/cortar puntos:', e);
      setMigracion(null);
      setAlertData({
        title: 'Error',
        message: etapa === 'fotos'
          ? 'Los puntos ya están en el proyecto destino, pero no se pudieron copiar todas sus fotos. Mientras tanto se siguen viendo desde el proyecto de origen.'
          : 'No se pudo completar la operación.',
      });
    }

    setModoMoverPuntos(false);
    setPuntosSeleccionadosMover([]);
    setMoverProyId(null);
  }, [puntosSeleccionadosMover, todosLosPuntos, conexiones, cablesAcero, proyMover, user, config, setPuntos, setConexiones, setCablesAcero, setProyectos, setProyectoActual, setAlertData]);

  // Resetear modoMover y pendingCoords al deseleccionar punto
  React.useEffect(() => {
    if (!puntoSeleccionado) {
      setModoMover(false);
      setPendingCoords(null);
    }
  }, [puntoSeleccionado]);

  // Auto-días: asegura que exista un día para la fecha de hoy y devuelve su id.
  // Si no existe, crea uno nuevo (find-or-create por fecha) y lo persiste.
  const asegurarDiaHoy = React.useCallback(() => {
    if (!proyectoActual) return diaActual;
    const hoy = new Date().toLocaleDateString();
    const diaExistente = (proyectoActual.dias || []).find(d => d.fecha === hoy);
    if (diaExistente) return diaExistente.id;
    const nDias = proyectoActual.dias?.length || 0;
    const nuevoDia = {
      id: `d_${Date.now()}`,
      nombre: `Día ${nDias + 1}`,
      fecha: hoy,
      color: colorParaNuevoDia(proyectoActual.dias),
    };
    const diasActualizados = [...(proyectoActual.dias || []), nuevoDia];
    // Estado local
    setProyectos(prev => prev.map(p => p.id === proyectoActual.id ? { ...p, dias: diasActualizados } : p));
    setProyectoActual(prev => prev ? { ...prev, dias: diasActualizados } : prev);
    setDiasVisibles(prev => [...new Set([...prev, nuevoDia.id])]);
    // Persistir en Firestore (background)
    import('firebase/firestore').then(({ doc: dref, updateDoc: upd }) => {
      upd(dref(db, 'proyectos', String(proyectoActual.id)), { dias: diasActualizados })
        .catch(e => console.error('Error creando día automático:', e));
    });
    return nuevoDia.id;
  }, [proyectoActual, diaActual, setProyectos, setProyectoActual, setDiasVisibles]);

  // ── PUNTOS SUELTOS: asignar día por FECHA a puntos cuyo diaId no existe en su proyecto
  // (quedaron así de antes del sistema de días automáticos). Reasigna el/los puntos y
  // crea los días que falten. Se dispara desde el botón flotante del mapa (punto sin día).
  const ejecutarAsignarDias = React.useCallback((proy, sueltos) => {
    let dias = [...(proy.dias || [])];
    const findOrCreate = (fecha) => {
      const d = dias.find(x => x.fecha === fecha);
      if (d) return d.id;
      const nuevo = { id: `d_${Date.now()}_${dias.length}`, nombre: `Día ${dias.length + 1}`, fecha, color: colorParaNuevoDia(dias) };
      dias = [...dias, nuevo];
      return nuevo.id;
    };
    const asign = sueltos.map(p => {
      const raw = p.datos?.fecha || p.fecha;
      const fecha = raw ? new Date(raw).toLocaleDateString() : new Date().toLocaleDateString();
      return { id: p.id, diaId: findOrCreate(fecha) };
    });
    const mapDia = Object.fromEntries(asign.map(a => [String(a.id), a.diaId]));
    setProyectos(prev => prev.map(pr => pr.id === proy.id ? { ...pr, dias } : pr));
    setProyectoActual(prev => (prev && prev.id === proy.id) ? { ...prev, dias } : prev);
    setPuntos(prev => prev.map(p => mapDia[String(p.id)] ? { ...p, diaId: mapDia[String(p.id)] } : p));
    setDiasVisibles(prev => [...new Set([...prev, ...dias.map(d => d.id)])]);
    import('firebase/firestore').then(({ doc: dref, updateDoc: upd }) => {
      upd(dref(db, 'proyectos', String(proy.id)), { dias }).catch(e => console.error('Asignar días (proyecto):', e));
      asign.forEach(a => upd(dref(db, 'puntos', String(a.id)), { diaId: a.diaId }).catch(() => {}));
    });
    setAlertData({ title: 'Listo', message: `${sueltos.length} punto(s) asignados a su día por fecha.` });
  }, [setProyectos, setProyectoActual, setPuntos, setDiasVisibles]);

  const asignarDiasSueltos = React.useCallback(() => {
    const punto = todosLosPuntos.find(p => String(p.id) === String(puntoSeleccionado));
    if (!punto) return;
    const proy = todosLosProyectos.find(pr => String(pr.id) === String(punto.proyectoId));
    if (!proy) { setAlertData({ title: 'Sin proyecto', message: 'No se encontró el proyecto del punto.' }); return; }
    const diasIds = new Set((proy.dias || []).map(d => String(d.id)));
    const sueltos = todosLosPuntos.filter(p => String(p.proyectoId) === String(proy.id) && !diasIds.has(String(p.diaId)));
    if (!sueltos.length) { setAlertData({ title: 'Sin puntos sueltos', message: 'Todos los puntos ya tienen su día.' }); return; }
    setConfirmData({
      title: 'Asignar día por fecha',
      message: `Se asignará su día (por la fecha de captura) a ${sueltos.length} punto(s) sueltos de "${proy.nombre}". Los días que falten se crean solos. ¿Continuar?`,
      actionText: 'ASIGNAR', theme,
      onConfirm: () => { setConfirmData(null); ejecutarAsignarDias(proy, sueltos); },
    });
  }, [todosLosPuntos, todosLosProyectos, puntoSeleccionado, ejecutarAsignarDias]);

  // ── REPARAR PUNTOS VIEJOS: normaliza ownerId (a tu usuario) + proyectoId/diaId a TEXTO
  // en TUS proyectos. Arregla de raíz el problema del borrado (no se sacaban al instante /
  // rompían el permiso) y el de los días. Solo toca puntos/fibras de proyectos que son TUYOS.
  const repararPuntos = React.useCallback(() => {
    const uid = user?.uid;
    if (!uid) return;
    const mios = new Set((proyectos || []).map(p => String(p.id)));
    const necesita = (o) => o.ownerId !== uid
      || (o.proyectoId != null && typeof o.proyectoId !== 'string')
      || (o.diaId != null && typeof o.diaId !== 'string');
    const pts = todosLosPuntos.filter(p => mios.has(String(p.proyectoId)) && necesita(p));
    const cxs = (conexiones || []).filter(c => mios.has(String(c.proyectoId)) && necesita(c));
    const total = pts.length + cxs.length;
    if (!total) { setAlertData({ title: 'Todo en orden', message: 'No hay puntos ni fibras viejos que reparar.' }); return; }
    setConfirmData({
      title: 'Reparar puntos',
      message: `Se normalizarán ${total} elemento(s) viejos (dueño + ids en texto) de tus proyectos. Con esto se borran al instante y no vuelve a fallar el permiso. ¿Continuar?`,
      actionText: 'REPARAR', theme,
      onConfirm: async () => {
        setConfirmData(null);
        const { doc: dref, updateDoc: upd } = await import('firebase/firestore');
        const patchDe = (o) => {
          const patch = { ownerId: uid };
          if (o.proyectoId != null && typeof o.proyectoId !== 'string') patch.proyectoId = String(o.proyectoId);
          if (o.diaId != null && typeof o.diaId !== 'string') patch.diaId = String(o.diaId);
          return patch;
        };
        let ok = 0;
        for (const p of pts) { try { await upd(dref(db, 'puntos', String(p.id)), patchDe(p)); ok++; } catch (e) { console.error('reparar punto', p.id, e); } }
        for (const c of cxs) { try { await upd(dref(db, 'conexiones', String(c.id)), patchDe(c)); ok++; } catch (e) { console.error('reparar fibra', c.id, e); } }
        setAlertData({ title: 'Listo', message: `${ok} elemento(s) reparados. Ya se borran sin problema.` });
      },
    });
  }, [user, proyectos, todosLosPuntos, conexiones]);

  const {
    abrirFormulario,
    iniciarEdicion,
    verDetalle,
    intentarAgregarDatos,
    solicitarBorrarPunto,
    guardarPunto,
    procesarFoto,
    cancelarPunto,
    intentarCancelar,
    fotosSubidasRef,
    moverPunto
  } = usePuntosLogic({
    user,
    puntoSeleccionado, setPuntoSeleccionado,
    puntoTemporal, setPuntoTemporal,
    modoEdicion, setModoEdicion,
    setModoLectura,
    datosFormulario, setDatosFormulario,
    memoriaUltimoPunto, setMemoriaUltimoPunto,
    diaActual, proyectoActual,
    proyectos: todosLosProyectos,
    asegurarDiaHoy,
    puntos: todosLosPuntos, setPuntos, conexiones, setConexiones, cablesAcero, setCablesAcero,
    setVista,
    setConfirmData, setAlertData,
    agregarTarea, theme,
    vistaAnterior, setVistaAnterior,
    config
  });

  // Listeners centralizados de notificaciones - proyectos propios
  const proyectoIds = React.useMemo(() => proyectos.map(p => p.id).join(','), [proyectos]);
  useEffect(() => {
    if (!user || proyectos.length === 0) { setNotifProyectos({}); return; }
    const unsubscribes = proyectos.map(proy => {
      const q = query(collection(db, "bitacora"), where("proyectoId", "==", proy.id), orderBy("timestamp", "desc"));
      return onSnapshot(q, (snapshot) => {
        let lastRead = localStorage.getItem(`lastChatRead_${proy.id}`);
        if (!lastRead) {
          // Si no hay registro, marcar todos los mensajes existentes como leídos
          const latestDoc = snapshot.docs[0];
          lastRead = latestDoc ? latestDoc.data().timestamp : new Date().toISOString();
          localStorage.setItem(`lastChatRead_${proy.id}`, lastRead);
        }
        const noLeidos = snapshot.docs.filter(d => {
          const data = d.data();
          return data.timestamp > lastRead && data.autorUid !== user.uid;
        }).length;
        setNotifProyectos(prev => ({ ...prev, [proy.id]: noLeidos }));
      });
    });
    return () => unsubscribes.forEach(u => u());
  }, [user?.uid, proyectoIds]);

  // Listeners centralizados de notificaciones - proyectos compartidos
  // Editor (edicion/ambos) → VistaProyectos | Solo lectura → VistaSupervision
  const supervisadoIds = React.useMemo(() => proyectosSupervisados.map(p => p.id).join(','), [proyectosSupervisados]);
  useEffect(() => {
    if (!user || proyectosSupervisados.length === 0) {
      setNotifEditor({});
      setNotifSupervisados({});
      return;
    }
    const unsubscribes = proyectosSupervisados.map(proy => {
      const esEditor = proy.permisoActual === 'edicion' || proy.permisoActual === 'ambos';
      const q = query(collection(db, "bitacora"), where("proyectoId", "==", proy.id), orderBy("timestamp", "desc"));
      return onSnapshot(q, (snapshot) => {
        let lastRead = localStorage.getItem(`lastChatRead_${proy.id}`);
        if (!lastRead) {
          const latestDoc = snapshot.docs[0];
          lastRead = latestDoc ? latestDoc.data().timestamp : new Date().toISOString();
          localStorage.setItem(`lastChatRead_${proy.id}`, lastRead);
        }
        const noLeidos = snapshot.docs.filter(d => {
          const data = d.data();
          return data.timestamp > lastRead && data.autorUid !== user.uid;
        }).length;
        if (esEditor) {
          setNotifEditor(prev => ({ ...prev, [proy.id]: noLeidos }));
        } else {
          setNotifSupervisados(prev => ({ ...prev, [proy.id]: noLeidos }));
        }
      });
    });
    return () => unsubscribes.forEach(u => u());
  }, [user?.uid, supervisadoIds]);

  // Auto-sync: ownerNombre/ownerEmpresa en proyectos propios al cargar
  useEffect(() => {
    if (!user || !configNube?.nombrePersonal || proyectos.length === 0) return;
    const nombre = configNube.nombrePersonal;
    const empresa = configNube.empresaPersonal || '';
    proyectos.forEach(proy => {
      if (proy.ownerNombre !== nombre || (proy.ownerEmpresa || '') !== empresa) {
        fbUpdateDoc(doc(db, "proyectos", proy.id), {
          ownerNombre: nombre,
          ownerEmpresa: empresa
        }).catch(e => console.error("Sync ownerNombre error:", e));
      }
    });
  }, [user?.uid, configNube?.nombrePersonal, configNube?.empresaPersonal]);

  // Auto-sync: supervisoresInfo en proyectos que superviso al cargar
  useEffect(() => {
    if (!user || !configNube?.nombrePersonal || proyectosSupervisados.length === 0) return;
    const nombre = configNube.nombrePersonal;
    const empresa = configNube.empresaPersonal || '';
    proyectosSupervisados.forEach(proy => {
      const info = proy.supervisoresInfo?.[user.uid];
      if (!info || info.nombre !== nombre || info.empresa !== empresa) {
        fbUpdateDoc(doc(db, "proyectos", proy.id), {
          [`supervisoresInfo.${user.uid}.nombre`]: nombre,
          [`supervisoresInfo.${user.uid}.empresa`]: empresa
        }).catch(e => console.error("Sync supervisorInfo error:", e));
      }
    });
  }, [user?.uid, configNube?.nombrePersonal, configNube?.empresaPersonal]);

  // Inicializar diasVisibles para TODOS los proyectos al arrancar
  // Usa diasOcultos del localStorage para saber cuáles estaban apagados
  const diasVisiblesInitRef = React.useRef(false);
  useEffect(() => {
    if (proyectosLista.length === 0) return;
    let ocultos = [];
    try { ocultos = JSON.parse(localStorage.getItem('diasOcultos') || '[]'); } catch(e) {}

    if (!diasVisiblesInitRef.current) {
      // Primera carga: inicializar todos los días no-ocultos
      const visibles = proyectosLista.flatMap(p => (p.dias || []).map(d => d.id)).filter(id => !ocultos.includes(id));
      setDiasVisibles(visibles);
      diasVisiblesInitRef.current = true;
    } else {
      // Carga posterior (e.g. proyectos compartidos llegaron después): agregar días nuevos no conocidos
      setDiasVisibles(prev => {
        const prevSet = new Set(prev);
        const ocultosSet = new Set(ocultos);
        const nuevos = [];
        proyectosLista.forEach(p => {
          (p.dias || []).forEach(d => {
            if (!prevSet.has(d.id) && !ocultosSet.has(d.id)) nuevos.push(d.id);
          });
        });
        if (nuevos.length === 0) return prev;
        return [...new Set([...prev, ...nuevos])];
      });
    }
  }, [proyectosLista]);

  // Bloquear botón Atrás mientras el formulario de punto está abierto
  useEffect(() => {
    if (vista !== 'formulario') return;
    history.pushState({ kipo: 'formulario' }, '');
    const handlePop = () => history.pushState({ kipo: 'formulario' }, '');
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [vista]);

  // Al iniciar sesión: migrar borrador de fotos a fotosProyecto y limpiar huérfanos
  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1. Migrar borrador de fotos (de punto no guardado) a fotosProyecto
      try {
        const draft = JSON.parse(localStorage.getItem('kipo_draft') || 'null');
        if (draft?.proyectoId && draft?.fotos) {
          const getLabel = (sectionId, itemId) => {
            const sec = TABS_CONFIG[sectionId];
            if (!sec) return itemId;
            for (const it of sec.items) {
              if (it.id === itemId) return `${sec.title} - ${it.label.replace(/\n/g, ' ')}`;
              if (it.items) {
                const sub = it.items.find(s => s.id === itemId);
                if (sub) return `${sec.title} - ${sub.label.replace(/\n/g, ' ')}`;
              }
            }
            return `${sec.title} - ${itemId}`;
          };
          const col = collection(db, 'proyectos', draft.proyectoId, 'fotosProyecto');
          const promises = [];
          Object.entries(draft.fotos).forEach(([sectionId, sectionFotos]) => {
            if (!sectionFotos || typeof sectionFotos !== 'object') return;
            Object.entries(sectionFotos).forEach(([itemId, foto]) => {
              if (!foto?.url) return;
              promises.push(addDoc(col, {
                nombre: getLabel(sectionId, itemId),
                url: foto.url,
                ...(foto.urlHD ? { urlHD: foto.urlHD } : {}),
                thumb: foto.thumb || foto.url,
                storagePath: foto._path || '',
                creadoEn: serverTimestamp(),
                uid: user.uid,
                sectionId,
                itemId,
                lat: draft.lat || null,
                lng: draft.lng || null,
              }));
            });
          });
          if (promises.length > 0) await Promise.allSettled(promises);
          localStorage.removeItem('kipo_draft');
        }
      } catch {}

      // 2. Podar la lista de paths pendientes (SOLO la lista; NUNCA se borran archivos de
      // Storage aquí). Borrar por antigüedad causaba pérdida de datos: una foto ya subida y
      // referenciada por un punto seguía en la lista y se le borraba el archivo → la url
      // quedaba muerta y solo sobrevivía la miniatura. La limpieza real de huérfanas la hace
      // registrarCandidata (las promueve a la capa de fotos del mapa, sin destruir nada).
      try {
        const pending = JSON.parse(localStorage.getItem('kipo_pending_paths') || '[]');
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 días
        const restantes = pending.filter(e => e.ts >= cutoff);
        if (restantes.length !== pending.length) localStorage.setItem('kipo_pending_paths', JSON.stringify(restantes));
      } catch {}

      // 3. Limpiar del equipo los blobs de respaldo local ya subidos con más de 30 días.
      try { const { limpiarBlobsVencidos } = await import('./utils/photoDB'); await limpiarBlobsVencidos(30); } catch {}

      // 4. Protección persistente del almacén (SIEMPRE, sin preguntar al usuario): evita
      //    que el navegador purgue los datos de Kipo. Se reintenta en cada arranque
      //    hasta que el navegador la conceda.
      try { await navigator.storage?.persist?.(); } catch {}

      // 5. Purga adaptativa: si el almacenamiento pasó el 80%, libera mapas y respaldos
      //    ya subidos (viejos primero). Las fotos pendientes nunca se tocan.
      try { const { purgaAdaptativa } = await import('./utils/photoDB'); await purgaAdaptativa(); } catch {}
    })();
  }, [user?.uid]);

  // Suscripción a fotosProyecto con coordenadas (capa de fotos en mapa)
  useEffect(() => {
    if (!proyectoActual?.id) { setFotosConCoordenadas([]); return; }
    const col = collection(db, 'proyectos', proyectoActual.id, 'fotosProyecto');
    const unsub = onSnapshot(col, snap => {
      setFotosConCoordenadas(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(f => f.lat != null && f.lng != null)
      );
    });
    return unsub;
  }, [proyectoActual?.id]);

  // Instalación de postes: AGREGAR abre directo la sección de fotos (instalación) con ITEM + GUARDAR
  const abrirFotosInstalacion = React.useCallback(() => {
    if (!puntoTemporal) {
      setAlertData({ title: 'Falta el punto', message: 'Toca el mapa primero para crear un punto (gris).' });
      return;
    }
    fotosSubidasRef.current = [];
    setModoEdicion(false);
    setModoLectura(false);
    setVistaAnterior('mapa');
    const now = new Date();
    setDatosFormulario({
      numero: '', fotos: {}, observaciones: '',
      tipoPoste: 'propio',
      fecha: now.toISOString(),
      hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }),
    });
    setPhotoTab('instalacion');
    setModoInstalacionFotos(true);
    setModalOpen('MODO_FOTOS');
  }, [puntoTemporal, setAlertData, setModoEdicion, setModoLectura, setVistaAnterior, setDatosFormulario, setModalOpen, fotosSubidasRef]);

  const guardarPuntoInstalacion = React.useCallback(() => {
    setModoInstalacionFotos(false);
    guardarPunto();
    setModalOpen(null);
  }, [guardarPunto, setModalOpen]);

  // Materializa el punto NUEVO como BORRADOR en la base (idempotente). Lo llama
  // PhotoManager al tomar la primera foto: así la foto se engancha a un documento
  // REAL y sobrevive a un apagón antes de GUARDAR. Los puntos existentes ya tienen
  // documento (no hace nada). No toca ningún dato ajeno: solo crea este doc nuevo.
  const asegurarPuntoBorrador = React.useCallback(async () => {
    if (puntoSeleccionado) return;                 // punto existente: ya tiene doc
    const id = tempPuntoId || puntoTemporal?.id;
    if (!id || !proyectoActual || !user) return;
    if ((puntos || []).some(p => p.id === id)) return; // ya materializado
    const diaTemp = puntoTemporal?.diaId || diaActual;
    const borrador = {
      id,
      proyectoId: proyectoActual.id,
      ownerId: user.uid,
      diaId: diaTemp,
      coords: { lat: puntoTemporal?.lat || 0, lng: puntoTemporal?.lng || 0, x: puntoTemporal?.x || 0, y: puntoTemporal?.y || 0 },
      datos: { ...(datosFormulario || {}), estado: 'borrador' },
    };
    setPuntos(prev => prev.some(p => p.id === id) ? prev : [...prev, borrador]);
    // FIRE-AND-FORGET: offline, la promesa de setDoc NO resuelve hasta reconectar,
    // pero el cache local se actualiza al instante. NO usar await (colgaría el flujo
    // de la foto offline). El cache local ya deja el doc listo para el updateDoc de la foto.
    setDoc(doc(db, 'puntos', String(id)), borrador, { merge: true }).catch(e => console.error('Error creando borrador:', e));
  }, [puntoSeleccionado, tempPuntoId, puntoTemporal, proyectoActual, user, diaActual, datosFormulario, puntos, setPuntos]);

  // Promover fotos huérfanas (subidas pero sin punto guardado) a la capa de fotos del mapa
  const promovidasRef = React.useRef(false);
  useEffect(() => {
    if (promovidasRef.current || !user) return;
    const candidatas = getCandidatas();
    if (candidatas.length === 0) { promovidasRef.current = true; return; }
    promovidasRef.current = true;
    const t = setTimeout(async () => {
      const urlsGuardadas = new Set();
      const walk = (o) => {
        if (!o || typeof o !== 'object') return;
        if (typeof o.url === 'string') urlsGuardadas.add(o.url);
        Object.values(o).forEach(v => { if (v && typeof v === 'object') walk(v); });
      };
      (todosLosPuntos || []).forEach(p => walk(p.datos?.fotos));
      for (const c of getCandidatas()) {
        try {
          if (!c.proyectoId || c.lat == null || c.lng == null || urlsGuardadas.has(c.url)) { quitarCandidata(c.id); continue; }
          await addDoc(collection(db, 'proyectos', c.proyectoId, 'fotosProyecto'), {
            nombre: 'Foto recuperada', url: c.url, thumb: c.thumb || null,
            sectionId: c.section, itemId: c.item, lat: c.lat, lng: c.lng,
            huerfana: true, creadoEn: new Date().toISOString(), uid: user.uid,
          });
          quitarCandidata(c.id);
        } catch (e) { console.error('Error promoviendo foto huérfana:', e); }
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [user, todosLosPuntos]);

  // Asociar foto de proyecto a un punto específico
  const asociarFoto = React.useCallback(async (fotoDoc, puntoId, forzar = false, overrideSection = null, overrideItem = null) => {
    const punto = puntos.find(p => p.id === puntoId);
    if (!punto) return 'error';
    const sectionId = overrideSection || fotoDoc.sectionId;
    const itemId = overrideItem || fotoDoc.itemId;
    if (!sectionId || !itemId) return 'sin-destino';
    const existente = punto.datos?.fotos?.[sectionId]?.[itemId];
    if (existente?.url && !forzar) return 'existe';
    const fotoData = {
      url: fotoDoc.url,
      thumb: fotoDoc.thumb || fotoDoc.url,
      timestamp: new Date().toISOString(),
      _path: fotoDoc.storagePath || '',
    };
    if (fotoDoc.urlHD) fotoData.urlHD = fotoDoc.urlHD;
    const newFotos = {
      ...(punto.datos?.fotos || {}),
      [sectionId]: {
        ...((punto.datos?.fotos || {})[sectionId] || {}),
        [itemId]: fotoData,
      },
    };
    await fbUpdateDoc(doc(db, 'puntos', puntoId), { 'datos.fotos': newFotos });
    await deleteDoc(doc(db, 'proyectos', proyectoActual.id, 'fotosProyecto', fotoDoc.id));
    setPuntos(prev => prev.map(p =>
      p.id === puntoId ? { ...p, datos: { ...p.datos, fotos: newFotos } } : p
    ));
    return 'ok';
  }, [puntos, proyectoActual?.id, setPuntos]);

  // Tomar foto directa desde el mapa (capa de fotos) → fotosProyecto con GPS del celular, SIN sección
  const capturarFotoMapa = React.useCallback(async (file) => {
    if (!file || !proyectoActual?.id) return;
    try {
      let lat = null, lng = null;
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch { /* sin GPS */ }

      const { procesarImagenInput } = await import('./utils/helpers');
      const { uploadImage } = await import('./utils/storage');
      const { inyectarEXIFenBlob } = await import('./utils/exif');
      const { fullBlob, thumbBase64 } = await procesarImagenInput(file);

      const ts = Date.now();
      const storagePath = `proyectos/${proyectoActual.id}/fotos/${ts}_${user.uid}.jpg`;
      const capDate = file.lastModified ? new Date(file.lastModified) : new Date();
      const datosExif = {
        fecha: capDate.toISOString(),
        hora: capDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }),
        gps: (lat != null) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '',
        proyecto: proyectoActual.nombre || '',
      };
      const blobExif = await inyectarEXIFenBlob(fullBlob, datosExif);
      const url = await uploadImage(blobExif, storagePath);

      const docData = {
        nombre: 'Foto directa',
        url, thumb: thumbBase64, storagePath,
        ...(lat != null ? { lat, lng } : {}),
        creadoEn: new Date().toISOString(), uid: user.uid,
      };
      await addDoc(collection(db, 'proyectos', proyectoActual.id, 'fotosProyecto'), docData);

      if (lat == null) {
        setAlertData({ title: 'Foto guardada', message: 'Sin ubicación GPS: la foto quedó en las fotos del proyecto, pero no aparece en el mapa.' });
      }
    } catch (e) {
      console.error('Error guardando foto directa:', e);
      setAlertData({ title: 'Error', message: 'No se pudo guardar la foto.' });
    }
  }, [proyectoActual?.id, proyectoActual?.nombre, user?.uid, setAlertData]);

  // Auto-seleccionar último proyecto abierto
  useEffect(() => {
    if (todosLosProyectos.length === 0 || proyectoActual) return;
    let savedId = null;
    try { savedId = localStorage.getItem('ultimoProyectoId'); } catch (e) {}
    if (savedId) {
      const proyecto = todosLosProyectos.find(p => p.id === savedId);
      if (proyecto) { seleccionarProyecto(proyecto); return; }
      // savedId existe pero aún no cargó (puede ser de proyectos compartidos) — esperar
      return;
    }
    // Sin savedId: seleccionar el último
    seleccionarProyecto(todosLosProyectos[todosLosProyectos.length - 1]);
  }, [todosLosProyectos, proyectoActual, seleccionarProyecto]);

  // Sincronizar proyectoActual con datos frescos de Firestore (propios y compartidos)
  useEffect(() => {
    if (proyectoActual && todosLosProyectos.length > 0) {
      const actualizado = todosLosProyectos.find(p => p.id === proyectoActual.id);
      if (actualizado && actualizado !== proyectoActual) {
        setProyectoActual(actualizado);
      }
    }
  }, [proyectos, proyectosEditor]);

  // Para editores/supervisores: cuando el propietario cambia el día activo, auto-seleccionarlo
  useEffect(() => {
    if (!proyectoActual?.esCompartido || !proyectoActual.diaActivoId) return;
    const diaExiste = proyectoActual.dias?.find(d => d.id === proyectoActual.diaActivoId);
    if (!diaExiste) return;
    if (diaActual !== proyectoActual.diaActivoId) {
      setDiaActual(proyectoActual.diaActivoId);
      setDiasVisibles(prev => [...new Set([...prev, proyectoActual.diaActivoId])]);
    }
  }, [proyectoActual?.diaActivoId]);

  // Guardar automáticamente cuando se cierra el modal de fotos en modo edición desde VerDetalle
  const prevModalOpen = React.useRef(modalOpen);
  const vistaAnteriorRef = React.useRef(vista);
  useEffect(() => {
    vistaAnteriorRef.current = vista;
  }, [vista]);

  useEffect(() => {
    // Detectar cuando MODO_FOTOS se cierra mientras estamos en VerDetalle con modo edición activo
    if (
      prevModalOpen.current === 'MODO_FOTOS' &&
      modalOpen !== 'MODO_FOTOS' &&
      vistaAnteriorRef.current === 'verDetalle' &&
      modoEdicion &&
      puntoSeleccionado
    ) {
      // Actualizar punto en Firebase sin cambiar de vista
      const puntoActualizado = puntos.find(p => p.id === puntoSeleccionado);
      if (puntoActualizado) {
        const direccionActualizada = datosFormulario.direccion || puntoActualizado.datos?.direccion;

        // Actualizar localmente
        setPuntos(prev => prev.map(p =>
          p.id === puntoSeleccionado
            ? { ...p, datos: { ...puntoActualizado.datos, fotos: datosFormulario.fotos, direccion: direccionActualizada } }
            : p
        ));

        // Encolar tarea de guardado en Firebase
        // Construir fotos seguras: para fotos aún subiendo, usar la versión de Firestore
        // para evitar sobreescribir una foto correctamente subida con datos incompletos
        const fotosBase = puntoActualizado.datos?.fotos || {};
        const fotosSeguras = { ...fotosBase };
        for (const [sec, items] of Object.entries(datosFormulario.fotos || {})) {
          if (!fotosSeguras[sec]) fotosSeguras[sec] = {};
          for (const [key, val] of Object.entries(items || {})) {
            if (val?.uploading || (typeof val?.thumb === 'string' && val.thumb.startsWith('blob:'))) continue;
            fotosSeguras[sec][key] = val;
          }
        }

        agregarTarea('guardar_punto', {
          modo: 'editar',
          coleccion: 'puntos',
          idDoc: String(puntoSeleccionado),
          datos: {
            ...puntoActualizado,
            datos: {
              ...puntoActualizado.datos,
              fotos: fotosSeguras,
              direccion: direccionActualizada
            },
            timestamp: new Date().toISOString()
          }
        });

        // Mensaje automático en bitácora — al chat del proyecto DEL PUNTO
        const chatEdit = puntoActualizado?.proyectoId || proyectoActual?.id;
        if (chatEdit && user?.uid) {
          const nombre = config?.nombrePersonal || user?.displayName || user?.email?.split('@')[0] || 'Usuario';
          const empresa = config?.empresaPersonal || '';
          const id = formatId(puntoActualizado.datos);
          const cambiosFotos = detectarCambiosFotos(puntoActualizado.datos?.fotos, datosFormulario.fotos);
          let msg = `Editado:\n${id}`;
          if (cambiosFotos.length > 0) msg += `\n${cambiosFotos.join('\n')}`;
          enviarMensajeSistema(String(chatEdit), msg, user.uid, nombre, empresa);
        }
      }
    }
    prevModalOpen.current = modalOpen;
  }, [modalOpen, modoEdicion, puntoSeleccionado, puntos, datosFormulario.fotos, datosFormulario.direccion, setPuntos, agregarTarea, proyectoActual, user]);

  // Guardar configuración
  const guardarConfiguracion = async (nuevaConfig) => {
    setConfig(nuevaConfig);
    try {
      await setDoc(doc(db, "configuraciones", user.uid), { ...nuevaConfig, email: user.email });
      console.log("Configuración sincronizada");

      // Sincronizar ownerNombre/ownerEmpresa en todos los proyectos propios
      for (const proy of proyectos) {
        try {
          await fbUpdateDoc(doc(db, "proyectos", proy.id), {
            ownerNombre: nuevaConfig.nombrePersonal || '',
            ownerEmpresa: nuevaConfig.empresaPersonal || ''
          });
        } catch (e) { console.error("Error actualizando proyecto:", e); }
      }

      // Sincronizar supervisoresInfo en proyectos que superviso
      for (const proy of proyectosSupervisados) {
        try {
          await fbUpdateDoc(doc(db, "proyectos", proy.id), {
            [`supervisoresInfo.${user.uid}.nombre`]: nuevaConfig.nombrePersonal || '',
            [`supervisoresInfo.${user.uid}.empresa`]: nuevaConfig.empresaPersonal || ''
          });
        } catch (e) { console.error("Error actualizando supervisión:", e); }
      }
    } catch (error) {
      console.error("Error guardando config:", error);
    }
  };

  // Archivar: sale de la lista, del mapa y del EQUIPO (al desarchivar queda personal).
  const archivarProyecto = React.useCallback(async (proy) => {
    if (!proy?.id) return;
    try {
      await fbUpdateDoc(doc(db, 'proyectos', String(proy.id)), {
        archivado: true,
        archivadoEn: new Date().toISOString(),
        grupoId: deleteField(),   // se quita del equipo
        enListaDe: deleteField(),
      });
      if (String(proyectoActual?.id) === String(proy.id)) setProyectoActual(null);
    } catch (e) {
      console.error('Archivar proyecto:', e);
      setAlertData({ title: 'Error', message: 'No se pudo archivar el proyecto.' });
    }
  }, [proyectoActual, setProyectoActual, setAlertData]);

  const desarchivarProyecto = React.useCallback(async (proy) => {
    if (!proy?.id) return;
    try {
      await fbUpdateDoc(doc(db, 'proyectos', String(proy.id)), {
        archivado: deleteField(),
        archivadoEn: deleteField(),
      });
    } catch (e) {
      console.error('Desarchivar proyecto:', e);
      setAlertData({ title: 'Error', message: 'No se pudo desarchivar el proyecto.' });
    }
  }, [setAlertData]);

  // Filtros de visibilidad. Al migrar puntos se acota la vista al proyecto de
  // origen: con varios proyectos encendidos era fácil arrastrar por error puntos
  // ajenos, y además sus fechas se resuelven contra los días de ese proyecto.
  const puntosVisiblesMapa = (modoMoverPuntos && proyMover)
    ? todosLosPuntos.filter(p => perteneceAProyecto(p, proyMover))
    : filtrosVisibilidad.getPuntosVisibles(todosLosPuntos, diasVisibles, proyectosActivos);
  const totalPuntosProyecto = proyectoActual ? todosLosPuntos.filter(p => String(p.proyectoId) === String(proyectoActual.id)).length : 0;
  const totalPuntosOrdenar = (modoOrdenar && proyOrdenar) ? todosLosPuntos.filter(p => perteneceAProyecto(p, proyOrdenar)).length : 0;

  // Días del proyecto activo para el panel del mapa (ordenados cronológicamente + conteo de puntos)
  const diasPanelData = React.useMemo(() => {
    const proy = mapaSupervision ? mapaSupervision.proyecto : proyectoActual;
    if (!proy?.dias?.length) return [];
    const conteo = {};
    todosLosPuntos.forEach(p => { conteo[p.diaId] = (conteo[p.diaId] || 0) + 1; });
    const tsOf = (d) => { const m = String(d.id).match(/(\d+)/); return m ? parseInt(m[1]) : 0; };
    return [...proy.dias]
      .sort((a, b) => tsOf(a) - tsOf(b))
      .map((d, idx) => ({ ...d, numero: idx + 1, count: conteo[d.id] || 0 }));
  }, [proyectoActual, mapaSupervision, todosLosPuntos]);
  const conexionesVisiblesBase = filtrosVisibilidad.getConexionesVisibles(conexiones, diasVisibles, proyectos.filter(p => !p.archivado));
  const conexionesVisiblesMapa = fibrasVisibles ? conexionesVisiblesBase : [];

  // ── AJUSTAR POSTES A LA FIBRA ─────────────────────────────────────────────
  // Jala los postes cercanos hasta apoyarlos sobre la línea, perpendicularmente.
  // La coordenada anterior se guarda solo mientras dure la sesión de fibra: la
  // buena es la nueva, la vieja únicamente sirve para deshacer si el umbral se pasó.
  const [modoAjuste, setModoAjuste] = React.useState(false);
  const [umbralAjuste, setUmbralAjuste] = React.useState(3);
  const [deshacerAjuste, setDeshacerAjuste] = React.useState(null);
  const [aplicandoAjuste, setAplicandoAjuste] = React.useState(false);

  // Tres grupos, no dos: los que hay que mover, los que YA están sobre la línea
  // (nada que ajustar) y el resto. Antes los del medio se quedaban sin color y
  // parecía que el umbral no los había visto.
  const YA_APOYADO = 0.3; // metros: por debajo de esto, moverlo no cambia nada
  const analisisAjuste = React.useMemo(() => {
    if (!modoAjuste || !proyectoActual) return { mover: [], apoyados: [] };
    const buscar = (id) => todosLosPuntos.find(p => String(p.id) === String(id));
    const fibras = conexionesVisiblesMapa.map(c => {
      const vs = verticesDeConexion(c, buscar);
      return vs.length >= 2
        ? { id: c.id, capacidad: c.capacidad || 12, vertices: vs, largo: longitudFibra(vs) }
        : null;
    }).filter(Boolean);
    if (fibras.length === 0) return { mover: [], apoyados: [] };
    const mover = [], apoyados = [];
    todosLosPuntos.forEach(p => {
      if (!perteneceAProyecto(p, proyectoActual) || p.coords?.lat == null) return;
      const m = mejorProyeccion({ lat: p.coords.lat, lng: p.coords.lng }, fibras, umbralAjuste);
      if (!m) return;
      if (m.dist <= YA_APOYADO) apoyados.push(p.id);
      else mover.push({ id: p.id, antes: { lat: p.coords.lat, lng: p.coords.lng }, destino: m.destino });
    });
    return { mover, apoyados };
  }, [modoAjuste, umbralAjuste, conexionesVisiblesMapa, todosLosPuntos, proyectoActual]);
  const previewAjuste = analisisAjuste.mover;

  // Escribe coordenadas nuevas en lote. Se reutiliza para aplicar y para deshacer.
  const escribirCoords = React.useCallback(async (cambios) => {
    const { doc: dref, writeBatch } = await import('firebase/firestore');
    const { db: fdb } = await import('./firebaseConfig');
    for (let i = 0; i < cambios.length; i += 400) {
      const lote = writeBatch(fdb);
      cambios.slice(i, i + 400).forEach(c => lote.update(dref(fdb, 'puntos', String(c.id)), { coords: c.coords }));
      await lote.commit();
    }
    const mapa = new Map(cambios.map(c => [String(c.id), c.coords]));
    setPuntos(prev => prev.map(p => mapa.has(String(p.id)) ? { ...p, coords: mapa.get(String(p.id)) } : p));
  }, [setPuntos]);

  const aplicarAjuste = React.useCallback(async () => {
    if (aplicandoAjuste || previewAjuste.length === 0) return;
    setAplicandoAjuste(true);
    try {
      await escribirCoords(previewAjuste.map(x => ({ id: x.id, coords: x.destino })));
      setDeshacerAjuste(previewAjuste.map(x => ({ id: x.id, coords: x.antes })));
      setModoAjuste(false);
      setAlertData({ title: 'Postes ajustados', message: `Se apoyaron ${previewAjuste.length} poste${previewAjuste.length === 1 ? '' : 's'} sobre la fibra.` });
    } catch (e) {
      console.error('Error ajustando postes:', e);
      setAlertData({ title: 'Error', message: 'No se pudieron mover los postes.' });
    } finally { setAplicandoAjuste(false); }
  }, [aplicandoAjuste, previewAjuste, escribirCoords, setAlertData]);

  const revertirAjuste = React.useCallback(async () => {
    if (aplicandoAjuste || !deshacerAjuste?.length) return;
    setAplicandoAjuste(true);
    try {
      await escribirCoords(deshacerAjuste);
      setDeshacerAjuste(null);
    } catch (e) { console.error('Error deshaciendo ajuste:', e); }
    finally { setAplicandoAjuste(false); }
  }, [aplicandoAjuste, deshacerAjuste, escribirCoords]);

  // CATÁLOGO DE FERRETERÍA DEL DUEÑO DEL PROYECTO.
  // Los puntos guardan ids de ferretería, y el nombre de cada id vive en la
  // configuración de quien creó el proyecto. Si se resolvieran con la configuración
  // del que mira, un miembro del equipo vería la ferretería vacía: sus ids no
  // coinciden con los del dueño. Se lee solo cuando el proyecto es de otro.
  const [configPropietario, setConfigPropietario] = React.useState(null);
  React.useEffect(() => {
    const proy = mapaSupervision ? mapaSupervision.proyecto : proyectoActual;
    const dueno = proy?.ownerId;
    if (!dueno || !user?.uid || String(dueno) === String(user.uid)) { setConfigPropietario(null); return; }
    let vivo = true;
    (async () => {
      try {
        const { doc: dref, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(dref(db, 'configuraciones', String(dueno)));
        if (vivo) setConfigPropietario(snap.exists() ? snap.data() : null);
      } catch (e) { console.error('No se pudo leer la configuración del propietario:', e); }
    })();
    return () => { vivo = false; };
  }, [proyectoActual?.ownerId, proyectoActual?.id, mapaSupervision, user?.uid]);

  // ARMADOS DEL PROYECTO. Cada obra usa los suyos, guardados en su documento.
  const armadosDelProyecto = React.useMemo(() => {
    const proy = mapaSupervision ? mapaSupervision.proyecto : proyectoActual;
    return Array.isArray(proy?.armados) ? proy.armados : [];
  }, [proyectoActual, mapaSupervision]);

  // Configuración con la que se pintan formulario y detalle: la propia, con el
  // catálogo de ferretería del dueño (los ids de material son suyos) y los armados
  // del proyecto.
  const configParaDetalle = React.useMemo(() => ({
    ...config,
    catalogoFerreteria: configPropietario?.catalogoFerreteria || config?.catalogoFerreteria || [],
    armados: armadosDelProyecto,
  }), [config, configPropietario, armadosDelProyecto]);

  // SIMBOLOGÍA: colorear los puntos por su armado en vez de por su día.
  // Los colores se guardan en el dispositivo y por proyecto: son una ayuda de
  // lectura de quien mira el plano, no un dato del proyecto.
  const [simbologiaActiva, setSimbologiaActiva] = React.useState(false);
  const [simbologiaAbierta, setSimbologiaAbierta] = React.useState(false);
  const claveSimbologia = `kipo_simbologia_${proyectoActual?.id || 'sin'}`;
  const [coloresArmado, setColoresArmado] = React.useState({});
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(claveSimbologia);
      setColoresArmado(raw ? JSON.parse(raw) : {});
    } catch { setColoresArmado({}); }
  }, [claveSimbologia]);
  const asignarColorArmado = React.useCallback((armadoId, color) => {
    setColoresArmado(prev => {
      const next = { ...prev };
      if (color) next[armadoId] = color; else delete next[armadoId];
      try { localStorage.setItem(claveSimbologia, JSON.stringify(next)); } catch { /* sin espacio */ }
      return next;
    });
  }, [claveSimbologia]);

  // Nombre propuesto para el próximo ramal: se toma el mayor "RAMAL NN" que ya
  // exista en el proyecto y se suma uno, así borrar uno no genera duplicados.
  // Solo se usa si el usuario no escribe nombre.
  const nombreSugeridoFibra = React.useMemo(() => {
    let max = 0;
    (conexiones || []).forEach(c => {
      if (String(c.proyectoId) !== String(proyectoActual?.id)) return;
      const m = String(c.nombre || '').match(/^RAMAL\s+(\d+)$/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `RAMAL ${String(max + 1).padStart(2, '0')}`;
  }, [conexiones, proyectoActual]);

  // ── CABLE DE ACERO ────────────────────────────────────────────────────────
  // Otra capa, aunque se dibuje desde la barra de fibra. Los tipos son fijos, como las
  // capacidades de la fibra (src/utils/cablesAcero.js).

  // Cables visibles, con sus dos postes ya resueltos y los metros que se liquidan
  const lineasAcero = React.useMemo(() => {
    if (!acerosVisibles) return [];
    const porId = new Map(todosLosPuntos.map(p => [String(p.id), p]));
    return filtrosVisibilidad.getConexionesVisibles(cablesAcero, diasVisibles, proyectos.filter(p => !p.archivado))
      .map(c => {
        const postes = postesDeCable(c, porId);
        if (!postes) return null;
        const [a, b] = postes;
        return {
          ...c, a, b,
          nombreTipo: nombreTipoAcero(c.ferrId),
          etiqueta: `${a.datos?.numero || 'S/N'} → ${b.datos?.numero || 'S/N'}`,
          metros: metrosCableAcero(a.coords, b.coords),
        };
      })
      .filter(Boolean);
  }, [acerosVisibles, cablesAcero, todosLosPuntos, diasVisibles, proyectos]);

  // Ferretería que sugieren los cables de acero del punto abierto en el formulario. Se
  // leen los del proyecto del punto, los haya trazado quien sea.
  const idPuntoAbierto = puntoSeleccionado || tempPuntoId;
  const proyectoPuntoAbierto = todosLosPuntos.find(p => String(p.id) === String(idPuntoAbierto))?.proyectoId || proyectoActual?.id;
  const cablesProyectoPunto = useCablesAceroProyecto(proyectoPuntoAbierto);
  const sugeridasAceroPunto = React.useMemo(
    () => sugeridasPorAcero(idPuntoAbierto, cablesProyectoPunto),
    [idPuntoAbierto, cablesProyectoPunto]
  );

  if (!user) return <Login onLogin={() => { }} initialBlocked={deviceBlocked} />;

  // Cada ramal reserva un pasillo de 2 m: no se deja poner un vértice que haría
  // pasar el trazo más cerca de otra fibra. Antes se dibujaban encima y se separaban
  // luego con un desfase visual, que movía las líneas de donde de verdad están.
  const UMBRAL_FIBRA = 1;
  const ajustarVerticeFibra = (v) => separarDeFibras(
    v, conexionesVisiblesMapa, UMBRAL_FIBRA, null,
    // El vértice anterior marca de qué lado viene el trazo: el nuevo se pone del
    // mismo lado para que el tramo no atraviese la fibra existente.
    puntosRecorrido[puntosRecorrido.length - 1] || null
  );

  // Borra un ramal: lo manda a la papelera y luego quita el documento.
  const borrarConexion = async (con) => {
            setConexiones(prev => prev.filter(c => c.id !== con.id));
            setConexionSeleccionada(null);
            // A la papelera (con las coords de sus puntos AL MOMENTO del borrado)
            try {
              const { enviarAPapelera } = await import('./utils/papelera');
              const idsPts = (con.puntos?.length >= 2 ? con.puntos : [con.from, con.to]).filter(Boolean).map(String);
              const metaPuntos = idsPts.map(pid => {
                const p = todosLosPuntos.find(x => String(x.id) === pid);
                return { id: pid, coords: { lat: p?.coords?.lat ?? null, lng: p?.coords?.lng ?? null } };
              });
              await enviarAPapelera({
                uid: user.uid, tipo: 'fibra',
                snapshot: JSON.parse(JSON.stringify(con)),
                coleccionOriginal: 'conexiones', idOriginal: con.id,
                proyectoId: con.proyectoId || null,
                proyectoNombre: proyectos.find(p => p.id === con.proyectoId)?.nombre || '',
                nombre: `Fibra ${con.capacidad || ''} (${idsPts.length} puntos)`.trim(),
                meta: { puntos: metaPuntos },
              });
            } catch (e) { console.error('Papelera fibra:', e); }
            import("firebase/firestore").then(({ deleteDoc, doc: fbDoc }) => {
              deleteDoc(fbDoc(db, "conexiones", con.id));
            }).catch(e => console.error("Error eliminando fibra:", e));
  };

  // ── Cable de acero: trazar, guardar, editar, borrar y cambiar de modo ────────
  const descripcionTrazoAcero = (() => {
    if (trazoAcero.postes.length !== 2) return null;
    const [a, b] = trazoAcero.postes.map(id => todosLosPuntos.find(p => String(p.id) === id));
    if (a?.coords?.lat == null || b?.coords?.lat == null) return null;
    return { etiqueta: `${a.datos?.numero || 'S/N'} → ${b.datos?.numero || 'S/N'}`, metros: metrosCableAcero(a.coords, b.coords) };
  })();
  // Las fibras y el medio tramo marcados, con lo que la barra necesita para mostrarlos
  const fibrasTrazoAcero = trazoAcero.fibras
    .map(id => (conexiones || []).find(c => String(c.id) === id))
    .filter(Boolean)
    .map(c => ({ id: String(c.id), nombre: c.nombre || '', capacidad: c.capacidad || 12 }));
  const medioTramoTrazoAcero = trazoAcero.medioTramo
    ? (todosLosPuntos.find(p => String(p.id) === trazoAcero.medioTramo)?.datos?.numero || 'S/N')
    : null;

  const guardarCableAcero = async (ferrId) => {
    if (faltaEnTrazoAcero(trazoAcero) || !ferrId) return;
    const { id, postes, fibras, medioTramo } = trazoAcero;
    const cambios = { puntos: postes, ferrId, fibras, medioTramo };
    // El cable va en el proyecto y el día de su primer poste. No depende del día elegido en
    // el mapa: sin día elegido no se guardaba, y sin avisar.
    const posteA = todosLosPuntos.find(p => String(p.id) === postes[0]);
    const diaId = posteA?.diaId || diaActual;
    const proyectoId = posteA?.proyectoId || proyectoActual?.id;
    if (!id && (!diaId || !proyectoId)) {
      setAlertData({ title: 'No se pudo guardar', message: 'No se encontró el día o el proyecto del primer poste del cable.' });
      return;
    }
    // Se limpia el trazo pero no se sale del modo: se sigue con el próximo cable
    setTrazoAcero(TRAZO_ACERO_VACIO);
    try {
      if (id) {
        setCablesAcero(prev => prev.map(c => String(c.id) === id ? { ...c, ...cambios } : c));
        await fbUpdateDoc(doc(db, 'cablesAcero', id), cambios);
        return;
      }
      await addDoc(collection(db, 'cablesAcero'), {
        ...cambios,
        diaId,
        proyectoId: String(proyectoId),
        ownerId: user.uid,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error guardando cable de acero:', error);
      setAlertData({ title: 'Error', message: 'No se pudo guardar el cable de acero.' });
    }
  };

  // Un cable guardado vuelve al trazo: al guardar se actualiza en vez de crear otro
  const editarCableAcero = (cable) => {
    setCableAceroSeleccionado(null);
    setTrazoAcero(trazoDesdeCable(cable));
  };

  const cambiarTipoCableAcero = async (cable, ferrId) => {
    setCablesAcero(prev => prev.map(c => c.id === cable.id ? { ...c, ferrId } : c));
    setCableAceroSeleccionado(prev => prev?.id === cable.id ? { ...prev, ferrId } : prev);
    try {
      await fbUpdateDoc(doc(db, 'cablesAcero', String(cable.id)), { ferrId });
    } catch (e) { console.error('Error cambiando el tipo del cable de acero:', e); }
  };

  const borrarCableAcero = async (cable) => {
    // A la papelera va el documento tal cual, sin lo que la lista le suma para mostrarlo
    const guardado = cablesAcero.find(c => c.id === cable.id) || cable;
    setCablesAcero(prev => prev.filter(c => c.id !== cable.id));
    setCableAceroSeleccionado(null);
    try {
      const { enviarCableAceroAPapelera } = await import('./utils/papelera');
      await enviarCableAceroAPapelera({
        uid: user.uid, cable: guardado,
        proyectoNombre: proyectos.find(p => String(p.id) === String(cable.proyectoId))?.nombre || '',
        nombre: `${cable.nombreTipo || 'Cable de acero'} (${cable.etiqueta || ''})`,
      });
    } catch (e) { console.error('Papelera cable de acero:', e); }
    try {
      await deleteDoc(doc(db, 'cablesAcero', String(cable.id)));
    } catch (e) { console.error('Error eliminando cable de acero:', e); }
  };

  const pedirBorrarCableAcero = (cable) => setConfirmData({
    title: 'Eliminar cable de acero',
    message: `Se eliminará ${cable.nombreTipo} (${cable.etiqueta}, ${cable.metros} m). Va a la papelera y se puede recuperar.`,
    actionText: 'ELIMINAR',
    theme,
    onConfirm: () => { setConfirmData(null); borrarCableAcero(cable); }
  });

  // FIBRA ↔ ACERO. Lo que se estaba trazando en el modo que se deja se descarta,
  // preguntando antes si había algo.
  const cambiarModoLinea = (nuevo) => {
    if (nuevo === modoLinea) return;
    const cambiar = () => {
      setPuntosRecorrido([]);
      setTrazoAcero(TRAZO_ACERO_VACIO);
      setConexionSeleccionada(null);
      setCableAceroSeleccionado(null);
      setModoAjuste(false);
      setModoLinea(nuevo);
    };
    const hayTrazo = modoLinea === 'acero' ? hayTrazoAcero(trazoAcero) : puntosRecorrido.length > 0;
    if (!hayTrazo) { cambiar(); return; }
    setConfirmData({
      title: 'Trazo sin guardar',
      message: `Se descartará lo que estabas trazando en ${modoLinea === 'acero' ? 'el cable de acero' : 'la fibra'}.`,
      actionText: 'DESCARTAR',
      theme,
      onConfirm: () => { setConfirmData(null); cambiar(); }
    });
  };


  return (
    <div className={`${pantallaCompacta ? 'compacto ' : ''}h-screen w-full flex flex-col ${theme.bg} ${theme.text} font-sans overflow-hidden select-none relative transition-colors duration-300`}>

      {/* Indicador de perfil activo — solo admin (para saber qué perfil se está previsualizando) */}
      {esAdmin && (
        <div className="fixed bottom-1.5 left-1.5 z-[600] px-2 py-0.5 rounded-full bg-slate-900/75 text-white text-[9px] font-black tracking-wider pointer-events-none shadow">
          PERFIL: {perfilActivo.toUpperCase()}
        </div>
      )}

      <Header
        theme={theme}
        setMenuAbierto={setMenuAbierto}
        estadoSync={estadoSync}
        cola={cola}
        onClickSync={() => setQueueModalAbierto(true)}
        setGpsTrigger={setGpsTrigger}
        mostrarEtiquetas={mostrarEtiquetas}
        setMostrarEtiquetas={setMostrarEtiquetas}
        menuEtiquetasAbierto={menuEtiquetasAbierto}
        simbologiaAbierta={simbologiaAbierta}
        simbologiaActiva={simbologiaActiva}
        onToggleSimbologia={() => setSimbologiaAbierta(v => !v)}
        setMenuEtiquetasAbierto={setMenuEtiquetasAbierto}
        toggleMenuEtiquetas={toggleMenuEtiquetas}
        isDark={isDark}
        setIsDark={setIsDark}
        setIconSize={setIconSize}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        menuDiasAbierto={menuDiasAbierto}
        toggleMenuDias={toggleMenuDias}
        totalNotificaciones={totalNotificaciones + totalSolicitudesColaboracion}
        flotante={isDesktop && vista === 'mapa'}
      />

      <QueueModal
        isOpen={queueModalAbierto}
        onClose={() => setQueueModalAbierto(false)}
        cola={cola}
        erroresTareas={erroresTareas}
        procesando={syncProcesando}
        isOnline={isOnline}
        eliminarTarea={eliminarTarea}
        reintentarTarea={reintentarTarea}
        guardarComoNuevo={guardarComoNuevo}
        theme={theme}
      />

      <Sidebar
        fotoPuntosActivo={fotoPuntosActivo}
        onToggleFotoPuntos={() => setFotoPuntosActivo(v => !v)}
        isOpen={menuAbierto}
        setMenuAbierto={setMenuAbierto}
        theme={theme}
        user={user}
        vista={vista}
        setVista={setVistaConHistorial}
        cerrarSesion={cerrarSesion}
        config={config}
        totalProyectos={proyectos.length}
        totalProyectosEditor={proyectosEditor.length}
        totalNotifProyectos={totalNotifVistaProyectos + totalSolicitudesColaboracion}
        notifEquipos={notifEquipos}
        perfilLabel={etiquetaPerfil(perfilActivo)}
        isDark={isDark}
        setIsDark={setIsDark}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        adminReturnEmail={adminReturnEmail}
        onVolverAAdmin={volverAAdmin}
        esAdmin={esAdmin}
      />

      {vista === 'mapa' && (
        <VistaMapa
          theme={theme}
          isDesktop={isDesktop}
          mapStyle={mapStyle}
          mapViewState={mapViewState}
          setMapViewState={setMapViewState}
          handleMapaClick={mapaSupervision
            ? () => { setPuntoSeleccionado(null); setConexionSeleccionada(null); }
            : (e) => {
              if (modoMover || modoMoverPuntos) return;
              setConexionSeleccionada(null);
              setCableAceroSeleccionado(null);
              mapInteractions.handleMapaClick({
                e, menuAbierto, modoFibra, dibujandoFibra, modoLinea, setPuntosRecorrido,
                ajustarVertice: ajustarVerticeFibra,
                puntoSeleccionado, vista, diaActual,
                diasVisibles, proyectos, proyectoActual, theme,
                setPuntoSeleccionado, setPuntoTemporal, setVista, setAlertData,
                setConfirmData,
                onEncenderDia: (diaId) => toggleVisibilidadDia(diaId)
              });
            }
          }
          puntosVisiblesMapa={mapaSupervision ? mapaSupervision.puntos : puntosVisiblesMapa}
          iconSize={iconSize}
          obtenerColorDia={mapaSupervision
            ? () => '#3b82f6'
            : (diaId) => filtrosVisibilidad.obtenerColorDia(diaId, proyectos)
          }
          puntoSeleccionado={puntoSeleccionado}
          handlePuntoClick={mapaSupervision
            ? (e, puntoId) => { setPuntoSeleccionado(puntoId); }
            : (e, puntoId) => mapInteractions.handlePuntoClick({
              e, puntoId,
              puntoCoords: todosLosPuntos.find(p => String(p.id) === String(puntoId))?.coords,
              modoFibra, dibujandoFibra, modoLinea, setPuntosRecorrido, setTrazoAcero,
              puntoEsMedioTramo: esMedioTramo(todosLosPuntos.find(p => String(p.id) === String(puntoId))),
              ajustarVertice: ajustarVerticeFibra,
              setPuntoSeleccionado, setPuntoTemporal
            })
          }
          puntoTemporal={mapaSupervision ? null : puntoTemporal}
          mostrarEtiquetas={mostrarEtiquetas}
          menuEtiquetasAbierto={menuEtiquetasAbierto}
          simbologiaActiva={simbologiaActiva}
          simbologiaAbierta={simbologiaAbierta}
          onToggleSimbologia={() => setSimbologiaAbierta(v => !v)}
          coloresArmado={coloresArmado}
          onAsignarColorArmado={asignarColorArmado}
          onToggleSimbologiaActiva={() => setSimbologiaActiva(v => !v)}
          armadosProyecto={armadosDelProyecto}
          setMostrarEtiquetas={setMostrarEtiquetas}
          menuDiasAbierto={menuDiasAbierto}
          diasPanelData={diasPanelData}
          diaExpandido={diaExpandido}
          setDiaExpandido={setDiaExpandido}
          diasVisibles={diasVisibles}
          toggleVisibilidadDia={toggleVisibilidadDia}
          cambiarColorDia={cambiarColorDia}
          uniformizarColorDias={uniformizarColorDias}
          coloresDia={COLORES_DIA}
          proyectoActivoId={(mapaSupervision ? mapaSupervision.proyecto : proyectoActual)?.id}
          gpsTrigger={gpsTrigger}
          yaSaltoAlInicio={yaSaltoAlInicio}
          setYaSaltoAlInicio={setYaSaltoAlInicio}
          isDark={isDark}
          verDetalle={mapaSupervision
            ? () => {
              const punto = mapaSupervision.puntos.find(p => p.id === puntoSeleccionado);
              if (punto) {
                setDatosFormulario({
                  ...JSON.parse(JSON.stringify(punto.datos)),
                  coords: punto.coords,
                  direccion: punto.datos?.direccion || ''
                });
                setVistaAnterior('mapa');
                setVista('verDetalle');
              }
            }
            : verDetalle
          }
          iniciarEdicion={iniciarEdicion}
          solicitarBorrarPunto={solicitarBorrarPunto}
          intentarAgregarDatos={proyectoActual?.tipo === 'instalacionPostes' ? abrirFotosInstalacion : intentarAgregarDatos}
          setVistaAnterior={setVistaAnterior}
          // Punto sin día asignado → botón flotante "asignar día por fecha"
          puntoSinDia={(() => {
            if (mapaSupervision || !puntoSeleccionado) return false;
            const p = todosLosPuntos.find(x => String(x.id) === String(puntoSeleccionado));
            if (!p) return false;
            const proy = todosLosProyectos.find(pr => String(pr.id) === String(p.proyectoId));
            return !!(proy && !(proy.dias || []).some(d => String(d.id) === String(p.diaId)));
          })()}
          onAsignarDiasSueltos={asignarDiasSueltos}
          // Props de MOVER
          modoMover={mapaSupervision ? false : modoMover}
          pendingCoords={mapaSupervision ? null : pendingCoords}
          iniciarMover={() => setModoMover(true)}
          cancelarMover={() => { setModoMover(false); setPendingCoords(null); }}
          confirmarMover={() => {
            if (pendingCoords) {
              moverPunto(pendingCoords.puntoId, pendingCoords.lat, pendingCoords.lng);
              setPendingCoords(null);
              setModoMover(false);
            }
          }}
          onPuntoDragEnd={(puntoId, lat, lng) => {
            setPendingCoords({ puntoId, lat, lng });
          }}
          // Props de FIBRA
          modoFibra={mapaSupervision ? false : modoFibra}
          setModoFibra={setModoFibra}
          dibujandoFibra={dibujandoFibra}
          setDibujandoFibra={setDibujandoFibra}
          capacidadFibra={capacidadFibra}
          nombreSugeridoFibra={nombreSugeridoFibra}
          modoAjuste={modoAjuste}
          setModoAjuste={setModoAjuste}
          umbralAjuste={umbralAjuste}
          setUmbralAjuste={setUmbralAjuste}
          previewAjuste={previewAjuste}
          apoyadosAjuste={analisisAjuste.apoyados}
          aplicandoAjuste={aplicandoAjuste}
          onAplicarAjuste={aplicarAjuste}
          hayDeshacerAjuste={!!deshacerAjuste?.length}
          onDeshacerAjuste={revertirAjuste}
          onActualizarConexion={async (con, cambios) => {
            // Nombre, capacidad y geometría se guardan juntos en una sola escritura:
            // así no puede quedar a medias si algo falla entre una y otra.
            const parche = {};
            if (cambios.nombre !== undefined) parche.nombre = String(cambios.nombre || '').trim();
            if (cambios.capacidad !== undefined) parche.capacidad = cambios.capacidad;
            if (cambios.vertices !== undefined) {
              parche.vertices = cambios.vertices;
              // Se mantiene al día la lista de postes por los que pasa (compatibilidad)
              parche.puntos = cambios.vertices.filter(v => v.puntoId).map(v => String(v.puntoId));
              parche.from = parche.puntos[0] || null;
              parche.to = parche.puntos[parche.puntos.length - 1] || null;
            }
            if (Object.keys(parche).length === 0) return;
            setConexiones(prev => prev.map(c => c.id === con.id ? { ...c, ...parche } : c));
            setConexionSeleccionada(prev => prev && prev.id === con.id ? { ...prev, ...parche } : prev);
            try {
              const { updateDoc: fbUp, doc: fbDoc } = await import("firebase/firestore");
              await fbUp(fbDoc(db, "conexiones", String(con.id)), parche);
            } catch (e) { console.error("Error actualizando ramal:", e); }
          }}

          setCapacidadFibra={setCapacidadFibra}
          fibrasVisibles={fibrasVisibles}
          setFibrasVisibles={setFibrasVisibles}
          puntosRecorrido={mapaSupervision ? [] : puntosRecorrido}
          setPuntosRecorrido={setPuntosRecorrido}
          conexionesVisiblesMapa={mapaSupervision ? [] : conexionesVisiblesMapa}
          conexionSeleccionada={conexionSeleccionada}
          setConexionSeleccionada={setConexionSeleccionada}
          handleConexionClick={(con) => {
            setPuntoSeleccionado(null);
            setConexionSeleccionada(prev => prev?.id === con.id ? null : con);
            // Mostrar la capacidad de la fibra seleccionada
            if (con && (!conexionSeleccionada || conexionSeleccionada.id !== con.id)) {
              setCapacidadFibra(con.capacidad || 12);
            }
          }}
          totalFibras={proyectoActual ? conexionesVisiblesBase.filter(c => c.proyectoId === proyectoActual.id).length : 0}
          nombreProyecto={mapaSupervision ? mapaSupervision.proyecto?.nombre : proyectoActual?.nombre}
          totalPuntosProyecto={mapaSupervision ? mapaSupervision.puntos.length : (modoOrdenar ? totalPuntosOrdenar : totalPuntosProyecto)}
          proyectoEsCompartido={!!proyectoActual?.esCompartido}
          onGuardarFibra={async ({ nombre = '', capacidad } = {}) => {
            if (puntosRecorrido.length < 2) return;
            const capFinal = capacidad || capacidadFibra;

            // La fibra guarda su PROPIA geometría: una lista de vértices con coordenadas.
            // Un vértice puede estar clavado en un poste (lleva puntoId) o ser libre.
            // Mover o borrar un poste ya no deforma la fibra.
            const vertices = puntosRecorrido
              .filter(v => v && v.lat != null && v.lng != null)
              .map(v => v.puntoId ? { lat: v.lat, lng: v.lng, puntoId: String(v.puntoId) } : { lat: v.lat, lng: v.lng });
            if (vertices.length < 2) return;

            // Compatibilidad: el código que todavía lee ids (KMZ del servidor,
            // exportadores) sigue viendo la lista de postes por los que pasa. Se irá
            // retirando conforme esos consumidores aprendan a leer 'vertices'.
            const idsPostes = vertices.filter(v => v.puntoId).map(v => v.puntoId);
            const puntoInicialFibra = todosLosPuntos.find(x => String(x.id) === String(idsPostes[0]));
            // Como el cable de acero: el día y el proyecto salen del primer poste, y solo si
            // no toca ninguno, del día elegido en el mapa. Si no hay de dónde, se avisa.
            const diaFibra = puntoInicialFibra?.diaId || diaActual;
            const proyectoFibra = puntoInicialFibra?.proyectoId || proyectoActual?.id;
            if (!diaFibra || !proyectoFibra) {
              setAlertData({ title: 'No se pudo guardar', message: 'Toca al menos un poste al trazar la fibra, o elige un día en el mapa.' });
              return;
            }
            const datos = {
              vertices,                    // ← geometría real, manda esta
              nombre: (nombre || '').trim(),
              puntos: idsPostes,           // legado
              from: idsPostes[0] || null,
              to: idsPostes[idsPostes.length - 1] || null,
              diaId: diaFibra,
              proyectoId: String(proyectoFibra),
              ownerId: user.uid,
              capacidad: capFinal,
              tipo: 'trazo',
              timestamp: new Date().toISOString()
            };

            try {
              await addDoc(collection(db, "conexiones"), datos);
            } catch (error) {
              console.error("Error guardando fibra:", error);
            }
            // Se limpia el trazo pero NO se sale del modo fibra: se sigue dibujando.
            setPuntosRecorrido([]);
          }}
          onEliminarConexion={(con) => setConfirmData({
            title: 'Eliminar ramal',
            message: `Se eliminará "${con.nombre || 'sin nombre'}" (${con.capacidad || 12} FO). Va a la papelera y se puede recuperar.`,
            actionText: 'ELIMINAR',
            theme,
            onConfirm: () => { setConfirmData(null); borrarConexion(con); }
          })}
          // Props de CABLE DE ACERO (sin ellos, en supervisión, la barra es la de fibra)
          modoLinea={modoLinea}
          onCambiarModoLinea={cambiarModoLinea}
          acero={mapaSupervision ? null : {
            lineas: lineasAcero,
            trazo: trazoAcero,
            setTrazo: setTrazoAcero,
            descripcionTrazo: descripcionTrazoAcero,
            fibrasTrazo: fibrasTrazoAcero,
            medioTramoTrazo: medioTramoTrazoAcero,
            onTocarFibra: (id) => setTrazoAcero(prev => tocarFibraAcero(prev, id)),
            tipoId: tipoAceroId,
            setTipoId: setTipoAceroId,
            onGuardar: guardarCableAcero,
            seleccionado: cableAceroSeleccionado,
            setSeleccionado: setCableAceroSeleccionado,
            onCambiarTipo: cambiarTipoCableAcero,
            onEditar: editarCableAcero,
            onEliminar: pedirBorrarCableAcero,
            visibles: acerosVisibles,
            setVisibles: setAcerosVisibles,
            total: proyectoActual ? cablesAcero.filter(c => String(c.proyectoId) === String(proyectoActual.id)).length : 0,
            onCerrar: () => { setTrazoAcero(TRAZO_ACERO_VACIO); setCableAceroSeleccionado(null); setModoLinea('fibra'); },
          }}
          modoSupervision={!!mapaSupervision}
          onVolverSupervision={() => {
            // La sección Supervisión se retiró: los supervisores entran desde EQUIPOS
            setMapaSupervision(null);
            setPuntoSeleccionado(null);
            setVista('equipos');
          }}
          overlayGPSActivo={!!mostrarOverlayGPS}
          fotosConCoordenadas={fotosConCoordenadas}
          fotoPuntosActivo={fotoPuntosActivo}
          onAsociarFoto={asociarFoto}
          onCapturarFotoMapa={capturarFotoMapa}
          tabsConfig={TABS_CONFIG}
          proyectoTipo={(() => {
            // Tipo del proyecto DEL PUNTO seleccionado (controla los botones del formulario);
            // sin punto seleccionado, el del proyecto activo (para crear puntos nuevos).
            const pt = puntoSeleccionado ? todosLosPuntos.find(x => String(x.id) === String(puntoSeleccionado)) : null;
            const proj = pt ? todosLosProyectos.find(pr => String(pr.id) === String(pt.proyectoId)) : null;
            return (proj || proyectoActual)?.tipo;
          })()}
          puntos={puntos}
          abrirCamaraDirecta={() => {
            const punto = todosLosPuntos.find(p => p.id === puntoSeleccionado);
            if (!punto) return;
            fotosSubidasRef.current = [];
            setDatosFormulario({
              ...JSON.parse(JSON.stringify(punto.datos)),
              coords: punto.coords,
              direccion: punto.datos.direccion || punto.direccion
            });
            const lastTab = (() => { try { const s = localStorage.getItem('kipo_last_tab'); return s || 'napMec'; } catch { return 'napMec'; } })();
            setPhotoTab(lastTab);
            setModalOpen('MODO_FOTOS');
          }}
          modoMoverPuntos={modoMoverPuntos}
          puntosSeleccionadosMover={puntosSeleccionadosMover}
          setPuntosSeleccionadosMover={setPuntosSeleccionadosMover}
          onEjecutarCopiarCortar={ejecutarCopiarCortar}
          onCancelarMoverPuntos={() => { const volverA = proyMover?.id ?? proyectoActual?.id; setModoMoverPuntos(false); setMoverProyId(null); setPuntosSeleccionadosMover([]); setModalPendiente(`LISTA_PUNTOS_${volverA}`); setVista('proyectos'); }}
          proyectosDestino={proyectos.filter(p => String(p.id) !== String(proyMover?.id))}
          modoOrdenar={modoOrdenar}
          ordenSeleccion={ordenSeleccion}
          setOrdenSeleccion={setOrdenSeleccion}
          guardandoOrden={guardandoOrden}
          onGuardarOrden={guardarOrdenTendido}
          onReiniciarOrden={reiniciarOrden}
          prefijoOrden={prefijoOrden}
          retomarOrden={retomarOrden}
          hayPosicionesPrevias={todosLosPuntos.some(p => perteneceAProyecto(p, proyOrdenar) && p.datos?.ordenTendido != null)}
          onRetomarOrden={() => setRetomarOrden(true)}
          modoCorregir={modoCorregir}
          correccionSel={correccionSel}
          setCorreccionSel={setCorreccionSel}
          ordenTrabajo={ordenTrabajoVisible}
          huboCorreccion={huboCorreccion}
          onIniciarCorreccion={iniciarCorreccion}
          onPedirDestino={() => setModoCorregir('destino')}
          onVolverASeleccion={() => setModoCorregir('seleccion')}
          onAplicarCorreccion={aplicarCorreccion}
          esOrdenable={(id) => {
            // Los del bloque retomado están fijos: no se vuelven a tocar.
            if (prefijoOrden.some(x => String(x) === String(id))) return false;
            const pt = todosLosPuntos.find(p => String(p.id) === String(id));
            return pt ? perteneceAProyecto(pt, proyOrdenar) : false;
          }}
          onCancelarOrdenar={() => { setModoOrdenar(false); setOrdenSeleccion([]); setRetomarOrden(false); limpiarCorreccion(); setModalPendiente(`LISTA_PUNTOS_${ordenarProyId || proyectoActual?.id}`); setOrdenarProyId(null); setVista('proyectos'); }}
        />
      )}
      {vista === 'proyectos' && (
        <VistaProyectos
          theme={theme}
          isDark={isDark}
          perfilActivo={perfilActivo}
          proyectos={proyectosLista}
          proyectoActual={proyectoActual}
          puntos={todosLosPuntos}
          diasVisibles={diasVisibles}
          config={config}
          logoApp={logoApp}
          vista={vista}
          setVista={setVista}
          setTempData={setTempData}
          setModalOpen={setModalOpen}
          modalOpen={modalOpen}
          seleccionarProyecto={seleccionarProyecto}
          diaActual={diaActual}
          setDiaActual={cambiarDiaActivo}
          toggleVisibilidadDia={toggleVisibilidadDia}
          cambiarColorDia={cambiarColorDia}
          uniformizarColorDias={uniformizarColorDias}
          toggleVisibilidadProyecto={toggleVisibilidadProyecto}
          cambiarColorProyecto={cambiarColorProyecto}
          solicitarBorrarProyecto={solicitarBorrarProyecto}
          irUbicacionProyecto={irUbicacionProyecto}
          descargarFotosZip={descargarFotosZip}
          setExportData={setExportData}
          selectorColorAbierto={selectorColorAbierto}
          setSelectorColorAbierto={setSelectorColorAbierto}
          tempData={tempData}
          confirmarCrearProyecto={confirmarCrearProyecto}
          confirmarCrearDia={confirmarCrearDia}
          aprobarSupervisor={aprobarSupervisor}
          rechazarSupervisor={rechazarSupervisor}
          eliminarSupervisor={eliminarSupervisor}
          user={user}
          setAlertData={setAlertData}
          setConfirmData={setConfirmData}
          setLogoApp={setLogoApp}
          handleCargarLogo={handleCargarLogo}
          setPuntoSeleccionado={setPuntoSeleccionado}
          setModoLectura={setModoLectura}
          setModoEdicion={setModoEdicion}
          setDatosFormulario={setDatosFormulario}
          setVistaAnterior={setVistaAnterior}
          setMapViewState={setMapViewState}
          modalPendiente={modalPendiente}
          setModalPendiente={setModalPendiente}
          setMostrarOverlayGPS={setMostrarOverlayGPS}
          onVolver={volverVistaAnterior}
          notificacionesProyectos={{ ...notifProyectos, ...notifEditor }}
          marcarChatLeido={marcarChatLeido}
          conexiones={conexiones}
          onIniciarMoverPuntos={(proy) => {
            setPuntoSeleccionado(null);
            setPuntosSeleccionadosMover([]);
            setMoverProyId(proy?.id ?? null);
            setModoMoverPuntos(true);
            setVista('mapa');
          }}
          onRepararPuntos={repararPuntos}
          proyectosArchivados={proyectosArchivados}
          onArchivarProyecto={archivarProyecto}
          onDesarchivarProyecto={desarchivarProyecto}
          onIniciarOrdenar={(proy) => {
            setPuntoSeleccionado(null);
            setOrdenSeleccion([]);
            setOrdenarProyId(proy?.id ?? null);
            setModoOrdenar(true);
            setVista('mapa');
          }}
        />
      )}

      {vista === 'admin' && (
        <VistaAdmin
          theme={theme}
          isDark={isDark}
          onVolver={volverVistaAnterior}
          onLoginComo={() => {
            setProyectoActual(null);
            setVista('mapa');
          }}
          esAdmin={esAdmin}
          perfilActivo={perfilActivo}
          perfilPreview={perfilPreview}
          onCambiarPerfil={cambiarPerfilPreview}
        />
      )}

      {vista === 'controlFerreteria' && (perfilActivo === 'basico' ? (
        <BloqueoHerramienta
          titulo="Control de ferretería"
          concepto="Crea listas de los materiales que recibes y vincúlalas a tus proyectos para comparar lo recibido contra lo instalado."
          theme={theme} isDark={isDark}
          onClose={volverVistaAnterior}
        />
      ) : (
        <VistaControlFerreteria
          theme={theme}
          isDark={isDark}
          user={user}
          config={config}
          saveConfig={guardarConfiguracion}
          proyectos={proyectos}
          puntos={todosLosPuntos}
          onVolver={volverVistaAnterior}
          setConfirmData={setConfirmData}
          setAlertData={setAlertData}
        />
      ))}

      {vista === 'equipos' && (
        <VistaEquipos
          theme={theme}
          isDark={isDark}
          user={user}
          config={config}
          saveConfig={guardarConfiguracion}
          setConfirmData={setConfirmData}
          setAlertData={setAlertData}
          onVolver={volverVistaAnterior}
          marcarChatLeido={marcarChatLeido}
          notificacionesSupervisados={notifSupervisados}
          proyectosPropios={proyectos}
          invitacionEquipoId={invitacionEquipoId}
          onInvitacionConsumida={() => setInvitacionEquipoId(null)}
          perfilActivo={perfilActivo}
          onAbrirProyecto={(proy) => {
            // EDITAR desde el equipo: activa el proyecto (EDITANDO) y va a la lista personal
            seleccionarProyecto(proy);
            setVista('proyectos');
          }}
          onGPSProyecto={(proyecto, pts, centrarEn) => {
            setMapaSupervision({ proyecto, puntos: pts });
            setPuntoSeleccionado(null);
            if (centrarEn) {
              setMapViewState({ center: [centrarEn.lat, centrarEn.lng], zoom: 19 });
            } else if (pts.length > 0) {
              const sumLat = pts.reduce((a, p) => a + p.coords.lat, 0);
              const sumLng = pts.reduce((a, p) => a + p.coords.lng, 0);
              setMapViewState({ center: [sumLat / pts.length, sumLng / pts.length], zoom: 17 });
            }
            setVista('mapa');
          }}
        />
      )}

      {vista === 'diseno' && (
        <React.Suspense fallback={null}>
          <VistaDiseno
            theme={theme}
            isDark={isDark}
            onVolver={() => { volverVistaAnterior(); setMenuAbierto(true); }}
            proyectos={proyectos}
            puntos={todosLosPuntos}
            onCrearProyecto={crearProyectoDiseno}
          />
        </React.Suspense>
      )}

      {vista === 'diagnostico' && (
        <VistaDiagnostico
          theme={theme}
          isDark={isDark}
          onVolver={volverVistaAnterior}
          proyectos={todosLosProyectos}
        />
      )}

      {vista === 'papelera' && (
        <VistaPapelera
          theme={theme}
          isDark={isDark}
          onVolver={volverVistaAnterior}
          user={user}
          puntos={puntos}
          proyectos={proyectos}
          setAlertData={setAlertData}
          soloProyectos
        />
      )}

      {vista === 'datosUsuario' && (
        <VistaDatosUsuario
          theme={theme}
          config={config}
          guardarConfiguracion={guardarConfiguracion}
          onVolver={volverVistaAnterior}
          user={user}
        />
      )}

      {vista === 'config' && (
        <Configurador
          config={config}
          saveConfig={guardarConfiguracion}
          volver={volverVistaAnterior}
          modalState={{ modalOpen, setModalOpen, tempData, setTempData, setConfirmData, setAlertData }}
          theme={theme}
          tab={configTab}
          setTab={setConfigTab}
          perfilActivo={perfilActivo}
          seccionAbierta={acordeonAbierto}
          setSeccionAbierta={setAcordeonAbierto}
        />
      )}

      {/* Mapa de fondo en PC mientras el formulario o las fotos están abiertos (panel a la derecha) */}
      {isDesktop && (vista === 'formulario' || modalOpen === 'MODO_FOTOS') && (() => {
        const pAct = puntoTemporal || (puntosVisiblesMapa || []).find(p => p.id === puntoSeleccionado);
        if (!pAct || !pAct.coords) return null;
        const lista = (puntosVisiblesMapa || []).some(p => p.id === pAct.id)
          ? puntosVisiblesMapa
          : [...(puntosVisiblesMapa || []), pAct];
        return (
          <div className="fixed inset-0 z-[150]">
            <MiniMapaRevision puntos={lista} puntoActivo={pAct} />
          </div>
        );
      })()}

      {vista === 'formulario' && (
        <Formulario
          sugeridasAcero={sugeridasAceroPunto}
          theme={theme}
          isDesktop={isDesktop}
          perfilActivo={perfilActivo}
          datosFormulario={datosFormulario}
          setDatosFormulario={setDatosFormulario}
          config={configParaDetalle}
          proyectoActual={proyectoActual}
          modoLectura={modoLectura}
          modoEdicion={modoEdicion}
          tipoProyecto={(() => {
            // Tipo del proyecto DEL PUNTO en edición (EDITANDO es independiente);
            // punto nuevo → tipo del proyecto activo.
            const pid = puntoSeleccionado || tempPuntoId;
            const pt = pid ? todosLosPuntos.find(x => String(x.id) === String(pid)) : null;
            const proj = pt ? todosLosProyectos.find(pr => String(pr.id) === String(pt.proyectoId)) : null;
            return (proj || proyectoActual)?.tipo || 'liquidacion';
          })()}
          setVista={setVista}
          guardarPunto={guardarPunto}
          cancelarPunto={cancelarPunto}
          intentarCancelar={intentarCancelar}
          onAbrirConfigDatos={() => { setConfigTab('datos'); setVistaConHistorial('config'); }}
          setModalOpen={setModalOpen}
          procesarFoto={procesarFoto}
          inputCamaraRef={inputCamaraRef}
          setPhotoTab={setPhotoTab}
          setAlertData={setAlertData}
        />
      )}

      {vista === 'verDetalle' && (
        <VerDetalle
          datos={datosFormulario}
          proyectoActual={mapaSupervision ? mapaSupervision.proyecto : proyectoActual}
          config={configParaDetalle}
          theme={theme}
          readOnly={!!mapaSupervision}
          esSupervision={!!mapaSupervision}
          proyectoId={mapaSupervision ? mapaSupervision.proyecto?.id : proyectoActual?.id}
          user={user}
          logoApp={logoApp}
          onVolver={() => {
            if (mapaSupervision) {
              // Viene del mapa supervisado, volver al mapa
              setVista('mapa');
            } else if (modalPendiente) {
              setVista('proyectos');
            } else {
              setVista(vistaAnterior);
            }
          }}
          onEditar={() => {
            if (!vistaAnterior || vistaAnterior === 'verDetalle') {
              setVistaAnterior('mapa');
            }
            setModoLectura(false);
            setModoEdicion(true);
            setVista('formulario');
          }}
          onEditarFotos={(seccion) => {
            setPhotoTab(seccion);
            setModalOpen('MODO_FOTOS');
          }}
        />
      )}


      <PantallaMigracion migracion={migracion} isOnline={isOnline} theme={theme} />

      <ConfirmModal
        isOpen={!!confirmData}
        onClose={() => setConfirmData(null)}
        {...confirmData}
        theme={theme}
      />

      <AlertModal
        isOpen={!!alertData}
        onClose={() => setAlertData(null)}
        {...alertData}
        theme={theme}
      />

      <ExportModal
        isOpen={!!exportData}
        onClose={() => setExportData(null)}
        fileName={exportData?.fileName}
        onConfirm={() => handleExportKML(exportData?.proyecto, puntos, conexiones, logoApp, setExportData, undefined, undefined, undefined, config?.catalogoFerreteria || [])}
        theme={theme}
      />

      {modalOpen === 'MODO_FOTOS' && (
        <>
        <div style={{
          position: 'fixed',
          top: 0,
          zIndex: 999999,
          backgroundColor: 'white',
          overflow: 'auto',
          ...(isDesktop
            ? { right: 0, width: '460px', maxWidth: '92vw', height: '100vh', boxShadow: '-8px 0 30px rgba(0,0,0,0.3)' }
            : { left: 0, width: '100vw', height: '100vh' }),
        }}>
          <PhotoManagerErrorBoundary onClose={() => setModalOpen(null)} userUid={user?.uid} userEmail={user?.email}>
            <PhotoManager
              onClose={() => setModalOpen(null)}
              datos={datosFormulario}
              setDatos={setDatosFormulario}
              proyectoActual={(() => {
                // El proyecto del PUNTO abierto (puede no ser el activo: EDITANDO y edición de
                // punto son independientes). Fotos/papelera/subidas van al proyecto del punto.
                const pid = puntoSeleccionado || tempPuntoId;
                const pt = pid ? todosLosPuntos.find(x => String(x.id) === String(pid)) : null;
                const proj = pt ? todosLosProyectos.find(pr => String(pr.id) === String(pt.proyectoId)) : null;
                return proj || proyectoActual;
              })()}
              puntoTemporal={puntoTemporal}
              initialTab={photoTab}
              forzarTab={modoInstalacionFotos ? 'instalacion' : undefined}
              modoInstalacion={modoInstalacionFotos}
              onGuardar={guardarPuntoInstalacion}
              puntoId={puntoSeleccionado || tempPuntoId}
              onAsegurarPunto={asegurarPuntoBorrador}
              onEncolarFoto={(entry) => agregarTarea('subir_foto', entry)}
              logoApp={logoApp}
              isDesktop={isDesktop}
              onFotoSubida={(url) => fotosSubidasRef.current.push(url)}
              perfilActivo={perfilActivo}
              setAlertData={setAlertData}
            />
          </PhotoManagerErrorBoundary>
        </div>
        </>
      )}

      {/* BOTONES GPS - Navegación después de GPS desde lista */}
      {mostrarOverlayGPS && (
        <div className="fixed bottom-24 left-0 right-0 z-[500] flex justify-center px-3 pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={() => {
                // Volver a la lista de puntos
                setModalPendiente(mostrarOverlayGPS);
                setVista('proyectos');
                setMostrarOverlayGPS(null);
                setPuntoSeleccionado(null);
              }}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm uppercase shadow-lg border-2 border-blue-700 active:scale-95 transition-all"
            >
              ← LISTA
            </button>

            <button
              onClick={() => {
                // Quedarme en el mapa
                setMostrarOverlayGPS(null);
              }}
              className={`${theme.card} ${theme.text} border-2 ${theme.border} px-4 py-2.5 rounded-xl font-bold text-sm uppercase shadow-lg active:scale-95 transition-all`}
            >
              ✕ CERRAR
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;