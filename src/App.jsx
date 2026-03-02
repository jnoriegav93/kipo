import React, { useEffect } from 'react';
import { doc, setDoc, addDoc, updateDoc as fbUpdateDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from './firebaseConfig';

// Componentes principales
import Login from './Login';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Configurador from './components/Configurador';
import Formulario from './components/Formulario';
import PhotoManager from './components/PhotoManager';
import { ConfirmModal, AlertModal, ExportModal } from './components/UI';
import VerDetalle from './components/VerDetalle';
import ModalAgregarCodigo from './components/ModalAgregarCodigo';
import { enviarMensajeSistema, detectarCambiosFotos, formatId } from './utils/bitacoraAuto';

// Vistas
import VistaMapa from './views/VistaMapa';
import VistaProyectos from './views/VistaProyectos';
import VistaSupervision from './views/VistaSupervision';
import VistaDatosUsuario from './views/VistaDatosUsuario';

// Hooks personalizados
import { useAuth } from './hooks/useAuth';
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
  const { estadoSync, cola, agregarTarea } = useSync();
  const { logoApp, setLogoApp, handleCargarLogo } = useLogo(user);

  // Tema
  const { isDark, setIsDark, theme } = useTheme();

  // Estado del mapa
  const {
    mapViewState, setMapViewState,
    iconSize, setIconSize,
    mapStyle, setMapStyle,
    mostrarEtiquetas, setMostrarEtiquetas,
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
  const [notifSupervisados, setNotifSupervisados] = React.useState({});
  const totalNotifProyectos = Object.values(notifProyectos).reduce((s, n) => s + n, 0);
  const totalNotifSupervisados = Object.values(notifSupervisados).reduce((s, n) => s + n, 0);
  const totalNotificaciones = totalNotifProyectos + totalNotifSupervisados;

  const marcarChatLeido = React.useCallback((proyectoId) => {
    localStorage.setItem(`lastChatRead_${proyectoId}`, new Date().toISOString());
    setNotifProyectos(prev => ({ ...prev, [proyectoId]: 0 }));
    setNotifSupervisados(prev => ({ ...prev, [proyectoId]: 0 }));
  }, []);

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
    conexiones, setConexiones,
    config: configNube, setConfig
  } = useFirebaseData(user);

  const config = configNube || DATA_INICIAL;

  // Estado local de proyectos y días
  const [proyectoActual, setProyectoActual] = React.useState(null);
  const [diaActual, setDiaActual] = React.useState(null);
  const [diasVisibles, setDiasVisibles] = React.useState([]);

  // Lógica de proyectos
  const {
    confirmarCrearProyecto,
    confirmarCrearDia,
    seleccionarProyecto,
    toggleVisibilidadDia,
    toggleVisibilidadProyecto,
    cambiarColorDia,
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
    puntos,
    tempData,
    setPuntos, setConexiones,
    setModalOpen, setConfirmData, setAlertData,
    setMapViewState, setVista, setMenuAbierto,
    config
  });

  // Lógica de puntos
  const {
    abrirFormulario,
    iniciarEdicion,
    verDetalle,
    intentarAgregarDatos,
    solicitarBorrarPunto,
    guardarPunto,
    procesarFoto
  } = usePuntosLogic({
    user,
    puntoSeleccionado, setPuntoSeleccionado,
    puntoTemporal, setPuntoTemporal,
    modoEdicion, setModoEdicion,
    setModoLectura,
    datosFormulario, setDatosFormulario,
    memoriaUltimoPunto, setMemoriaUltimoPunto,
    diaActual, proyectoActual,
    puntos, setPuntos, setConexiones,
    setVista,
    setConfirmData, setAlertData,
    agregarTarea, theme,
    vistaAnterior, setVistaAnterior
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

  // Listeners centralizados de notificaciones - proyectos supervisados
  const supervisadoIds = React.useMemo(() => proyectosSupervisados.map(p => p.id).join(','), [proyectosSupervisados]);
  useEffect(() => {
    if (!user || proyectosSupervisados.length === 0) { setNotifSupervisados({}); return; }
    const unsubscribes = proyectosSupervisados.map(proy => {
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
        setNotifSupervisados(prev => ({ ...prev, [proy.id]: noLeidos }));
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

  // Auto-seleccionar último proyecto abierto
  useEffect(() => {
    if (proyectos.length > 0 && !proyectoActual) {
      let proyecto = null;
      try {
        const savedId = localStorage.getItem('ultimoProyectoId');
        if (savedId) proyecto = proyectos.find(p => p.id === savedId);
      } catch (e) { }
      if (!proyecto) proyecto = proyectos[proyectos.length - 1];
      seleccionarProyecto(proyecto);
    }
  }, [proyectos, proyectoActual, seleccionarProyecto]);

  // Sincronizar proyectoActual con datos frescos de Firestore
  useEffect(() => {
    if (proyectoActual && proyectos.length > 0) {
      const actualizado = proyectos.find(p => p.id === proyectoActual.id);
      if (actualizado && actualizado !== proyectoActual) {
        setProyectoActual(actualizado);
      }
    }
  }, [proyectos]);

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
        agregarTarea('guardar_punto', {
          modo: 'editar',
          coleccion: 'puntos',
          idDoc: String(puntoSeleccionado),
          datos: {
            ...puntoActualizado,
            datos: {
              ...puntoActualizado.datos,
              fotos: datosFormulario.fotos,
              direccion: direccionActualizada
            },
            timestamp: new Date().toISOString()
          }
        });

        // Mensaje automático en bitácora
        if (proyectoActual?.id && user?.uid) {
          const id = formatId(puntoActualizado.datos);
          const cambiosFotos = detectarCambiosFotos(puntoActualizado.datos?.fotos, datosFormulario.fotos);
          let msg = `Editado:\n${id}`;
          if (cambiosFotos.length > 0) msg += `\n${cambiosFotos.join('\n')}`;
          enviarMensajeSistema(proyectoActual.id, msg, user.uid);
        }
      }
    }
    prevModalOpen.current = modalOpen;
  }, [modalOpen, modoEdicion, puntoSeleccionado, puntos, datosFormulario.fotos, datosFormulario.direccion, setPuntos, agregarTarea, proyectoActual, user]);

  // Guardar configuración
  const guardarConfiguracion = async (nuevaConfig) => {
    setConfig(nuevaConfig);
    try {
      await setDoc(doc(db, "configuraciones", user.uid), nuevaConfig);
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
  const puntosVisiblesMapa = filtrosVisibilidad.getPuntosVisibles(puntos, diasVisibles, proyectos);
  const totalPuntosProyecto = proyectoActual ? puntos.filter(p => p.proyectoId === proyectoActual.id).length : 0;
  const conexionesVisiblesBase = filtrosVisibilidad.getConexionesVisibles(conexiones, diasVisibles, proyectos);
  const conexionesVisiblesMapa = fibrasVisibles ? conexionesVisiblesBase : [];

  if (!user) return <Login onLogin={() => { }} initialBlocked={deviceBlocked} />;

  return (
    <div className={`h-screen w-full flex flex-col ${theme.bg} ${theme.text} font-sans overflow-hidden select-none relative transition-colors duration-300`}>

      <Header
        theme={theme}
        setMenuAbierto={setMenuAbierto}
        estadoSync={estadoSync}
        cola={cola}
        setGpsTrigger={setGpsTrigger}
        mostrarEtiquetas={mostrarEtiquetas}
        setMostrarEtiquetas={setMostrarEtiquetas}
        isDark={isDark}
        setIsDark={setIsDark}
        setIconSize={setIconSize}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        totalNotificaciones={totalNotificaciones}
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
        totalSupervision={proyectosSupervisados.length}
        totalNotifProyectos={totalNotifProyectos}
        totalNotifSupervisados={totalNotifSupervisados}
        isDark={isDark}
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
        />
      )}
      {vista === 'proyectos' && (
        <VistaProyectos
          theme={theme}
          isDark={isDark}
          proyectos={proyectos}
          proyectoActual={proyectoActual}
          puntos={puntos}
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
          setDiaActual={setDiaActual}
          toggleVisibilidadDia={toggleVisibilidadDia}
          cambiarColorDia={cambiarColorDia}
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
          notificacionesProyectos={notifProyectos}
          marcarChatLeido={marcarChatLeido}
          conexiones={conexiones}
        />
      )}

      {vista === 'supervision' && (
        <VistaSupervision
          theme={theme}
          user={user}
          proyectosSupervisados={proyectosSupervisados}
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
          <PhotoManager
            onClose={() => setModalOpen(null)}
            datos={datosFormulario}
            setDatos={setDatosFormulario}
            proyectoActual={proyectoActual}
            puntoTemporal={puntoTemporal}
            initialTab={photoTab}
            puntoId={puntoSeleccionado}
            logoApp={logoApp}
          />
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