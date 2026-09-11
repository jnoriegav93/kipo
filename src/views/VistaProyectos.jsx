
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, ChevronDown, Eye, EyeOff, Trash2, MapPin,
  FolderDown, FileDown, Share2, Folder, X, Key, Users, Check, XCircle, Copy, MessageCircle, Image as ImageIcon, Info, Download, Loader2, Minus, AlertTriangle, Lock, UploadCloud, Edit, Link2, Camera, FolderInput, Package, Settings, ArrowUpDown, ListOrdered, ClipboardCheck, ShieldCheck, Wrench, Cloud, Smartphone, RefreshCw, Search, Recycle, LogOut, Archive, Hash
} from 'lucide-react';
import { Modal, ThemedInput } from '../components/UI';
import { BloqueLiquidacion, BloqueLevantamiento, GrupoPropietario, GrupoElemento, InputsDatos } from '../components/Formulario';
import { TABS_CONFIG, esFotoMiniatura } from '../components/PhotoManager';
import { MiniMapaRevision } from '../components/Mapas';
import useIsDesktop from '../hooks/useIsDesktop';
import { compartirODescargar, perteneceAProyecto } from '../utils/helpers';
import BloqueoHerramienta from '../components/BloqueoHerramienta';
import { equiposDePunto } from '../utils/equiposPasivos';
import RenumerarItems from '../components/RenumerarItems';
import RuedaSelector from '../components/RuedaSelector';
import EditorArmadoItems from '../components/EditorArmadoItems';
import { construirItems } from '../utils/armados';
import ZoomImage from '../components/ZoomImage';
import { resumenFibrasEnPoste, getColorFibra } from '../utils/fibraUtils';
import { descargarFotosZip, handleExportKML } from '../utils/exporters';
import { crearExportacion, suscribirseAExportacion } from '../services/exportacionService';
import { COLORES_DIA } from '../data/constantes';
import { validarPunto } from '../utils/validarPunto';
import ChatBitacora from '../components/ChatBitacora';
import VistaPapelera from './VistaPapelera';
import FotosProyecto from '../components/FotosProyecto';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Reportes de datos (client-side) en curso. Module-scope: sobrevive a que la vista se
// desmonte/monte al navegar (misma pestaña), pero se vacía al recargar la app (donde la
// generación cliente muere). Sirve para NO mostrar tarjetas de carga zombis tras recargar.
const generacionesReporteActivas = new Set();
// Escribe/actualiza (o elimina) una tarjeta de resultado en localStorage directamente y
// avisa a la vista. Se usa desde la promesa de generación aunque el componente ya no exista.
const persistirResultadoLS = (key, card, { eliminar = false } = {}) => {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    const sinEse = arr.filter(r => r.id !== card.id);
    const next = eliminar ? sinEse : [...sinEse, card];
    localStorage.setItem(key, JSON.stringify(next));
  } catch { /* noop */ }
  try { window.dispatchEvent(new CustomEvent('kipo-reportes-actualizado')); } catch { /* noop */ }
};

const VistaProyectos = ({
  theme, isDark, perfilActivo = 'claro', proyectos, proyectoActual, puntos, diasVisibles,
  config, logoApp, vista, setVista, setTempData, setModalOpen, modalOpen,
  seleccionarProyecto, diaActual, setDiaActual, toggleVisibilidadDia,
  cambiarColorDia, uniformizarColorDias, toggleVisibilidadProyecto, cambiarColorProyecto,
  solicitarBorrarProyecto, irUbicacionProyecto, setExportData, selectorColorAbierto,
  setSelectorColorAbierto, tempData, confirmarCrearProyecto, confirmarCrearDia,
  aprobarSupervisor, rechazarSupervisor, eliminarSupervisor, user, setAlertData, setConfirmData,
  setLogoApp, handleCargarLogo, setPuntoSeleccionado, setModoLectura, setModoEdicion, setDatosFormulario, setVistaAnterior, setMapViewState, modalPendiente, setModalPendiente, setMostrarOverlayGPS, onVolver,
  notificacionesProyectos = {}, marcarChatLeido, conexiones, onIniciarMoverPuntos, onIniciarOrdenar, onRepararPuntos,
  proyectosArchivados = [], onArchivarProyecto, onDesarchivarProyecto
}) => {

  const [codigoCopiado, setCodigoCopiado] = React.useState(false);
  const [colorMenuPos, setColorMenuPos] = React.useState(null); // Posición del menú de color (para evitar overflow)

  const [creandoProyecto, setCreandoProyecto] = React.useState(false);
  const [creandoDia, setCreandoDia] = React.useState(false);
  const [editandoNombre, setEditandoNombre] = React.useState(null); // { proyId, valor }

  // Proyecto a exportar: el del botón Exportar presionado (el desglose es independiente
  // del proyecto activo). Si no hay uno marcado, cae al proyecto activo.
  const [exportProyId, setExportProyId] = React.useState(null);
  const [verArchivados, setVerArchivados] = React.useState(false); // vista ARCHIVADOR

  // DERIVED STATE: Always use the fresh project data from the list, not the potentially stale prop
  const activeProjectData = React.useMemo(() => {
    const idBuscar = exportProyId || proyectoActual?.id;
    return proyectos.find(p => p.id === idBuscar) || proyectoActual;
  }, [proyectos, proyectoActual, exportProyId]);

  // Estado para exportación
  const exportKey = `kipo_export_results_${user?.uid || 'anon'}`;
  const exportPendingKey = `kipo_export_pending_${user?.uid || 'anon'}`;
  const [exportandoTipo, setExportandoTipo] = React.useState(null); // 'ZIP' | 'EXCEL' | 'KMZ' | null
  // Filtra las tarjetas guardadas: completadas (<48h) + tarjetas de reporte EXCEL en curso
  // que sigan vivas en ESTA sesión (evita "cargando" zombi tras recargar la app).
  const filtrarResultadosGuardados = React.useCallback((arr) => {
    const corte = Date.now() - 48 * 60 * 60 * 1000;
    return (arr || []).filter(r =>
      (!r.cargando && r.timestamp > corte) ||
      (r.cargando && r.type === 'EXCEL' && generacionesReporteActivas.has(r.id))
    );
  }, []);
  const [resultadosExportacion, setResultadosExportacion] = React.useState(() => {
    try {
      const saved = localStorage.getItem(`kipo_export_results_${user?.uid || 'anon'}`);
      if (!saved) return [];
      const corte = Date.now() - 48 * 60 * 60 * 1000;
      return JSON.parse(saved).filter(r =>
        (!r.cargando && r.timestamp > corte) ||
        (r.cargando && r.type === 'EXCEL' && generacionesReporteActivas.has(r.id))
      );
    } catch { return []; }
  });
  const abortControllerRef = React.useRef(null);
  const ultimoTap = React.useRef(null);
  const [fotosCountMap, setFotosCountMap] = React.useState({}); // { [proyId]: number }

  // Persistir resultados en localStorage: completados + reportes EXCEL en curso (para que la
  // tarjeta no desaparezca al salir y volver a la vista).
  React.useEffect(() => {
    const guardables = resultadosExportacion.filter(r => !r.cargando || r.type === 'EXCEL');
    if (guardables.length > 0) localStorage.setItem(exportKey, JSON.stringify(guardables));
    else localStorage.removeItem(exportKey);
  }, [resultadosExportacion, exportKey]);

  // Refrescar desde localStorage cuando una generación (posiblemente en otra instancia de la
  // vista, o tras desmontar) actualice/termine un reporte.
  React.useEffect(() => {
    const h = () => {
      try {
        const saved = filtrarResultadosGuardados(JSON.parse(localStorage.getItem(exportKey) || '[]'));
        setResultadosExportacion(prev => {
          const byId = new Map();
          // Conservar tarjetas en curso NO persistidas (ej. ZIP del servidor)
          prev.forEach(r => { if (r.cargando && r.type !== 'EXCEL') byId.set(r.id, r); });
          // Aplicar lo guardado (completadas + reportes EXCEL)
          saved.forEach(r => byId.set(r.id, r));
          return [...byId.values()];
        });
      } catch { /* noop */ }
    };
    window.addEventListener('kipo-reportes-actualizado', h);
    return () => window.removeEventListener('kipo-reportes-actualizado', h);
  }, [exportKey, filtrarResultadosGuardados]);

  // Cancelar Exportación
  const cancelarExportacion = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setExportandoTipo(null);
      setAlertData({ title: "Exportación Cancelada", message: "El proceso de exportación fue detenido por el usuario." });
    }
  };

  // Manejador de Exportación en Servidor (Cloud Function)
  const handleExportarServidor = async (tipo, proy, limiteFotos = 700, stampConfig = {}) => {
    if (!proy) return;
    // Para EXCEL, cada resultado se ancla a su selector de reporte (detallado por defecto).
    const reporteTag = tipo === 'EXCEL' ? (stampConfig.reporte || 'detallado') : undefined;
    const tempId = `srv_loading_${Date.now()}`;
    setResultadosExportacion(prev => [
      ...prev.filter(r => !(reporteTag && r.type === 'EXCEL' && r.reporte === reporteTag && String(r.proyectoId) === String(proy.id))),
      { id: tempId, type: tipo, reporte: reporteTag, proyectoId: proy.id, name: `Generando ${tipo}...`,
        cargando: true, downloadUrl: null, blob: { size: 0 }, numPuntos: 0 },
    ]);
    try {
      const exportId = await crearExportacion(proy.id, tipo, limiteFotos, stampConfig);
      localStorage.setItem(exportPendingKey, JSON.stringify({
        exportId, tipo, reporte: reporteTag, proyectoId: proy.id, timestamp: Date.now()
      }));
      let vigilante = null;
      const unsubscribe = suscribirseAExportacion(exportId, (exportData) => {
        if (exportData.status === 'listo') {
          clearTimeout(vigilante);
          unsubscribe();
          localStorage.removeItem(exportPendingKey);
          const ts = Date.now();
          const nuevosResultados = (exportData.resultados || []).map((r, i) => ({
            id: `srv_${exportId}_${i}`,
            type: tipo, reporte: reporteTag, proyectoId: proy.id, name: r.nombre,
            downloadUrl: r.downloadUrl, cargando: false,
            blob: { size: r.tamano }, numPuntos: r.numPuntos,
            timestamp: ts,
          }));
          setResultadosExportacion(prev => {
            const sinTemp = prev.filter(r => r.id !== tempId);
            const ids = new Set(sinTemp.map(r => r.id));
            return [...sinTemp, ...nuevosResultados.filter(r => !ids.has(r.id))];
          });
        } else if (exportData.status === 'error') {
          clearTimeout(vigilante);
          unsubscribe();
          localStorage.removeItem(exportPendingKey);
          setResultadosExportacion(prev => prev.filter(r => r.id !== tempId));
          setAlertData({ title: 'Error del servidor', message: exportData.error || 'Error procesando la exportación.' });
        }
      });
      // Si el servidor se cae de golpe, el documento se queda en "procesando" y
      // nunca llega ni 'listo' ni 'error': la tarjeta giraría para siempre. La
      // función tiene 9 min de tope, así que a los 11 se da por perdida.
      vigilante = setTimeout(() => {
        unsubscribe();
        localStorage.removeItem(exportPendingKey);
        setResultadosExportacion(prev => prev.filter(r => r.id !== tempId));
        setAlertData({ title: 'Sin respuesta del servidor', message: 'La generación no llegó a terminar. Vuelve a intentarlo.' });
      }, 11 * 60 * 1000);
    } catch (error) {
      console.error('Error iniciando exportación servidor:', error);
      setResultadosExportacion(prev => prev.filter(r => r.id !== tempId));
      setAlertData({ title: 'Error', message: 'No se pudo conectar con el servidor. Verifica tu conexión.' });
    }
  };

  // Recuperar exportación pendiente si el usuario cerró la app mientras el servidor procesaba
  React.useEffect(() => {
    const raw = localStorage.getItem(exportPendingKey);
    if (!raw) return;
    let pending;
    try { pending = JSON.parse(raw); } catch { localStorage.removeItem(exportPendingKey); return; }
    const { exportId, tipo, reporte: reporteTag, proyectoId, timestamp } = pending;
    if (proyectoId !== proyectoActual?.id) return;
    // Links del servidor expiran en 48h, no tiene sentido recuperar más tarde
    if (Date.now() - timestamp > 60 * 60 * 1000) {
      localStorage.removeItem(exportPendingKey);
      return;
    }
    const tempId = `srv_recovery_${exportId}`;
    setResultadosExportacion(prev => {
      if (prev.some(r => r.id === tempId)) return prev;
      return [...prev, { id: tempId, type: tipo, reporte: reporteTag, proyectoId, name: `Generando ${tipo}...`, cargando: true, downloadUrl: null, blob: { size: 0 }, numPuntos: 0 }];
    });
    let vigilante = null;
    const unsubscribe = suscribirseAExportacion(exportId, (exportData) => {
      if (exportData.status === 'listo') {
        clearTimeout(vigilante);
        unsubscribe();
        localStorage.removeItem(exportPendingKey);
        const ts = Date.now();
        const nuevosResultados = (exportData.resultados || []).map((r, i) => ({
          id: `srv_${exportId}_${i}`,
          type: tipo, reporte: reporteTag, proyectoId, name: r.nombre,
          downloadUrl: r.downloadUrl, cargando: false,
          blob: { size: r.tamano }, numPuntos: r.numPuntos,
          timestamp: ts,
        }));
        setResultadosExportacion(prev => {
          const sinTemp = prev.filter(r => r.id !== tempId);
          const ids = new Set(sinTemp.map(r => r.id));
          return [...sinTemp, ...nuevosResultados.filter(r => !ids.has(r.id))];
        });
        setModalOpen('EXPORTAR_HUB');
      } else if (exportData.status === 'error') {
        clearTimeout(vigilante);
        unsubscribe();
        localStorage.removeItem(exportPendingKey);
        setResultadosExportacion(prev => prev.filter(r => r.id !== tempId));
        setAlertData({ title: 'Error del servidor', message: exportData.error || 'Error procesando.' });
      }
    });
    // Mismo vigilante que al generar: se cuenta desde que arrancó la exportación
    vigilante = setTimeout(() => {
      unsubscribe();
      localStorage.removeItem(exportPendingKey);
      setResultadosExportacion(prev => prev.filter(r => r.id !== tempId));
      setAlertData({ title: 'Sin respuesta del servidor', message: 'La generación no llegó a terminar. Vuelve a intentarlo.' });
    }, Math.max(30 * 1000, 11 * 60 * 1000 - (Date.now() - timestamp)));
    return () => { clearTimeout(vigilante); unsubscribe(); };
  }, [proyectoActual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manejador de Exportación Unificado
  const handleExportar = async (tipo, proy, limiteFotos = 700, stampConfig = {}) => {
    if (!proy) return;

    // Si ya hay una en curso, ignorar o cancelar anterior (aquí optamos por bloquear UI)
    if (exportandoTipo) return;

    // Crear nuevo controlador de aborto
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const iniciarExportacion = async () => {
      setExportandoTipo(tipo);
      try {
        let res = [];
        if (tipo === 'ZIP') {
          res = await descargarFotosZip(proy, puntos, logoApp, signal, limiteFotos, stampConfig);
        } else if (tipo === 'KMZ') {
          res = await handleExportKML(proy, puntos, conexiones || [], logoApp, null, signal, limiteFotos, stampConfig);
        }

        // Agregar ID único y timestamp y TIPO CORRECTO
        const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const nuevosResultados = res.map(r => ({
          ...r,
          type: tipo, // Forzar el tipo para que coincida con el filtro de la UI
          proyectoId: proy.id,
          id: Date.now() + Math.random(),
          timestamp: new Date()
        }));

        // Generar lista de resultados
        // const nuevosResultados = [
        //   { type: tipo, nombre: `Reporte_${tipo}_${proy.nombre.replace(/\s+/g, '_')}_${fecha}.zip`, fecha, blob: null /* Aquí iría el blob real si lo tuviéramos a mano */ }
        // ];

        // Hack para simular archivo real en lista (ya que exporters devuelve blob pero aqui simplificamos)
        // En realidad exporters debería devolver metadatos. Asumimos éxito.

        console.log("Exportación finalizada. Actualizando resultados...");
        // FORZAR ACTUALIZACIÓN DE ESTADO
        setResultadosExportacion(prev => {
          const updated = [...prev, ...nuevosResultados];
          console.log("Nuevos resultados:", updated);
          return updated;
        });

        // IMPORTANTE: Limpiar estado de carga AL FINAL
        setTimeout(() => {
          setExportandoTipo(null);
          setModalOpen('EXPORTAR_HUB'); // Asegurar que el modal siga abierto y renderice
        }, 500);

      } catch (error) {
        if (error.message === "EXPORT_CANCELLED") {
          console.log("Exportación cancelada limpiamente.");
        } else {
          console.error("Error exportando:", error);
          setAlertData({ title: "Error", message: "Hubo un problema al generar los archivos." });
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setExportandoTipo(null);
          abortControllerRef.current = null;
        }
      }
    };

    // Validación de LOGO
    if (!logoApp) {
      setConfirmData({
        title: "Logo no detectado",
        message: "¿Deseas generar el reporte sin logo o cargarlo ahora?",
        actionText: "CARGAR LOGO",
        onConfirm: () => {
          setConfirmData(null);
          logoOriginalRef.current = null;
          setLogoTemporal(null);
          setModalLocalOpen('LOGO_MANAGER');
        },
        onCancel: () => {
          setConfirmData(null);
          iniciarExportacion(); // Continuar sin logo
        },
        cancelText: "CONTINUAR SIN LOGO"
      });
      return;
    }

    iniciarExportacion();
  };


  // Inicializar modal con modalPendiente para evitar parpadeo
  const [modalLocalOpen, setModalLocalOpen] = React.useState(() => {
    if (modalPendiente) {
      setTimeout(() => setModalPendiente(null), 0);
      return modalPendiente;
    }
    return null;
  });

  const inputLogoRef = React.useRef(null);
  const [logoTemporal, setLogoTemporal] = React.useState(null);
  const logoOriginalRef = React.useRef(null);
  const [filtroPunto, setFiltroPunto] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState({ field: null, dir: 'asc' });
  const [quitandoEspacios, setQuitandoEspacios] = React.useState(false);
  const [detectandoMini, setDetectandoMini] = React.useState(false);
  // Acordeón de la lista de proyectos: SOLO un proyecto desglosado a la vez.
  // Independiente del proyecto activo (EDITANDO = proyectoActual).
  const [desglosadoId, setDesglosadoId] = React.useState(null);

  // SALIR de un proyecto compartido (editor): solo se desvincula de tu lista, no borra nada.
  const salirDeProyecto = (proy) => {
    setConfirmData({
      title: 'Salir del proyecto',
      message: `Dejarás de ver "${proy.nombre}" en tu lista. No se borra nada del proyecto.`,
      actionText: 'SALIR', theme,
      onConfirm: async () => {
        setConfirmData(null);
        try {
          const { doc: dref, updateDoc: upd, arrayRemove: aRem, deleteField: dfield } = await import('firebase/firestore');
          await upd(dref(db, 'proyectos', String(proy.id)), {
            compartidoCon: aRem(user.uid),
            [`permisos.${user.uid}`]: dfield(),
            enListaDe: aRem(user.uid),
          });
        } catch (e) { console.error('Salir del proyecto:', e); setAlertData?.({ title: 'Error', message: 'No se pudo salir del proyecto.' }); }
      },
    });
  };

  // Proyecto DEL MODAL abierto (los modales locales llevan el id al final: LISTA_PUNTOS_x,
  // FOTOS_x, EQUIPO_x, PAPELERA_x…). Como el desglose es independiente del proyecto activo,
  // los modales NO pueden asumir proyectoActual: resuelven su proyecto por el id del modal.
  const proyModal = React.useMemo(() => {
    if (!modalLocalOpen) return proyectoActual;
    const id = String(modalLocalOpen).split('_').pop();
    return proyectos.find(p => String(p.id) === id) || proyectoActual;
  }, [modalLocalOpen, proyectos, proyectoActual]);

  // ── FASE 4: verificación de fotos por proyecto ──────────────────────────
  const [busquedaAbierta, setBusquedaAbierta] = React.useState(false); // buscador colapsado a botón
  const [modoVerif, setModoVerif] = React.useState(false);        // toggle: chips en vez de botones
  const [verifData, setVerifData] = React.useState(null);          // resultado (doc verificacionesFotos)
  const [verificando, setVerificando] = React.useState(false);
  const [reparando, setReparando] = React.useState(false);
  const [progVerif, setProgVerif] = React.useState({ d: 0, t: 0 });
  const [expandVerifId, setExpandVerifId] = React.useState(null);  // punto expandido (secciones)

  const esPropietario = proyModal && user && proyModal.ownerId === user.uid;

  const correrAnalisis = async () => {
    if (verificando || reparando || !proyModal) return;
    setVerificando(true);
    setProgVerif({ d: 0, t: 0 });
    try {
      const ids = puntos.filter(p => perteneceAProyecto(p, proyModal)).map(p => String(p.id));
      const { ejecutarVerificacion } = await import('../utils/verificacionFotos');
      const r = await ejecutarVerificacion({
        proyectoId: proyModal.id, puntoIds: ids, uid: user?.uid,
        nombreUsuario: config?.nombrePersonal || user?.displayName || user?.email?.split('@')[0] || 'Usuario',
        onProgreso: (d, t) => setProgVerif({ d, t }),
      });
      setVerifData(r);
    } catch (e) {
      console.error('verificación:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo verificar las fotos. Revisa tu conexión.' });
    } finally {
      setVerificando(false);
    }
  };

  const toggleVerificacion = async () => {
    if (verificando || reparando) return;
    if (modoVerif) { setModoVerif(false); setExpandVerifId(null); return; }
    setModoVerif(true);
    const { cargarVerificacion } = await import('../utils/verificacionFotos');
    const previo = await cargarVerificacion(proyModal.id);
    if (previo) { setVerifData(previo); return; }
    // Sin análisis previo: lo corre el propietario (tiene los blobs del equipo)
    if (esPropietario) await correrAnalisis();
    else setAlertData?.({ title: 'Sin análisis', message: 'Este proyecto aún no tiene verificación de fotos. La debe correr el propietario (sus fotos locales están en su equipo).' });
  };

  const problemasVerif = React.useMemo(() => {
    if (!verifData?.puntos) return 0;
    return Object.values(verifData.puntos).reduce((acc, p) => acc + (p.total - p.nube), 0);
  }, [verifData]);

  const correrReparacion = async () => {
    if (reparando || verificando || !verifData || !proyModal) return;
    setReparando(true);
    setProgVerif({ d: 0, t: 0 });
    try {
      const { repararFotosProyecto } = await import('../utils/verificacionFotos');
      const r = await repararFotosProyecto({
        proyectoId: proyModal.id, resultado: verifData,
        onProgreso: (d, t, fase) => setProgVerif({ d, t, fase }),
      });
      setAlertData?.({ title: 'Reparación de fotos', message: `• ${r.subidasEquipo} subida(s) desde este equipo\n• ${r.restauradasServidor} restaurada(s) desde el respaldo\n• ${r.respaldadas} respaldo(s) nuevo(s) creado(s)\n• ${r.sinFuente} sin fuente disponible\n\nActualizando datos…` });
      await correrAnalisis(); // re-verificar para refrescar los números
    } catch (e) {
      console.error('reparación:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo reparar. Revisa tu conexión.' });
    } finally {
      setReparando(false);
    }
  };
  const [ordenAbierto, setOrdenAbierto] = React.useState(false);
  const [configAbierto, setConfigAbierto] = React.useState(false);
  const [editarPosicion, setEditarPosicion] = React.useState(false);
  const [ordenEdit, setOrdenEdit] = React.useState([]);       // array de ids en orden de edición
  const [ubicarDespues, setUbicarDespues] = React.useState(null); // id del punto a reubicar
  const [guardandoOrden, setGuardandoOrden] = React.useState(false);

  // Reset del modo edición al cerrar/cambiar el modal de la lista de puntos
  React.useEffect(() => {
    setEditarPosicion(false); setOrdenEdit([]); setUbicarDespues(null); setConfigAbierto(false); setOrdenAbierto(false);
  }, [modalLocalOpen]);

  // Marcar como leído al abrir la pantalla de Equipo (incluye la bitácora)
  React.useEffect(() => {
    if (modalLocalOpen?.startsWith('EQUIPO_') && proyModal && marcarChatLeido) {
      marcarChatLeido(proyModal.id);
    }
  }, [modalLocalOpen, proyModal?.id, marcarChatLeido]);

  // Cargar conteo de fotos del proyecto activo para mostrar badge
  React.useEffect(() => {
    if (!proyectoActual?.id) return;
    const proyId = proyectoActual.id;
    // Solo cargar si no tenemos el conteo aún
    if (fotosCountMap[proyId] !== undefined) return;
    getDocs(collection(db, 'proyectos', proyId, 'fotosProyecto'))
      .then(snap => setFotosCountMap(prev => ({ ...prev, [proyId]: snap.size })))
      .catch(() => {});
  }, [proyectoActual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Función para calcular Info Poste (X/5)
  const calcularInfoPoste = (datos) => {
    let count = 0;
    if (datos.altura) count++;
    if (datos.fuerza) count++;
    if (datos.material) count++;
    if (datos.tipo) count++;
    if (datos.cables) count++;
    return count;
  };

  // Función para contar fotos principales (X/14)
  const contarFotosPrincipales = (fotos) => {
    if (!fotos || typeof fotos !== 'object') return 0;

    let count = 0;
    const secciones = ['poste', 'acometida', 'medidor'];
    const fotosPorSeccion = {
      poste: 5,      // principal + 4 extras
      acometida: 5,  // principal + 4 extras
      medidor: 4     // principal + 3 extras
    };

    secciones.forEach(seccion => {
      if (fotos[seccion]) {
        if (fotos[seccion].principal) count++;
        for (let i = 1; i <= (fotosPorSeccion[seccion] - 1); i++) {
          if (fotos[seccion][`extra${i}`]) count++;
        }
      }
    });

    return count;
  };

  const toggleSort = (field) => {
    setConfigAbierto(false); // cerrar el menú al ordenar
    setSortConfig(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const aplicarSort = (lista) => {
    // Orden por defecto: ordenTendido guardado (posición) y si no, por creación (id)
    const base = [...lista].sort((a, b) => {
      const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return parseInt(a.id) - parseInt(b.id);
    });
    if (!sortConfig.field) return base;
    if (sortConfig.field === 'posicion') return sortConfig.dir === 'asc' ? base : [...base].reverse();
    return base.sort((a, b) => {
      const valA = (sortConfig.field === 'item' ? a.datos?.numero : a.datos?.pasivo) || '';
      const valB = (sortConfig.field === 'item' ? b.datos?.numero : b.datos?.pasivo) || '';
      const cmp = valA.localeCompare(valB, 'es', { numeric: true });
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  };

  // Mapa id → posición por orden de creación (id ascendente), dentro del proyecto
  const posicionMap = React.useMemo(() => {
    const m = {};
    const dias = proyModal?.dias;
    if (!dias) return m;
    const pts = (puntos || []).filter(p => perteneceAProyecto(p, proyModal));
    [...pts].sort((a, b) => parseInt(a.id) - parseInt(b.id)).forEach((p, i) => { m[p.id] = i + 1; });
    return m;
  }, [puntos, proyModal]);

  const quitarEspacios = async (campo) => {
    if (!proyModal || proyModal.esCompartido) return;
    setQuitandoEspacios(campo);
    try {
      const { doc: docRef, updateDoc } = await import('firebase/firestore');
      const { db: fireDb } = await import('../firebaseConfig');
      const dataField = campo === 'item' ? 'datos.numero' : 'datos.pasivo';
      const puntosProyecto = puntos.filter(p => perteneceAProyecto(p, proyModal));
      for (const punto of puntosProyecto) {
        const valorActual = campo === 'item' ? punto.datos?.numero : punto.datos?.pasivo;
        if (valorActual && valorActual.includes(' ')) {
          const sinEspacios = valorActual.replace(/\s+/g, '');
          await updateDoc(docRef(fireDb, 'puntos', String(punto.id)), { [dataField]: sinEspacios });
        }
      }
    } catch (e) {
      console.error('Error quitando espacios:', e);
    } finally {
      setQuitandoEspacios(false);
    }
  };

  // ── Editar posición (orden de tendido) ──────────────────────────────────
  const extractNum = (item) => { const m = String(item || '').match(/\d+/); return m ? parseInt(m[0], 10) : NaN; };
  const puntosDelProyecto = () => (puntos || []).filter(p => perteneceAProyecto(p, proyModal));

  const iniciarEdicionPosicion = () => {
    const ordenados = [...puntosDelProyecto()].sort((a, b) => {
      const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return parseInt(a.id) - parseInt(b.id);
    });
    setOrdenEdit(ordenados.map(p => p.id));
    setEditarPosicion(true);
    setConfigAbierto(false);
  };

  const posicionarPorItem = () => {
    const ordenados = [...puntosDelProyecto()].sort((a, b) => {
      const na = extractNum(a.datos?.numero), nb = extractNum(b.datos?.numero);
      if (isNaN(na) && isNaN(nb)) return 0;
      if (isNaN(na)) return 1;
      if (isNaN(nb)) return -1;
      return na - nb;
    });
    setOrdenEdit(ordenados.map(p => p.id));
  };

  const moverDespuesDe = (idMover, idDestino) => {
    setOrdenEdit(prev => {
      const arr = prev.filter(id => String(id) !== String(idMover));
      if (idDestino === '__INICIO__') { arr.unshift(idMover); return arr; }
      const idx = arr.findIndex(id => String(id) === String(idDestino));
      if (idx === -1) return prev;
      arr.splice(idx + 1, 0, idMover);
      return arr;
    });
    setUbicarDespues(null);
  };

  const guardarOrden = async () => {
    if (guardandoOrden) return;
    setGuardandoOrden(true);
    try {
      const { doc: docRef, updateDoc } = await import('firebase/firestore');
      const { db: fireDb } = await import('../firebaseConfig');
      for (let i = 0; i < ordenEdit.length; i++) {
        await updateDoc(docRef(fireDb, 'puntos', String(ordenEdit[i])), { 'datos.ordenTendido': i + 1 });
      }
      setEditarPosicion(false);
      setOrdenEdit([]);
      setAlertData?.({ title: 'Orden guardado', message: 'Las posiciones se guardaron correctamente.' });
    } catch (e) {
      console.error('Error guardando orden:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo guardar el orden.' });
    } finally {
      setGuardandoOrden(false);
    }
  };

  const copiarCodigo = (codigo) => {
    navigator.clipboard.writeText(codigo);
    setCodigoCopiado(true);
    setTimeout(() => setCodigoCopiado(false), 2000);
  };

  const handleCrearProyecto = async () => {
    if (creandoProyecto) return;
    setCreandoProyecto(true);
    try { await confirmarCrearProyecto(); }
    finally { setCreandoProyecto(false); }
  };

  const handleCrearDia = async () => {
    if (creandoDia) return;
    setCreandoDia(true);
    try { await confirmarCrearDia(); }
    finally { setCreandoDia(false); }
  };

  const guardarNombreProyecto = async (proyId, nuevoNombre) => {
    const nombre = nuevoNombre.trim();
    setEditandoNombre(null);
    if (!nombre) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      await updateDoc(doc(db, 'proyectos', proyId), { nombre });
    } catch (err) { console.error('Error actualizando nombre:', err); }
  };

  // ── VISTA ARCHIVADOR: proyectos archivados (solo ver y desarchivar) ──────────
  if (verArchivados) {
    return (
      <div className={`flex-1 ${theme.bg} flex flex-col overflow-hidden`}>
        <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0`}>
          <button onClick={() => setVerArchivados(false)}>
            <ChevronDown className={`rotate-90 ${theme.text}`} size={28} />
          </button>
          <span className={`font-black ${theme.text} text-lg uppercase`}>ARCHIVADOR</span>
          <div className="w-7" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className={`text-[11px] ${theme.textSec} text-center pb-1`}>
            Los proyectos archivados no salen en tu lista ni en el mapa. Nada se borró: al desarchivar vuelven completos (como proyecto personal).
          </p>
          {proyectosArchivados.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-16 ${theme.textSec}`}>
              <Archive size={56} className="mb-3 opacity-30" />
              <p className="font-bold text-sm">No hay proyectos archivados</p>
            </div>
          ) : proyectosArchivados.map(proy => {
            const totalPuntosProy = puntos.filter(p => perteneceAProyecto(p, proy)).length;
            const abrevTipo = proy.tipo === 'liquidacion' ? 'PRECO' : proy.tipo === 'desbMecanica' ? 'MECA' : proy.tipo === 'balanceada' ? 'BALAN' : proy.tipo === 'instalacionPostes' ? 'INSTA' : 'LEV';
            return (
              <div key={proy.id} className={`relative rounded-xl border-2 ${isDark ? `${theme.border} ${theme.card}` : 'border-slate-900 bg-slate-100'} shadow-sm`}>
                <div className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-black text-base uppercase leading-tight truncate ${theme.text}`}>{proy.nombre}</h3>
                    <p className={`text-[11px] font-bold ${theme.textSec} mt-0.5 truncate`}>
                      {totalPuntosProy} pts · {abrevTipo}
                    </p>
                  </div>
                  {/* Ojo y lápiz DESACTIVADOS mientras esté archivado */}
                  <span className="w-10 h-10 rounded-lg border-2 border-slate-300 bg-slate-100 flex items-center justify-center opacity-40" title="No disponible: proyecto archivado">
                    <EyeOff size={16} className="text-slate-400" strokeWidth={2} />
                  </span>
                  <span className="w-10 h-10 rounded-lg border-2 border-slate-300 bg-slate-100 flex items-center justify-center opacity-40" title="No disponible: proyecto archivado">
                    <Edit size={16} className="text-slate-400" strokeWidth={2} />
                  </span>
                  <button
                    onClick={() => setConfirmData?.({
                      title: '¿Desarchivar proyecto?',
                      message: `"${proy.nombre}" volverá a tu lista de proyectos y sus puntos se verán de nuevo en el mapa.`,
                      actionText: 'DESARCHIVAR',
                      theme,
                      onConfirm: () => { setConfirmData(null); onDesarchivarProyecto?.(proy); },
                    })}
                    className="shrink-0 h-10 px-3 rounded-lg bg-green-600 border-2 border-green-800 text-white text-[11px] font-black tracking-widest active:scale-95 transition-all"
                  >
                    DESARCHIVAR
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 ${theme.bg} flex flex-col overflow-hidden`}>

      {/* Si hay modalPendiente, no renderizar el contenido normal - solo el modal al final */}
      {modalPendiente ? null : proyectos.length === 0 ? (
        <div className={`flex flex-col items-center justify-center h-full ${theme.textSec} p-4`}>
          <Folder size={64} className="mb-4 opacity-30" />
          <p className="mb-4 font-bold">No hay proyectos creados</p>
          <button onClick={() => { setTempData({ tipo: 'levantamiento', modoFotos: 'comprimido' }); setModalOpen('CREAR_PROYECTO'); }} className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"><Plus size={20} /> CREAR PRIMER PROYECTO</button>
        </div>
      ) : (
        <>
          <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0 z-20`}>
            <button onClick={onVolver}>
              <ChevronDown className={`rotate-90 ${theme.text}`} size={28} />
            </button>
            <span className={`font-black ${theme.text} text-lg uppercase`}>PROYECTOS</span>
            <button
              onClick={() => setVerArchivados(true)}
              title="Proyectos archivados"
              className={`relative w-10 h-10 rounded-lg border-2 ${theme.border} flex items-center justify-center active:scale-95 transition-all`}
            >
              <Archive size={18} className={theme.text} strokeWidth={2} />
              {proyectosArchivados.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white border-2 border-white">
                  {proyectosArchivados.length > 9 ? '9+' : proyectosArchivados.length}
                </span>
              )}
            </button>
          </div>

          <div className={`${theme.header} shrink-0 p-2 z-10 shadow-sm`}>
            <button
              onClick={() => { setTempData({ tipo: 'levantamiento', modoFotos: 'comprimido' }); setModalOpen('CREAR_PROYECTO'); }}
              className={`w-full py-3 border-2 border-dashed ${theme.border} ${theme.card} rounded-xl ${theme.text} font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:border-brand-500 hover:text-brand-500 transition-colors active:scale-95`}
            >
              <Plus size={18} /> CREAR NUEVO PROYECTO
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {[...proyectos].sort((x, y) => (parseInt(y.id) || 0) - (parseInt(x.id) || 0)).map(proy => {
              const esActivo = proyectoActual?.id === proy.id;   // EDITANDO (proyecto activo)
              const esCompartido = !!proy.esCompartido;          // proyecto donde soy editor/supervisor
              const esGrupo = !!proy.grupoId;                    // proyecto compartido en un equipo
              const desglosado = desglosadoId === proy.id;       // acordeón: uno a la vez
              const notifCount = notificacionesProyectos[proy.id] || 0;
              const idsDias = proy.dias?.map(d => d.id) || [];
              const algunoVisible = idsDias.some(id => diasVisibles.includes(id));
              const totalPuntosProy = puntos.filter(p => perteneceAProyecto(p, proy)).length;
              // Tipo abreviado: LEV/LIQ/INSTA + COMP/ALTA
              const abrevTipo = proy.tipo === 'liquidacion' ? 'PRECO' : proy.tipo === 'desbMecanica' ? 'MECA' : proy.tipo === 'balanceada' ? 'BALAN' : proy.tipo === 'instalacionPostes' ? 'INSTA' : 'LEV';
              const abrev = `${abrevTipo}-${proy.modoFotos === 'altaCalidad' ? 'ALTA' : 'COMP'}`;
              // EDITANDO pinta TODA la tarjeta de negro; compartido mantiene su borde naranja
              const activoNaranja = esActivo && (esCompartido || esGrupo); // EDITANDO un compartido → tarjeta naranja
              const bordeActivo = activoNaranja ? 'border-slate-900' : 'border-white';
              // Naranja activo: botones fondo naranja (transparente sobre la tarjeta) con borde e íconos negros
              const btnActivo = activoNaranja ? 'border-2 border-slate-900 bg-transparent' : 'border border-white bg-[#262626]';
              const iconActivo = activoNaranja ? 'text-slate-900' : 'text-white';
              const cardCls = esActivo
                ? (activoNaranja ? 'bg-[#FCBF26] border-slate-900' : 'bg-[#262626] border-[#262626]')
                : (esCompartido || esGrupo)
                  ? 'border-[#FCBF26] bg-[#FCBF26]/10'
                  : isDark ? `${theme.border} ${theme.card}` : 'border-slate-900 bg-slate-100';
              const txtCls = esActivo ? (activoNaranja ? 'text-slate-900' : 'text-white') : theme.text;
              const subCls = esActivo ? (activoNaranja ? 'text-slate-800' : 'text-slate-300') : theme.textSec;

              return (
                <div key={proy.id} className={`relative rounded-xl border-2 ${cardCls} shadow-sm transition-colors`}>

                  {/* FILA PRINCIPAL: nombre + pts (izq) · ojo · EDITAR · desglose (der) */}
                  <div className="p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      {(!esCompartido && desglosado && editandoNombre?.proyId === proy.id) ? (
                        <input
                          autoFocus
                          value={editandoNombre.valor}
                          onChange={e => setEditandoNombre({ ...editandoNombre, valor: e.target.value })}
                          onBlur={() => guardarNombreProyecto(proy.id, editandoNombre.valor)}
                          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditandoNombre(null); }}
                          className={`font-black text-base uppercase leading-none w-full bg-transparent border-b-2 border-brand-500 outline-none ${txtCls}`}
                        />
                      ) : (
                        <h3
                          className={`font-black text-base uppercase leading-tight truncate ${txtCls} ${desglosado && !esCompartido ? 'cursor-pointer active:opacity-60' : ''}`}
                          onClick={() => { if (desglosado && !esCompartido) setEditandoNombre({ proyId: proy.id, valor: proy.nombre }); }}
                        >
                          {proy.nombre}
                        </h3>
                      )}
                      <p className={`text-[11px] font-bold ${subCls} mt-0.5 truncate`}>
                        {totalPuntosProy} pts · {abrev}
                      </p>
                      {(esGrupo || esCompartido) && (
                        <p className={`text-[10px] font-bold ${subCls} truncate`}>
                          {esCompartido ? `Proyecto de: ${proy.ownerNombre || '—'}` : 'Compartido en equipo'}
                        </p>
                      )}
                    </div>

                    {/* 3 botones juntos: ojo · editar (lápiz) · desglose — negros con borde blanco */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Ojo — visibilidad LOCAL (solo cambia tu vista) */}
                      <button
                        onClick={(e) => toggleVisibilidadProyecto(e, proy)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-90 transition-all shadow-sm ${esActivo ? `${btnActivo}` : 'border-2 border-slate-900 bg-transparent'}`}
                        title={algunoVisible ? 'Apagar puntos en el mapa' : 'Prender puntos en el mapa'}
                      >
                        {algunoVisible
                          ? <Eye size={16} className={esActivo ? iconActivo : theme.text} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                          : <EyeOff size={16} className={esActivo ? (activoNaranja ? 'text-slate-900/40' : 'text-white/40') : 'text-slate-400'} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                        }
                      </button>

                      {/* Editar (lápiz) → VERDE cuando es el proyecto activo (EDITANDO) */}
                      <button
                        onClick={() => { if (!esActivo) seleccionarProyecto(proy); }}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-95 transition-all shadow-sm ${esActivo ? `${activoNaranja ? "border-2" : "border"} bg-green-600 ${bordeActivo}` : 'border-2 border-slate-900 bg-transparent'}`}
                        title={esActivo ? 'Editando' : 'Editar'}
                      >
                        <Edit size={16} className={esActivo ? 'text-white' : theme.text} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                      </button>

                      {/* Desglose (acordeón) */}
                      <button
                        onClick={() => setDesglosadoId(prev => (prev === proy.id ? null : proy.id))}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-95 transition-all shadow-sm ${esActivo ? `${btnActivo}` : 'border-2 border-slate-900 bg-transparent'}`}
                        title="Ver opciones"
                      >
                        <ChevronDown size={18} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} className={`${esActivo ? iconActivo : theme.text} transition-transform duration-200 ${desglosado ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Badge de mensajes (solo comprimido; desglosado ya lo muestra el botón de bitácora) */}
                  {!desglosado && notifCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white border-2 border-white shadow-sm px-1">
                      <MessageCircle size={10} className="mr-0.5" />{notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}

                  {desglosado && (<>
                  {/* Divisoria */}
                  <div className="px-4">
                    <div className={`border-t ${esActivo ? (activoNaranja ? 'border-black/40' : 'border-white/30') : 'border-black'}`}></div>
                  </div>

                  {/* Fila secundaria: cámara (izq) · LISTA DE PUNTOS (centro) · GPS (der) */}
                  <div className="px-3 pt-2 flex items-center gap-2">
                    {/* CÁMARA DE PROYECTO: botón oculto a pedido (jul 2026). La herramienta
                        FotosProyecto y su modal FOTOS_ siguen intactos para reactivarla.
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setModalLocalOpen(`FOTOS_${proy.id}`); }}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-95 transition-all ${esActivo ? `${btnActivo}` : `border-2 ${theme.border} bg-transparent`}`}
                        title="Fotos del proyecto"
                      >
                        <Camera size={20} className={esActivo ? iconActivo : theme.text} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                      </button>
                      {(fotosCountMap[proy.id] || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white border border-white">
                          {(fotosCountMap[proy.id] || 0) > 9 ? '9+' : (fotosCountMap[proy.id] || 0)}
                        </span>
                      )}
                    </div>
                    */}
                    {/* ARCHIVAR: sale de la lista y del mapa (y del equipo). Nada se borra. */}
                    {!esCompartido && onArchivarProyecto && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmData?.({
                            title: '¿Archivar proyecto?',
                            message: `"${proy.nombre}" saldrá de tu lista y sus puntos dejarán de verse en el mapa. No se borra nada: puedes recuperarlo desde el archivador.${proy.grupoId ? '\n\nOJO: también saldrá del equipo y al desarchivarlo quedará como proyecto personal.' : ''}`,
                            actionText: 'ARCHIVAR',
                            theme,
                            onConfirm: () => { setConfirmData(null); onArchivarProyecto(proy); },
                          });
                        }}
                        className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center active:scale-95 transition-all ${esActivo ? `${btnActivo}` : `border-2 ${theme.border} bg-transparent`}`}
                        title="Archivar proyecto"
                      >
                        <Archive size={20} className={esActivo ? iconActivo : theme.text} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setModalLocalOpen(`LISTA_PUNTOS_${proy.id}`); }}
                      className={`flex-1 h-10 rounded-lg text-[11px] font-black tracking-widest active:scale-95 transition-all ${esActivo ? `${btnActivo} ${iconActivo}` : `border-2 ${theme.border} bg-transparent ${theme.text}`}`}
                    >
                      LISTA DE PUNTOS
                    </button>
                    <button
                      onClick={(e) => irUbicacionProyecto(e, proy.id)}
                      className={`shrink-0 w-10 h-10 rounded-lg active:scale-95 transition-all flex items-center justify-center ${esActivo ? `${btnActivo}` : `border-2 ${theme.border} bg-transparent`}`}
                      title="Ver en Mapa"
                    >
                      <MapPin size={16} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} className={esActivo ? iconActivo : theme.text} />
                    </button>
                  </div>

                  {/* FILA UNIFICADA: FOTOS + CHAT + COLABORADORES + FERRETERÍA + REVISIÓN + EXPORTAR + BORRAR */}
                  <div className={`px-3 py-3 rounded-b-xl overflow-x-auto overflow-y-hidden`}>
                    <div className="flex items-center w-full h-10 gap-1 min-w-max">

                      {/* Papelera — pegada a la izquierda (debajo de la cámara) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setModalLocalOpen(`PAPELERA_${proy.id}`); }}
                        className={`shrink-0 p-2 rounded-lg hover:border-red-400 active:scale-95 transition-all w-10 h-10 flex items-center justify-center ${esActivo ? `${btnActivo}` : `border-2 ${theme.border} bg-transparent`}`}
                        title="Papelera del proyecto"
                      >
                        <Recycle size={20} className={esActivo ? iconActivo : theme.text} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                      </button>

                      <div className="h-8 w-[1px] bg-slate-400 mx-1 shrink-0"></div>

                      {/* Botones centrales distribuidos homogéneamente */}
                      <div className="flex items-center justify-evenly flex-1 gap-1">
                        {/* Equipo (colaboradores + bitácora) — badge: solicitudes + mensajes */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setModalLocalOpen(`EQUIPO_${proy.id}`); }}
                          className={`relative p-2 rounded-lg hover:border-green-500 active:scale-95 transition-all w-10 h-10 flex items-center justify-center ${esActivo ? `${btnActivo}` : `border-2 ${theme.border} bg-transparent`}`}
                          title="Equipo del proyecto"
                        >
                          <Users size={20} className={esActivo ? iconActivo : theme.text} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                          {(notifCount) > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white border border-white">
                              {(notifCount) > 9 ? '9+' : (notifCount)}
                            </span>
                          )}
                        </button>
                        {/* Control de ferretería — comparativo del proyecto */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setModalLocalOpen(`COMPARATIVO_${proy.id}`); }}
                          className={`p-2 rounded-lg hover:border-amber-500 active:scale-95 transition-all w-10 h-10 flex items-center justify-center ${esActivo ? `${btnActivo}` : `border-2 ${theme.border} bg-transparent`}`}
                          title="Control de ferretería"
                        >
                          <Package size={20} className={esActivo ? iconActivo : theme.text} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                        </button>
                        {/* Revisión — fotos del poste + datos de levantamiento */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setModalLocalOpen(`REVISION_${proy.id}`); }}
                          className={`p-2 rounded-lg hover:border-emerald-500 active:scale-95 transition-all w-10 h-10 flex items-center justify-center ${esActivo ? `${btnActivo}` : `border-2 ${theme.border} bg-transparent`}`}
                          title="Revisión de puntos"
                        >
                          <ClipboardCheck size={20} className={esActivo ? iconActivo : theme.text} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} />
                        </button>
                        {/* Exportar — desactivado para invitados */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExportProyId(proy.id); // exportar ESTE proyecto (no el activo)
                              logoOriginalRef.current = logoApp;
                              setLogoTemporal(logoApp);
                              setModalOpen('EXPORTAR_HUB');
                            }}
                            className={`p-2 rounded-lg transition-all w-10 h-10 flex items-center justify-center ${esActivo ? `${btnActivo} active:scale-95` : `border-2 ${theme.border} bg-transparent hover:border-blue-600 hover:text-blue-600 active:scale-95`}`}
                            title="Compartir / Exportar"
                          >
                            <Share2 size={20} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} className={esActivo ? iconActivo : theme.text} />
                          </button>
                          {exportandoTipo && (
                            <div className="absolute -bottom-2.5 left-0 right-0 h-1.5 bg-slate-200 rounded overflow-hidden border border-slate-300 z-10">
                              <div className="h-full bg-blue-600 animate-progress"></div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="h-8 w-[1px] bg-slate-400 mx-1 shrink-0"></div>

                      {/* Borrar (dueño) / SALIR (editor: solo desvincula) — pegado a la derecha */}
                      {esCompartido ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); salirDeProyecto(proy); }}
                          className={`shrink-0 p-2 rounded-lg transition-all w-10 h-10 flex items-center justify-center active:scale-90 ${esActivo ? 'border-2 border-red-600 bg-transparent' : 'border-2 border-red-600 bg-transparent hover:bg-red-50'}`}
                          title="Salir del proyecto (no borra nada)"
                        >
                          <LogOut size={20} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} className="text-red-600" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); solicitarBorrarProyecto(proy.id); }}
                          disabled={resultadosExportacion.length > 0 && exportandoTipo}
                          className={`shrink-0 p-2 rounded-lg transition-all w-10 h-10 flex items-center justify-center active:scale-90 ${esActivo ? 'border-2 border-red-600 bg-transparent' : 'border-2 border-red-600 bg-transparent hover:bg-red-50'}`}
                        >
                          <Trash2 size={20} strokeWidth={esActivo && !activoNaranja ? 1.5 : 2} className="text-red-600" />
                        </button>
                      )}

                    </div>
                  </div>
                  </>)}

                </div>
              );
            })}
          </div>
        </>
      )}
      {/* MENÚ FLOTANTE DE COLOR (ANTI-OVERFLOW) */}
      {selectorColorAbierto && colorMenuPos && (
        <div className="fixed inset-0 z-[200]" onClick={() => setSelectorColorAbierto(null)}>
          <div
            className={`absolute flex gap-1 p-2 rounded-xl border-2 ${theme.border} ${theme.card} shadow-2xl animate-in zoom-in-95 duration-200`}
            style={{
              top: colorMenuPos.top + 8, // Un poco más abajo
              left: Math.min(colorMenuPos.left, window.innerWidth - 300), // Evitar que se salga por la derecha
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {COLORES_DIA.map(c => (
              <div
                key={c}
                onClick={(e) => {
                  cambiarColorProyecto(e, selectorColorAbierto, c);
                  setSelectorColorAbierto(null);
                }}
                className={`w-8 h-8 rounded-md border-2 cursor-pointer hover:scale-125 transition-transform shadow-sm border-slate-200`}
                style={{ backgroundColor: c }}
              ></div>
            ))}
            <button onClick={() => setSelectorColorAbierto(null)} className="ml-2 bg-slate-100 p-1 rounded hover:bg-red-100 text-slate-500 hover:text-red-600">
              <X size={18} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      {/* MODALES DE CREACIÓN */}
      <Modal isOpen={modalOpen === 'CREAR_PROYECTO'} onClose={() => setModalOpen(null)} title="Nuevo Proyecto" theme={theme}>
        <ThemedInput autoFocus placeholder="Nombre" val={tempData.nombre || ''} onChange={e => setTempData({ ...tempData, nombre: e.target.value })} theme={theme} />
        <div className="flex flex-col gap-2 my-4">
          {(user?.tipoAcceso === 'levantamiento' || perfilActivo === 'basico') ? (
            <button onClick={() => setTempData({ ...tempData, tipo: 'levantamiento' })} className={`w-full py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'levantamiento' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>LEVANTAMIENTO</button>
          ) : (
            <>
              <div className="flex gap-2">
                <button onClick={() => setTempData({ ...tempData, tipo: 'levantamiento' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'levantamiento' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>LEVANTAMIENTO</button>
                <button onClick={() => setTempData({ ...tempData, tipo: 'liquidacion' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'liquidacion' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>DESB. PRECO</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTempData({ ...tempData, tipo: 'desbMecanica' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'desbMecanica' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>DESB. MECÁNICA</button>
                <button onClick={() => setTempData({ ...tempData, tipo: 'balanceada' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'balanceada' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>BALANCEADA</button>
              </div>
              <button onClick={() => setTempData({ ...tempData, tipo: 'instalacionPostes' })} className={`w-full py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'instalacionPostes' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>INSTALACIÓN DE POSTES</button>
            </>
          )}
        </div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Calidad de fotos</p>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTempData({ ...tempData, modoFotos: 'comprimido' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.modoFotos !== 'altaCalidad' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>COMPRIMIR</button>
          {perfilActivo !== 'basico' && user?.calidadFotos !== 'comprimidas' && (
            <button onClick={() => setTempData({ ...tempData, modoFotos: 'altaCalidad' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.modoFotos === 'altaCalidad' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>ALTA CALIDAD</button>
          )}
        </div>
        {!tempData.nombre?.trim() && (
          <p className="text-[10px] text-red-500 font-bold text-center -mt-1 mb-1">Escribe un nombre para el proyecto</p>
        )}
        <button onClick={() => {
          if (!tempData.nombre?.trim() || creandoProyecto) return;
          handleCrearProyecto();
        }} disabled={creandoProyecto} className={`w-full py-3 rounded font-bold border-2 transition-colors ${tempData.nombre?.trim() && !creandoProyecto ? 'bg-brand-600 text-white border-brand-800' : 'bg-slate-200 text-slate-400 border-slate-300'}`}>
          {creandoProyecto ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Creando...</span> : 'CREAR'}
        </button>
      </Modal>


      <Modal isOpen={modalOpen === 'CREAR_DIA'} onClose={() => setModalOpen(null)} title="Nuevo Día" theme={theme}>
        <ThemedInput autoFocus placeholder="Nombre (ej: Lunes 05)" val={tempData.nombre || ''} onChange={e => setTempData({ ...tempData, nombre: e.target.value })} theme={theme} />
        <div className="h-4"></div>
        <button onClick={handleCrearDia} disabled={creandoDia} className={`w-full py-3 rounded font-bold border-2 transition-colors ${creandoDia ? 'bg-slate-200 text-slate-400 border-slate-300' : 'bg-brand-600 text-white border-brand-800'}`}>
          {creandoDia ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Agregando...</span> : 'AGREGAR'}
        </button>
      </Modal>

      {/* PANTALLA COMPLETA DE EXPORTACIÓN */}
      {modalOpen === 'EXPORTAR_HUB' && activeProjectData && (
        <div className={`fixed inset-0 z-[300] flex flex-col ${theme.bg}`}>
          {/* Header */}
          <div className={`${theme.header} px-4 flex items-center justify-between border-b-2 ${theme.border} shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
            <h3 className={`font-black ${theme.text} text-xl uppercase`}>Exportación</h3>
            <button onClick={() => { setModalOpen(null); setExportandoTipo(null); }}>
              <X size={28} className={theme.text} />
            </button>
          </div>
          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <ExportHubContent
              proyecto={activeProjectData}
              puntos={puntos}
              config={config}
              setAlertData={setAlertData}
              exportandoTipo={exportandoTipo}
              handleExportar={handleExportar}
              handleExportarServidor={handleExportarServidor}
              cancelarExportacion={cancelarExportacion}
              resultadosExportacion={resultadosExportacion.filter(r => String(r.proyectoId) === String(activeProjectData.id))}
              setResultadosExportacion={setResultadosExportacion}
              logoApp={logoApp}
              setLogoApp={setLogoApp}
              inputLogoRef={inputLogoRef}
              handleCargarLogo={handleCargarLogo}
              user={user}
              proyectoId={activeProjectData.id}
              perfilActivo={perfilActivo}
            />
          </div>
        </div>
      )}

      {/* MODAL CHAT */}
      {
        modalLocalOpen?.startsWith('FOTOS_') && proyModal && (perfilActivo === 'basico' ? (
          <BloqueoHerramienta
            titulo="Fotos de proyecto"
            concepto="La cámara rápida del proyecto: dispara fotos sueltas en campo y asígnalas después al casillero exacto de cada punto."
            theme={theme} isDark={isDark}
            onClose={() => setModalLocalOpen(null)}
          />
        ) : (
          <FotosProyecto
            proyectoId={proyModal.id}
            proyectoNombre={proyModal.nombre || ''}
            modoFotos={proyModal.modoFotos}
            theme={theme}
            user={user}
            onClose={() => setModalLocalOpen(null)}
            onCountChange={(count) => setFotosCountMap(prev => ({ ...prev, [proyModal.id]: count }))}
          />
        ))
      }

      {/* PANTALLA EQUIPO (unifica colaboradores + bitácora): editores arriba, bitácora desplegada abajo */}
      {
        modalLocalOpen?.startsWith('EQUIPO_') && proyModal && (() => {
          const PERMISOS_INFO = {
            lectura: { label: 'Supervisor', color: 'bg-blue-100 text-blue-700' },
            edicion: { label: 'Editor', color: 'bg-slate-900 text-white' },
            ambos:   { label: 'Sup + Editor', color: 'bg-purple-100 text-purple-700' },
          };
          const colaboradores = proyModal.compartidoCon || [];
          return (
            <div className={`fixed inset-0 z-[300] ${theme.card} flex flex-col`}>

              {/* Header */}
              <div className={`${theme.header} px-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <Users size={20} className="text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-black text-lg ${theme.text} uppercase`}>Equipo</h3>
                    <p className={`text-xs ${theme.textSec} font-medium truncate`}>{proyModal.nombre}</p>
                  </div>
                </div>
                <button onClick={() => setModalLocalOpen(null)} className={`${theme.text} hover:bg-slate-100 p-2 rounded-lg transition-colors`}>
                  <X size={24} />
                </button>
              </div>

              {/* Colaboradores (arriba, compacto) */}
              <div className={`shrink-0 max-h-[38vh] overflow-y-auto px-4 py-3 space-y-2 border-b-2 ${theme.border}`}>
                {colaboradores.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className={`text-xs font-black ${theme.text} uppercase tracking-wider`}>Colaboradores</h4>
                    {colaboradores.map(uid => {
                      const info = proyModal.supervisoresInfo?.[uid];
                      const permiso = proyModal.permisos?.[uid] || 'lectura';
                      const { label, color } = PERMISOS_INFO[permiso] || PERMISOS_INFO.lectura;
                      return (
                        <div key={uid} className={`${theme.card} border-2 ${theme.border} rounded-xl px-3 py-1.5 flex items-center justify-between gap-3`}>
                          <p className={`flex-1 min-w-0 text-sm font-black ${theme.text} truncate`}>{info?.nombre || 'Colaborador'}</p>
                          <span className={`px-2 py-1.5 rounded-lg text-[10px] font-black shrink-0 ${color}`}>{label}</span>
                          {!proyModal.esCompartido && (
                            <button onClick={() => eliminarSupervisor(proyModal.id, uid)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg active:scale-95 transition-all shrink-0" title="Eliminar acceso"><Trash2 size={16} /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-xs ${theme.textSec} text-center py-1`}>Sin colaboradores.</p>
                )}
              </div>

              {/* Bitácora desplegada (abajo) */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <ChatBitacora
                  proyectoId={proyModal.id}
                  user={user}
                  theme={theme}
                  esCompartido={false}
                  config={config}
                />
              </div>
            </div>
          );
        })()
      }

      {/* PAPELERA DEL PROYECTO */}
      {
        modalLocalOpen?.startsWith('PAPELERA_') && proyModal && (
          <div className="fixed inset-0 z-[300]">
            <VistaPapelera
              theme={theme}
              isDark={isDark}
              onVolver={() => setModalLocalOpen(null)}
              user={user}
              puntos={puntos}
              proyectos={proyectos}
              setAlertData={setAlertData}
              proyectoId={String(proyModal.id)}
            />
          </div>
        )
      }

      {/* MODAL LISTA PUNTOS - PANTALLA COMPLETA */}
      {
        modalLocalOpen?.startsWith('LISTA_PUNTOS_') && proyModal && (
          <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2" onClick={() => setModalLocalOpen(null)}>
            <div className={`${theme.card} rounded-2xl w-full h-full shadow-2xl border-2 ${theme.border} overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className={`${theme.header} px-6 pb-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0`} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-lg">
                    <MapPin size={20} className="text-white" />
                  </div>
                  <h3 className={`font-black text-lg ${theme.text} uppercase`}>
                    TOTAL: {puntos.filter(p => perteneceAProyecto(p, proyModal)).length} PUNTOS
                  </h3>
                </div>
                <button
                  onClick={() => setModalLocalOpen(null)}
                  className={`${theme.bg} ${theme.text} p-2 rounded-lg border-2 ${theme.border} hover:bg-red-50 hover:text-red-600 hover:border-red-600 active:scale-95 transition-all`}
                >
                  <X size={24} strokeWidth={2.5} />
                </button>
              </div>

              {/* Contenido */}
              <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">

                {/* Input de búsqueda + engranaje / guardar */}
                <div className="shrink-0 flex gap-2 items-center relative">
                  {busquedaAbierta ? (
                    /* Búsqueda abierta: input a toda la fila + X a la derecha */
                    <>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Buscar por item o elemento pasivo..."
                        value={filtroPunto}
                        onChange={(e) => setFiltroPunto(e.target.value)}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 ${theme.border} ${theme.bg} ${theme.text} font-bold placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors text-base`}
                      />
                      <button
                        onClick={() => { setBusquedaAbierta(false); setFiltroPunto(''); }}
                        className={`shrink-0 p-3 rounded-lg border-2 ${theme.border} ${theme.text} active:scale-95 transition-all`}
                        title="Cerrar búsqueda"
                      >
                        <X size={20} />
                      </button>
                    </>
                  ) : (
                    /* Fila de botones (der→izq: engranaje, llave, escudo, buscar) */
                    <>
                      <button
                        onClick={() => setBusquedaAbierta(true)}
                        className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center active:scale-95 transition-all ${filtroPunto ? 'border-blue-600 text-blue-600' : `${theme.border} ${theme.text}`}`}
                        title="Buscar"
                      >
                        <Search size={20} />
                      </button>
                      {/* Verificar fotos (toggle): reemplaza los botones por el estado nube/equipo/respaldo/caídas */}
                      <button
                        onClick={toggleVerificacion}
                        disabled={verificando || reparando}
                        className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 ${modoVerif ? 'border-blue-600 bg-blue-600 text-white' : `${theme.border} ${theme.text}`}`}
                        title="Verificar fotos"
                      >
                        {verificando ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                      </button>
                      {/* Reparar (activo tras verificar, si hay problemas) */}
                      <button
                        onClick={correrReparacion}
                        disabled={!modoVerif || !verifData || verificando || reparando || problemasVerif === 0}
                        className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 ${modoVerif && verifData && problemasVerif > 0 && !verificando && !reparando ? 'border-amber-500 bg-amber-500 text-black' : `${theme.border} ${theme.text}`}`}
                        title="Reparar fotos (subir a la nube desde equipo/respaldo)"
                      >
                        {reparando ? <Loader2 size={20} className="animate-spin" /> : <Wrench size={20} />}
                      </button>
                      {editarPosicion ? (
                        <button
                          onClick={guardarOrden}
                          disabled={guardandoOrden}
                          className="flex-1 p-3 rounded-lg border-2 border-green-600 bg-green-600 text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
                          title="Guardar orden"
                        >
                          {guardandoOrden ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfigAbierto(v => !v)}
                          className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center active:scale-95 transition-all ${configAbierto ? 'border-slate-900 bg-slate-900 text-white' : `${theme.border} ${theme.text}`}`}
                          title="Configuración"
                        >
                          <Settings size={20} />
                        </button>
                      )}
                    </>
                  )}

                  {/* Menú flotante de configuración */}
                  {configAbierto && !editarPosicion && (
                    <div className={`absolute right-0 top-full mt-1 z-30 w-64 ${theme.card} border-2 ${theme.border} rounded-xl shadow-2xl p-1.5 space-y-1`}>
                      <button
                        onClick={() => toggleSort('item')}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black active:scale-95 transition-all ${sortConfig.field === 'item' ? 'bg-slate-900 text-white' : `${theme.text} hover:bg-slate-500/10`}`}
                      >
                        <ArrowUpDown size={16} /> Ordenar por ITEM {sortConfig.field === 'item' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                      <button
                        onClick={() => toggleSort('pasivo')}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black active:scale-95 transition-all ${sortConfig.field === 'pasivo' ? 'bg-slate-900 text-white' : `${theme.text} hover:bg-slate-500/10`}`}
                      >
                        <ArrowUpDown size={16} /> Ordenar por PASIVO {sortConfig.field === 'pasivo' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                      <button
                        onClick={() => toggleSort('posicion')}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black active:scale-95 transition-all ${sortConfig.field === 'posicion' ? 'bg-slate-900 text-white' : `${theme.text} hover:bg-slate-500/10`}`}
                      >
                        <ListOrdered size={16} /> Ordenar por POSICIÓN {sortConfig.field === 'posicion' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                      <button
                        onClick={() => { setConfigAbierto(false); setModalLocalOpen(null); onIniciarOrdenar?.(proyModal); }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black ${theme.text} hover:bg-slate-500/10 active:scale-95 transition-all`}
                      >
                        <ListOrdered size={16} /> Editar posición
                      </button>
                      {!proyModal?.esCompartido && onIniciarMoverPuntos && (
                        <button
                          onClick={() => { setConfigAbierto(false); setModalLocalOpen(null); onIniciarMoverPuntos(proyModal); }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black ${theme.text} hover:bg-slate-500/10 active:scale-95 transition-all`}
                        >
                          <FolderInput size={16} /> Mover puntos a otro proyecto
                        </button>
                      )}
                      {!proyModal.esCompartido && (
                        <>
                          <div className={`h-px my-1 ${theme.border}`} />
                          <button
                            onClick={() => setConfirmData({ title: 'QUITAR ESPACIOS - ITEM', message: 'Se quitarán todos los espacios del campo ITEM en todos los puntos del proyecto.', actionText: 'CONFIRMAR', theme, onConfirm: () => { setConfirmData(null); quitarEspacios('item'); } })}
                            disabled={!!quitandoEspacios}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-black ${theme.text} hover:bg-slate-500/10 active:scale-95 disabled:opacity-40 transition-all`}
                          >
                            {quitandoEspacios === 'item' ? 'Quitando…' : 'Quitar espacios de ITEM'}
                          </button>
                          <button
                            onClick={() => setConfirmData({ title: 'QUITAR ESPACIOS - PASIVO', message: 'Se quitarán todos los espacios del campo PASIVO en todos los puntos del proyecto.', actionText: 'CONFIRMAR', theme, onConfirm: () => { setConfirmData(null); quitarEspacios('pasivo'); } })}
                            disabled={!!quitandoEspacios}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-black ${theme.text} hover:bg-slate-500/10 active:scale-95 disabled:opacity-40 transition-all`}
                          >
                            {quitandoEspacios === 'pasivo' ? 'Quitando…' : 'Quitar espacios de PASIVO'}
                          </button>
                        </>
                      )}
                      <div className={`h-px my-1 ${theme.border}`} />
                      <button
                        disabled={detectandoMini}
                        onClick={async () => {
                          if (detectandoMini) return;
                          setDetectandoMini(true);
                          try {
                            const { clasificarFotosProyecto } = await import('../services/exportacionService');
                            const data = await clasificarFotosProyecto(proyModal.id);
                            const minis = data?.minis || [];
                            const porPunto = {};
                            minis.forEach(m => { (porPunto[m.puntoId] = porPunto[m.puntoId] || []).push(`${m.section}/${m.item}`); });
                            localStorage.setItem('kipo_fotos_mini', JSON.stringify(porPunto));
                            window.dispatchEvent(new CustomEvent('kipo-fotos-mini-actualizado'));
                            const nP = Object.keys(porPunto).length;
                            setConfigAbierto(false);
                            setAlertData?.({ title: 'Análisis de fotos', message: minis.length === 0 ? 'No se encontraron fotos en miniatura. 🎉' : `${minis.length} foto(s) en miniatura en ${nP} punto(s).\n\nSe marcaron en ROJO. Abrí el punto → tocá la foto marcada → RETOMAR.` });
                          } catch (e) {
                            setAlertData?.({ title: 'Error', message: 'No se pudo analizar. Reintentá.' });
                          } finally {
                            setDetectandoMini(false);
                          }
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-black text-red-600 hover:bg-red-500/10 active:scale-95 disabled:opacity-40 transition-all"
                      >
                        {detectandoMini ? 'Analizando fotos…' : '🔍 Detectar fotos en miniatura'}
                      </button>
                      {/* OCULTO (a pedido): limpieza de una sola vez para puntos viejos.
                          Para reactivar, cambiar `false &&` por `onRepararPuntos &&`. */}
                      {false && onRepararPuntos && (
                        <button
                          onClick={() => { setConfigAbierto(false); onRepararPuntos(); }}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-black text-blue-600 hover:bg-blue-500/10 active:scale-95 transition-all"
                        >
                          🔧 Reparar puntos viejos (permisos/días)
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Barra de progreso REAL (verificación / reparación) */}
                {(verificando || reparando) && (
                  <div className="shrink-0">
                    <div className={`flex justify-between text-[10px] font-bold ${theme.textSec} mb-0.5`}>
                      <span>
                        {reparando
                          ? (progVerif.fase === 'servidor' ? 'Reparando en el servidor — puedes salir de la app' : 'Subiendo fotos de este equipo…')
                          : 'Verificando fotos…'}
                      </span>
                      {progVerif.t > 0 && <span>{progVerif.d}/{progVerif.t}</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-300/50 overflow-hidden">
                      {progVerif.t > 0 ? (
                        <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.round((progVerif.d / progVerif.t) * 100)}%` }} />
                      ) : (
                        <div className="h-full w-1/3 bg-blue-600 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>
                )}

                {/* Banner del modo verificación + leyenda de íconos */}
                {modoVerif && verifData && !verificando && (
                  <div className={`shrink-0 px-3 py-2 rounded-lg border ${theme.border} ${theme.bg} space-y-1.5`}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-blue-600 shrink-0" />
                      <p className={`flex-1 text-[10px] ${theme.textSec} leading-tight`}>
                        Último análisis: <b>{new Date(verifData.fecha).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</b>
                        {verifData.equipoDe ? <> · Las fotos "en equipo" están en el dispositivo de <b>{verifData.equipoDe}</b></> : null}
                      </p>
                      {esPropietario && (
                        <button onClick={correrAnalisis} disabled={verificando || reparando} className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-black ${theme.border} ${theme.text} active:scale-95 disabled:opacity-50`}>
                          <RefreshCw size={11} /> Re-analizar
                        </button>
                      )}
                    </div>
                    {/* Leyenda 2x2 */}
                    <div className={`grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-bold ${theme.textSec}`}>
                      <span className="flex items-center gap-1"><Cloud size={11} className="text-green-600" /> Fotos en nube</span>
                      <span className="flex items-center gap-1"><Smartphone size={11} className="text-slate-500" /> Fotos en equipo</span>
                      <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-blue-600" /> Fotos de respaldo</span>
                      <span className="flex items-center gap-1"><AlertTriangle size={11} className="text-red-600" /> Fotos caídas</span>
                    </div>
                  </div>
                )}

                {/* Lista de puntos */}
                <div className="flex-1 overflow-y-auto space-y-2">
                  {(() => {
                    const ptsProyecto = puntos.filter(p => perteneceAProyecto(p, proyModal));
                    // Conteo de números repetidos (para resaltar en edición)
                    const numCount = {};
                    ptsProyecto.forEach(p => { const n = extractNum(p.datos?.numero); if (!isNaN(n)) numCount[n] = (numCount[n] || 0) + 1; });
                    // Mapa de posición (orden de tendido asc)
                    const posMap = {};
                    [...ptsProyecto].sort((a, b) => {
                      const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
                      if (oa != null && ob != null) return oa - ob;
                      if (oa != null) return -1;
                      if (ob != null) return 1;
                      return parseInt(a.id) - parseInt(b.id);
                    }).forEach((p, i) => { posMap[p.id] = i + 1; });
                    let lista;
                    if (editarPosicion && ordenEdit.length) {
                      const byId = new Map(ptsProyecto.map(p => [String(p.id), p]));
                      lista = ordenEdit.map(id => byId.get(String(id))).filter(Boolean);
                    } else {
                      lista = aplicarSort(ptsProyecto).filter(p => {
                        if (!filtroPunto) return true;
                        const busqueda = filtroPunto.toLowerCase();
                        const fat = (p.datos.codFat || '').toLowerCase();
                        const numero = (p.datos.numero || '').toLowerCase();
                        const pasivo = (p.datos.pasivo || '').toLowerCase();
                        return fat.includes(busqueda) || numero.includes(busqueda) || pasivo.includes(busqueda);
                      });
                    }
                    return lista.map((punto, idxLista) => {
                      // Contar total de fotos en todas las secciones
                      const totalFotos = (() => {
                        const fotos = punto.datos.fotos;
                        if (!fotos || typeof fotos !== 'object') return 0;
                        let count = 0;
                        Object.values(fotos).forEach(section => {
                          if (section && typeof section === 'object') {
                            count += Object.values(section).filter(v => v && (typeof v === 'string' || v.url)).length;
                          }
                        });
                        return count;
                      })();

                      return (
                        <div key={punto.id} className={`${theme.card} border-2 ${theme.border} rounded-lg px-3 py-2`}>
                          {/* FILA ÚNICA: ITEM | PASIVO | fotos | Info | GPS */}
                          <div className="flex items-center gap-2">
                            {/* Posición (al ordenar por posición) */}
                            {sortConfig.field === 'posicion' && (
                              <span className="shrink-0 min-w-[26px] h-[26px] px-1 rounded-md bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
                                {posMap[punto.id] ?? '-'}
                              </span>
                            )}
                            {modoVerif ? (
                              /* Compacto: "P06 - FAT01" (sin etiquetas) para dar espacio a los chips */
                              <div className="flex items-center min-w-0 flex-1">
                                <span className={`text-xs font-black ${theme.text} truncate`}>
                                  {punto.datos.numero || '-'}{punto.datos.pasivo ? ` - ${punto.datos.pasivo}` : ''}
                                </span>
                              </div>
                            ) : (
                              <>
                                {/* ITEM */}
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className={`text-[10px] font-normal ${theme.textSec} shrink-0`}>ITEM:</span>
                                  <span className={`text-xs font-black ${theme.text} truncate`}>{punto.datos.numero || '-'}</span>
                                </div>

                                <div className={`w-px h-3 ${theme.border} shrink-0`}></div>

                                {/* PASIVO */}
                                <div className="flex items-center gap-1 min-w-0 flex-1">
                                  <span className={`text-[10px] font-normal ${theme.textSec} shrink-0`}>PASIVO:</span>
                                  <span className={`text-xs font-black ${theme.text} truncate`}>{punto.datos.pasivo || '-'}</span>
                                </div>
                              </>
                            )}

                            {modoVerif ? (() => {
                              // ── MODO VERIFICACIÓN: chips nube / equipo / respaldo / caídas ──
                              const v = verifData?.puntos?.[punto.id];
                              if (!v) return <span className={`text-[10px] ${theme.textSec} shrink-0`}>sin datos</span>;
                              const chip = 'w-11 flex items-center justify-center gap-0.5 px-0.5 py-1 rounded-md text-[10px] font-black shrink-0';
                              return (
                                <button onClick={() => setExpandVerifId(prev => prev === punto.id ? null : punto.id)} className="flex items-center gap-1 shrink-0 active:scale-95">
                                  <span className={`${chip} ${v.nube > 0 ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-600'}`} title="Fotos en nube"><Cloud size={12} />{v.nube}</span>
                                  <span className={`${chip} ${v.eq > 0 ? 'bg-slate-700 text-white' : 'bg-slate-300 text-slate-600'}`} title="Fotos en equipo (total/no en nube)"><Smartphone size={12} />{v.eq}/{v.eqNoNube}</span>
                                  <span className={`${chip} ${v.resp > 0 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`} title="Fotos de respaldo (total/no en nube)"><ShieldCheck size={12} />{v.resp}/{v.respNoNube}</span>
                                  <span className={`${chip} ${v.caidas > 0 ? 'bg-red-600 text-white' : 'bg-slate-300 text-slate-600'}`} title="Fotos caídas"><AlertTriangle size={12} />{v.caidas}</span>
                                </button>
                              );
                            })() : (
                              <>
                            {/* Contador de fotos */}
                            <div className={`flex items-center gap-1.5 px-2.5 p-1.5 rounded-lg text-xs font-black shrink-0 shadow-md text-white ${totalFotos > 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                              <ImageIcon size={14} />
                              <span>{totalFotos}</span>
                            </div>

                            {/* Botón Info */}
                            <button
                              onClick={() => {
                                setDatosFormulario({
                                  ...JSON.parse(JSON.stringify(punto.datos)),
                                  coords: punto.coords,
                                  direccion: punto.datos.direccion || punto.direccion
                                });
                                setPuntoSeleccionado(punto.id);
                                setModoLectura(true);
                                setModoEdicion(true);
                                setModalPendiente(modalLocalOpen);
                                setVistaAnterior('proyectos');
                                setVista('verDetalle');
                                setModalLocalOpen(null);
                              }}
                              className="p-1.5 rounded-lg bg-slate-900 text-white active:scale-95 transition-all shrink-0"
                              title="Ver Detalle"
                            >
                              <Info size={14} />
                            </button>

                            {/* Botón GPS */}
                            <button
                              onClick={() => {
                                if (!diasVisibles.includes(punto.diaId)) {
                                  toggleVisibilidadDia(punto.diaId);
                                }
                                if (punto.coords) {
                                  setMapViewState({ center: [punto.coords.lat, punto.coords.lng], zoom: 19 });
                                }
                                setPuntoSeleccionado(punto.id);
                                setDiaActual(punto.diaId);
                                setMostrarOverlayGPS(modalLocalOpen);
                                setModalLocalOpen(null);
                                setVista('mapa');
                              }}
                              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-md shrink-0"
                              title="Ver en Mapa"
                            >
                              <MapPin size={14} />
                            </button>
                              </>
                            )}
                          </div>

                          {/* Desglose por sección (modo verificación, punto expandido).
                              Las 4 columnas de estado (w-14) quedan ALINEADAS bajo su chip. */}
                          {modoVerif && expandVerifId === punto.id && verifData?.puntos?.[punto.id] && (
                            <div className={`mt-2 pt-2 border-t ${theme.border} space-y-1.5`}>
                              {Object.entries(verifData.puntos[punto.id].secciones || {}).map(([sid, st]) => (
                                <div key={sid} className={`grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem_2.75rem_2.75rem] gap-x-1 items-center text-[11px] font-black ${theme.text}`}>
                                  <span className="truncate">{TABS_CONFIG[sid]?.title || sid}</span>
                                  <span className={`text-center ${st.n > 0 ? 'text-green-600' : theme.textSec}`}>{st.n}/{st.req}</span>
                                  <span className="text-center">{st.eq}/{st.eqNoNube}</span>
                                  <span className="text-center text-blue-600">{st.r}/{st.respNoNube}</span>
                                  <span className={`text-center ${st.c > 0 ? 'text-red-600' : theme.textSec}`}>{st.c}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}

                  {/* Vacío */}
                  {puntos
                    .filter(p => perteneceAProyecto(p, proyModal))
                    .filter(p => {
                      if (!filtroPunto) return true;
                      const busqueda = filtroPunto.toLowerCase();
                      const fat = (p.datos.codFat || '').toLowerCase();
                      const numero = (p.datos.numero || '').toLowerCase();
                      const pasivo = (p.datos.pasivo || '').toLowerCase();
                      return fat.includes(busqueda) || numero.includes(busqueda) || pasivo.includes(busqueda);
                    }).length === 0 && (
                      <div className="text-center py-8">
                        <MapPin size={48} className={`${theme.textSec} mx-auto mb-3 opacity-30`} />
                        <p className={`text-sm ${theme.textSec} font-medium`}>
                          {filtroPunto ? 'No se encontraron puntos' : 'No hay puntos registrados'}
                        </p>
                      </div>
                    )}
                </div>

                {/* Overlay: ubicar después de… (grilla de ítems) */}
                {ubicarDespues && (() => {
                  const ptsProyecto = puntos.filter(p => perteneceAProyecto(p, proyModal));
                  const byId = new Map(ptsProyecto.map(p => [String(p.id), p]));
                  const ordenados = ordenEdit.map(id => byId.get(String(id))).filter(Boolean);
                  const moving = byId.get(String(ubicarDespues));
                  return (
                    <div className="fixed inset-0 z-[400] bg-black/70 flex flex-col justify-end p-3" onClick={() => setUbicarDespues(null)}>
                      <div className={`${theme.card} rounded-2xl border-2 ${theme.border} flex flex-col max-h-[80vh] overflow-hidden`} onClick={e => e.stopPropagation()}>
                        <div className={`px-4 py-3 border-b-2 ${theme.border} flex items-center justify-between shrink-0`}>
                          <p className={`font-black text-sm ${theme.text}`}>Ubicar <span className="text-blue-600">{moving?.datos?.numero || '-'}</span> después de…</p>
                          <button onClick={() => setUbicarDespues(null)} className={theme.text}><X size={20} /></button>
                        </div>
                        <div className="p-3 overflow-y-auto">
                          <button onClick={() => moverDespuesDe(ubicarDespues, '__INICIO__')} className="w-full mb-2 py-2 rounded-lg border-2 border-blue-600 text-blue-600 text-xs font-black active:scale-95">▲ AL INICIO (posición 1)</button>
                          <div className="grid grid-cols-3 gap-2">
                            {ordenados.filter(p => String(p.id) !== String(ubicarDespues)).map((p) => (
                              <button
                                key={p.id}
                                onClick={() => moverDespuesDe(ubicarDespues, p.id)}
                                className={`py-2 px-1 rounded-lg border-2 ${theme.border} ${theme.text} text-[11px] font-black active:scale-95 truncate`}
                              >
                                <span className="text-[9px] opacity-60 block">{ordenEdit.findIndex(id => String(id) === String(p.id)) + 1}</span>
                                {p.datos?.numero || '-'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL COMPARATIVO DE CONTROL DE FERRETERÍA */}
      {modalLocalOpen?.startsWith('COMPARATIVO_') && proyModal && (perfilActivo === 'basico' ? (
        <BloqueoHerramienta
          titulo="Control de ferretería"
          concepto="Registra los materiales recibidos y compáralos contra lo instalado en cada poste del proyecto."
          theme={theme} isDark={isDark}
          onClose={() => setModalLocalOpen(null)}
        />
      ) : (
        <ComparativoModal
          proyectos={proyectos}
          conexiones={(conexiones || []).filter(c => String(c.proyectoId) === String(proyModal?.id ?? ''))}
          proyecto={proyModal}
          puntos={puntos}
          config={config}
          user={user}
          theme={theme}
          isDark={isDark}
          setConfirmData={setConfirmData}
          setAlertData={setAlertData}
          onClose={() => setModalLocalOpen(null)}
        />
      ))}

      {/* MODAL REVISIÓN DE PUNTOS — disponible en TODOS los perfiles (incluido básico) */}
      {modalLocalOpen?.startsWith('REVISION_') && proyModal && (
        <RevisionModal
          proyecto={proyModal}
          puntos={puntos}
          config={config}
          user={user}
          theme={theme}
          isDark={isDark}
          perfilActivo={perfilActivo}
          setConfirmData={setConfirmData}
          setAlertData={setAlertData}
          onClose={() => setModalLocalOpen(null)}
        />
      )}

      {/* MODAL GESTIÓN DE LOGO */}
      {
        modalLocalOpen === 'LOGO_MANAGER' && (
          <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalLocalOpen(null)}>
            <div className={`${theme.card} rounded-2xl max-w-md w-full shadow-2xl border-2 ${theme.border} overflow-hidden`} onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className={`${theme.header} px-6 py-4 border-b-2 ${theme.border} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <ImageIcon size={20} className="text-blue-600" />
                  </div>
                  <h3 className={`font-black text-lg ${theme.text} uppercase`}>Logo de Empresa</h3>
                </div>
                <button onClick={() => setModalLocalOpen(null)} className={`${theme.text} hover:bg-slate-100 p-2 rounded-lg transition-colors`}>
                  <X size={24} />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-6">
                {logoTemporal ? (
                  <div className="space-y-4">
                    {/* Vista previa del logo */}
                    <div className={`relative rounded-xl border-2 ${theme.border} ${theme.card} h-48 flex items-center justify-center overflow-hidden`}>
                      <img src={logoTemporal} alt="Logo Empresa" className="max-w-full max-h-full object-contain p-4" />
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (logoTemporal !== logoOriginalRef.current) {
                            // Si hay cambios, GUARDAR y cerrar
                            setLogoApp(logoTemporal);
                            logoOriginalRef.current = logoTemporal;
                            setModalLocalOpen(null);
                          } else {
                            // Si no hay cambios, CAMBIAR (abrir buscador)
                            inputLogoRef.current?.click();
                          }
                        }}
                        className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 active:scale-95 transition-all ${logoTemporal !== logoOriginalRef.current
                          ? 'bg-green-600 text-white border-green-800 hover:bg-green-700'
                          : 'bg-blue-600 text-white border-blue-800 hover:bg-blue-700'
                          }`}
                      >
                        {logoTemporal !== logoOriginalRef.current ? 'GUARDAR' : 'CAMBIAR'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!user) return;
                          setLogoApp(null);
                          setLogoTemporal(null);
                          logoOriginalRef.current = null;
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            const { db } = await import('../firebaseConfig');

                            // 2. Borrar de proyecto
                            if (proyectoActual?.id) {
                              const proyRef = doc(db, "proyectos", proyectoActual.id);
                              await updateDoc(proyRef, { logoEmpresa: null });
                            }
                          } catch (err) {
                            console.error(err);
                          }
                          setModalLocalOpen(null);
                        }}
                        className="flex-1 bg-red-600 text-white py-2 rounded-xl font-bold text-sm border-2 border-red-800 hover:bg-red-700 active:scale-95 transition-all"
                      >
                        ELIMINAR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Estado vacío */}
                    <div className={`rounded-xl border-2 border-dashed ${theme.border} ${theme.card} h-48 flex flex-col items-center justify-center`}>
                      <ImageIcon size={48} className={`${theme.textSec} mb-3 opacity-30`} />
                      <p className={`text-sm ${theme.textSec} font-medium`}>No hay logo cargado</p>
                      <p className={`text-xs ${theme.textSec} mt-1`}>Sube una imagen para usar como logo</p>
                    </div>

                    {/* Botón cargar */}
                    <button
                      onClick={() => {
                        inputLogoRef.current?.click();
                      }}
                      className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold text-sm border-2 border-blue-800 hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      CARGAR LOGO
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      <input
        type="file"
        ref={inputLogoRef}
        className="hidden"
        accept="image/*"
        onChange={handleCargarLogo}
      />
    </div >
  );
};


// ─── Tablero de elementos (acumulador por posición) ──────────────────────────
// Recorre los puntos hasta la posición actual y recuerda el último valor de cada
// tipo. PT/CMR/MT toman el ITEM; FAT/MF/XB/HB toman el PASIVO. Cualquier poste
// (incluido "pelado") actualiza PT; cámara y medio tramo NO tocan PT.
const TABLERO_ORDEN = ['PT', 'FAT', 'MF', 'XB', 'HB', 'CMR', 'MT'];
const calcularTableroElementos = (ptsOrd, idx, overrides, incluirActualStored = false) => {
  const t = { PT: '', FAT: '', MF: '', XB: '', HB: '', CMR: '', MT: '' };
  for (let k = 0; k <= idx && k < ptsOrd.length; k++) {
    const p = ptsOrd[k];
    if (!p) continue;
    const conf = overrides && overrides[p.id];
    let d;
    if (conf) d = conf;                                   // punto confirmado esta sesión
    else if (k === idx && !incluirActualStored) continue; // punto ACTUAL sin confirmar → no aporta
    else d = p.datos || {};                               // puntos anteriores → valor guardado
    const raw = d.tipoElemento;
    const tipos = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const item = (d.numero || '').toString().trim();
    const pasivo = (d.pasivo || '').toString().trim();
    const has = (x) => tipos.includes(x);
    const esNoPoste = tipos.length > 0 && tipos.every(x => x === 'camara' || x === 'medioTramo');
    if (has('fat')) t.FAT = pasivo;
    if (has('mufa')) t.MF = pasivo;
    if (has('xbox')) t.XB = pasivo;
    if (has('hbox')) t.HB = pasivo;
    if (has('camara')) t.CMR = item;
    if (has('medioTramo')) t.MT = item;
    if (!esNoPoste) t.PT = item;
  }
  return t;
};

const TABLERO_VACIO = { PT: '', FAT: '', MF: '', XB: '', HB: '', CMR: '', MT: '' };
// Aplica los datos de UN punto (recién modificado/guardado) al tablero, actualizando
// solo las casillas de sus tipos. El resto se mantiene (hasta que se modifique otro).
const aplicarElementoAlTablero = (t0, d) => {
  const t = { ...t0 };
  const raw = d?.tipoElemento;
  const tipos = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const item = (d?.numero || '').toString().trim();
  const pasivo = (d?.pasivo || '').toString().trim();
  const has = (x) => tipos.includes(x);
  const esNoPoste = tipos.length > 0 && tipos.every(x => x === 'camara' || x === 'medioTramo');
  if (has('fat')) t.FAT = pasivo;
  if (has('mufa')) t.MF = pasivo;
  if (has('xbox')) t.XB = pasivo;
  if (has('hbox')) t.HB = pasivo;
  if (has('camara')) t.CMR = item;
  if (has('medioTramo')) t.MT = item;
  if (!esNoPoste) t.PT = item;
  return t;
};

const TableroElementos = ({ tablero, theme, isDark }) => (
  <div className={`shrink-0 flex flex-wrap justify-center gap-1.5 px-3 py-2 border-b ${theme.border} ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
    {TABLERO_ORDEN.map(k => {
      const val = tablero[k];
      return (
        <div key={k} className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${val ? (isDark ? 'border-slate-600 bg-slate-900' : 'border-slate-300 bg-white') : (isDark ? 'border-slate-700 opacity-50' : 'border-slate-200 opacity-50')}`}>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wide">{k}</span>
          <span className={`text-[11px] font-black ${val ? theme.text : 'text-slate-400'}`}>{val || '—'}</span>
        </div>
      );
    })}
  </div>
);

// ─── MODAL COMPARATIVO (Control de Ferretería desde el proyecto) ──────────────
const ComparativoModal = ({ proyecto, puntos, conexiones = [], proyectos = [], config, user, theme, isDark, setConfirmData, setAlertData, onClose }) => {
  const isDesktop = useIsDesktop();
  const [lista, setLista] = React.useState(undefined); // undefined=cargando, null=sin lista
  const [disponibles, setDisponibles] = React.useState([]);
  const [vinculando, setVinculando] = React.useState(false);
  const [selectorAbierto, setSelectorAbierto] = React.useState(false);
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  // Pestaña DEFINIR FERRETERÍA
  // ARMADOS DEL PROYECTO. Viven en el documento del proyecto y solo el dueño los
  // toca. Mientras el proyecto no tenga los suyos se muestran los del usuario como
  // respaldo, igual que el formulario, para no perder la vinculación existente.
  const esDuenoProy = !proyecto?.esCompartido;
  const armadosProy = React.useMemo(() => (
    Array.isArray(proyecto?.armados) ? proyecto.armados : []
  ), [proyecto]);

  // Cuántos puntos usan cada armado: sirve para no dejarse fuera ninguno al fijar.
  const usoPorArmado = React.useMemo(() => {
    const m = {};
    (puntos || []).filter(p => perteneceAProyecto(p, proyecto)).forEach(p => {
      const id = p?.datos?.armadoSeleccionadoId;
      if (id) m[id] = (m[id] || 0) + 1;
    });
    return m;
  }, [puntos, proyecto]);

  // Los del proyecto primero; después los de Configuración que todavía no se fijaron.
  const listaArmados = React.useMemo(() => {
    const enProy = Array.isArray(proyecto?.armados) ? proyecto.armados : [];
    const ids = new Set(enProy.map(a => String(a.id)));
    return [
      ...enProy.map(a => ({ ...a, enProyecto: true })),
      ...(config?.armados || []).filter(a => !ids.has(String(a.id))).map(a => ({ ...a, enProyecto: false })),
    ];
  }, [proyecto, config]);

  // IMPORTAR y CONSERVAR.
  // 'importar' guía el flujo: primero de dónde, luego qué armados. Los ids se
  // conservan siempre, que es lo que mantiene viva la asignación de los puntos.
  const [importar, setImportar] = React.useState(null); // { paso, origen, proyectoId, sel:[] }
  const [conflicto, setConflicto] = React.useState(null); // { entrante, existente, nombre, cola, destino }

  // Copia un armado del proyecto a la configuración del usuario, para reutilizarlo
  // en otras obras. Es lo contrario de importar.
  const mismosMateriales = (x, y) => {
    const norm = (arm) => (arm.items || []).map(i => `${i.idRef}:${i.cant}`).sort().join('|');
    return norm(x) === norm(y);
  };

  const conservarArmado = async (a) => {
    const propios = config?.armados || [];
    // Mismo armado (mismo id): puede estar idéntico o haber cambiado en el proyecto
    const mismo = propios.find(x => String(x.id) === String(a.id));
    if (mismo) {
      if (String(mismo.nombre).trim() === String(a.nombre).trim() && mismosMateriales(mismo, a)) {
        setAlertData?.({ title: 'Ya lo tenías', message: `"${a.nombre}" ya está en tu configuración, sin cambios.` });
        return;
      }
      setConflicto({ entrante: a, existente: mismo, nombre: `${a.nombre} (2)`, cola: [], destino: 'config' });
      return;
    }
    // Otro armado con el mismo nombre
    const choque = propios.find(x =>
      String(x.nombre || "").trim().toLowerCase() === String(a.nombre || "").trim().toLowerCase());
    if (choque) {
      setConflicto({ entrante: a, existente: choque, nombre: `${a.nombre} (2)`, cola: [], destino: 'config' });
      return;
    }
    await escribirEnConfig([...propios, { ...a, visible: true }]);
    setAlertData?.({ title: 'Guardado', message: `"${a.nombre}" quedó en tu configuración.` });
  };

  const escribirEnConfig = async (lista) => {
    try {
      await updateDoc(doc(db, 'configuraciones', String(user.uid)), { armados: lista });
    } catch (e) { console.error('Error guardando en configuración:', e); }
  };

  // Resuelve los choques de nombre de uno en uno y va aplicando el resto.
  const procesarCola = async (cola, destino) => {
    const base = destino === 'config' ? (config?.armados || []) : (Array.isArray(proyecto?.armados) ? proyecto.armados : []);
    let lista = [...base];
    for (let i = 0; i < cola.length; i++) {
      const a = cola[i];
      const choque = lista.find(x => String(x.id) !== String(a.id) &&
        String(x.nombre || "").trim().toLowerCase() === String(a.nombre || "").trim().toLowerCase());
      if (choque) {
        // Se guarda lo aplicado hasta aquí y se pregunta por este
        if (destino === 'config') await escribirEnConfig(lista); else await guardarArmados(lista);
        setConflicto({ entrante: a, existente: choque, nombre: `${a.nombre} (2)`, cola: cola.slice(i + 1), destino });
        return;
      }
      if (!lista.some(x => String(x.id) === String(a.id))) lista.push({ ...a, visible: true });
    }
    if (destino === 'config') await escribirEnConfig(lista); else await guardarArmados(lista);
    setConflicto(null);
    setImportar(null);
  };

  const fijarArmado = async (a) => {
    const base = Array.isArray(proyecto?.armados) ? proyecto.armados : [];
    if (base.some(x => String(x.id) === String(a.id))) return;
    await guardarArmados([...base, { id: a.id, nombre: a.nombre, items: a.items || [], visible: true }]);
  };
  const [guardandoArmados, setGuardandoArmados] = React.useState(false);
  const [armadoEdit, setArmadoEdit] = React.useState(null); // tempData del editor

  // Abre el editor con la misma forma de datos que usa Configuración: los materiales
  // ya puestos primero, en su orden, y detrás el resto del catálogo.
  const abrirEditorArmado = (arm) => {
    const catalogo = config?.catalogoFerreteria || [];
    const itemsSeleccion = {};
    (arm?.items || []).forEach(it => { itemsSeleccion[it.idRef] = { cant: it.cant, tipo: it.tipo || 'primaria' }; });
    const puestos = (arm?.items || []).map(it => it.idRef);
    const listaOrden = [...puestos, ...catalogo.map(f => f.id).filter(id => !puestos.includes(id))];
    setArmadoEdit({
      nuevoArmadoId: arm?.id || `arm_${Date.now()}`,
      nuevoArmadoNombre: arm?.nombre || '',
      itemsSeleccion, listaOrden,
      snapshot: JSON.stringify({ itemsSeleccion, listaOrden }),
      modoEdicion: !!arm,
    });
  };

  // Guarda lo que devuelve el editor en los armados del proyecto.
  const guardarDesdeEditor = async () => {
    if (!armadoEdit) return;
    const { nuevoArmadoId, nuevoArmadoNombre, itemsSeleccion = {}, listaOrden } = armadoEdit;
    const nombre = String(nuevoArmadoNombre || '').trim();
    if (!nombre) { setAlertData?.({ title: 'Falta el nombre', message: 'Ponle un nombre al armado.' }); return; }
    const items = construirItems({ itemsSeleccion, listaOrden }, config?.catalogoFerreteria || []);
    const limpio = { id: nuevoArmadoId, nombre, items, visible: true };
    const existe = armadosProy.some(x => String(x.id) === String(limpio.id));
    await guardarArmados(existe ? armadosProy.map(x => String(x.id) === String(limpio.id) ? limpio : x) : [...armadosProy, limpio]);
    setArmadoEdit(null);
  };
  const [confirmarBorrado, setConfirmarBorrado] = React.useState(null);

  const guardarArmados = async (lista) => {
    if (!proyecto?.id || guardandoArmados) return;
    setGuardandoArmados(true);
    try {
      await updateDoc(doc(db, 'proyectos', String(proyecto.id)), { armados: lista });
    } catch (e) {
      console.error('Error guardando armados del proyecto:', e);
      setAlertData?.({ title: 'No se pudo guardar', message: 'Solo el dueño del proyecto puede cambiar los armados.' });
    } finally { setGuardandoArmados(false); }
  };

  const [tab, setTab] = React.useState('comparativo');
  const [idx, setIdx] = React.useState(0);
  const [localDatos, setLocalDatos] = React.useState({});
  const [fotoIdx, setFotoIdx] = React.useState(0); // carrusel de fotos (SIG/ANT): ferretería, frontal, zoom ferretería, mapa
  const [guardandoFerr, setGuardandoFerr] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [subirActivas, setSubirActivas] = React.useState(false);
  const [expandido, setExpandido] = React.useState(false);
  const [estadosOverride, setEstadosOverride] = React.useState({});
  const scrollRef = React.useRef(null);

  const ptsOrd = React.useMemo(() => [...(puntos || []).filter(p => p.proyectoId === proyecto.id)].sort((a, b) => {
    const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1;
    if (ob != null) return 1;
    return parseInt(a.id) - parseInt(b.id);
  }), [puntos, proyecto]);
  const puedeEditar = !proyecto?.esCompartido || ['edicion', 'ambos'].includes(proyecto?.permisoActual);

  const estadoDe = (p) => estadosOverride[p?.id] ?? p?.datos?.ferrEstado ?? null;
  // Con cambios sin guardar el visto bueno deja de valer: lo revisado ya no es lo que
  // hay en pantalla. Se apaga en cuanto se toca algo, y al guardar se borra de verdad.
  const estadoActual = dirty ? null : estadoDe(ptsOrd[idx]);
  const marcarEstado = async (nuevo, forzar = false) => {
    const p = ptsOrd[idx];
    if (!p || !puedeEditar) return;
    // Con forzar, el ✓ aprueba sin alternar: viene de guardar cambios y el estado
    // anterior ya no vale. Sin forzar mantiene el toggle de siempre.
    const final = (!forzar && estadoDe(p) === nuevo) ? null : nuevo;
    setEstadosOverride(prev => ({ ...prev, [p.id]: final }));
    try { await updateDoc(doc(db, 'puntos', String(p.id)), { 'datos.ferrEstado': final }); }
    catch (e) { console.error(e); }
  };

  React.useEffect(() => {
    const p = ptsOrd[idx];
    if (p) { setLocalDatos({ armadoSeleccionadoId: p.datos?.armadoSeleccionadoId || null, ferreteriaFinal: { ...(p.datos?.ferreteriaFinal || {}) } }); setDirty(false); setSubirActivas(false); setFotoIdx(0); }
  }, [idx, ptsOrd]);

  // Volver arriba solo al cambiar de punto (no al aprobar/desaprobar)
  React.useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [idx]);

  const saltar = (go) => {
    if (dirty) {
      setConfirmData?.({
        title: 'Cambios sin guardar',
        message: '¿Qué querés hacer con los cambios de este punto?',
        actionText: 'DESCARTAR',
        onConfirm: () => { setConfirmData(null); go(); },
        extraText: 'GUARDAR',
        onExtra: async () => { setConfirmData(null); const ok = await guardarPuntoFerr(true); if (ok) go(); },
      });
    } else go();
  };
  const navegar = (dir) => saltar(() => setIdx(i => Math.max(0, Math.min(ptsOrd.length - 1, i + dir))));
  const irAIndice = (target) => {
    if (target === idx) { setExpandido(false); return; }
    saltar(() => { setIdx(target); setExpandido(false); });
  };

  const setLocalDatosDirty = (updater) => { setLocalDatos(updater); setDirty(true); };

  const guardarPuntoFerr = async (silent) => {
    const p = ptsOrd[idx];
    if (!p || guardandoFerr) return false;
    setGuardandoFerr(true);
    let ok = false;
    try {
      await updateDoc(doc(db, 'puntos', String(p.id)), {
        'datos.armadoSeleccionadoId': localDatos.armadoSeleccionadoId || null,
        'datos.ferreteriaFinal': localDatos.ferreteriaFinal || {},
        // Se guardó un cambio: el visto bueno anterior ya no corresponde a lo que hay.
        'datos.ferrEstado': null,
      });
      setEstadosOverride(prev => ({ ...prev, [p.id]: null }));
      setDirty(false);
      ok = true;
      if (!silent) setAlertData?.({ title: 'Actualizado', message: `Ferretería del punto ${p.datos?.numero || ''} guardada.` });
    } catch (e) { console.error(e); setAlertData?.({ title: 'Error', message: 'No se pudo guardar.' }); }
    setGuardandoFerr(false);
    return ok;
  };

  // ✓: si hay cambios, guarda y aprueba a la vez
  const aprobar = async () => {
    const habiaCambios = dirty;
    if (dirty) { const ok = await guardarPuntoFerr(true); if (!ok) return; }
    marcarEstado('aprobado', habiaCambios);
  };

  React.useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'controlFerreteria'), where('ownerId', '==', user.uid)));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLista(all.find(l => l.proyectoId === proyecto.id) || null);
        setDisponibles(all.filter(l => !l.proyectoId));
      } catch (e) { console.error(e); setLista(null); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normV = (v) => typeof v === 'number' ? { factor: 1, cant: v } : (v && typeof v === 'object' ? { factor: v.factor || 1, cant: v.cant || 0 } : { factor: 1, cant: 0 });
  const totalDe = (v) => { const n = normV(v); return n.cant * (n.factor || 1); };
  const consolidado = React.useMemo(() => {
    const t = {};
    (puntos || []).filter(p => p.proyectoId === proyecto.id).forEach(p => {
      const d = p.datos || {};
      if (d.ferreteriaFinal && Object.keys(d.ferreteriaFinal).length > 0) {
        Object.entries(d.ferreteriaFinal).forEach(([id, c]) => { if (c) t[id] = (t[id] || 0) + c; });
      } else {
        (d.armadosSeleccionados || []).forEach(a => (a.items || []).forEach(it => { t[it.idRef] = (t[it.idRef] || 0) + it.cant; }));
        Object.entries(d.ferreteriaExtra || {}).forEach(([id, c]) => { if (c) t[id] = (t[id] || 0) + c; });
      }
    });
    return t;
  }, [puntos, proyecto]);

  const vincular = async (l) => {
    setVinculando(true);
    try {
      await updateDoc(doc(db, 'controlFerreteria', l.id), { proyectoId: proyecto.id, proyectoNombre: proyecto.nombre || '' });
      setLista({ ...l, proyectoId: proyecto.id, proyectoNombre: proyecto.nombre });
      setSelectorAbierto(false);
    } catch (e) { console.error(e); }
    setVinculando(false);
  };

  // Filas: unión de recibido (si hay lista) + consolidado. Sin lista → recibido vacío (0).
  const recibido = lista ? (lista.recibido || {}) : {};
  const nombreDe = (id) => (config?.catalogoFerreteria || []).find(f => f.id === id)?.nombre || id;
  const ids = new Set([...Object.keys(recibido), ...Object.keys(consolidado)].filter(id => totalDe(recibido[id]) > 0 || (consolidado[id] || 0) > 0));
  const filas = [...ids].map(id => ({ id, nombre: nombreDe(id), rec: totalDe(recibido[id]), con: consolidado[id] || 0 })).sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2" onClick={onClose}>
      <div className={`${theme.card} rounded-2xl w-full h-full ${isDesktop ? 'max-w-6xl' : ''} shadow-2xl border-2 ${theme.border} overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className={`${theme.header} px-6 pb-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0`} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-amber-500 p-2 rounded-lg shrink-0"><Package size={20} className="text-white" /></div>
            <div className="min-w-0">
              <h3 className={`font-black text-lg ${theme.text} uppercase truncate`}>Ferretería</h3>
              {/* LIST: clickeable para vincular (solo en comparativo) */}
              {tab === 'comparativo' && (
                <button onClick={() => setSelectorAbierto(true)} className="flex items-center gap-1 active:opacity-60">
                  <Link2 size={11} className={lista ? 'text-orange-500' : theme.textSec} strokeWidth={2.5} />
                  <span className={`text-[10px] font-black uppercase truncate ${lista ? 'text-orange-500' : theme.textSec}`}>
                    LIST: {lista ? lista.nombre : 'Sin vincular'}
                  </span>
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} className={`${theme.bg} ${theme.text} p-2 rounded-lg border-2 ${theme.border} hover:bg-red-50 hover:text-red-600 hover:border-red-600 active:scale-95 shrink-0`}><X size={24} strokeWidth={2.5} /></button>
        </div>

        {/* Pestañas */}
        <div className={`flex border-b-2 ${theme.border} shrink-0`}>
          <button onClick={() => setTab('armados')} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${tab === 'armados' ? 'text-amber-600 border-b-2 border-amber-500' : muted}`}>Armados</button>
          <button onClick={() => setTab('comparativo')} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${tab === 'comparativo' ? 'text-amber-600 border-b-2 border-amber-500' : muted}`}>Comparativo</button>
          <button onClick={() => setTab('definir')} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${tab === 'definir' ? 'text-amber-600 border-b-2 border-amber-500' : muted}`}>Revisión</button>
        </div>

        {tab === 'armados' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {(() => {
              const enRiesgo = listaArmados.filter(a => !a.enProyecto && usoPorArmado[a.id]);
              if (enRiesgo.length === 0) return null;
              const postes = enRiesgo.reduce((t, a) => t + usoPorArmado[a.id], 0);
              return (
                <div className="rounded-xl border-2 border-red-400 bg-red-50 px-3 py-2">
                  <p className="text-[11px] font-bold text-red-800 leading-snug">
                    {enRiesgo.length} armado{enRiesgo.length === 1 ? '' : 's'} sin fijar se usa
                    {enRiesgo.length === 1 ? '' : 'n'} en {postes} poste{postes === 1 ? '' : 's'} de este
                    proyecto. Fíjalo{enRiesgo.length === 1 ? '' : 's'} para no perder esa asignación.
                  </p>
                </div>
              );
            })()}

            {esDuenoProy && (
              <div className="flex gap-2">
                <button
                  onClick={() => abrirEditorArmado(null)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-amber-500 bg-amber-500 text-white text-xs font-black tracking-widest active:scale-95"
                >
                  + NUEVO
                </button>
                <button
                  onClick={() => setImportar({ paso: 'origen', sel: [] })}
                  className={`flex-1 py-2.5 rounded-xl border-2 ${theme.border} ${theme.text} text-xs font-black tracking-widest active:scale-95`}
                >
                  IMPORTAR
                </button>
              </div>
            )}

            {listaArmados.length === 0 ? (
              <p className={`text-xs font-bold text-center py-8 ${muted}`}>Sin armados todavía.</p>
            ) : listaArmados.map(a => (
              <div key={a.id} className={`rounded-xl border-2 ${a.enProyecto ? theme.border : 'border-dashed border-amber-400'} p-3`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black uppercase truncate ${theme.text}`}>{a.nombre}</p>
                    <p className={`text-[10px] font-bold ${muted}`}>
                      {(a.items || []).length} material{(a.items || []).length === 1 ? '' : 'es'}
                      {usoPorArmado[a.id] ? ` · en ${usoPorArmado[a.id]} poste${usoPorArmado[a.id] === 1 ? '' : 's'}` : ''}
                      {!a.enProyecto ? ' · sin fijar' : ''}
                    </p>
                  </div>
                  {esDuenoProy && !a.enProyecto && (
                    <>
                      <button
                        onClick={() => fijarArmado(a)}
                        disabled={guardandoArmados}
                        className="shrink-0 px-2 py-1.5 rounded-lg border-2 border-amber-600 bg-amber-500 text-white text-[10px] font-black active:scale-95 disabled:opacity-50"
                      >
                        FIJAR
                      </button>
                      <button
                        onClick={() => setConfirmarBorrado({ ...a, deConfig: true })}
                        title="Quitarlo de tu configuración"
                        className="shrink-0 px-2 py-1.5 rounded-lg border-2 border-red-400 text-red-600 text-[10px] font-black active:scale-95"
                      >
                        BORRAR
                      </button>
                    </>
                  )}
                  {esDuenoProy && a.enProyecto && (
                    <>
                      <button
                        onClick={() => abrirEditorArmado(a)}
                        className={`shrink-0 px-2 py-1.5 rounded-lg border-2 ${theme.border} ${theme.text} text-[10px] font-black active:scale-95`}
                      >
                        EDITAR
                      </button>
                      <button
                        onClick={() => conservarArmado(a)}
                        title="Guardar este armado en tu configuración para reutilizarlo"
                        className={`shrink-0 px-2 py-1.5 rounded-lg border-2 ${theme.border} ${theme.text} text-[10px] font-black active:scale-95`}
                      >
                        CONSERVAR
                      </button>
                      <button
                        onClick={() => setConfirmarBorrado(a)}
                        className="shrink-0 px-2 py-1.5 rounded-lg border-2 border-red-400 text-red-600 text-[10px] font-black active:scale-95"
                      >
                        BORRAR
                      </button>
                    </>
                  )}
                </div>
                {(a.items || []).length > 0 && (
                  <div className={`mt-2 pt-2 border-t ${theme.border} space-y-0.5`}>
                    {(a.items || []).map((it, i) => {
                      const mat = (config?.catalogoFerreteria || []).find(f => f.id === it.idRef);
                      return (
                        <p key={i} className={`text-[11px] font-bold ${muted}`}>
                          {it.cant} × {mat?.nombre || 'material no encontrado'}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Editor de un armado del proyecto: nombre y materiales con cantidad.
            Los materiales salen del catálogo de ferretería del usuario, que sigue
            siendo suyo para que un mismo material valga en todos sus proyectos. */}
        {/* Mismo editor que Configuración: cantidades, vínculos entre ferreterías
            que van juntas y reordenado. Un solo componente para los dos sitios. */}
        {armadoEdit && (
          <EditorArmadoItems
            tempData={armadoEdit}
            setTempData={setArmadoEdit}
            config={config}
            theme={theme}
            setConfirmData={setConfirmData}
            onCerrar={() => setArmadoEdit(null)}
            onGuardar={guardarDesdeEditor}
          />
        )}

        {/* IMPORTAR: primero de dónde, después qué armados. Los ids se conservan,
            que es lo que mantiene la asignación de los puntos. */}
        {importar && (
          <div className="absolute inset-0 z-[520] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setImportar(null)}>
            <div className={`${theme.card} rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border-2 ${theme.border}`} onClick={e => e.stopPropagation()}>
              <div className={`shrink-0 p-3 border-b-2 ${theme.border}`}>
                <p className={`text-sm font-black uppercase ${theme.text}`}>Importar armados</p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {importar.paso === 'origen' && (
                  <>
                    <button onClick={() => setImportar({ paso: 'lista', origen: 'config', sel: [] })}
                      className={`w-full py-3 rounded-xl border-2 ${theme.border} ${theme.text} text-xs font-black tracking-widest active:scale-95`}>
                      DESDE CONFIGURACIÓN
                    </button>
                    <button onClick={() => setImportar({ paso: 'proyectos', origen: 'proyecto', sel: [] })}
                      className={`w-full py-3 rounded-xl border-2 ${theme.border} ${theme.text} text-xs font-black tracking-widest active:scale-95`}>
                      DESDE OTRO PROYECTO
                    </button>
                  </>
                )}

                {importar.paso === 'proyectos' && (
                  (proyectos || []).filter(p => String(p.id) !== String(proyecto?.id) && (p.armados || []).length > 0).length === 0 ? (
                    <p className={`text-xs font-bold text-center py-6 ${muted}`}>Ningún otro proyecto tiene armados propios todavía.</p>
                  ) : (proyectos || []).filter(p => String(p.id) !== String(proyecto?.id) && (p.armados || []).length > 0).map(p => (
                    <button key={p.id} onClick={() => setImportar({ paso: 'lista', origen: 'proyecto', proyectoId: p.id, sel: [] })}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border-2 ${theme.border} active:scale-95`}>
                      <p className={`text-xs font-black uppercase truncate ${theme.text}`}>{p.nombre}</p>
                      <p className={`text-[10px] font-bold ${muted}`}>{(p.armados || []).length} armado{(p.armados || []).length === 1 ? '' : 's'}</p>
                    </button>
                  ))
                )}

                {importar.paso === 'lista' && (() => {
                  const origen = importar.origen === 'config'
                    ? (config?.armados || [])
                    : ((proyectos || []).find(p => String(p.id) === String(importar.proyectoId))?.armados || []);
                  const yaEstan = new Set((Array.isArray(proyecto?.armados) ? proyecto.armados : []).map(x => String(x.id)));
                  const disponibles = origen.filter(a => !yaEstan.has(String(a.id)));
                  if (origen.length === 0) return <p className={`text-xs font-bold text-center py-6 ${muted}`}>No hay armados en el origen elegido.</p>;
                  const todos = disponibles.length > 0 && disponibles.length === importar.sel.length;
                  return (
                    <>
                      <button
                        onClick={() => setImportar(p => ({ ...p, sel: todos ? [] : disponibles.map(a => a.id) }))}
                        className={`w-full py-2 rounded-lg border-2 ${theme.border} ${theme.text} text-[11px] font-black tracking-widest`}
                      >
                        {todos ? 'QUITAR TODOS' : 'SELECCIONAR TODOS'}
                      </button>
                      {origen.map(a => {
                        const puesto = yaEstan.has(String(a.id));
                        const marcado = importar.sel.includes(a.id);
                        return (
                          <button key={a.id}
                            disabled={puesto}
                            onClick={() => setImportar(p => ({ ...p, sel: marcado ? p.sel.filter(x => x !== a.id) : [...p.sel, a.id] }))}
                            className={`w-full text-left px-3 py-2 rounded-xl border-2 ${puesto ? `${theme.border} opacity-45` : marcado ? "border-amber-500 bg-amber-500/10" : theme.border}`}>
                            <p className={`text-xs font-black uppercase truncate ${theme.text}`}>{a.nombre}</p>
                            <p className={`text-[10px] font-bold ${muted}`}>
                              {(a.items || []).length} material{(a.items || []).length === 1 ? '' : 'es'}
                              {puesto ? ' · ya está en el proyecto' : ''}
                            </p>
                          </button>
                        );
                      })}
                    </>
                  );
                })()}
              </div>

              <div className={`shrink-0 p-3 border-t-2 ${theme.border} flex gap-2`}>
                <button onClick={() => setImportar(null)} className={`flex-1 py-2.5 rounded-xl border-2 ${theme.border} ${theme.text} text-xs font-black tracking-widest`}>CERRAR</button>
                {importar.paso === 'lista' && (
                  <button
                    onClick={() => {
                      const origen = importar.origen === 'config'
                        ? (config?.armados || [])
                        : ((proyectos || []).find(p => String(p.id) === String(importar.proyectoId))?.armados || []);
                      const elegidos = origen.filter(a => importar.sel.includes(a.id))
                        .map(a => ({ id: a.id, nombre: a.nombre, items: a.items || [], visible: true }));
                      procesarCola(elegidos, 'proyecto');
                    }}
                    disabled={importar.sel.length === 0 || guardandoArmados}
                    className="flex-1 py-2.5 rounded-xl border-2 border-amber-600 bg-amber-500 text-white text-xs font-black tracking-widest active:scale-95 disabled:opacity-50"
                  >
                    IMPORTAR ({importar.sel.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Choque de nombres: se resuelve de uno en uno, viendo los materiales de cada uno */}
        {conflicto && (
          <div className="absolute inset-0 z-[530] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
            <div className={`${theme.card} rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border-2 ${theme.border}`}>
              <div className={`shrink-0 p-3 border-b-2 ${theme.border}`}>
                <p className={`text-sm font-black ${theme.text}`}>Ya existe “{conflicto.existente.nombre}”</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
                {[["EL QUE YA ESTÁ", conflicto.existente], ["EL QUE LLEGA", conflicto.entrante]].map(([titulo, arm]) => (
                  <div key={titulo} className={`rounded-xl border-2 ${theme.border} p-2`}>
                    <p className={`text-[10px] font-black tracking-widest mb-1 ${muted}`}>{titulo}</p>
                    {(arm.items || []).length === 0 ? (
                      <p className={`text-[10px] font-bold ${muted}`}>Sin materiales</p>
                    ) : (arm.items || []).map((it, k) => {
                      const mat = (config?.catalogoFerreteria || []).find(f => f.id === it.idRef);
                      return <p key={k} className={`text-[10px] font-bold ${theme.text}`}>{it.cant} × {mat?.nombre || '—'}</p>;
                    })}
                  </div>
                ))}
              </div>
              <div className={`shrink-0 p-3 border-t-2 ${theme.border} space-y-2`}>
                <input
                  value={conflicto.nombre}
                  onChange={(e) => setConflicto(c => ({ ...c, nombre: e.target.value }))}
                  className={`w-full px-2 py-2 rounded-lg border-2 ${theme.border} bg-transparent outline-none text-xs font-black uppercase ${theme.text}`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => procesarCola(conflicto.cola, conflicto.destino)}
                    className={`flex-1 py-2 rounded-xl border-2 ${theme.border} ${theme.text} text-[11px] font-black tracking-widest`}
                  >
                    OMITIR
                  </button>
                  <button
                    onClick={async () => {
                      const base = conflicto.destino === 'config' ? (config?.armados || []) : (Array.isArray(proyecto?.armados) ? proyecto.armados : []);
                      const lista = base.map(x => String(x.id) === String(conflicto.existente.id) ? { ...conflicto.entrante, visible: true } : x);
                      if (conflicto.destino === 'config') await escribirEnConfig(lista); else await guardarArmados(lista);
                      procesarCola(conflicto.cola, conflicto.destino);
                    }}
                    className={`flex-1 py-2 rounded-xl border-2 ${theme.border} ${theme.text} text-[11px] font-black tracking-widest`}
                  >
                    REEMPLAZAR
                  </button>
                  <button
                    onClick={async () => {
                      const base = conflicto.destino === 'config' ? (config?.armados || []) : (Array.isArray(proyecto?.armados) ? proyecto.armados : []);
                      // Si el id ya está ocupado, la copia se lleva uno nuevo: dos
                      // armados no pueden compartir id o se pisarían al resolverlos.
                      const idLibre = base.some(x => String(x.id) === String(conflicto.entrante.id))
                        ? `arm_${Date.now()}` : conflicto.entrante.id;
                      const lista = [...base, { ...conflicto.entrante, id: idLibre, nombre: (conflicto.nombre || conflicto.entrante.nombre).trim(), visible: true }];
                      if (conflicto.destino === 'config') await escribirEnConfig(lista); else await guardarArmados(lista);
                      procesarCola(conflicto.cola, conflicto.destino);
                    }}
                    className="flex-1 py-2 rounded-xl border-2 border-amber-600 bg-amber-500 text-white text-[11px] font-black tracking-widest"
                  >
                    LOS DOS
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de borrado */}
        {confirmarBorrado && (
          <div className="absolute inset-0 z-[520] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmarBorrado(null)}>
            <div className={`${theme.card} rounded-2xl p-5 max-w-xs w-full shadow-2xl border-2 ${theme.border}`} onClick={e => e.stopPropagation()}>
              <p className={`text-sm font-black mb-1 ${theme.text}`}>Borrar “{confirmarBorrado.nombre}”</p>
              <p className={`text-xs font-bold mb-4 ${muted}`}>
                {confirmarBorrado.deConfig
                  ? 'Se quita de tu configuración. No afecta a los proyectos que ya lo fijaron.'
                  : 'Los puntos que lo usan se quedarán sin armado asignado.'}
                {usoPorArmado[confirmarBorrado.id]
                  ? ` Aquí lo usan ${usoPorArmado[confirmarBorrado.id]} poste${usoPorArmado[confirmarBorrado.id] === 1 ? '' : 's'}.`
                  : ''}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmarBorrado(null)} className={`flex-1 py-2.5 rounded-xl border-2 ${theme.border} ${theme.text} text-xs font-black tracking-widest`}>CANCELAR</button>
                <button
                  onClick={async () => {
                    if (confirmarBorrado.deConfig) {
                      await escribirEnConfig((config?.armados || []).filter(x => String(x.id) !== String(confirmarBorrado.id)));
                    } else {
                      await guardarArmados(armadosProy.filter(x => x.id !== confirmarBorrado.id));
                    }
                    setConfirmarBorrado(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-red-600 bg-red-500 text-white text-xs font-black tracking-widest active:scale-95"
                >
                  BORRAR
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'comparativo' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lista === undefined ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-amber-500" /></div>
          ) : (
            <>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <span className={`flex-1 text-[10px] font-black uppercase ${muted}`}>Ferretería</span>
                <span className={`w-14 text-center text-[10px] font-black uppercase ${muted}`}>Recib.</span>
                <span className={`w-14 text-center text-[10px] font-black uppercase ${muted}`}>Consol.</span>
                <span className={`w-14 text-center text-[10px] font-black uppercase ${muted}`}>Difer.</span>
              </div>
              {filas.length === 0 ? (
                <p className={`text-center py-8 text-sm ${muted}`}>Sin datos para comparar</p>
              ) : filas.map(f => {
                const dif = f.rec - f.con; const dc = dif > 0 ? 'text-green-600' : dif < 0 ? 'text-red-600' : muted;
                return (
                  <div key={f.id} className={`${theme.card} border-2 ${theme.border} rounded-lg px-3 py-2 flex items-center gap-2`}>
                    <span className={`flex-1 text-xs font-bold truncate ${theme.text}`}>{f.nombre}</span>
                    <span className={`w-14 text-center text-sm font-black ${f.rec > 0 ? theme.text : muted}`}>{Number.isInteger(f.rec) ? f.rec : f.rec.toFixed(1)}</span>
                    <span className={`w-14 text-center text-sm font-black ${theme.text}`}>{Number.isInteger(f.con) ? f.con : f.con.toFixed(1)}</span>
                    <span className={`w-14 text-center text-sm font-black ${dc}`}>{dif > 0 ? '+' : ''}{Number.isInteger(dif) ? dif : dif.toFixed(1)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        )}

        {tab === 'definir' && (
          ptsOrd.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6"><p className={`text-sm ${muted}`}>No hay puntos en este proyecto.</p></div>
          ) : (() => {
            const punto = ptsOrd[idx];
            // Carrusel (SIG/ANT como Revisión): 3 fotos + mapa al final.
            // Las fotos que no existen NO se muestran (se saltan); el mapa siempre queda.
            const hayFoto = (f) => f && (typeof f === 'string' ? !!f : !!(f.url || f.thumb));
            const slides = [
              { tipo: 'foto', label: 'FERRETERÍA', foto: punto?.datos?.fotos?.poste?.ferreteria },
              { tipo: 'foto', label: 'FRONTAL', foto: punto?.datos?.fotos?.poste?.frontal },
              { tipo: 'foto', label: 'ZOOM A LA FERRETERÍA', foto: punto?.datos?.fotos?.medioTramo?.zoomFerreteria },
              { tipo: 'mapa', label: 'MAPA' },
            ].filter(s => s.tipo !== 'foto' || hayFoto(s.foto));
            // Fibras que tocan este poste, dentro de 3 m: cuáles se apoyan y cuáles
            // terminan aquí. Se calcula al vuelo, no se guarda.
            const resumenFibras = punto?.coords?.lat != null
              ? resumenFibrasEnPoste({ lat: punto.coords.lat, lng: punto.coords.lng }, conexiones, 3)
              : [];
            const slideIdx = Math.min(fotoIdx, slides.length - 1);
            const slideActual = slides[slideIdx];
            const fotoActual = slideActual?.foto;
            const imgSrc = fotoActual ? (typeof fotoActual === 'string' ? fotoActual : (fotoActual.url || fotoActual.thumb)) : null;
            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Navegación */}
                <div className={`shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b ${theme.border}`}>
                  <button onClick={() => navegar(-1)} disabled={idx === 0} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-black active:scale-95 disabled:opacity-30 shadow">ANT</button>
                  <button onClick={() => setExpandido(v => !v)} className="text-center min-w-0 flex-1 active:opacity-70">
                    <p className={`text-xs font-black uppercase truncate ${theme.text}`}>ITEM: {punto?.datos?.numero || '-'}{(punto?.datos?.pasivo || '').toString().trim() ? ` - EQ PASIVO: ${punto.datos.pasivo}` : ''}</p>
                    <p className={`text-[10px] ${muted}`}>Posición {idx + 1} de {ptsOrd.length}{dirty ? ' · sin guardar' : ''} ▾</p>
                  </button>
                  <button onClick={() => navegar(1)} disabled={idx === ptsOrd.length - 1} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-black active:scale-95 disabled:opacity-30 shadow">SIG</button>
                </div>

                {/* Grilla de posiciones (aprobado/desaprobado) — pantalla completa */}
                {expandido && (
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="grid grid-cols-5 gap-2">
                      {ptsOrd.map((p, i) => {
                        const est = estadoDe(p);
                        const faltaTipo = !p?.datos?.tipoPoste;
                        const cls = est === 'aprobado' ? 'bg-green-500 text-white border-green-600'
                          : est === 'desaprobado' ? 'bg-red-500 text-white border-red-600'
                          : `${theme.bg} ${theme.text} ${theme.border}`;
                        return (
                          <button key={p.id} onClick={() => irAIndice(i)} className={`relative h-14 rounded-lg border-2 flex flex-col items-center justify-center leading-none px-1 active:scale-95 ${cls} ${i === idx ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`}>
                            <span className="text-base font-black">{i + 1}</span>
                            <span className="text-[10px] font-bold opacity-80 truncate max-w-full">{p?.datos?.numero || '—'}</span>
                            {faltaTipo && <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-orange-500 border-2 border-white shadow" title="Sin tipo de poste" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!expandido && (
                <div ref={scrollRef} className={`flex-1 ${isDesktop ? 'flex flex-row overflow-hidden' : 'overflow-y-auto'}`}>
                  {/* Columna fotos */}
                  <div className={`p-4 space-y-3 ${isDesktop ? `w-1/2 flex flex-col overflow-hidden border-r ${theme.border}` : ''}`}>
                    {/* Navegación de fotos + mapa (SIG/ANT como en Revisión) */}
                    <div className="flex items-center justify-between gap-2 shrink-0">
                      <button onClick={() => setFotoIdx(i => Math.max(0, i - 1))} disabled={slideIdx === 0} className={`px-3 py-2 rounded-lg border-2 ${theme.border} ${theme.text} text-lg font-black leading-none active:scale-95 disabled:opacity-30`}>◀</button>
                      <div className="text-center min-w-0 flex-1">
                        <p className={`text-xs font-black uppercase truncate ${theme.text}`}>{slideActual?.label}</p>
                        <p className={`text-[10px] ${muted}`}>{slideIdx + 1} de {slides.length}</p>
                      </div>
                      <button onClick={() => setFotoIdx(i => Math.min(slides.length - 1, i + 1))} disabled={slideIdx >= slides.length - 1} className={`px-3 py-2 rounded-lg border-2 ${theme.border} ${theme.text} text-lg font-black leading-none active:scale-95 disabled:opacity-30`}>▶</button>
                    </div>
                    {/* Vista: mapa embebido, o foto con zoom — llena el alto disponible en PC */}
                    {slideActual?.tipo === 'mapa' ? (
                      <div className={`${isDesktop ? 'flex-1 min-h-0' : 'h-96'} rounded-xl overflow-hidden border-2 ${theme.border}`}>
                        <MiniMapaRevision puntos={ptsOrd} puntoActivo={punto} />
                      </div>
                    ) : imgSrc ? (
                      <div className={`relative ${isDesktop ? 'flex-1 min-h-0' : ''}`}>
                        <ZoomImage key={`${punto?.id}-${slideIdx}`} src={imgSrc} fallback={typeof fotoActual === 'object' ? fotoActual.thumb : null} heightClass={isDesktop ? 'h-full' : 'h-96'} />
                        {resumenFibras.length > 0 && (
                          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 pointer-events-none">
                            {resumenFibras.map(f => (
                              <div key={f.capacidad} className="flex items-center gap-1.5 bg-black/70 rounded-md px-2 py-1 backdrop-blur-sm">
                                <span className="w-2.5 h-2.5 rounded-full border border-white/40 shrink-0" style={{ backgroundColor: getColorFibra(f.capacidad) }} />
                                <span className="text-white text-[11px] font-black tracking-wide whitespace-nowrap">
                                  {f.capacidad} FO
                                  {f.apoyos > 0 && ` — ${f.apoyos} apoyo${f.apoyos === 1 ? '' : 's'}`}
                                  {f.extremos > 0 && ` — ${f.extremos} extremo${f.extremos === 1 ? '' : 's'}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {esFotoMiniatura(fotoActual) && (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-red-600/90 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-full shadow-lg pointer-events-none">⚠ Solo miniatura — falta la foto real</div>
                        )}
                      </div>
                    ) : (
                      <div className={`${isDesktop ? 'flex-1 min-h-0' : 'h-96'} flex items-center justify-center bg-black rounded-xl`}><p className="text-slate-400 text-sm font-bold">Sin foto</p></div>
                    )}
                  </div>
                  {/* Columna formulario */}
                  <div className={`p-4 space-y-3 ${isDesktop ? 'w-1/2 overflow-y-auto' : ''}`}>
                    {/* Armados + ferretería (igual que el formulario) */}
                    {/* Los armados salen del PROYECTO, no de la configuración del usuario:
                        si no, lo que se edita en la pestaña Armados no se veía aquí. */}
                    <BloqueLiquidacion
                      config={{ ...config, armados: armadosProy }}
                      datosFormulario={localDatos}
                      setDatosFormulario={setLocalDatosDirty}
                      theme={theme}
                      disabled={!puedeEditar}
                      subirConValor={subirActivas}
                    />
                  </div>
                </div>
                )}

                {/* Acciones */}
                {!expandido && (
                <div className={`shrink-0 p-3 border-t-2 ${theme.border} flex gap-2`}>
                  <button onClick={() => setSubirActivas(v => !v)} className={`px-3 py-3 rounded-xl font-black border-2 active:scale-95 flex items-center justify-center gap-1 ${subirActivas ? 'bg-amber-500 border-black text-black' : `${theme.border} ${theme.text}`}`}>
                    <ArrowUpDown size={16} /> <span className="text-xs">ORDENAR</span>
                  </button>
                  {puedeEditar && (
                    <>
                      <button onClick={() => guardarPuntoFerr(false)} disabled={guardandoFerr || !dirty} className={`flex-1 py-3 rounded-xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${dirty && !guardandoFerr ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400'}`}>
                        {guardandoFerr ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {guardandoFerr ? 'ACTUALIZANDO…' : dirty ? 'ACTUALIZAR' : 'ACTUALIZADO'}
                      </button>
                      <button onClick={aprobar} title="Aprobar" className={`w-12 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-all ${estadoActual === 'aprobado' ? 'bg-green-600 border-green-700 text-white' : `${theme.border} text-green-600`}`}>
                        <Check size={22} strokeWidth={3} />
                      </button>
                      <button onClick={() => marcarEstado('desaprobado')} title="Desaprobar" className={`w-12 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-all ${estadoActual === 'desaprobado' ? 'bg-red-600 border-red-700 text-white' : `${theme.border} text-red-600`}`}>
                        <X size={22} strokeWidth={3} />
                      </button>
                    </>
                  )}
                </div>
                )}
              </div>
            );
          })()
        )}

        {/* Selector para vincular una lista */}
        {selectorAbierto && (
          <div className="absolute inset-0 z-[10] bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectorAbierto(false)}>
            <div className={`w-full max-w-sm ${theme.card} rounded-2xl p-5 space-y-3 border-2 ${theme.border}`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h4 className={`font-black text-sm uppercase ${theme.text}`}>Vincular lista</h4>
                <button onClick={() => setSelectorAbierto(false)} className={`p-1.5 rounded-lg ${theme.text}`}><X size={18} /></button>
              </div>
              {disponibles.length === 0 ? (
                <p className={`text-xs ${muted}`}>No tenés listas sin vincular. Creá una en la sección "Control Ferretería".</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {disponibles.map(l => (
                    <button key={l.id} disabled={vinculando} onClick={() => vincular(l)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border-2 ${theme.border} ${theme.text} font-bold text-sm active:scale-95 disabled:opacity-50`}>
                      {l.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MODAL REVISIÓN (fotos del poste + datos de levantamiento por punto) ──────
const RevisionModal = ({ proyecto, puntos, config, user, theme, isDark, perfilActivo = 'claro', setConfirmData, setAlertData, onClose }) => {
  const isDesktop = useIsDesktop();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const [idx, setIdx] = React.useState(0);
  const [fotoIdx, setFotoIdx] = React.useState(0);
  const [localDatos, setLocalDatos] = React.useState({ extrasSeleccionados: [] });
  const [guardando, setGuardando] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [expandido, setExpandido] = React.useState(false);
  const [estadosOverride, setEstadosOverride] = React.useState({});
  // Tablero de elementos: arranca EN BLANCO y solo se actualiza cuando GUARDÁS/ACTUALIZÁS
  // un punto (con el valor que modificaste). Navegar (SIG/ANT) sin cambios NO lo toca; cada
  // casilla queda con el último valor modificado hasta modificar otro del mismo tipo.
  const [tablero, setTablero] = React.useState(TABLERO_VACIO);
  // Memoria de campos de poste para heredar al siguiente punto en Revisión (como en captura):
  // se completan SOLO los campos vacíos del punto; nunca se pisa un valor ya guardado.
  const memoriaPosteRef = React.useRef({ material: null, tipo: null, fuerza: null, altura: null, cables: null, extrasSeleccionados: [] });
  const [heredado, setHeredado] = React.useState(false); // hay valores heredados sin guardar (habilita ACTUALIZAR sin trabar SIG)
  const scrollRef = React.useRef(null);

  const ptsOrd = React.useMemo(() => [...(puntos || []).filter(p => p.proyectoId === proyecto.id)].sort((a, b) => {
    const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1;
    if (ob != null) return 1;
    return parseInt(a.id) - parseInt(b.id);
  }), [puntos, proyecto]);
  const puedeEditar = !proyecto?.esCompartido || ['edicion', 'ambos'].includes(proyecto?.permisoActual);

  const punto = ptsOrd[idx];
  const estadoDe = (p) => estadosOverride[p?.id] ?? p?.datos?.revEstado ?? null;
  // Mismo criterio que en ferretería: si hay cambios pendientes, no hay visto bueno.
  const estadoActual = dirty ? null : estadoDe(punto);

  const marcarEstado = async (nuevo, forzar = false) => {
    const p = ptsOrd[idx];
    if (!p || !puedeEditar) return;
    // Con forzar, el ✓ aprueba sin alternar: viene de guardar cambios y el estado
    // anterior ya no vale. Sin forzar mantiene el toggle de siempre.
    const final = (!forzar && estadoDe(p) === nuevo) ? null : nuevo;
    setEstadosOverride(prev => ({ ...prev, [p.id]: final }));
    try { await updateDoc(doc(db, 'puntos', String(p.id)), { 'datos.revEstado': final }); }
    catch (e) { console.error(e); }
  };

  // Fotos de la pestaña POSTE que existen, en el orden del catálogo
  const fotosPoste = React.useMemo(() => {
    const fotos = punto?.datos?.fotos || {};
    const hayFoto = (f) => f && (typeof f === 'string' ? f : (f.url || f.thumb));
    const lista = [];
    const tiposPto = Array.isArray(punto?.datos?.tipoElemento) ? punto.datos.tipoElemento : (punto?.datos?.tipoElemento ? [punto.datos.tipoElemento] : []);
    // MEDIO TRAMO: sin sección de poste — solo sus 3 fotos propias
    if (tiposPto.includes('medioTramo')) {
      const fmt = fotos.medioTramo || {};
      (TABS_CONFIG.medioTramo?.items || []).forEach(it => {
        const foto = fmt[it.id];
        if (hayFoto(foto)) lista.push({ id: `medioTramo_${it.id}`, label: (it.label || it.id).replace(/\n/g, ' '), foto });
      });
      return lista;
    }
    // Fotos del POSTE — sin la de "base"
    const fp = fotos.poste || {};
    (TABS_CONFIG.poste?.items || []).forEach(it => {
      if (it.id === 'base') return; // se quita la foto de base
      const foto = fp[it.id];
      if (hayFoto(foto)) lista.push({ id: `poste_${it.id}`, label: (it.label || it.id).replace(/\n/g, ' '), foto });
    });
    // + Fotos de CÓDIGO DE SERIE de FAT / XBOX / HBOX
    const seccionesSerie = [
      { sec: 'fatPrecoNueva', label: 'SERIE — FAT' },
      { sec: 'xbox', label: 'SERIE — XBOX' },
      { sec: 'hbox', label: 'SERIE — HBOX' },
    ];
    seccionesSerie.forEach(({ sec, label }) => {
      const foto = fotos[sec]?.codigoSerie;
      if (hayFoto(foto)) lista.push({ id: `${sec}_codigoSerie`, label, foto });
    });
    return lista;
  }, [punto]);

  React.useEffect(() => {
    const d = punto?.datos || {};
    const tipos = Array.isArray(d.tipoElemento) ? [...d.tipoElemento] : (d.tipoElemento ? [d.tipoElemento] : []);
    const esMT = tipos.includes('medioTramo');
    const mem = memoriaPosteRef.current;
    // Hereda el valor recordado SOLO si el punto no tiene el suyo (y no es medio tramo).
    const inh = (stored, remembered) => stored || (esMT ? null : (remembered ?? null));
    const material = inh(d.material, mem.material);
    const tipo = inh(d.tipo, mem.tipo);
    const fuerza = inh(d.fuerza, mem.fuerza);
    const altura = inh(d.altura, mem.altura);
    const cables = inh(d.cables, mem.cables);
    const extras = (d.extrasSeleccionados?.length) ? [...d.extrasSeleccionados] : (esMT ? [] : [...(mem.extrasSeleccionados || [])]);
    const seHeredo = (!d.material && !!material) || (!d.tipo && !!tipo) || (!d.fuerza && !!fuerza)
      || (!d.altura && !!altura) || (!d.cables && !!cables) || (!(d.extrasSeleccionados?.length) && extras.length > 0);
    setLocalDatos({
      numero: d.numero || '',
      codigo: d.codigo || '',
      pasivo: d.pasivo || '',
      codigoSerie: d.codigoSerie || '',
      equipos: Array.isArray(d.equipos) ? d.equipos : undefined,
      absIn: d.absIn || '',
      absOut: d.absOut || '',
      suministro: d.suministro || '',
      tipoPoste: d.tipoPoste || null,
      material, tipo, fuerza, altura, cables,
      extrasSeleccionados: extras,
      tipoElemento: tipos,
    });
    setDirty(false);
    setHeredado(seHeredo);
    setFotoIdx(0);
  }, [idx, ptsOrd]);

  // Volver arriba solo al cambiar de punto (no al aprobar/desaprobar)
  React.useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [idx]);

  const setLocalDatosDirty = (updater) => {
    setLocalDatos(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Recordar la selección de poste para heredarla al siguiente punto (salvo medio tramo).
      const tipos = Array.isArray(next.tipoElemento) ? next.tipoElemento : (next.tipoElemento ? [next.tipoElemento] : []);
      if (!tipos.includes('medioTramo')) {
        memoriaPosteRef.current = {
          material: next.material ?? null, tipo: next.tipo ?? null, fuerza: next.fuerza ?? null,
          altura: next.altura ?? null, cables: next.cables ?? null,
          extrasSeleccionados: [...(next.extrasSeleccionados || [])],
        };
      }
      return next;
    });
    setDirty(true);
  };

  const guardarRev = async (silent) => {
    const p = ptsOrd[idx];
    if (!p || guardando) return false;
    const errVal = validarPunto(localDatos);
    if (errVal) { setAlertData?.({ title: 'Faltan datos', message: errVal }); return false; }
    setGuardando(true);
    let ok = false;
    try {
      await updateDoc(doc(db, 'puntos', String(p.id)), {
        'datos.numero': localDatos.numero || '',
        'datos.codigo': localDatos.codigo || '',
        'datos.pasivo': localDatos.pasivo || '',
        'datos.codigoSerie': localDatos.codigoSerie || '',
        'datos.equipos': equiposDePunto(localDatos),
        'datos.absIn': localDatos.absIn || '',
        'datos.absOut': localDatos.absOut || '',
        'datos.suministro': localDatos.suministro || '',
        'datos.tipoPoste': localDatos.tipoPoste || null,
        'datos.material': localDatos.material || null,
        'datos.tipo': localDatos.tipo || null,
        'datos.fuerza': localDatos.fuerza || null,
        'datos.altura': localDatos.altura || null,
        'datos.cables': localDatos.cables || null,
        'datos.extrasSeleccionados': localDatos.extrasSeleccionados || [],
        'datos.tipoElemento': localDatos.tipoElemento || [],
        // Se guardó un cambio: el visto bueno anterior ya no corresponde a lo que hay.
        'datos.revEstado': null,
      });
      setEstadosOverride(prev => ({ ...prev, [p.id]: null }));
      setDirty(false);
      setHeredado(false);
      ok = true;
      // Tablero: actualizar SOLO al guardar, con el punto recién modificado.
      setTablero(prev => aplicarElementoAlTablero(prev, localDatos));
      if (!silent) setAlertData?.({ title: 'Actualizado', message: `Datos del punto ${p.datos?.numero || ''} guardados.` });
    } catch (e) { console.error(e); setAlertData?.({ title: 'Error', message: 'No se pudo guardar.' }); }
    setGuardando(false);
    return ok;
  };

  // ✓: si hay cambios, guarda y aprueba a la vez
  const aprobar = async () => {
    const errVal = validarPunto(localDatos);
    if (errVal) { setAlertData?.({ title: 'Faltan datos', message: errVal }); return; }
    const habiaCambios = dirty || heredado;
    if (habiaCambios) { const ok = await guardarRev(true); if (!ok) return; }
    marcarEstado('aprobado', habiaCambios);
  };

  const saltar = (go) => {
    if (dirty) {
      setConfirmData?.({
        title: 'Cambios sin guardar',
        message: '¿Qué querés hacer con los cambios de este punto?',
        actionText: 'DESCARTAR',
        onConfirm: () => { setConfirmData(null); go(); },
        extraText: 'GUARDAR',
        onExtra: async () => { setConfirmData(null); const ok = await guardarRev(true); if (ok) go(); },
      });
    } else go();
  };
  const navegar = (dir) => saltar(() => setIdx(i => Math.max(0, Math.min(ptsOrd.length - 1, i + dir))));
  const irAIndice = (target) => {
    if (target === idx) { setExpandido(false); return; }
    saltar(() => { setIdx(target); setExpandido(false); });
  };

  const fotoActual = fotosPoste[fotoIdx];
  const imgSrc = fotoActual ? (typeof fotoActual.foto === 'string' ? fotoActual.foto : (fotoActual.foto.url || fotoActual.foto.thumb)) : null;

  // RENUMERAR ITEMS: reescribe solo datos.numero de los puntos del proyecto
  const [renumerarAbierto, setRenumerarAbierto] = React.useState(false);
  const aplicarRenumeracion = async (cambios) => {
    for (const c of cambios) {
      await updateDoc(doc(db, 'puntos', String(c.id)), { 'datos.numero': c.numero });
    }
    // Refrescar el punto en pantalla con su nuevo item
    const actual = cambios.find(c => String(c.id) === String(ptsOrd[idx]?.id));
    if (actual) setLocalDatos(prev => ({ ...prev, numero: actual.numero }));
    setAlertData?.({ title: 'Items actualizados', message: `Se renumeraron ${cambios.length} punto${cambios.length !== 1 ? 's' : ''}.` });
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2" onClick={onClose}>
      <div className={`${theme.card} rounded-2xl w-full h-full ${isDesktop ? 'max-w-6xl' : ''} shadow-2xl border-2 ${theme.border} overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`${theme.header} px-6 pb-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0`} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-emerald-500 p-2 rounded-lg shrink-0"><ClipboardCheck size={20} className="text-white" /></div>
            <h3 className={`font-black text-lg ${theme.text} uppercase truncate`}>Revisión</h3>
          </div>
          <button onClick={onClose} className={`${theme.bg} ${theme.text} p-2 rounded-lg border-2 ${theme.border} hover:bg-red-50 hover:text-red-600 hover:border-red-600 active:scale-95 shrink-0`}><X size={24} strokeWidth={2.5} /></button>
        </div>

        {ptsOrd.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6"><p className={`text-sm ${muted}`}>No hay puntos en este proyecto.</p></div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Navegación de puntos */}
            <div className={`shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b ${theme.border}`}>
              <button onClick={() => navegar(-1)} disabled={idx === 0} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-black active:scale-95 disabled:opacity-30 shadow">ANT</button>
              <button onClick={() => setExpandido(v => !v)} className="text-center min-w-0 flex-1 active:opacity-70">
                <p className={`text-xs font-black uppercase truncate ${theme.text}`}>ITEM: {punto?.datos?.numero || '-'}</p>
                <p className={`text-[10px] ${muted}`}>Posición {idx + 1} de {ptsOrd.length}{dirty ? ' · sin guardar' : ''} ▾</p>
              </button>
              <button onClick={() => navegar(1)} disabled={idx === ptsOrd.length - 1} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-black active:scale-95 disabled:opacity-30 shadow">SIG</button>
            </div>

            <TableroElementos tablero={tablero} theme={theme} isDark={isDark} />

            {/* Grilla de posiciones (aprobado/desaprobado) — pantalla completa */}
            {expandido && (
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-5 gap-2">
                  {ptsOrd.map((p, i) => {
                    const est = estadoDe(p);
                    const faltaTipo = !p?.datos?.tipoPoste;
                    const cls = est === 'aprobado' ? 'bg-green-500 text-white border-green-600'
                      : est === 'desaprobado' ? 'bg-red-500 text-white border-red-600'
                      : `${theme.bg} ${theme.text} ${theme.border}`;
                    return (
                      <button key={p.id} onClick={() => irAIndice(i)} className={`relative h-14 rounded-lg border-2 flex flex-col items-center justify-center leading-none px-1 active:scale-95 ${cls} ${i === idx ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`}>
                        <span className="text-base font-black">{i + 1}</span>
                        <span className="text-[10px] font-bold opacity-80 truncate max-w-full">{p?.datos?.numero || '—'}</span>
                        {faltaTipo && <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-orange-500 border-2 border-white shadow" title="Sin tipo de poste" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!expandido && (
            <div ref={scrollRef} className={`flex-1 ${isDesktop ? 'flex flex-row overflow-hidden' : 'overflow-y-auto'}`}>
              {/* Columna fotos */}
              <div className={`p-4 space-y-3 ${isDesktop ? `w-1/2 flex flex-col overflow-hidden border-r ${theme.border}` : ''}`}>
                {/* Nombre de la foto + navegación de fotos */}
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <button onClick={() => setFotoIdx(i => Math.max(0, i - 1))} disabled={fotoIdx === 0 || fotosPoste.length === 0} className={`px-3 py-2 rounded-lg border-2 ${theme.border} ${theme.text} text-lg font-black leading-none active:scale-95 disabled:opacity-30`}>◀</button>
                  <div className="text-center min-w-0 flex-1">
                    <p className={`text-xs font-black uppercase truncate ${theme.text}`}>{fotoActual?.label || 'Sin fotos'}</p>
                    {fotosPoste.length > 0 && <p className={`text-[10px] ${muted}`}>Foto {fotoIdx + 1} de {fotosPoste.length}</p>}
                  </div>
                  <button onClick={() => setFotoIdx(i => Math.min(fotosPoste.length - 1, i + 1))} disabled={fotoIdx >= fotosPoste.length - 1 || fotosPoste.length === 0} className={`px-3 py-2 rounded-lg border-2 ${theme.border} ${theme.text} text-lg font-black leading-none active:scale-95 disabled:opacity-30`}>▶</button>
                </div>
                {/* Visor con zoom — llena el alto disponible en PC */}
                {imgSrc ? (
                  <div className={`relative ${isDesktop ? 'flex-1 min-h-0' : ''}`}>
                    <ZoomImage key={`${punto?.id}-${fotoActual?.id}-${fotoIdx}`} src={imgSrc} fallback={typeof fotoActual?.foto === 'object' ? fotoActual.foto.thumb : null} heightClass={isDesktop ? 'h-full' : 'h-96'} />
                    {esFotoMiniatura(fotoActual?.foto) && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-red-600/90 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-full shadow-lg pointer-events-none">⚠ Solo miniatura — falta la foto real</div>
                    )}
                  </div>
                ) : (
                  <div className={`${isDesktop ? 'flex-1 min-h-0' : 'h-96'} flex items-center justify-center bg-black rounded-xl`}><p className="text-slate-400 text-sm font-bold">Sin fotos de poste</p></div>
                )}
              </div>

              {/* Columna formulario */}
              <div className={`p-4 ${isDesktop ? 'w-1/2 overflow-y-auto' : ''}`}>
                <div className={`space-y-3 ${isDesktop ? 'max-w-md mx-auto' : ''}`}>
                {/* Inputs de datos (mismo bloque que el formulario, según perfil) */}
                <InputsDatos datos={localDatos} setDatos={setLocalDatosDirty} theme={theme} disabled={!puedeEditar} tipoProyecto={proyecto?.tipo} />
                {/* PROPIETARIO + EQ. PASIVO (igual que el formulario, según perfil) */}
                <GrupoPropietario datos={localDatos} setDatos={setLocalDatosDirty} theme={theme} disabled={!puedeEditar} setAlertData={setAlertData} />
                {proyecto?.tipo !== 'levantamiento' && (
                  <GrupoElemento datos={localDatos} setDatos={setLocalDatosDirty} theme={theme} disabled={!puedeEditar} tipoProyecto={proyecto?.tipo} setAlertData={setAlertData} />
                )}
                {/* Datos de levantamiento (editable) — sin TIPO DE POSTE (ya está arriba como PROPIETARIO) */}
                <BloqueLevantamiento
                  config={config}
                  datosFormulario={localDatos}
                  setDatosFormulario={setLocalDatosDirty}
                  theme={theme}
                  disabled={!puedeEditar}
                  sinTipoPoste
                />
                </div>
              </div>
            </div>
            )}

            {renumerarAbierto && (
              <RenumerarItems
                proyecto={proyecto}
                puntos={ptsOrd}
                theme={theme}
                isDark={isDark}
                onAplicar={aplicarRenumeracion}
                onClose={() => setRenumerarAbierto(false)}
              />
            )}

            {/* Guardar + aprobar/desaprobar */}
            {!expandido && puedeEditar && (
              <div className={`shrink-0 p-3 border-t-2 ${theme.border} flex gap-2`}>
                <button onClick={() => setRenumerarAbierto(true)} title="Renumerar items"
                  className={`w-12 rounded-xl border-2 ${theme.border} ${theme.text} flex items-center justify-center active:scale-95 transition-all`}>
                  <Hash size={20} strokeWidth={2.5} />
                </button>
                <button onClick={() => guardarRev(false)} disabled={guardando || (!dirty && !heredado)} className={`flex-1 py-3 rounded-xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${(dirty || heredado) && !guardando ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400'}`}>
                  {guardando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {guardando ? 'ACTUALIZANDO…' : (dirty || heredado) ? 'ACTUALIZAR' : 'ACTUALIZADO'}
                </button>
                <button onClick={aprobar} title="Aprobar" className={`w-12 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-all ${estadoActual === 'aprobado' ? 'bg-green-600 border-green-700 text-white' : `${theme.border} text-green-600`}`}>
                  <Check size={22} strokeWidth={3} />
                </button>
                <button onClick={() => marcarEstado('desaprobado')} title="Desaprobar" className={`w-12 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-all ${estadoActual === 'desaprobado' ? 'bg-red-600 border-red-700 text-white' : `${theme.border} text-red-600`}`}>
                  <X size={22} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ExportHubContent = ({ proyecto, puntos, config, setAlertData, exportandoTipo, handleExportar, handleExportarServidor, cancelarExportacion, resultadosExportacion, setResultadosExportacion, logoApp, setLogoApp, inputLogoRef, handleCargarLogo, user, proyectoId, perfilActivo = 'avanzado' }) => {
  const [descargandoId, setDescargandoId] = React.useState(null);
  const [genCuant, setGenCuant] = React.useState(false);
  const [genLiq, setGenLiq] = React.useState(false);
  const [genList, setGenList] = React.useState(false);
  const [genUtil, setGenUtil] = React.useState(false);
  const [genEstado, setGenEstado] = React.useState(false);
  const [genRfPasivos, setGenRfPasivos] = React.useState(false);
  const blobsRef = React.useRef({});

  // Genera un reporte de DATOS (client-side), lo SUBE a Storage y lo deja como tarjeta
  // descargable (igual que los de fotos): así se puede descargar en el momento o luego.
  const generarReporteExcel = async (setGen, yaGen, fnGenerar, reporteId = 'detallado') => {
    if (yaGen) return;
    setGen(true);
    const exportKey = `kipo_export_results_${user?.uid || 'anon'}`;
    const id = `xls_${Date.now()}`;
    generacionesReporteActivas.add(id);
    const loadingCard = { id, type: 'EXCEL', reporte: reporteId, proyectoId: proyecto.id, name: 'Generando reporte…', cargando: true, downloadUrl: null, blob: { size: 0 }, numPuntos: 0, timestamp: Date.now() };
    // Reemplaza cualquier resultado previo del MISMO reporte (se regenera).
    setResultadosExportacion(prev => [...prev.filter(r => !(r.type === 'EXCEL' && r.reporte === reporteId && String(r.proyectoId) === String(proyecto.id))), loadingCard]);
    persistirResultadoLS(exportKey, loadingCard);
    try {
      const res = await fnGenerar();
      const blob = res?.blob, nombre = res?.nombre || 'reporte.xlsx';
      if (!blob) throw new Error('El reporte no generó archivo.');
      const { uploadImage } = await import('../utils/storage');
      const safe = nombre.replace(/[^\w.\- ]+/g, '_');
      const url = await uploadImage(blob, `proyectos/${proyecto.id}/reportes/${Date.now()}_${safe}`);
      blobsRef.current[id] = blob; // disponible para descarga inmediata sin re-fetch
      // Tarjeta final: se escribe a estado Y a localStorage (para que quede aunque la vista
      // se haya desmontado mientras generaba). El evento refresca cualquier vista montada.
      const cnt = res?.puntos ?? res?.postes ?? res?.filas ?? res?.equipos ?? res?.fotos ?? 0;
      const doneCard = { id, type: 'EXCEL', reporte: reporteId, proyectoId: proyecto.id, name: nombre, cargando: false, downloadUrl: url, blob: { size: blob.size }, numPuntos: cnt, timestamp: Date.now() };
      setResultadosExportacion(prev => prev.map(r => r.id === id ? doneCard : r));
      persistirResultadoLS(exportKey, doneCard);
    } catch (e) {
      console.error('Error generando reporte:', e);
      setResultadosExportacion(prev => prev.filter(r => r.id !== id));
      persistirResultadoLS(exportKey, { id }, { eliminar: true });
      setAlertData?.({ title: 'Error', message: 'No se pudo generar el reporte.' });
    } finally {
      generacionesReporteActivas.delete(id);
      setGen(false);
    }
  };

  const [askSelloRf, setAskSelloRf] = React.useState(false);
  // RF equipos pasivos AHORA se genera en el SERVIDOR (como los otros reportes de fotos):
  // se puede cerrar la app, tiene link y expira en 48h. conDatos = con sello.
  const lanzarRfServidor = (conDatos) => {
    handleExportarServidor('EXCEL', proyecto, 99999, {
      ...stampConfig,
      reporte: 'rfEquiposPasivos',
      ...(conDatos ? {} : { sinDatos: true }),
    });
  };
  const generarCuantificado = () => generarReporteExcel(setGenCuant, genCuant, async () => {
    const { descargarCuantificado } = await import('../utils/cuantificado');
    return descargarCuantificado(proyecto, puntos, config);
  }, 'cuantificado');
  const generarLiquidacion = () => generarReporteExcel(setGenLiq, genLiq, async () => {
    const { descargarLiquidacion } = await import('../utils/liquidacion');
    return descargarLiquidacion(proyecto, puntos, config);
  }, 'liquidacion');
  const generarListado = () => generarReporteExcel(setGenList, genList, async () => {
    const { descargarListadoPostes } = await import('../utils/listadoPostes');
    return descargarListadoPostes(proyecto, puntos, config);
  }, 'listadoPostes');
  const generarUtilizados = () => generarReporteExcel(setGenUtil, genUtil, async () => {
    const { descargarListadoUtilizados } = await import('../utils/listadoUtilizados');
    return descargarListadoUtilizados(proyecto, puntos, config);
  }, 'listadoUtilizados');
  const generarEstadoFotos = () => generarReporteExcel(setGenEstado, genEstado, async () => {
    const { descargarReporteEstadoFotos } = await import('../utils/reporteEstadoFotos');
    return descargarReporteEstadoFotos(proyecto, puntos);
  });

  // Aviso cuando un RF de postes no tiene ningún punto de ese tipo (reporte saldría vacío)
  const [avisoSinPostes, setAvisoSinPostes] = React.useState(null); // { id, texto }
  const normProp = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const contarPorPropietario = (clave) => ptsDelProyecto.filter(p => normProp(p.datos?.tipoPoste) === clave).length;

  // Dispatcher: genera el reporte de Excel indicado directamente (cada fila tiene su GENERAR).
  const generarReporte = (id, omitirAviso = false) => {
    if (id === 'cuantificado') return generarCuantificado();
    if (id === 'liquidacion') return generarLiquidacion();
    if (id === 'listadoPostes') return generarListado();
    if (id === 'listadoUtilizados') return generarUtilizados();
    if (id === 'rfEquiposPasivos') { setReporteExcel(id); setAskSelloRf(true); return; }
    // RF de postes sin puntos de ese tipo: avisar antes de generar un reporte vacío
    if (!omitirAviso && (id === 'postesPropios' || id === 'postesElectricos')) {
      const esPropios = id === 'postesPropios';
      if (contarPorPropietario(esPropios ? 'propio' : 'electrico') === 0) {
        setAvisoSinPostes({ id, texto: esPropios ? 'postes propios' : 'postes eléctricos' });
        return;
      }
    }
    // Server-side (detallado, postesPropios, postesElectricos, tendido, ferreteria)
    setReporteExcel(id);
    let total = 0;
    ptsDelProyecto.forEach(p => {
      let fotos = 0;
      if (p.datos && p.datos.fotos && !Array.isArray(p.datos.fotos)) {
        Object.values(p.datos.fotos).forEach(section => {
          if (section && typeof section === 'object') fotos += Object.values(section).filter(v => v && (typeof v === 'string' || v.url)).length;
        });
      } else if (Array.isArray(p.datos?.fotos)) fotos = p.datos.fotos.length;
      total += Math.max(fotos, 1);
    });
    const reporteTag = ['postesPropios', 'postesElectricos', 'tendido', 'ferreteria', 'tendidoRamales'].includes(id) ? id : null;
    setExportPendiente({ tipo: 'EXCEL', proyecto, limiteCalculado: total || 1, reporte: reporteTag });
    if (!logoApp) setModalExportStep('logo'); else setModalExportStep('datos');
  };

  const handleDescargar = async (archivo) => {
    if (descargandoId === archivo.id) return;
    setDescargandoId(archivo.id);
    try {
      let blob = blobsRef.current[archivo.id] instanceof Blob ? blobsRef.current[archivo.id] : null;
      if (!blob && archivo.downloadUrl) {
        const res = await fetch(archivo.downloadUrl);
        blob = await res.blob();
        blobsRef.current[archivo.id] = blob;
        // Activar botón compartir archivo (solo útil en móvil)
        setResultadosExportacion(prev => prev.map(r => r.id === archivo.id ? { ...r, descargado: true } : r));
      }
      if (blob) {
        // Disparar descarga: abre diálogo en PC, descarga a carpeta en móvil
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = archivo.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (e) {
      console.error('Error descargando:', e);
    } finally {
      setDescargandoId(null);
    }
  };

  const handleCompartirArchivo = async (archivo) => {
    const blob = blobsRef.current[archivo.id];
    if (!blob) return;
    try {
      const file = new File([blob], archivo.name, { type: blob.type });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: archivo.name });
      }
    } catch (e) {
      console.log('Compartir cancelado:', e);
    }
  };

  // Borrar UN archivo generado, eliminándolo totalmente de la nube (Storage + doc Firestore)
  const [eliminandoId, setEliminandoId] = React.useState(null);
  const handleEliminarArchivo = async (archivo) => {
    if (eliminandoId) return;
    setEliminandoId(archivo.id);
    try {
      if (archivo.downloadUrl) {
        const { ref, deleteObject } = await import('firebase/storage');
        const { storage } = await import('../firebaseConfig');
        const match = archivo.downloadUrl.match(/\/o\/(.+?)\?/);
        if (match) await deleteObject(ref(storage, decodeURIComponent(match[1]))).catch(() => {});
      }
      // Doc de exportaciones/: sólo borrarlo si ningún otro archivo lo comparte
      const m = archivo.id?.match(/^srv_(.+?)_\d+$/);
      const exportId = m ? m[1] : null;
      if (exportId) {
        const otrosDelMismoExport = resultadosExportacion.some(r => r.id !== archivo.id && r.id?.startsWith(`srv_${exportId}_`));
        if (!otrosDelMismoExport) {
          const { deleteDoc, doc: fbDoc } = await import('firebase/firestore');
          await deleteDoc(fbDoc(db, 'exportaciones', exportId)).catch(() => {});
        }
      }
    } catch (e) { console.error('Error eliminando archivo:', e); }
    delete blobsRef.current[archivo.id];
    setResultadosExportacion(prev => prev.filter(r => r.id !== archivo.id));
    try { persistirResultadoLS(`kipo_export_results_${user?.uid || 'anon'}`, { id: archivo.id }, { eliminar: true }); } catch {}
    setEliminandoId(null);
  };
  // 1. Cálculos Iniciales (Safe Nav)
  // FIX: Recalcular stats correctamente incluso si proyecto.dias es undefined (usando filtroPunto o lógica simple)
  // Si es un proyecto nuevo, proyecto.dias puede ser [] o undefined, así que usamos puntos directamente si pertenecen al proyecto (asumiendo que puntos tiene proyectoId, pero aqui solo tenemos diaId).
  // La lógica actual es: puntos -> diaId -> proyecto.dias.
  // Si el proyecto es nuevo, proyecto.dias está vacío, por ende ptsDelProyecto es [].
  // FIX: Debemos asegurar que 'puntos' contenga los puntos de este proyecto.
  // En VistaProyectos, 'puntos' son TODOS los puntos globales? No, el componente padre filtra?
  // VistaProyectos: const [puntos, setPuntos] = useState([]); <- Lee de todos los días.
  // Si añado un punto, se añade a 'puntos'.
  // El problema es que proyecto.dias array debe actualizarse cuando agrego un punto nuevo?
  // O los puntos filtrados dependen de que el día esté en el proyecto.

  const ptsDelProyecto = React.useMemo(() => {
    if (!proyecto || !proyecto.dias) return [];
    // Filtrar puntos cuyo diaId este en proyecto.dias
    return puntos.filter(p => perteneceAProyecto(p, proyecto));
  }, [puntos, proyecto]);

  // FIX: Si ptsDelProyecto es 0 y acabamos de agregar fotos, es porque 'puntos' no se actualizó o 'proyecto.dias' no tiene el día del punto nuevo.
  // Asumiremos que el parent component (VistaProyectos) maneja la integridad de 'puntos'.

  const totalPuntos = ptsDelProyecto.length || 0;
  const totalFotos = React.useMemo(() => ptsDelProyecto.reduce((acc, p) => {
    let count = 0;
    if (p.datos && p.datos.fotos) {
      if (Array.isArray(p.datos.fotos)) {
        count = p.datos.fotos.length;
      } else {
        Object.values(p.datos.fotos).forEach(section => {
          if (section && typeof section === 'object') {
            count += Object.keys(section).length;
          }
        });
      }
    }
    return acc + count;
  }, 0), [ptsDelProyecto]);

  const pesoPromedioFotoMB = 0.3; // 300KB
  const pesoTotalEstimadoMB = (totalFotos * pesoPromedioFotoMB).toFixed(1);

  // 2. Estado Local
  const [activeTab, setActiveTab] = React.useState('EXCEL');
  const [reporteExcel, setReporteExcel] = React.useState('detallado'); // 'detallado' | 'postesPropios'
  const [grupoAbierto, setGrupoAbierto] = React.useState({ listados: true, fotograficos: true }); // grupos contraíbles
  const [stampConfig, setStampConfig] = React.useState({ logoPosition: 'right', mostrarNroPoste: true, mostrarCodFat: true, fondoSello: 'black' });
  const [exportPendiente, setExportPendiente] = React.useState(null); // { tipo, proyecto, limiteCalculado }
  // RF FERRETERÍA: nombres de empresa para el rótulo (ITEM / EMPRESA / CÓDIGO).
  // Se recuerdan por PROYECTO (no son globales: cada plano puede ser de otra empresa).
  const empresasKey = `kipo_empresas_rf_${proyectoId || 'sin'}`;
  const [empresasRf, setEmpresasRf] = React.useState({ electrica: '', propietaria: '', teleco: '' });
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(empresasKey);
      setEmpresasRf(raw ? { electrica: '', propietaria: '', teleco: '', ...JSON.parse(raw) } : { electrica: '', propietaria: '', teleco: '' });
    } catch { setEmpresasRf({ electrica: '', propietaria: '', teleco: '' }); }
  }, [empresasKey]);
  const guardarEmpresasRf = () => { try { localStorage.setItem(empresasKey, JSON.stringify(empresasRf)); } catch {} };
  // CON/SIN DATOS. En RF FERRETERÍA hay un paso extra (nombres de empresa) antes de generar.
  const lanzarExport = (sinDatos) => {
    if (!exportPendiente) return;
    const { tipo, proyecto: proy, limiteCalculado, reporte } = exportPendiente;
    if (reporte === 'ferreteria') {
      setExportPendiente({ ...exportPendiente, sinDatos });
      setModalExportStep('empresas');
      return;
    }
    if (tipo === 'EXCEL') {
      // Un paso más: desde qué poste y hasta cuál entra en el reporte
      setExportPendiente({ ...exportPendiente, sinDatos });
      setRangoExport({ desde: 1, hasta: 0 }); // 0 = hasta el final
      setReinicioRuedas(n => n + 1);
      setModalExportStep('rango');
      return;
    }
    setModalExportStep(null);
    handleExportarServidor(tipo, proy, limiteCalculado, { ...stampConfig, ...(sinDatos ? { sinDatos: true } : {}), ...(reporte ? { reporte } : {}) });
    setExportPendiente(null);
  };

  const lanzarExportRango = () => {
    if (!exportPendiente) return;
    const { tipo, proyecto: proy, limiteCalculado, reporte, sinDatos } = exportPendiente;
    const total = postesDelExport.length;
    const desde = Math.max(1, Math.min(rangoExport.desde || 1, total));
    const hasta = Math.min(total, rangoExport.hasta || total);
    setModalExportStep(null);
    handleExportarServidor(tipo, proy, limiteCalculado, {
      ...stampConfig,
      ...(sinDatos ? { sinDatos: true } : {}),
      ...(reporte ? { reporte } : {}),
      // Solo se manda si de verdad recorta: así un reporte completo viaja igual que siempre
      ...((desde > 1 || hasta < total) ? { desde, hasta } : {})
    });
    setExportPendiente(null);
  };
  const lanzarExportFerreteria = () => {
    if (!exportPendiente) return;
    const { tipo, proyecto: proy, limiteCalculado, reporte, sinDatos } = exportPendiente;
    guardarEmpresasRf();
    setModalExportStep(null);
    handleExportarServidor(tipo, proy, limiteCalculado, { ...stampConfig, ...(sinDatos ? { sinDatos: true } : {}), reporte, empresas: empresasRf });
    setExportPendiente(null);
  };
  // RANGO DE POSTES del reporte. Se guarda como POSICIÓN (1..N) en el orden de
  // tendido, que es el mismo con el que se arman todos los reportes. Se elige de una
  // lista para no tener que teclear el ITEM ni acertar con su formato.
  const [rangoExport, setRangoExport] = React.useState({ desde: 1, hasta: 0 });
  const [reinicioRuedas, setReinicioRuedas] = React.useState(0);
  const postesDelExport = React.useMemo(() => {
    const proy = exportPendiente?.proyecto;
    if (!proy) return [];
    return (puntos || []).filter(p => perteneceAProyecto(p, proy)).sort((a, b) => {
      const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return parseInt(a.id) - parseInt(b.id);
    });
  }, [exportPendiente, puntos]);

  const [modalExportStep, setModalExportStep] = React.useState(null); // null | 'logo' | 'datos' | 'rango' | 'empresas'
  const pendingLogoRef = React.useRef(false);
  // Siempre se genera UN solo archivo (ya no se divide en volúmenes).
  const [cantidadArchivos] = React.useState(1);

  // 3. Cálculos Dinámicos
  const pesoPorArchivo = (cantidadArchivos > 0) ? (totalFotos * pesoPromedioFotoMB / cantidadArchivos).toFixed(1) : 0;

  // Color de advertencia
  let colorPeso = "text-green-600";
  if (pesoPorArchivo > 200) colorPeso = "text-amber-500";
  if (pesoPorArchivo > 500) colorPeso = "text-red-600";

  // Cargar Logo EXCLUSIVAMENTE del Proyecto Actual
  // Si el proyecto tiene logo, se usa. Si no, se muestra vacío.
  // NO usamos user.logoEmpresa para evitar confusión de dependencias.
  React.useEffect(() => {
    // console.log("ExportHubContent: Proyecto cambiado o montado", proyecto?.id, proyecto?.logoEmpresa);
    if (proyecto?.logoEmpresa) {
      setLogoApp(proyecto.logoEmpresa);
    }
    // IMPORTANTE: NO limpiar el logo si proyecto.logoEmpresa es undefined/null PERO
    // acabamos de subir uno localmente (lo cual setLogoApp ya manejaría).
    // El problema es que si cambiamos de proyecto, este efecto corre.
    // Si proyecto nuevo NO tiene logo, debe limpiarse.
    else {
      // Solo limpiamos si el ID del proyecto cambió, para no borrar el progreso de subida en el MISMO proyecto
      // antes de que el prop se actualice.
      // Pero 'setLogoApp' es global/compartido? No, viene de props.
      setLogoApp(null);
    }
  }, [proyecto?.id, proyecto?.logoEmpresa, setLogoApp]); // Dependencia clave: proyecto.id y logo


  // HANDLER LOCAL PARA SUBIR LOGO AL PROYECTO
  const handleCargarLogoLocal = async (e) => {
    const file = e.target.files[0];
    if (!file || !proyectoId) return;

    // Preview
    const localPreview = URL.createObjectURL(file);
    setLogoApp(localPreview);

    try {
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import('../firebaseConfig');
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');

      // 1. Subir a carpeta de proyecto
      const storageRef = ref(storage, `logos_proyectos/${proyectoId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);

      // 2. URL
      const urlDescarga = await getDownloadURL(storageRef);

      // 3. Guardar en documento del proyecto
      const proyRef = doc(db, "proyectos", proyectoId);
      await updateDoc(proyRef, { logoEmpresa: urlDescarga });

      console.log("Logo de proyecto actualizado con éxito:", urlDescarga);
      setLogoApp(urlDescarga);

      if (pendingLogoRef.current) {
        pendingLogoRef.current = false;
        setModalExportStep('datos');
      }

    } catch (error) {
      console.error("Error subiendo logo local:", error);
      alert("Error al subir el logo.");
      setLogoApp(null);
      pendingLogoRef.current = false;
    }
  };

  return (
    <div className="flex flex-col">
      {/* 1. ENCABEADO DE DATOS */}
      <div className="bg-slate-100 p-3 rounded-lg mb-4 flex justify-between items-center text-xs">
        <div className="min-w-0">
          <h4 className="font-black text-2xl text-slate-800 uppercase tracking-tight truncate">{proyecto.nombre}</h4>
        </div>
        <div className="text-right shrink-0 pl-3">
          <span className="block font-black text-slate-900 text-xl leading-none">{totalPuntos} <span className="text-sm font-bold text-slate-500">pts</span> · {totalFotos} <span className="text-sm font-bold text-slate-500">fotos</span></span>
        </div>
      </div>

      {/* 2. GESTIÓN DE LOGO (Mejorada) */}
      <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-2 block">Logo del Reporte</label>
        {logoApp ? (
          <div className="flex items-center justify-between gap-3">
            {/* PREVIEW AUMENTADA - Céntrado + Borde Negro Dashed */}
            <div className="flex-1 h-24 border-2 border-dashed border-slate-800 rounded-lg bg-white p-2 flex items-center justify-center relative overflow-hidden group">
              <img src={logoApp} alt="Logo" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => inputLogoRef.current?.click()}
                className="p-3 bg-blue-100 text-blue-800 border-2 border-blue-200 rounded-lg active:scale-95 transition-all hover:bg-blue-200"
                title="Cambiar Logo"
              >
                <Edit size={20} strokeWidth={2.5} />
              </button>
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCargarLogoLocal}
              />
              <button
                onClick={async () => {
                  setLogoApp(null);
                  // Borrar de Usuario y Proyecto
                  if (user && proyectoId) {
                    try {
                      const { doc, updateDoc, getDoc } = await import('firebase/firestore');
                      const { db } = await import('../firebaseConfig');

                      // Solo borramos de la colección 'proyectos'
                      const proyRef = doc(db, "proyectos", proyectoId);
                      await updateDoc(proyRef, { logoEmpresa: null });

                      console.log("Logo eliminado del proyecto:", proyectoId);


                    } catch (err) {
                      console.error("Error eliminando logo del proyecto:", err);
                    }
                  }
                }}
                className="p-3 bg-red-100 text-red-600 border-2 border-red-600 rounded-lg active:scale-95 transition-all hover:bg-red-200"
                title="Eliminar Logo"
              >
                <Trash2 size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => inputLogoRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-slate-400 rounded-xl text-slate-800 text-xs font-black flex items-center justify-center gap-2 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <UploadCloud size={20} strokeWidth={2.5} />
              SUBIR LOGO DE EMPRESA
            </button>
            <input
              ref={inputLogoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCargarLogoLocal}
            />
          </div>
        )}
      </div>

      {/* 2.5. CONFIGURADOR DE SELLO (mismo estilo tenue que la tarjeta del logo) */}
      <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-2 block">Configurar Sello de Exportación</label>

        {(() => {
          const fondo = stampConfig.fondoSello || 'white';
          const prevBarBg = fondo === 'black' ? 'rgba(0,0,0,0.80)' : fondo === 'glass' ? 'rgba(50,50,50,0.45)' : 'rgba(255,255,255,0.92)';
          const prevClr1 = fondo === 'white' ? '#000000' : fondo === 'black' ? '#FCBF26' : '#ffffff';
          const prevClr2 = fondo === 'white' ? '#000000' : fondo === 'black' ? '#FCBF26' : '#ffffff';
          const prevClr3 = fondo === 'white' ? '#000000' : '#ffffff';
          const prevClrR = fondo === 'white' ? '#000000' : '#ffffff';
          const prevClrRL = fondo === 'white' ? '#000000' : '#ffffff';
          const prevDiv = fondo === 'white' ? '#cbd5e1' : fondo === 'glass' ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)';
          return (
          <div className="space-y-3">

            {/* Posición del Logo */}
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5 block">Logo en la parte superior</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStampConfig(c => ({ ...c, logoPosition: 'left' }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${stampConfig.logoPosition === 'left' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-900 text-slate-600 hover:border-slate-500'}`}
                >
                  Izquierda
                </button>
                <button
                  onClick={() => setStampConfig(c => ({ ...c, logoPosition: 'right' }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${stampConfig.logoPosition === 'right' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-900 text-slate-600 hover:border-slate-500'}`}
                >
                  Derecha
                </button>
              </div>
            </div>

            {/* Identificadores */}
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5 block">Identificador en Fotos</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStampConfig(c => ({ ...c, mostrarNroPoste: !c.mostrarNroPoste }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${stampConfig.mostrarNroPoste ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-900 text-slate-600 hover:border-slate-500'}`}
                >
                  Item
                </button>
                <button
                  onClick={() => setStampConfig(c => ({ ...c, mostrarCodFat: !c.mostrarCodFat }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${stampConfig.mostrarCodFat ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-900 text-slate-600 hover:border-slate-500'}`}
                >
                  Pasivo
                </button>
              </div>
            </div>

            {/* Fondo del Sello */}
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5 block">Fondo del Sello</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStampConfig(c => ({ ...c, fondoSello: 'glass' }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${stampConfig.fondoSello === 'glass' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-900 text-slate-600 hover:border-slate-500'}`}
                >
                  Vidrio
                </button>
                <button
                  onClick={() => setStampConfig(c => ({ ...c, fondoSello: 'white' }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${stampConfig.fondoSello === 'white' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-900 text-slate-600 hover:border-slate-500'}`}
                >
                  Blanco
                </button>
                <button
                  onClick={() => setStampConfig(c => ({ ...c, fondoSello: 'black' }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${stampConfig.fondoSello === 'black' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-900 text-slate-600 hover:border-slate-500'}`}
                >
                  Negro
                </button>
              </div>
            </div>

            {/* Preview visual del layout */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 text-center">Vista previa del sello</p>
              {/* Simula la imagen con barra inferior */}
              <div className="relative rounded overflow-hidden border border-slate-300 bg-slate-300" style={{ height: '80px' }}>
                {/* Logo en esquina superior */}
                <div className={`absolute top-1 ${stampConfig.logoPosition === 'left' ? 'left-1' : 'right-1'} bg-white/80 border border-slate-400 rounded px-1.5 py-0.5 text-[7px] font-black text-slate-600`}>
                  LOGO
                </div>
                {/* Barra inferior — 3 columnas: 25% | 40% | 35% */}
                <div className="absolute bottom-0 left-0 right-0 flex items-center border-t border-slate-400" style={{ height: '38%', backgroundColor: prevBarBg }}>
                  {/* Col 1: Proyecto / Item+Pasivo (25%) — negrita */}
                  <div className="flex flex-col justify-center overflow-hidden shrink-0" style={{ width: '25%', padding: '1px 3px 1px 4px', gap: '1px' }}>
                    <span className="font-black truncate leading-none" style={{ fontSize: '6px', color: prevClr1 }}>PROYECTO</span>
                    <span className="font-black truncate leading-none" style={{ fontSize: '6px', color: prevClr2 }}>
                      {stampConfig.mostrarNroPoste && '001'}
                      {stampConfig.mostrarNroPoste && stampConfig.mostrarCodFat && ' | '}
                      {stampConfig.mostrarCodFat && 'M25'}
                      {!stampConfig.mostrarNroPoste && !stampConfig.mostrarCodFat && '—'}
                    </span>
                  </div>
                  {/* Divisor 1 */}
                  <div className="self-stretch shrink-0" style={{ width: '1px', margin: '2px 0', backgroundColor: prevDiv }}></div>
                  {/* Col 2: Fecha+Hora / GPS (40%) — centrado */}
                  <div className="flex flex-col justify-center items-center overflow-hidden shrink-0" style={{ width: '40%', padding: '1px 3px', gap: '1px' }}>
                    <span className="truncate leading-none" style={{ fontSize: '6px', color: prevClr3 }}>15/01/2025 · 09:30</span>
                    <span className="truncate leading-none" style={{ fontSize: '6px', color: prevClrR }}>-12.345, -76.987</span>
                  </div>
                  {/* Divisor 2 */}
                  <div className="self-stretch shrink-0" style={{ width: '1px', margin: '2px 0', backgroundColor: prevDiv }}></div>
                  {/* Col 3: Dirección / Ubicación (35% restante) — alineado a la derecha */}
                  <div className="flex flex-col justify-center overflow-hidden flex-1" style={{ padding: '1px 4px 1px 3px', gap: '1px' }}>
                    <span className="truncate leading-none" style={{ fontSize: '6px', color: prevClrR, textAlign: 'right' }}>Av. Principal 123</span>
                    <span className="truncate leading-none" style={{ fontSize: '6px', color: prevClrRL, textAlign: 'right' }}>Arequipa, Arequipa</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
          );
        })()}
      </div>

      {/* 3. PESTAÑAS (Alto Contraste y Distinción) */}
      <div className="flex border-b-2 border-slate-300 mb-4">
        {['EXCEL', 'ZIP', 'KMZ'].map(tab => (
          <button
            key={tab}
            onClick={() => !exportandoTipo && setActiveTab(tab)}
            className={`flex-1 py-3 text-xs font-black transition-colors border-b-4 -mb-[2px] ${activeTab === tab
              ? 'border-black text-black bg-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}
              ${exportandoTipo ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. CONTENIDO PRINCIPAL */}
      <div className="relative mb-4">

        {/* PANTALLA DE CONFIGURACIÓN (siempre visible para generar uno a uno) */}
        {true && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

            {/* TEXTO DESCRIPTIVO (Tenue y Pequeño - Sin Fondo, Pegado Arriba) */}
            <div className="text-center mt-1 px-4">
              <p className={`text-[10px] uppercase font-bold tracking-widest ${activeTab === 'ZIP' ? 'text-blue-400' :
                activeTab === 'EXCEL' ? 'text-green-600' :
                  'text-amber-600'
                }`}>
                {activeTab === 'ZIP' && "Carpeta de Fotos Organizada"}
                {activeTab === 'KMZ' && "Google Earth + Ubicaciones"}
              </p>
            </div>

            {/* SELECTOR DE FORMATO DE REPORTE (solo Excel) */}
            {activeTab === 'EXCEL' && (() => {
              const LISTADOS = [
                ['cuantificado', 'CUANTIFICADO DE MATERIALES'],
                ['liquidacion', 'LIQUIDACIÓN DE MATERIALES'],
                ['listadoPostes', 'LISTADO DE POSTES ELÉCTRICOS'],
                ['listadoUtilizados', 'LISTADO DE POSTES UTILIZADOS'],
              ];
              const FOTOGRAFICOS = [
                ['postesPropios', 'RF POSTES PROPIOS'],
                ['postesElectricos', 'RF POSTES ELÉCTRICOS'],
                ['ferreteria', 'RF DE FERRETERÍA'],
                ['tendido', 'RF TENDIDO DE FO'],
                ['rfEquiposPasivos', 'RF EQUIPOS PASIVOS'],
              ];
              const fechaCorta = (ts) => { try { return new Date(ts || Date.now()).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return ''; } };
              const horasRestantes = (ts) => Math.max(0, 48 - Math.floor((Date.now() - (ts || Date.now())) / 3600000));
              // Reportes que se generan en el SERVIDOR (se puede cerrar la app); el resto es client-side.
              const EN_SERVIDOR = new Set(['detallado', 'postesPropios', 'postesElectricos', 'tendido', 'ferreteria', 'rfEquiposPasivos', 'tendidoRamales']);
              const iconBtn = 'w-8 h-8 flex items-center justify-center rounded-lg border-2 border-white text-white active:scale-95 transition-all disabled:opacity-30 shrink-0';
              const renderFila = (id, label) => {
                const res = resultadosExportacion.find(r => r.type === 'EXCEL' && (r.reporte || 'detallado') === id);
                const cargando = res?.cargando;
                const listo = res && !res.cargando;

                // GENERADO → fondo negro, nombre + (pts · peso) + (fecha · horas), 4 botones lineales.
                if (listo) {
                  const mb = (res.blob.size / 1024 / 1024).toFixed(2);
                  return (
                    <div key={id} className="w-full rounded-lg bg-slate-900 text-white px-3 py-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black leading-tight break-words line-clamp-2">{label}</p>
                        <p className="text-[10px] text-slate-300 font-bold mt-0.5">{res.numPuntos ?? 0} pts · {mb} MB</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{fechaCorta(res.timestamp)} · {horasRestantes(res.timestamp)}h para eliminarse</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button disabled={!res.downloadUrl} onClick={() => navigator.share?.({ url: res.downloadUrl, title: `${res.name} - ${proyecto?.nombre || ''}` })} className={iconBtn} title="Compartir enlace"><Link2 size={15} /></button>
                        <button disabled={!res.downloadUrl || descargandoId === res.id} onClick={() => handleDescargar(res)} className={iconBtn} title="Descargar">
                          {descargandoId === res.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        </button>
                        <button disabled={!res.descargado} onClick={() => handleCompartirArchivo(res)} className={iconBtn} title="Compartir archivo"><Share2 size={15} /></button>
                        <button disabled={eliminandoId === res.id} onClick={() => handleEliminarArchivo(res)} className={`${iconBtn} text-red-400`} title="Borrar de la nube">
                          {eliminandoId === res.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>
                  );
                }

                // GENERANDO → mensaje según dónde se procesa + spinner.
                if (cargando) {
                  const msg = EN_SERVIDOR.has(id)
                    ? 'Generándose en el servidor… puedes salir de la app'
                    : 'Generando…';
                  return (
                    <div key={id} className="w-full rounded-lg border border-slate-900 bg-white px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-900 leading-tight">{label}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">{msg}</p>
                      </div>
                      <Loader2 size={18} className="animate-spin text-slate-500 shrink-0" />
                    </div>
                  );
                }

                // SIN GENERAR → nombre del reporte + botón GENERAR.
                return (
                  <div key={id} className="w-full rounded-lg border border-slate-900 bg-white px-3 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 leading-tight">{label}</p>
                    </div>
                    <button onClick={() => generarReporte(id)} className="shrink-0 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-black active:scale-95 transition-all hover:bg-slate-800">
                      GENERAR
                    </button>
                  </div>
                );
              };
              const renderGrupo = (clave, titulo, items) => {
                const abierto = grupoAbierto[clave];
                return (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setGrupoAbierto(g => ({ ...g, [clave]: !g[clave] }))}
                      className="w-full flex items-center justify-between"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{titulo}</span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                    </button>
                    {abierto && (
                      <div className="space-y-2 mt-2">
                        {items.map(([id, label]) => renderFila(id, label))}
                      </div>
                    )}
                  </div>
                );
              };
              return (
              <div className="space-y-4">
                {/* DATOS + FOTOS y REPORTE DE TENDIDO — fuera de los grupos, primero */}
                {renderFila('detallado', 'DATOS + FOTOS')}
                {perfilActivo === 'avanzado' && renderFila('tendidoRamales', 'REPORTE DE TENDIDO')}
                {/* Listados y reportes con plantilla: EXCLUSIVOS del perfil AVANZADO */}
                {perfilActivo === 'avanzado' ? (
                  <>
                    {renderGrupo('listados', 'Listados', LISTADOS)}
                    {renderGrupo('fotograficos', 'Reportes fotográficos', FOTOGRAFICOS)}
                  </>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-300 px-4 py-3">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Listados y reportes fotográficos</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Disponibles en el perfil AVANZADO.</p>
                  </div>
                )}
              </div>
              );
            })()}

            {/* BOTÓN GENERAR — solo ZIP/KMZ (en EXCEL cada fila tiene su propio GENERAR) */}
            {activeTab !== 'EXCEL' && (
            <button
              disabled={genCuant || genLiq || genList || genUtil || genEstado || genRfPasivos}
              onClick={() => {
                // CUANTIFICADO / LIQUIDACIÓN: client-side directo (un solo Excel, sin fotos)
                if (activeTab === 'EXCEL' && reporteExcel === 'cuantificado') { generarCuantificado(); return; }
                if (activeTab === 'EXCEL' && reporteExcel === 'liquidacion') { generarLiquidacion(); return; }
                if (activeTab === 'EXCEL' && reporteExcel === 'listadoPostes') { generarListado(); return; }
                if (activeTab === 'EXCEL' && reporteExcel === 'listadoUtilizados') { generarUtilizados(); return; }
                if (activeTab === 'EXCEL' && reporteExcel === 'rfEquiposPasivos') { setAskSelloRf(true); return; }
                // FORCE SPLIT LOGIC:
                // Si cantidadArchivos > 1, debemos asegurar que el límite sea menor al total para forzar el corte.
                // Usamos Math.floor y restamos un pequeño margen si es necesario, o simplemente división exacta.
                // Ejemplo: 10 fotos, 2 archivos. Límite ideal = 5. 
                // Si el loop acumula 5, corta. 
                // Pero si hay fotos "pesadas" o lógica de agrupación?
                // Mejor usar división simple Math.ceil para no dejar huérfanos, pero los exporters usan > LIMITE.
                // Si Fotos=10, Límite=5. 5 > 5 es False. No corta. Acumula 6. 6 > 5 True. Corta.
                // Entonces el primer volumen tendría 6. El segundo 4.
                // Si queremos equidad, el límite debería ser un poco menos? No, mejor pasar el número de archivos deseado y que el exporter calcule?
                // No puedo cambiar firma de exporter ahora fácil.
                // Ajuste: Si quiero 2 archivos de 10 fotos. Límite = 5.
                // Exporter: if (buffer + current > limit). 
                // Si current es 1. Buffer 4. 4+1 > 5 (False). Buffer 5.
                // Next punto. Buffer 5. Current 1. 5+1 > 5 (True). Corta. Vol1 = 5.
                // Funciona perfecto con división exacta.
                // PERO si Total < Cantidad? (ej 1 foto, 2 archivos). Math.ceil(1/2) = 1.
                // Buffer 0. Current 1. 1 > 1 (False). No corta. Vol1 = 1. No sale Vol2.
                // Es correcto, no puedes sacar 2 archivos de 1 foto.

                // FORCE SPLIT LOGIC REVISADA:
                // El exporter usa: pesoLogico = Math.max(fotosPunto, 1).
                // Por tanto, debemos calcular el Total basado en esa misma regla.
                let maxPesoPunto = 0;
                const totalPesoCalculado = ptsDelProyecto.reduce((acc, p) => {
                  let fotos = 0;
                  if (p.datos && p.datos.fotos) {
                    if (Array.isArray(p.datos.fotos)) {
                      fotos = p.datos.fotos.length;
                    } else {
                      Object.values(p.datos.fotos).forEach(section => {
                        if (section && typeof section === 'object') {
                          fotos += Object.values(section).filter(v => v && (typeof v === 'string' || v.url)).length;
                        }
                      });
                    }
                  }
                  const peso = Math.max(fotos, 1);
                  if (peso > maxPesoPunto) maxPesoPunto = peso;
                  return acc + peso;
                }, 0);

                let limiteCalculado = Math.ceil(totalPesoCalculado / cantidadArchivos);

                // AJUSTE PARA FRAGMENTACIÓN:
                // Si items grandes no caben exacto, se desperdicia espacio en el volumen anterior.
                // Aumentamos el límite un margen seguro (mitad del item más grande o 1 si son pequeños) para absorber ese desperdicio
                // y no generar volúmenes extra.
                if (cantidadArchivos > 1) {
                  const margen = Math.max(Math.ceil(maxPesoPunto / 2), 1);
                  limiteCalculado += margen;
                }

                setExportPendiente({ tipo: activeTab, proyecto, limiteCalculado, reporte: activeTab === 'EXCEL' && (reporteExcel === 'postesPropios' || reporteExcel === 'postesElectricos' || reporteExcel === 'tendido' || reporteExcel === 'ferreteria') ? reporteExcel : null });
                if (!logoApp) {
                  setModalExportStep('logo');
                } else {
                  setModalExportStep('datos');
                }
              }}
              className="w-full py-3 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800"
            >
              GENERAR ARCHIVO
            </button>
            )}

          </div>
        )}

        {/* Elegir sello para el RF de equipos pasivos (fotos) */}
        {askSelloRf && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6" onClick={() => setAskSelloRf(false)}>
            <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-slate-800 text-lg mb-1">¿Imprimir datos en las fotos?</h3>
              <p className="text-slate-500 text-sm mb-5">Con datos imprime el sello con GPS, fecha y proyecto. Sin datos usa las fotos originales limpias.</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setAskSelloRf(false); lanzarRfServidor(true); }} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform">CON DATOS</button>
                <button onClick={() => { setAskSelloRf(false); lanzarRfServidor(false); }} className="w-full border-2 border-slate-300 text-slate-700 font-bold py-3 rounded-xl active:scale-95 transition-transform">SIN DATOS</button>
                <button onClick={() => setAskSelloRf(false)} className="w-full py-2 rounded-xl font-bold text-xs text-slate-500">CANCELAR</button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA DE RESULTADOS (solo ZIP/KMZ — en EXCEL el resultado va inline en su selector) */}
        {activeTab !== 'EXCEL' && resultadosExportacion.filter(r => r.type === activeTab).length > 0 && (
          <div className="space-y-3">
            <div className="bg-slate-50 text-slate-400 p-2 rounded text-[10px] text-center mb-2">
              Los archivos expiran en 48h. Puedes cerrar la app mientras se genera.
            </div>

            {resultadosExportacion.filter(r => r.type === activeTab).map((archivo) => (
              <div key={archivo.id} className="relative bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm overflow-hidden">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  archivo.cargando ? 'bg-slate-100 text-slate-400' :
                  activeTab === 'ZIP' ? 'bg-blue-100 text-blue-600' :
                  activeTab === 'EXCEL' ? 'bg-green-100 text-green-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {archivo.cargando
                    ? <Loader2 size={20} className="animate-spin" />
                    : activeTab === 'ZIP' ? <FolderDown size={20} />
                    : activeTab === 'EXCEL' ? <FileDown size={20} />
                    : <Share2 size={20} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-slate-700 truncate">
                    {archivo.cargando ? `Procesando ${archivo.type}...` : archivo.name}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {archivo.cargando
                      ? (archivo.type === 'EXCEL' ? 'Generando en este equipo — no cierres la app' : 'Servidor trabajando — puedes cerrar la app')
                      : `${(archivo.blob.size / 1024 / 1024).toFixed(2)} MB${archivo.numPuntos ? ` • ${archivo.numPuntos} pts` : ''}`
                    }
                  </p>
                </div>

                {/* Botón Compartir Link */}
                <button
                  disabled={archivo.cargando || !archivo.downloadUrl}
                  onClick={() => navigator.share?.({ url: archivo.downloadUrl, title: `${archivo.name} - ${proyecto?.nombre || ''}` })}
                  className={`p-2 rounded-lg border-2 transition-all flex-shrink-0 ${
                    archivo.cargando || !archivo.downloadUrl
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-slate-900 text-slate-900 hover:bg-slate-50 active:scale-95'
                  }`}
                >
                  <Link2 size={16} />
                </button>

                {/* Botón Descargar */}
                <button
                  onClick={() => !archivo.cargando && handleDescargar(archivo)}
                  disabled={archivo.cargando || !archivo.downloadUrl || descargandoId === archivo.id}
                  className={`p-2 rounded-lg border-2 transition-all flex-shrink-0 ${
                    archivo.cargando || !archivo.downloadUrl || descargandoId === archivo.id
                      ? 'border-slate-100 text-slate-300 pointer-events-none'
                      : 'border-slate-900 text-slate-900 hover:bg-slate-50 active:scale-95'
                  }`}
                >
                  {descargandoId === archivo.id
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Download size={16} />
                  }
                </button>

                {/* Botón Compartir Archivo (solo útil en móvil, se activa tras descargar) */}
                <button
                  onClick={() => handleCompartirArchivo(archivo)}
                  disabled={!archivo.descargado}
                  className={`p-2 rounded-lg border-2 transition-all flex-shrink-0 ${
                    archivo.descargado
                      ? 'border-green-400 text-green-600 hover:bg-green-50 active:scale-95'
                      : 'border-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <Share2 size={16} />
                </button>

                {/* Botón cancelar export en progreso */}
                {archivo.cargando && (
                  <button
                    onClick={() => {
                      try { localStorage.removeItem(`kipo_export_pending_${user?.uid || 'anon'}`); } catch {}
                      setResultadosExportacion(prev => prev.filter(r => r.id !== archivo.id));
                    }}
                    className="p-2 rounded-lg border-2 border-red-300 text-red-400 hover:bg-red-50 active:scale-95 transition-all flex-shrink-0"
                    title="Cancelar"
                  >
                    <X size={16} />
                  </button>
                )}

                {/* Botón borrar este archivo de la nube (solo cuando ya está generado) */}
                {!archivo.cargando && (
                  <button
                    onClick={() => handleEliminarArchivo(archivo)}
                    disabled={eliminandoId === archivo.id}
                    className="p-2 rounded-lg border-2 border-red-200 text-red-500 hover:bg-red-50 active:scale-95 transition-all flex-shrink-0 disabled:opacity-40"
                    title="Borrar archivo de la nube"
                  >
                    {eliminandoId === archivo.id
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Trash2 size={16} />}
                  </button>
                )}

              </div>
            ))}

          </div>
        )}
      </div>

      {/* MODAL: LOGO NO DETECTADO */}
      {modalExportStep === 'logo' && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalExportStep(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-full shrink-0">
                <AlertTriangle size={24} className="text-orange-500" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 mb-1">Falta el logo</h3>
                <p className="text-sm text-slate-600 leading-snug">No hay logo cargado para este proyecto. ¿Deseas subirlo ahora o continuar sin él?</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setModalExportStep(null);
                  pendingLogoRef.current = true;
                  inputLogoRef.current?.click();
                }}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <UploadCloud size={18} /> SUBIR LOGO
              </button>
              <button
                onClick={() => setModalExportStep('datos')}
                className="w-full border-2 border-slate-300 text-slate-700 font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                CONTINUAR SIN LOGO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RF de postes sin puntos de ese tipo */}
      {avisoSinPostes && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAvisoSinPostes(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-amber-100 p-2 rounded-full shrink-0">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 mb-1">Sin {avisoSinPostes.texto}</h3>
                <p className="text-sm text-slate-600 leading-snug">
                  Este proyecto no tiene {avisoSinPostes.texto}. El reporte saldrá vacío (solo el encabezado y un aviso).
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { const id = avisoSinPostes.id; setAvisoSinPostes(null); generarReporte(id, true); }}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                GENERAR DE TODAS MANERAS
              </button>
              <button
                onClick={() => setAvisoSinPostes(null)}
                className="w-full border-2 border-slate-300 text-slate-700 font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                NO GENERAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOMBRES DE EMPRESA (solo RF FERRETERÍA, tras elegir con/sin datos) */}
      {modalExportStep === 'empresas' && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalExportStep(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-lg text-slate-900 mb-1">Nombres de empresa</h3>
            <p className="text-sm text-slate-600 leading-snug mb-4">
              Van en el rótulo de cada foto (ITEM / EMPRESA / CÓDIGO), según el propietario del poste. Se recuerdan para este proyecto.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {[
                ['electrica', 'Empresa eléctrica'],
                ['propietaria', 'Empresa propietaria'],
                ['teleco', 'Empresa de telecomunicaciones'],
              ].map(([k, ph]) => (
                <input
                  key={k}
                  value={empresasRf[k] || ''}
                  onChange={e => setEmpresasRf(prev => ({ ...prev, [k]: e.target.value.toUpperCase() }))}
                  placeholder={ph}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 text-sm font-bold uppercase outline-none focus:border-orange-500"
                />
              ))}
            </div>
            <button
              onClick={lanzarExportFerreteria}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
            >
              GENERAR REPORTE
            </button>
            <button
              onClick={() => setModalExportStep('datos')}
              className="w-full py-2 mt-2 rounded-xl font-bold text-xs text-slate-500"
            >
              ← ATRÁS
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ¿IMPRIMIR DATOS EN FOTOS? */}
      {modalExportStep === 'rango' && (() => {
        const total = postesDelExport.length;
        const desde = Math.max(1, Math.min(rangoExport.desde || 1, total));
        const hasta = Math.min(total, rangoExport.hasta || total);
        const opcionesPostes = postesDelExport.map((p, i) => ({
          valor: i + 1,
          // Solo el ITEM: la posición es interna y al técnico no le dice nada,
          // reconoce el poste por su item.
          etiqueta: p?.datos?.numero || 'sin item'
        }));
        return (
          <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalExportStep(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-full shrink-0">
                  <ListOrdered size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 mb-1">¿Qué postes entran?</h3>
                  <p className="text-sm text-slate-600 leading-snug">
                    En orden de posición. Déjalo como está para incluirlos todos.
                  </p>
                </div>
              </div>

              <div className="flex items-stretch gap-2 mb-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-black tracking-widest text-slate-500 mb-1 text-center">DESDE</label>
                  <RuedaSelector
                    key={`desde-${reinicioRuedas}`}
                    items={opcionesPostes}
                    valor={desde}
                    onChange={(v) => setRangoExport(r => ({ ...r, desde: v }))}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-black tracking-widest text-slate-500 mb-1 text-center">HASTA</label>
                  <RuedaSelector
                    key={`hasta-${reinicioRuedas}`}
                    items={opcionesPostes}
                    valor={hasta}
                    onChange={(v) => setRangoExport(r => ({ ...r, hasta: v }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-3">
                <button
                  onClick={() => { setRangoExport({ desde: 1, hasta: total }); setReinicioRuedas(n => n + 1); }}
                  className={`px-3 py-1.5 rounded-lg border-2 text-[11px] font-black tracking-widest transition-all ${desde === 1 && hasta === total
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 text-slate-600 active:scale-95'}`}
                >
                  TODOS
                </button>
                <p className="text-xs font-black text-slate-600">
                  {hasta >= desde
                    ? `${hasta - desde + 1} de ${total} postes`
                    : 'El "hasta" va después del "desde"'}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={lanzarExportRango}
                  disabled={hasta < desde}
                  className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-40"
                >
                  GENERAR
                </button>
                <button
                  onClick={() => setModalExportStep(null)}
                  className="w-full border-2 border-slate-300 text-slate-700 font-bold py-3 rounded-xl active:scale-95 transition-transform"
                >
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {modalExportStep === 'datos' && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalExportStep(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-full shrink-0">
                <ImageIcon size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 mb-1">¿Imprimir datos en las fotos?</h3>
                <p className="text-sm text-slate-600 leading-snug">
                  Con datos imprime el sello con GPS, fecha y proyecto. Sin datos usa las fotos originales limpias.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => lanzarExport(false)}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                CON DATOS
              </button>
              <button
                onClick={() => lanzarExport(true)}
                className="w-full border-2 border-slate-300 text-slate-700 font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                SIN DATOS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VistaProyectos;