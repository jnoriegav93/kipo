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
import { doc, setDoc, addDoc, updateDoc as fbUpdateDoc, deleteDoc, getDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Componentes principales
import Login from './Login';
import UpdateBanner from './components/UpdateBanner';
import Header from './components/Header';
import QueueModal from './components/QueueModal';
import Sidebar from './components/Sidebar';
import Configurador from './components/Configurador';
import Formulario from './components/Formulario';
import PhotoManager, { TABS_CONFIG } from './components/PhotoManager';
import { ConfirmModal, AlertModal, ExportModal } from './components/UI';
import VerDetalle from './components/VerDetalle';
import ModalAgregarCodigo from './components/ModalAgregarCodigo';
import { enviarMensajeSistema, detectarCambiosFotos, formatId } from './utils/bitacoraAuto';

// Vistas
import VistaMapa from './views/VistaMapa';
import VistaProyectos from './views/VistaProyectos';
import VistaSupervision from './views/VistaSupervision';
import VistaPermisos from './views/VistaPermisos';
import VistaDatosUsuario from './views/VistaDatosUsuario';
import VistaAdmin from './views/VistaAdmin';
import VistaDiagnostico from './views/VistaDiagnostico';

// Hooks personalizados
import { useAuth, ADMIN_UID } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useMapState } from './hooks/useMapState';
import { useUIState } from './hooks/useUIState';
import { useFormulario } from './hooks/useFormulario';
import { useLogo } from './hooks/useLogo';
import { useFirebaseData } from './hooks/useFirebaseData';
import { useProjectLogic } from './hooks/useProjectLogic';
import { usePuntosLogic } from './hooks/usePuntosLogic';
import { useSync } from './context/SyncContext';

// Utilidades
import { descargarReporteExcel, descargarFotosZip, handleExportKML } from './utils/exporters';
import { mapInteractions } from './utils/mapInteractions';
import { filtrosVisibilidad } from './utils/filtrosVisibilidad';

// Constantes
import { DATA_INICIAL } from './data/constantes';

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

  // Solicitudes de supervisión enviadas (pendientes de aprobación)
  const [solicitudesEnviadas, setSolicitudesEnviadas] = React.useState([]);

  // Modo mapa supervisión: { proyecto, puntos } o null
  const [mapaSupervision, setMapaSupervision] = React.useState(null);

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
          const road = data.address.road || data.address.street || '';
          const house = data.address.house_number || '';
          const direccion = `${road} ${house}`.trim() || '-';
          const city = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
          const state = data.address.state || data.address.region || '';
          const ubicacion = [city, state].filter(Boolean).join(', ') || '';
          setDatosFormulario(prev => ({ ...prev, direccion, ubicacion }));
        } else {
          setDatosFormulario(prev => ({ ...prev, direccion: '-' }));
        }
      })
      .catch(() => setDatosFormulario(prev => ({ ...prev, direccion: '-' })));
  }, [vista, puntoTemporal?.lat, puntoTemporal?.lng]);

  // Generar ID local para nuevo punto al abrir PhotoManager desde Formulario (evita freeze por draft localStorage)
  useEffect(() => {
    if (modalOpen === 'MODO_FOTOS' && !puntoSeleccionado) {
      setTempPuntoId(doc(collection(db, 'puntos')).id);
    } else if (modalOpen !== 'MODO_FOTOS') {
      setTempPuntoId(null);
    }
  }, [modalOpen, puntoSeleccionado]);

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
    config: configNube, setConfig
  } = useFirebaseData(user);

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
  const proyectosSupervision = React.useMemo(() =>
    proyectosSupervisados.filter(p => p.permisoActual === 'lectura' || p.permisoActual === 'solo_lectura' || p.permisoActual === 'ambos'),
    [proyectosSupervisados]
  );
  const todosLosProyectos = React.useMemo(() => [...proyectos, ...proyectosEditor], [proyectos, proyectosEditor]);

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
    eliminarSupervisor
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

  // Modo reasignación de puntos a otro proyecto
  const [modoMoverPuntos, setModoMoverPuntos] = React.useState(false);
  const [puntosSeleccionadosMover, setPuntosSeleccionadosMover] = React.useState([]);

  const ejecutarMoverPuntos = React.useCallback((proyectoDestino) => {
    const diaDestino = proyectoDestino.dias?.[0]?.id || null;
    const idsSet = new Set(puntosSeleccionadosMover);
    const conexionesAMover = conexiones.filter(c => {
      const ids = c.puntos?.length >= 2 ? c.puntos : [c.from, c.to].filter(Boolean);
      return ids.length >= 2 && ids.every(id => idsSet.has(id));
    });
    setPuntos(prev => prev.map(p => idsSet.has(p.id) ? { ...p, proyectoId: proyectoDestino.id, diaId: diaDestino } : p));
    setConexiones(prev => prev.map(c => conexionesAMover.some(cm => cm.id === c.id) ? { ...c, proyectoId: proyectoDestino.id, diaId: diaDestino } : c));
    puntosSeleccionadosMover.forEach(id => agregarTarea('reasignar_punto', { coleccion: 'puntos', idDoc: String(id), proyectoId: proyectoDestino.id, diaId: diaDestino }));
    conexionesAMover.forEach(c => agregarTarea('reasignar_punto', { coleccion: 'conexiones', idDoc: String(c.id), proyectoId: proyectoDestino.id, diaId: diaDestino }));
    setModoMoverPuntos(false);
    setPuntosSeleccionadosMover([]);
  }, [puntosSeleccionadosMover, conexiones, setPuntos, setConexiones, agregarTarea]);

  // Resetear modoMover y pendingCoords al deseleccionar punto
  React.useEffect(() => {
    if (!puntoSeleccionado) {
      setModoMover(false);
      setPendingCoords(null);
    }
  }, [puntoSeleccionado]);

  const {
    abrirFormulario,
    iniciarEdicion,
    verDetalle,
    intentarAgregarDatos,
    solicitarBorrarPunto,
    guardarPunto,
    procesarFoto,
    cancelarPunto,
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
    puntos: todosLosPuntos, setPuntos, setConexiones,
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
    if (todosLosProyectos.length === 0) return;
    let ocultos = [];
    try { ocultos = JSON.parse(localStorage.getItem('diasOcultos') || '[]'); } catch(e) {}

    if (!diasVisiblesInitRef.current) {
      // Primera carga: inicializar todos los días no-ocultos
      const visibles = todosLosProyectos.flatMap(p => (p.dias || []).map(d => d.id)).filter(id => !ocultos.includes(id));
      setDiasVisibles(visibles);
      diasVisiblesInitRef.current = true;
    } else {
      // Carga posterior (e.g. proyectos compartidos llegaron después): agregar días nuevos no conocidos
      setDiasVisibles(prev => {
        const prevSet = new Set(prev);
        const ocultosSet = new Set(ocultos);
        const nuevos = [];
        todosLosProyectos.forEach(p => {
          (p.dias || []).forEach(d => {
            if (!prevSet.has(d.id) && !ocultosSet.has(d.id)) nuevos.push(d.id);
          });
        });
        if (nuevos.length === 0) return prev;
        return [...new Set([...prev, ...nuevos])];
      });
    }
  }, [todosLosProyectos]);

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

      // 2. Limpiar fotos huérfanas antiguas de Storage
      try {
        const pending = JSON.parse(localStorage.getItem('kipo_pending_paths') || '[]');
        if (!pending.length) return;
        const cutoff = Date.now() - 60 * 60 * 1000;
        const toDelete = pending.filter(e => e.ts < cutoff);
        if (!toDelete.length) return;
        const { ref: storageRef, deleteObject } = await import('firebase/storage');
        const { storage } = await import('./firebaseConfig');
        await Promise.allSettled(toDelete.map(e => deleteObject(storageRef(storage, e.path))));
        localStorage.setItem('kipo_pending_paths', JSON.stringify(
          pending.filter(e => e.ts >= cutoff)
        ));
      } catch {}
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
          .filter(f => f.sectionId && f.lat != null && f.lng != null)
      );
    });
    return unsub;
  }, [proyectoActual?.id]);

  // Asociar foto de proyecto a un punto específico
  const asociarFoto = React.useCallback(async (fotoDoc, puntoId, forzar = false) => {
    const punto = puntos.find(p => p.id === puntoId);
    if (!punto) return 'error';
    const existente = punto.datos?.fotos?.[fotoDoc.sectionId]?.[fotoDoc.itemId];
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
      [fotoDoc.sectionId]: {
        ...((punto.datos?.fotos || {})[fotoDoc.sectionId] || {}),
        [fotoDoc.itemId]: fotoData,
      },
    };
    await fbUpdateDoc(doc(db, 'puntos', puntoId), { 'datos.fotos': newFotos });
    await deleteDoc(doc(db, 'proyectos', proyectoActual.id, 'fotosProyecto', fotoDoc.id));
    setPuntos(prev => prev.map(p =>
      p.id === puntoId ? { ...p, datos: { ...p.datos, fotos: newFotos } } : p
    ));
    return 'ok';
  }, [puntos, proyectoActual?.id, setPuntos]);

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

        // Mensaje automático en bitácora
        if (proyectoActual?.id && user?.uid) {
          const nombre = config?.nombrePersonal || user?.displayName || user?.email?.split('@')[0] || 'Usuario';
          const empresa = config?.empresaPersonal || '';
          const id = formatId(puntoActualizado.datos);
          const cambiosFotos = detectarCambiosFotos(puntoActualizado.datos?.fotos, datosFormulario.fotos);
          let msg = `Editado:\n${id}`;
          if (cambiosFotos.length > 0) msg += `\n${cambiosFotos.join('\n')}`;
          enviarMensajeSistema(proyectoActual.id, msg, user.uid, nombre, empresa);
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

  // Filtros de visibilidad
  const puntosVisiblesMapa = filtrosVisibilidad.getPuntosVisibles(todosLosPuntos, diasVisibles, todosLosProyectos);
  const totalPuntosProyecto = proyectoActual ? todosLosPuntos.filter(p => p.proyectoId === proyectoActual.id).length : 0;
  const conexionesVisiblesBase = filtrosVisibilidad.getConexionesVisibles(conexiones, diasVisibles, proyectos);
  const conexionesVisiblesMapa = fibrasVisibles ? conexionesVisiblesBase : [];

  if (!user) return <Login onLogin={() => { }} initialBlocked={deviceBlocked} />;

  return (
    <div className={`h-screen w-full flex flex-col ${theme.bg} ${theme.text} font-sans overflow-hidden select-none relative transition-colors duration-300`}>
      <UpdateBanner />

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
        setMenuEtiquetasAbierto={setMenuEtiquetasAbierto}
        toggleMenuEtiquetas={toggleMenuEtiquetas}
        isDark={isDark}
        setIsDark={setIsDark}
        setIconSize={setIconSize}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        totalNotificaciones={totalNotificaciones}
        fotoPuntosActivo={fotoPuntosActivo}
        onToggleFotoPuntos={() => setFotoPuntosActivo(v => !v)}
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
        totalSupervision={proyectosSupervision.length}
        totalPermisos={proyectosSupervisados.length + solicitudesEnviadas.filter(s => !proyectosSupervisados.some(p => p.id === s.id)).length}
        totalNotifProyectos={totalNotifVistaProyectos}
        totalNotifSupervisados={totalNotifSupervisados}
        isDark={isDark}
        setIsDark={setIsDark}
        adminReturnEmail={adminReturnEmail}
        onVolverAAdmin={volverAAdmin}
      />

      {vista === 'mapa' && (
        <VistaMapa
          theme={theme}
          mapStyle={mapStyle}
          mapViewState={mapViewState}
          setMapViewState={setMapViewState}
          handleMapaClick={mapaSupervision
            ? () => { setPuntoSeleccionado(null); setConexionSeleccionada(null); }
            : (e) => {
              if (modoMover || modoMoverPuntos) return;
              setConexionSeleccionada(null);
              mapInteractions.handleMapaClick({
                e, menuAbierto, modoFibra, puntoSeleccionado, vista, diaActual,
                diasVisibles, proyectos,
                setPuntoSeleccionado, setPuntoTemporal, setVista, setAlertData
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
              e, puntoId, modoFibra, dibujandoFibra, setPuntosRecorrido,
              setPuntoSeleccionado, setPuntoTemporal
            })
          }
          puntoTemporal={mapaSupervision ? null : puntoTemporal}
          mostrarEtiquetas={mostrarEtiquetas}
          menuEtiquetasAbierto={menuEtiquetasAbierto}
          setMostrarEtiquetas={setMostrarEtiquetas}
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
          intentarAgregarDatos={intentarAgregarDatos}
          setVistaAnterior={setVistaAnterior}
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
          totalPuntosProyecto={mapaSupervision ? mapaSupervision.puntos.length : totalPuntosProyecto}
          proyectoEsCompartido={!!proyectoActual?.esCompartido}
          onGuardarFibra={async () => {
            if (puntosRecorrido.length < 2 || !diaActual || !proyectoActual) return;

            // Guardar como un solo objeto trazo (multi-punto)
            const datos = {
              puntos: puntosRecorrido, // Array ordenado de IDs de puntos [p1, p2, p3...]
              from: puntosRecorrido[0], // Referencia inicial
              to: puntosRecorrido[puntosRecorrido.length - 1], // Referencia final
              diaId: diaActual,
              proyectoId: proyectoActual.id,
              ownerId: user.uid,
              capacidad: capacidadFibra,
              tipo: 'trazo',
              timestamp: new Date().toISOString()
            };

            try {
              await addDoc(collection(db, "conexiones"), datos);
            } catch (error) {
              console.error("Error guardando fibra:", error);
            }
            setPuntosRecorrido([]);
          }}
          onEliminarConexion={(con) => {
            setConexiones(prev => prev.filter(c => c.id !== con.id));
            setConexionSeleccionada(null);
            import("firebase/firestore").then(({ deleteDoc, doc: fbDoc }) => {
              deleteDoc(fbDoc(db, "conexiones", con.id));
            }).catch(e => console.error("Error eliminando fibra:", e));
          }}
          onCambiarCapacidad={async (con, nuevaCapacidad) => {
            setConexiones(prev => prev.map(c =>
              c.id === con.id ? { ...c, capacidad: nuevaCapacidad } : c
            ));
            setConexionSeleccionada(prev => prev ? { ...prev, capacidad: nuevaCapacidad } : null);
            try {
              const { updateDoc: fbUp, doc: fbDoc } = await import("firebase/firestore");
              await fbUp(fbDoc(db, "conexiones", con.id), { capacidad: nuevaCapacidad });
            } catch (e) { console.error("Error actualizando capacidad:", e); }
          }}
          modoSupervision={!!mapaSupervision}
          onVolverSupervision={() => {
            setMapaSupervision(null);
            setPuntoSeleccionado(null);
            setVista('supervision');
          }}
          overlayGPSActivo={!!mostrarOverlayGPS}
          fotosConCoordenadas={fotosConCoordenadas}
          fotoPuntosActivo={fotoPuntosActivo}
          onAsociarFoto={asociarFoto}
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
          onEjecutarMoverPuntos={ejecutarMoverPuntos}
          onCancelarMoverPuntos={() => { setModoMoverPuntos(false); setPuntosSeleccionadosMover([]); }}
          proyectosDestino={proyectos.filter(p => p.id !== proyectoActual?.id)}
        />
      )}
      {vista === 'proyectos' && (
        <VistaProyectos
          theme={theme}
          isDark={isDark}
          proyectos={todosLosProyectos}
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
          descargarReporteExcel={descargarReporteExcel}
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
          onIniciarMoverPuntos={() => {
            setPuntoSeleccionado(null);
            setPuntosSeleccionadosMover([]);
            setModoMoverPuntos(true);
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
        />
      )}

      {vista === 'permisos' && (
        <VistaPermisos
          theme={theme}
          proyectosSupervisados={proyectosSupervisados}
          solicitudesPendientes={solicitudesEnviadas.filter(s => !proyectosSupervisados.some(p => p.id === s.id))}
          setModalCodigoAbierto={setModalCodigoAbierto}
          onVolver={volverVistaAnterior}
          onEliminar={(proy) => {
            setConfirmData({
              title: '¿Dejar de participar?',
              message: `Dejarás de tener acceso al proyecto "${proy.nombre}".`,
              actionText: 'CONFIRMAR',
              theme,
              onConfirm: async () => {
                try {
                  const { doc: docRef, updateDoc, arrayRemove } = await import("firebase/firestore");
                  const { db: fireDb } = await import('./firebaseConfig');
                  const proyRef = docRef(fireDb, "proyectos", proy.id);
                  await updateDoc(proyRef, { compartidoCon: arrayRemove(user.uid) });
                  setSolicitudesEnviadas(prev => prev.filter(s => s.id !== proy.id));
                  setConfirmData(null);
                  setAlertData({ title: "Listo", message: "Ya no tenés acceso a este proyecto." });
                } catch (error) {
                  console.error("Error:", error);
                  setAlertData({ title: "Error", message: "No se pudo completar la acción." });
                }
              }
            });
          }}
        />
      )}

      {vista === 'supervision' && (
        <VistaSupervision
          theme={theme}
          user={user}
          proyectosSupervisados={proyectosSupervision}
          solicitudesPendientes={solicitudesEnviadas.filter(s => !proyectosSupervisados.some(p => p.id === s.id))}
          onVolver={volverVistaAnterior}
          setModalCodigoAbierto={setModalCodigoAbierto}
          config={config}
          notificacionesSupervisados={notifSupervisados}
          marcarChatLeido={marcarChatLeido}
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
          onEliminarSupervision={(proy) => {
            setConfirmData({
              title: '¿Dejar de supervisar?',
              message: `Dejarás de supervisar el proyecto "${proy.nombre}".`,
              actionText: 'CONFIRMAR',
              theme,
              onConfirm: async () => {
                try {
                  const { doc: docRef, updateDoc, arrayRemove } = await import("firebase/firestore");
                  const { db: fireDb } = await import('./firebaseConfig');
                  const proyRef = docRef(fireDb, "proyectos", proy.id);
                  await updateDoc(proyRef, {
                    compartidoCon: arrayRemove(user.uid)
                  });
                  // Limpiar de solicitudes enviadas para que no reaparezca como "en espera"
                  setSolicitudesEnviadas(prev => prev.filter(s => s.id !== proy.id));
                  setConfirmData(null);
                  setAlertData({ title: "Listo", message: "Ya no supervisas este proyecto." });
                } catch (error) {
                  console.error("Error:", error);
                  setAlertData({ title: "Error", message: "No se pudo completar la acción." });
                }
              }
            });
          }}
        />
      )}

      {vista === 'diagnostico' && (
        <VistaDiagnostico
          theme={theme}
          isDark={isDark}
          onVolver={volverVistaAnterior}
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
          seccionAbierta={acordeonAbierto}
          setSeccionAbierta={setAcordeonAbierto}
        />
      )}

      {vista === 'formulario' && (
        <Formulario
          theme={theme}
          datosFormulario={datosFormulario}
          setDatosFormulario={setDatosFormulario}
          config={config}
          proyectoActual={proyectoActual}
          modoLectura={modoLectura}
          modoEdicion={modoEdicion}
          setVista={setVista}
          guardarPunto={guardarPunto}
          cancelarPunto={cancelarPunto}
          setModalOpen={setModalOpen}
          procesarFoto={procesarFoto}
          inputCamaraRef={inputCamaraRef}
          setPhotoTab={setPhotoTab}
        />
      )}

      {vista === 'verDetalle' && (
        <VerDetalle
          datos={datosFormulario}
          proyectoActual={mapaSupervision ? mapaSupervision.proyecto : proyectoActual}
          config={config}
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
        onConfirm={() => handleExportKML(exportData?.proyecto, puntos, conexiones, logoApp, setExportData)}
        theme={theme}
      />

      {modalOpen === 'MODO_FOTOS' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 999999,
          backgroundColor: 'white',
          overflow: 'auto'
        }}>
          <PhotoManagerErrorBoundary onClose={() => setModalOpen(null)} userUid={user?.uid} userEmail={user?.email}>
            <PhotoManager
              onClose={() => setModalOpen(null)}
              datos={datosFormulario}
              setDatos={setDatosFormulario}
              proyectoActual={proyectoActual}
              puntoTemporal={puntoTemporal}
              initialTab={photoTab}
              puntoId={puntoSeleccionado || tempPuntoId}
              logoApp={logoApp}
              onFotoSubida={(url) => fotosSubidasRef.current.push(url)}
            />
          </PhotoManagerErrorBoundary>
        </div>
      )}

      {/* MODAL AGREGAR CÓDIGO */}
      <ModalAgregarCodigo
        isOpen={modalCodigoAbierto}
        onClose={() => setModalCodigoAbierto(false)}
        user={user}
        theme={theme}
        setAlertData={setAlertData}
        config={config}
        onSolicitudEnviada={(proy) => {
          setSolicitudesEnviadas(prev => {
            if (prev.some(p => p.id === proy.id)) return prev;
            return [...prev, proy];
          });
        }}
      />

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