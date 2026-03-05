
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, ChevronDown, Eye, EyeOff, Trash2, MapPin,
  FolderDown, FileDown, Share2, Folder, X, Key, Users, Check, XCircle, Copy, MessageCircle, Image as ImageIcon, Info, Download, Loader2, Minus, AlertTriangle, Lock, UploadCloud, Edit, Link2
} from 'lucide-react';
import { Modal, ThemedInput } from '../components/UI';
import { compartirODescargar } from '../utils/helpers';
import { descargarReporteExcel, descargarFotosZip, handleExportKML } from '../utils/exporters';
import { crearExportacion, suscribirseAExportacion } from '../services/exportacionService';
import { COLORES_DIA } from '../data/constantes';
import ChatBitacora from '../components/ChatBitacora';

const VistaProyectos = ({
  theme, isDark, proyectos, proyectoActual, puntos, diasVisibles,
  config, logoApp, vista, setVista, setTempData, setModalOpen, modalOpen,
  seleccionarProyecto, diaActual, setDiaActual, toggleVisibilidadDia,
  cambiarColorDia, toggleVisibilidadProyecto, cambiarColorProyecto,
  solicitarBorrarProyecto, irUbicacionProyecto, setExportData, selectorColorAbierto,
  setSelectorColorAbierto, tempData, confirmarCrearProyecto, confirmarCrearDia,
  aprobarSupervisor, rechazarSupervisor, eliminarSupervisor, user, setAlertData, setConfirmData,
  setLogoApp, handleCargarLogo, setPuntoSeleccionado, setModoLectura, setModoEdicion, setDatosFormulario, setVistaAnterior, setMapViewState, modalPendiente, setModalPendiente, setMostrarOverlayGPS, onVolver,
  notificacionesProyectos = {}, marcarChatLeido, conexiones
}) => {

  const [codigoCopiado, setCodigoCopiado] = React.useState(false);
  const [colorMenuPos, setColorMenuPos] = React.useState(null); // Posición del menú de color (para evitar overflow)
  const [altaCalidadMissingConfig, setAltaCalidadMissingConfig] = React.useState(false);
  const [altaCalidadSinLogoStep, setAltaCalidadSinLogoStep] = React.useState(false);

  // DERIVED STATE: Always use the fresh project data from the list, not the potentially stale prop
  const activeProjectData = React.useMemo(() => {
    return proyectos.find(p => p.id === proyectoActual?.id) || proyectoActual;
  }, [proyectos, proyectoActual]);

  // Estado para exportación
  const [exportandoTipo, setExportandoTipo] = React.useState(null); // 'ZIP' | 'EXCEL' | 'KMZ' | null
  const [resultadosExportacion, setResultadosExportacion] = React.useState(() => {
    try {
      const saved = localStorage.getItem('kipo_export_results');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      // Descartar resultados de más de 48h (los links del servidor expiran)
      const corte = Date.now() - 48 * 60 * 60 * 1000;
      return parsed.filter(r => !r.cargando && r.timestamp > corte);
    } catch { return []; }
  });
  const abortControllerRef = React.useRef(null);

  // Persistir resultados completados en localStorage
  React.useEffect(() => {
    const completados = resultadosExportacion.filter(r => !r.cargando);
    if (completados.length > 0) {
      localStorage.setItem('kipo_export_results', JSON.stringify(completados));
    } else {
      localStorage.removeItem('kipo_export_results');
    }
  }, [resultadosExportacion]);

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
    const tempId = `srv_loading_${Date.now()}`;
    setResultadosExportacion(prev => [...prev, {
      id: tempId, type: tipo, name: `Generando ${tipo}...`,
      cargando: true, downloadUrl: null, blob: { size: 0 }, numPuntos: 0,
    }]);
    try {
      const exportId = await crearExportacion(proy.id, tipo, limiteFotos, stampConfig);
      localStorage.setItem('kipo_export_pending', JSON.stringify({
        exportId, tipo, proyectoId: proy.id, timestamp: Date.now()
      }));
      const unsubscribe = suscribirseAExportacion(exportId, (exportData) => {
        if (exportData.status === 'listo') {
          unsubscribe();
          localStorage.removeItem('kipo_export_pending');
          const ts = Date.now();
          const nuevosResultados = (exportData.resultados || []).map((r, i) => ({
            id: `srv_${exportId}_${i}`,
            type: tipo, name: r.nombre,
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
          unsubscribe();
          localStorage.removeItem('kipo_export_pending');
          setResultadosExportacion(prev => prev.filter(r => r.id !== tempId));
          setAlertData({ title: 'Error del servidor', message: exportData.error || 'Error procesando la exportación.' });
        }
      });
    } catch (error) {
      console.error('Error iniciando exportación servidor:', error);
      setResultadosExportacion(prev => prev.filter(r => r.id !== tempId));
      setAlertData({ title: 'Error', message: 'No se pudo conectar con el servidor. Verifica tu conexión.' });
    }
  };

  // Recuperar exportación pendiente si el usuario cerró la app mientras el servidor procesaba
  React.useEffect(() => {
    const raw = localStorage.getItem('kipo_export_pending');
    if (!raw) return;
    let pending;
    try { pending = JSON.parse(raw); } catch { localStorage.removeItem('kipo_export_pending'); return; }
    const { exportId, tipo, proyectoId, timestamp } = pending;
    if (proyectoId !== proyectoActual?.id) return;
    // Links del servidor expiran en 48h, no tiene sentido recuperar más tarde
    if (Date.now() - timestamp > 48 * 60 * 60 * 1000) {
      localStorage.removeItem('kipo_export_pending');
      return;
    }
    const tempId = `srv_recovery_${exportId}`;
    setResultadosExportacion(prev => {
      if (prev.some(r => r.id === tempId)) return prev;
      return [...prev, { id: tempId, type: tipo, name: `Generando ${tipo}...`, cargando: true, downloadUrl: null, blob: { size: 0 }, numPuntos: 0 }];
    });
    const unsubscribe = suscribirseAExportacion(exportId, (exportData) => {
      if (exportData.status === 'listo') {
        unsubscribe();
        localStorage.removeItem('kipo_export_pending');
        const ts = Date.now();
        const nuevosResultados = (exportData.resultados || []).map((r, i) => ({
          id: `srv_${exportId}_${i}`,
          type: tipo, name: r.nombre,
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
        unsubscribe();
        localStorage.removeItem('kipo_export_pending');
        setResultadosExportacion(prev => prev.filter(r => r.id !== tempId));
        setAlertData({ title: 'Error del servidor', message: exportData.error || 'Error procesando.' });
      }
    });
    return () => unsubscribe();
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
        } else if (tipo === 'EXCEL') {
          res = await descargarReporteExcel(proy, puntos, logoApp, config, signal, limiteFotos, stampConfig);
        } else if (tipo === 'KMZ') {
          res = await handleExportKML(proy, puntos, conexiones || [], logoApp, null, signal, limiteFotos, stampConfig);
        }

        // Agregar ID único y timestamp y TIPO CORRECTO
        const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const nuevosResultados = res.map(r => ({
          ...r,
          type: tipo, // Forzar el tipo para que coincida con el filtro de la UI
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

  // Marcar como leído al abrir chat
  React.useEffect(() => {
    if (modalLocalOpen?.startsWith('CHAT_') && proyectoActual && marcarChatLeido) {
      marcarChatLeido(proyectoActual.id);
    }
  }, [modalLocalOpen, proyectoActual?.id, marcarChatLeido]);

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

  const copiarCodigo = (codigo) => {
    navigator.clipboard.writeText(codigo);
    setCodigoCopiado(true);
    setTimeout(() => setCodigoCopiado(false), 2000);
  };

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
            <div className="w-6"></div>
          </div>

          <div className={`${theme.header} shrink-0 p-2 z-10 shadow-sm`}>
            <button
              onClick={() => { setTempData({ tipo: 'levantamiento', modoFotos: 'comprimido' }); setModalOpen('CREAR_PROYECTO'); }}
              className={`w-full py-3 border-2 border-dashed ${theme.border} ${theme.card} rounded-xl ${theme.text} font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:border-brand-500 hover:text-brand-500 transition-colors active:scale-95`}
            >
              <Plus size={18} /> CREAR NUEVO PROYECTO
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {proyectos.map(proy => {
              const esActivo = proyectoActual?.id === proy.id;
              const colorProyecto = proy.colorGlobal || COLORES_DIA[0];

              if (!esActivo) {
                const notifCount = notificacionesProyectos[proy.id] || 0;
                return (
                  <div
                    key={proy.id}
                    onClick={() => seleccionarProyecto(proy)}
                    className={`relative w-full rounded-xl ${isDark ? theme.card : 'bg-slate-200'} border-2 ${theme.border} p-5 cursor-pointer hover:opacity-80 transition-all active:scale-95 shadow-sm`}
                  >
                    <h3 className={`font-black text-lg uppercase ${theme.textSec} text-center tracking-widest select-none`}>
                      {proy.nombre}
                    </h3>
                    {notifCount > 0 && (
                      <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white border-2 border-white shadow-sm px-1">
                        <MessageCircle size={10} className="mr-0.5" />{notifCount > 9 ? '9+' : notifCount}
                      </span>
                    )}
                  </div>
                );
              }

              const totalPuntosProy = puntos.filter(p => proy.dias.some(d => d.id === p.diaId)).length;
              const idsDias = proy.dias.map(d => d.id);
              const todosVisibles = idsDias.every(id => diasVisibles.includes(id));

              return (
                <div key={proy.id} className={`rounded-xl border-2 ${theme.border} ${theme.card} shadow-2xl animate-in zoom-in-95 duration-200 relative`}>

                  {/* ENCABEZADO CON TÍTULO + TIPO + PUNTOS/GPS */}
                  <div className={`px-4 pt-3 pb-2 ${theme.card} rounded-t-xl`}>
                    <div className="flex justify-between items-center w-full gap-2">

                      {/* Título + Tipo */}
                      <div className="flex-1">
                        <h3 className={`font-black text-xl ${theme.text} uppercase leading-none break-words`}>
                          {proy.nombre}
                        </h3>
                        <span className={`text-[10px] font-normal ${theme.textSec} uppercase tracking-wider leading-none block mt-0.5`}>
                          {proy.tipo || 'LEVANTAMIENTO'}
                        </span>
                      </div>

                      {/* Puntos + Ojo + GPS */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalLocalOpen(`LISTA_PUNTOS_${proy.id}`);
                          }}
                          className="bg-slate-800 text-white text-xs font-black px-4 py-2 rounded-lg border border-slate-900 hover:bg-slate-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <span>{totalPuntosProy}</span>
                          <span className="opacity-70">PTS</span>
                        </button>
                        <button
                          onClick={(e) => toggleVisibilidadProyecto(e, proy)}
                          className={`p-2 rounded-lg border-2 ${theme.border} ${theme.bg} hover:border-brand-500 transition-all active:scale-90`}
                        >
                          {todosVisibles ? <Eye size={16} className="text-slate-600" strokeWidth={2.5} /> : <EyeOff size={16} className={theme.textSec} strokeWidth={2.5} />}
                        </button>
                        <button
                          onClick={(e) => irUbicacionProyecto(e, proy.id)}
                          className="bg-blue-600 text-white p-2 rounded-lg border border-blue-800 hover:bg-blue-700 active:scale-95 shadow-sm transition-all"
                          title="Ver en Mapa"
                        >
                          <MapPin size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* LÍNEA DIVISORIA HORIZONTAL (Thinner Black) */}
                  <div className="px-4">
                    <div className="border-t border-black"></div>
                  </div>

                  {/* FILA UNIFICADA: COLOR + CHAT + SUPERVISORES + LOCK (CÓDIGO) + EXPORTAR + BORRAR */}
                  <div className={`px-2 py-3 ${theme.card} border-b-2 ${theme.border} overflow-x-auto overflow-y-hidden`}>
                    <div className="flex items-center justify-between w-full h-10 gap-1 min-w-max"> {/* min-w-max prevents wrap */}

                      <div className="relative flex items-center shrink-0 pr-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setColorMenuPos({ top: rect.bottom, left: rect.left });
                            setSelectorColorAbierto(selectorColorAbierto === proy.id ? null : proy.id);
                          }}
                          className={`w-9 h-9 rounded-md border-2 ${theme.border} cursor-pointer hover:scale-110 shadow-sm transition-transform`}
                          style={{ backgroundColor: colorProyecto }}
                        ></div>
                        {/* El menú se renderiza al final del componente para evitar clipping */}
                      </div>

                      {/* DIVISOR 1: Entre Color y Chat */}
                      <div className="h-8 w-[1px] bg-slate-400 mx-1 shrink-0"></div>

                      {/* 2. Botones de Acción (Chat, Supervisores, Lock) */}
                      <div className="flex items-center gap-1 flex-1 justify-center px-1">

                        {/* Chat */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setModalLocalOpen(`CHAT_${proy.id}`); }}
                          className={`relative p-2 rounded-lg border-2 ${theme.border} ${theme.bg} hover:border-blue-500 active:scale-95 transition-all w-10 h-10 flex items-center justify-center`}
                          title="Bitácora"
                        >
                          <MessageCircle size={20} className={`${theme.text}`} strokeWidth={2.5} />
                          {(notificacionesProyectos[proy.id] || 0) > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white border border-white">
                              {(notificacionesProyectos[proy.id] || 0) > 9 ? '9+' : (notificacionesProyectos[proy.id] || 0)}
                            </span>
                          )}
                        </button>

                        {/* Supervisores */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setModalLocalOpen(`SUPERVISORES_${proy.id}`); }}
                          className={`relative p-2 rounded-lg border-2 ${theme.border} ${theme.bg} hover:border-green-500 active:scale-95 transition-all w-10 h-10 flex items-center justify-center`}
                          title="Supervisores"
                        >
                          <Users size={20} className={`${theme.text}`} strokeWidth={2.5} />
                          {proy.solicitudesPendientes?.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white border border-white">
                              {proy.solicitudesPendientes.length}
                            </span>
                          )}
                        </button>

                        {/* Lock (Código) - AUTO COPIAR + ALERTA */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // 1. Copiar Código
                            copiarCodigo(proy.codigoAcceso || '');

                            // 2. Mostrar Alerta (Con Código en Mensaje por si acaso customContent falla)
                            setAlertData({
                              title: proy.codigoAcceso || 'ERROR',
                              message: "Código de acceso copiado al portapapeles.",
                              textoBoton: "ACEPTAR"
                            });
                          }}
                          className={`p-2 rounded-lg border-2 ${theme.border} ${theme.bg} hover:border-amber-500 active:scale-95 transition-all w-10 h-10 flex items-center justify-center`}
                          title="Copiar Código"
                        >
                          <Lock size={20} className={`${theme.text}`} strokeWidth={2.5} />
                        </button>

                      </div>

                      {/* DIVISOR 2: Entre Lock y Exportar */}
                      <div className="h-8 w-[1px] bg-slate-400 mx-1 shrink-0"></div>

                      {/* 3. Exportar y Borrar */}
                      <div className="flex items-center gap-1 shrink-0 pl-1">

                        {/* Exportar (Cuadrado) */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              logoOriginalRef.current = logoApp; // Sync ref
                              setLogoTemporal(logoApp); // Sync state
                              setModalOpen('EXPORTAR_HUB');
                            }}
                            className={`p-2 rounded-lg border-2 ${theme.border} ${theme.bg} hover:border-blue-600 hover:text-blue-600 transition-all active:scale-95 w-10 h-10 flex items-center justify-center`}
                            title="Compartir / Exportar"
                          >
                            <Share2 size={20} strokeWidth={2.5} className={theme.text} />
                          </button>
                          {/* Mini barra de progreso si está exportando ESTE proyecto */}
                          {exportandoTipo && (
                            <div className="absolute -bottom-2.5 left-0 right-0 h-1.5 bg-slate-200 rounded overflow-hidden border border-slate-300 z-10">
                              <div className="h-full bg-blue-600 animate-progress"></div>
                            </div>
                          )}
                        </div>

                        {/* DIVISOR VERTICAL ENTRE EXPORTAR Y BORRAR */}
                        <div className="h-8 w-[1px] bg-slate-400 mx-1 shrink-0"></div>

                        {/* Borrar */}
                        <button
                          onClick={(e) => { e.stopPropagation(); solicitarBorrarProyecto(proy.id); }}
                          disabled={resultadosExportacion.length > 0 && exportandoTipo}
                          className={`p-2 rounded-lg bg-red-600 border-2 border-red-800 text-white hover:bg-red-700 transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10 flex items-center justify-center`}
                        >
                          <Trash2 size={20} strokeWidth={2.5} />
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* DÍAS */}
                  <div className={`${isDark ? 'bg-slate-950/50' : 'bg-slate-100'} p-3 space-y-2 rounded-b-xl`}>

                    <button onClick={() => { setTempData({}); setModalOpen('CREAR_DIA'); }} className={`w-full py-3 border-2 border-dashed ${theme.border} ${theme.card} rounded-xl ${theme.text} font-bold text-xs hover:border-brand-500 hover:text-brand-500 transition-colors`}>+ NUEVO DÍA DE TRABAJO</button>

                    {[...proy.dias].reverse().map(dia => {
                      const isSelected = diaActual && dia.id === diaActual;
                      const isVisible = diasVisibles.includes(dia.id);
                      const ptosDia = puntos.filter(p => p.diaId === dia.id).length;

                      let claseDia = `${theme.card} ${theme.border} ${theme.text}`;
                      let textoSub = theme.textSec;

                      if (isSelected) {
                        if (isDark) {
                          claseDia = 'bg-orange-500 border-orange-600 text-black shadow-lg ring-2 ring-orange-200';
                          textoSub = 'text-black/70';
                        } else {
                          claseDia = 'bg-slate-900 border-black text-white shadow-lg';
                          textoSub = 'text-slate-400';
                        }
                      }

                      return (
                        <div key={dia.id} className={`py-4 px-2 rounded-lg border-2 flex justify-between items-center transition-colors ${claseDia}`}>
                          <div className="flex-1 cursor-pointer" onClick={() => { setDiaActual(dia.id); if (!isVisible) toggleVisibilidadDia(dia.id); }}>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-sm leading-none">{dia.nombre}</h4>
                                <span className={`${isSelected ? (isDark ? 'bg-black/20 text-black' : 'bg-white/20 text-white') : 'bg-slate-800 text-white'} text-[9px] font-black px-1.5 py-0.5 rounded`}>
                                  {ptosDia} pts
                                </span>
                              </div>
                              <span className={`text-[10px] font-bold ${textoSub} leading-none block mt-1`}>{dia.fecha}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex gap-1">
                              {COLORES_DIA.map(c => (
                                <div key={c} onClick={() => cambiarColorDia(proy.id, dia.id, c)} className={`w-5 h-5 rounded cursor-pointer transition-transform ${dia.color === c ? 'ring-1 ring-offset-1 ring-black scale-125 z-10 shadow-sm' : 'opacity-40 hover:opacity-100'}`} style={{ backgroundColor: c }}></div>
                              ))}
                            </div>
                            <button onClick={() => toggleVisibilidadDia(dia.id)}>
                              {isVisible ?
                                <Eye size={22} className="text-slate-600" strokeWidth={2.5} /> :
                                <EyeOff size={22} className="text-slate-600" strokeWidth={2.5} />
                              }
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
        <div className="flex gap-2 my-4">
          <button onClick={() => setTempData({ ...tempData, tipo: 'levantamiento' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'levantamiento' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>LEVANTAMIENTO</button>
          <button onClick={() => setTempData({ ...tempData, tipo: 'liquidacion' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'liquidacion' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>LIQUIDACIÓN</button>
        </div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Calidad de fotos</p>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTempData({ ...tempData, modoFotos: 'comprimido' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.modoFotos !== 'altaCalidad' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>COMPRIMIR</button>
          <button onClick={() => setTempData({ ...tempData, modoFotos: 'altaCalidad' })} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.modoFotos === 'altaCalidad' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>ALTA CALIDAD</button>
        </div>
        {tempData.modoFotos === 'altaCalidad' && (
          <button onClick={() => { setAltaCalidadMissingConfig(false); setAltaCalidadSinLogoStep(false); setModalOpen('ALTA_CALIDAD_CONFIG'); }} className="w-full mb-4 flex items-center justify-between px-4 py-3 rounded-xl border-2 border-slate-900 bg-slate-50 active:scale-95 transition-transform">
            <span className="font-black text-slate-900 text-xs uppercase tracking-widest">Configurar Sello</span>
            <div className="flex items-center gap-2">
              {tempData.stampLogoBase64 ? <Check size={14} className="text-green-600" /> : <AlertTriangle size={14} className="text-amber-500" />}
              <ChevronDown size={16} className="text-slate-900 -rotate-90" />
            </div>
          </button>
        )}
        <button onClick={() => {
          if (tempData.modoFotos === 'altaCalidad' && !tempData.stampConfig) {
            setAltaCalidadMissingConfig(true);
            setAltaCalidadSinLogoStep(false);
            setModalOpen('ALTA_CALIDAD_CONFIG');
            return;
          }
          confirmarCrearProyecto();
        }} className="w-full bg-brand-600 text-white py-3 rounded font-bold border-2 border-brand-800">CREAR</button>
      </Modal>

      {/* PANTALLA COMPLETA: CONFIG SELLO ALTA CALIDAD */}
      {modalOpen === 'ALTA_CALIDAD_CONFIG' && (() => {
        const sc = tempData.stampConfig || {};
        const fondo = sc.fondoSello || 'white';
        const prevBarBg = fondo === 'black' ? 'rgba(0,0,0,0.80)' : fondo === 'glass' ? 'rgba(50,50,50,0.45)' : 'rgba(255,255,255,0.92)';
        const prevClr1 = fondo === 'white' ? '#000000' : fondo === 'black' ? '#FCBF26' : '#ffffff';
        const prevClr2 = fondo === 'white' ? '#000000' : '#ffffff';
        const prevDiv = fondo === 'white' ? '#cbd5e1' : fondo === 'glass' ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)';
        const logoInputRef2 = { current: null };
        return (
          <div className="fixed inset-0 z-[400] bg-white flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 px-4 flex items-center justify-between shrink-0" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))', paddingBottom: '16px' }}>
              <button onClick={() => { setAltaCalidadMissingConfig(false); setAltaCalidadSinLogoStep(false); setModalOpen('CREAR_PROYECTO'); }}>
                <ChevronDown size={28} className="text-white rotate-90" />
              </button>
              <span className="font-black text-white text-base uppercase">Configurar Sello</span>
              <div className="w-7" />
            </div>
            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Alerta si se llegó sin configurar */}
              {altaCalidadMissingConfig && (
                <div className="bg-red-50 border border-red-300 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-700 leading-snug">⚠️ No se puede crear un proyecto de Alta Calidad sin configurar el sello. Completa la configuración y presiona CONFIRMAR.</p>
                </div>
              )}
              {/* Explicación */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-800 font-medium leading-snug">En esta opción las fotos se guardarán en tu equipo con el sello ya impreso en alta resolución. También se sube una versión comprimida sellada para la app.</p>
              </div>
              {/* Logo */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Logo del sello</p>
                <input ref={logoInputRef2} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setTempData(prev => ({ ...prev, stampLogoBase64: ev.target.result }));
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} />
                {tempData.stampLogoBase64 ? (
                  <div className="flex items-center gap-3">
                    <img src={tempData.stampLogoBase64} alt="Logo" className="h-12 object-contain border border-slate-200 rounded bg-white p-1" />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-green-600 font-bold">✓ Logo cargado</span>
                      <button onClick={() => setTempData(prev => ({ ...prev, stampLogoBase64: null }))} className="text-[10px] text-red-500 font-bold text-left">Quitar logo</button>
                    </div>
                    <button onClick={() => logoInputRef2.current?.click()} className="ml-auto text-xs text-brand-600 font-bold">Cambiar</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button onClick={() => logoInputRef2.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-600 active:scale-95 transition-transform">
                      <UploadCloud size={16} /> SUBIR LOGO
                    </button>
                    <p className="text-[9px] text-slate-400 text-center">También puedes continuar sin logo</p>
                  </div>
                )}
              </div>
              {/* Config */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Posición del logo</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[['left','Izquierda'],['right','Derecha']].map(([pos, label]) => (
                      <button key={pos} onClick={() => setTempData(prev => ({ ...prev, stampConfig: { ...(prev.stampConfig || {}), logoPosition: pos } }))}
                        className={`py-2 rounded-lg text-xs font-black uppercase border-2 transition-all ${(sc.logoPosition || 'right') === pos ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Identificadores</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[['mostrarNroPoste','Item'],['mostrarCodFat','Pasivo']].map(([key, label]) => {
                      const val = sc[key] ?? (key === 'mostrarNroPoste' ? true : false);
                      return (
                        <button key={key} onClick={() => setTempData(prev => ({ ...prev, stampConfig: { ...(prev.stampConfig || {}), [key]: !val } }))}
                          className={`py-2 rounded-lg text-xs font-black uppercase border-2 transition-all ${val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Fondo del sello</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[['glass','Vidrio'],['white','Blanco'],['black','Negro']].map(([val, label]) => (
                      <button key={val} onClick={() => setTempData(prev => ({ ...prev, stampConfig: { ...(prev.stampConfig || {}), fondoSello: val } }))}
                        className={`py-2 rounded-lg text-xs font-black uppercase border-2 transition-all ${(sc.fondoSello || 'white') === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 text-center">Vista previa del sello</p>
                <div className="relative rounded overflow-hidden border border-slate-300 bg-slate-300" style={{ height: '80px' }}>
                  {tempData.stampLogoBase64 ? (
                    <img src={tempData.stampLogoBase64} alt="Logo" className={`absolute top-1 ${(sc.logoPosition || 'right') === 'left' ? 'left-1' : 'right-1'} h-5 object-contain bg-white/80 border border-slate-400 rounded px-1`} />
                  ) : (
                    <div className={`absolute top-1 ${(sc.logoPosition || 'right') === 'left' ? 'left-1' : 'right-1'} bg-white/80 border border-slate-400 rounded px-1.5 py-0.5 text-[7px] font-black text-slate-600`}>LOGO</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 flex items-center border-t border-slate-400" style={{ height: '38%', backgroundColor: prevBarBg }}>
                    <div className="flex flex-col justify-center overflow-hidden shrink-0" style={{ width: '25%', padding: '1px 3px 1px 4px', gap: '1px' }}>
                      <span className="font-black truncate leading-none" style={{ fontSize: '6px', color: prevClr1 }}>PROYECTO</span>
                      <span className="font-black truncate leading-none" style={{ fontSize: '6px', color: prevClr2 }}>
                        {(sc.mostrarNroPoste ?? true) && '001'}{(sc.mostrarNroPoste ?? true) && (sc.mostrarCodFat) && ' | '}{sc.mostrarCodFat && 'M25'}
                        {!(sc.mostrarNroPoste ?? true) && !sc.mostrarCodFat && '—'}
                      </span>
                    </div>
                    <div className="self-stretch shrink-0" style={{ width: '1px', margin: '2px 0', backgroundColor: prevDiv }}></div>
                    <div className="flex flex-col justify-center items-center overflow-hidden shrink-0" style={{ width: '40%', padding: '1px 3px', gap: '1px' }}>
                      <span className="truncate leading-none" style={{ fontSize: '6px', color: prevClr2 }}>15/01/2025 · 09:30</span>
                      <span className="truncate leading-none" style={{ fontSize: '6px', color: prevClr2 }}>-12.345, -76.987</span>
                    </div>
                    <div className="self-stretch shrink-0" style={{ width: '1px', margin: '2px 0', backgroundColor: prevDiv }}></div>
                    <div className="flex flex-col justify-center overflow-hidden flex-1" style={{ padding: '1px 4px 1px 3px', gap: '1px' }}>
                      <span className="truncate leading-none" style={{ fontSize: '6px', color: prevClr2, textAlign: 'right' }}>Av. Principal 123</span>
                      <span className="truncate leading-none" style={{ fontSize: '6px', color: prevClr2, textAlign: 'right' }}>Arequipa, Perú</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Botón confirmar / sin-logo step */}
            <div className="shrink-0 p-4 border-t border-slate-200 space-y-2" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
              {altaCalidadSinLogoStep ? (
                <>
                  <p className="text-[10px] text-center font-black text-amber-600 uppercase tracking-wide">No se ha cargado el logo</p>
                  <button onClick={() => { setAltaCalidadSinLogoStep(false); logoInputRef2.current?.click(); }}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform">
                    Cargar logo
                  </button>
                  <button onClick={() => {
                    if (!tempData.stampConfig) {
                      setTempData(prev => ({ ...prev, stampConfig: { logoPosition: 'right', mostrarNroPoste: true, mostrarCodFat: false, fondoSello: 'white' } }));
                    }
                    setAltaCalidadSinLogoStep(false);
                    setAltaCalidadMissingConfig(false);
                    setModalOpen('CREAR_PROYECTO');
                  }} className="w-full bg-white border-2 border-slate-900 text-slate-900 py-3 rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform">
                    Continuar sin logo
                  </button>
                </>
              ) : (
                <button onClick={() => {
                  setAltaCalidadMissingConfig(false);
                  if (!tempData.stampLogoBase64) {
                    setAltaCalidadSinLogoStep(true);
                    return;
                  }
                  if (!tempData.stampConfig) {
                    setTempData(prev => ({ ...prev, stampConfig: { logoPosition: 'right', mostrarNroPoste: true, mostrarCodFat: false, fondoSello: 'white' } }));
                  }
                  setModalOpen('CREAR_PROYECTO');
                }} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-transform">
                  CONFIRMAR
                </button>
              )}
            </div>
          </div>
        );
      })()}

      <Modal isOpen={modalOpen === 'CREAR_DIA'} onClose={() => setModalOpen(null)} title="Nuevo Día" theme={theme}>
        <ThemedInput autoFocus placeholder="Nombre (ej: Lunes 05)" val={tempData.nombre || ''} onChange={e => setTempData({ ...tempData, nombre: e.target.value })} theme={theme} />
        <div className="h-4"></div>
        <button onClick={confirmarCrearDia} className="w-full bg-brand-600 text-white py-3 rounded font-bold border-2 border-brand-800">AGREGAR</button>
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
              exportandoTipo={exportandoTipo}
              handleExportar={handleExportar}
              handleExportarServidor={handleExportarServidor}
              cancelarExportacion={cancelarExportacion}
              resultadosExportacion={resultadosExportacion}
              setResultadosExportacion={setResultadosExportacion}
              logoApp={logoApp}
              setLogoApp={setLogoApp}
              inputLogoRef={inputLogoRef}
              handleCargarLogo={handleCargarLogo}
              user={user}
              proyectoId={activeProjectData.id}
            />
          </div>
        </div>
      )}

      {/* MODAL CHAT */}
      {
        modalLocalOpen?.startsWith('CHAT_') && (
          <div className={`fixed inset-0 z-[300] ${theme.card} flex flex-col`}>

            {/* Header */}
            <div className={`${theme.header} px-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <MessageCircle size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className={`font-black text-lg ${theme.text} uppercase`}>Bitácora</h3>
                  <p className={`text-xs ${theme.textSec} font-medium`}>Comunicación del proyecto</p>
                </div>
              </div>
              <button onClick={() => setModalLocalOpen(null)} className={`${theme.text} hover:bg-slate-100 p-2 rounded-lg transition-colors`}>
                <X size={24} />
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <ChatBitacora
                proyectoId={proyectoActual?.id}
                user={user}
                theme={theme}
                esCompartido={false}
                config={config}
              />
            </div>
          </div>
        )
      }

      {/* MODAL SUPERVISORES */}
      {
        modalLocalOpen?.startsWith('SUPERVISORES_') && proyectoActual && (
          <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalLocalOpen(null)}>
            <div className={`${theme.card} rounded-2xl max-w-md w-full shadow-2xl border-2 ${theme.border} overflow-hidden`} onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className={`${theme.header} px-6 py-4 border-b-2 ${theme.border} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Users size={20} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className={`font-black text-lg ${theme.text} uppercase`}>Supervisores</h3>
                    <p className={`text-xs ${theme.textSec} font-medium`}>
                      {proyectoActual.compartidoCon?.length || 0} activo{proyectoActual.compartidoCon?.length !== 1 ? 's' : ''}
                      {proyectoActual.solicitudesPendientes?.length > 0 && ` • ${proyectoActual.solicitudesPendientes.length} pendiente${proyectoActual.solicitudesPendientes.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => setModalLocalOpen(null)} className={`${theme.text} hover:bg-slate-100 p-2 rounded-lg transition-colors`}>
                  <X size={24} />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-6 max-h-96 overflow-y-auto space-y-3">

                {/* Solicitudes pendientes */}
                {proyectoActual.solicitudesPendientes?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className={`text-xs font-black ${theme.text} uppercase tracking-wider mb-2`}>Solicitudes Pendientes</h4>
                    {proyectoActual.solicitudesPendientes.map(sol => (
                      <div key={sol.uid} className={`${theme.card} border-2 border-slate-600 rounded-lg p-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className={`text-sm font-black ${theme.text}`}>{sol.nombrePersonal || sol.nombre}</p>
                            <p className={`text-xs ${theme.textSec} mt-0.5`}>{sol.empresaPersonal || 'Sin empresa'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => aprobarSupervisor(proyectoActual.id, sol)}
                              className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 active:scale-95 transition-all"
                              title="Aprobar"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={() => rechazarSupervisor(proyectoActual.id, sol)}
                              className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 active:scale-95 transition-all"
                              title="Rechazar"
                            >
                              <XCircle size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Supervisores activos */}
                {proyectoActual.compartidoCon?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className={`text-xs font-black ${theme.text} uppercase tracking-wider mb-2 ${proyectoActual.solicitudesPendientes?.length > 0 ? 'mt-4' : ''}`}>Supervisores Activos</h4>
                    {proyectoActual.compartidoCon.map(supervisorUid => {
                      const info = proyectoActual.supervisoresInfo?.[supervisorUid];
                      return (
                        <div key={supervisorUid} className={`${theme.card} border-2 ${theme.border} rounded-lg p-4 flex items-center justify-between`}>
                          <div>
                            <p className={`text-sm font-black ${theme.text}`}>{info?.nombre || 'Supervisor'}</p>
                            <p className={`text-xs ${theme.textSec} mt-0.5`}>{info?.empresa || 'Sin empresa'}</p>
                          </div>
                          <button
                            onClick={() => eliminarSupervisor(proyectoActual.id, supervisorUid)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg active:scale-95 transition-all"
                            title="Eliminar acceso"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Estado vacío */}
                {proyectoActual.compartidoCon?.length === 0 && proyectoActual.solicitudesPendientes?.length === 0 && (
                  <div className="text-center py-8">
                    <Users size={48} className={`${theme.textSec} mx-auto mb-3 opacity-30`} />
                    <p className={`text-sm ${theme.textSec} font-medium`}>
                      No hay supervisores aún
                    </p>
                    <p className={`text-xs ${theme.textSec} mt-1`}>
                      Comparte el código de acceso para agregar supervisores
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL LISTA PUNTOS - PANTALLA COMPLETA */}
      {
        modalLocalOpen?.startsWith('LISTA_PUNTOS_') && proyectoActual && (
          <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2" onClick={() => setModalLocalOpen(null)}>
            <div className={`${theme.card} rounded-2xl w-full h-full shadow-2xl border-2 ${theme.border} overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className={`${theme.header} px-6 pb-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0`} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-slate-800 p-2 rounded-lg">
                    <MapPin size={20} className="text-white" />
                  </div>
                  <h3 className={`font-black text-lg ${theme.text} uppercase`}>
                    TOTAL: {puntos.filter(p => proyectoActual.dias?.some(d => d.id === p.diaId)).length} PUNTOS
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

                {/* Input de búsqueda/filtro */}
                <div className="shrink-0">
                  <input
                    type="text"
                    placeholder="Buscar por item o elemento pasivo..."
                    value={filtroPunto}
                    onChange={(e) => setFiltroPunto(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border-2 ${theme.border} ${theme.bg} ${theme.text} font-bold placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors text-base`}
                  />
                </div>

                {/* Lista de puntos */}
                <div className="flex-1 overflow-y-auto space-y-2">
                  {puntos
                    .filter(p => proyectoActual.dias?.some(d => d.id === p.diaId))
                    .filter(p => {
                      if (!filtroPunto) return true;
                      const busqueda = filtroPunto.toLowerCase();
                      const fat = (p.datos.codFat || '').toLowerCase();
                      const numero = (p.datos.numero || '').toLowerCase();
                      const pasivo = (p.datos.pasivo || '').toLowerCase();
                      return fat.includes(busqueda) || numero.includes(busqueda) || pasivo.includes(busqueda);
                    })
                    .map((punto) => {
                      // Contar total de fotos en todas las secciones
                      const totalFotos = (() => {
                        const fotos = punto.datos.fotos;
                        if (!fotos || typeof fotos !== 'object') return 0;
                        let count = 0;
                        Object.values(fotos).forEach(section => {
                          if (section && typeof section === 'object') {
                            count += Object.values(section).filter(v => v && (typeof v === 'string' || v.url || v.thumb)).length;
                          }
                        });
                        return count;
                      })();

                      return (
                        <div key={punto.id} className={`${theme.card} border-2 ${theme.border} rounded-lg px-3 py-2`}>
                          {/* FILA ÚNICA: ITEM | PASIVO | fotos | Info | GPS */}
                          <div className="flex items-center gap-2">
                            {/* ITEM */}
                            <div className="flex items-center gap-1 min-w-0">
                              <span className={`text-[10px] font-normal ${theme.textSec} shrink-0`}>ITEM:</span>
                              <span className={`text-xs font-black ${theme.text} truncate`}>{punto.datos.numero || '-'}</span>
                            </div>

                            <div className={`w-px h-3 ${theme.border} shrink-0`}></div>

                            {/* PASIVO */}
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              <span className={`text-[10px] font-normal ${theme.textSec} shrink-0`}>Pasivo:</span>
                              <span className={`text-xs font-black ${theme.text} truncate`}>{punto.datos.pasivo || '-'}</span>
                            </div>

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
                              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-md shrink-0"
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
                          </div>
                        </div>
                      );
                    })}

                  {/* Vacío */}
                  {puntos
                    .filter(p => proyectoActual.dias?.some(d => d.id === p.diaId))
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
              </div>
            </div>
          </div>
        )
      }

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

const ExportHubContent = ({ proyecto, puntos, exportandoTipo, handleExportar, handleExportarServidor, cancelarExportacion, resultadosExportacion, setResultadosExportacion, logoApp, setLogoApp, inputLogoRef, handleCargarLogo, user, proyectoId }) => {
  const [descargandoId, setDescargandoId] = React.useState(null);
  const blobsRef = React.useRef({});

  const handleDescargar = async (archivo) => {
    if (descargandoId === archivo.id) return;
    setDescargandoId(archivo.id);
    try {
      let blob = archivo.blob instanceof Blob ? archivo.blob : null;
      if (!blob && archivo.downloadUrl) {
        const res = await fetch(archivo.downloadUrl);
        blob = await res.blob();
      }
      if (blob) {
        blobsRef.current[archivo.id] = blob;
        setResultadosExportacion(prev => prev.map(r => r.id === archivo.id ? { ...r, descargado: true } : r));
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
    return puntos.filter(p => proyecto.dias.some(d => d.id === p.diaId));
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
  const [mostrarConfigSello, setMostrarConfigSello] = React.useState(false);
  const [stampConfig, setStampConfig] = React.useState({ logoPosition: 'right', mostrarNroPoste: true, mostrarCodFat: false, fondoSello: 'white' });
  const [exportPendiente, setExportPendiente] = React.useState(null); // { tipo, proyecto, limiteCalculado }
  const [modalExportStep, setModalExportStep] = React.useState(null); // null | 'logo' | 'datos'
  const pendingLogoRef = React.useRef(false);
  const [cantidadArchivos, setCantidadArchivos] = React.useState(() => {
    // Calcular default: 1 archivo por cada 200MB
    const sugerido = Math.ceil(totalFotos * pesoPromedioFotoMB / 200) || 1;
    return Math.max(1, sugerido);
  });

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
        <div>
          <h4 className="font-black text-2xl text-slate-800 uppercase tracking-tight">{proyecto.nombre}</h4>
          <span className="text-slate-600 font-bold mt-1 block">{totalPuntos} Puntos • {totalFotos} Fotos</span>
        </div>
        <div className="text-right">
          <span className="block font-black text-slate-900 text-xl leading-none">{pesoTotalEstimadoMB} MB</span>
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Total Aprox.</span>
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

      {/* 2.5. CONFIGURADOR DE SELLO */}
      <div className="mb-4 border-2 border-slate-900 rounded-lg overflow-hidden">
        <button
          onClick={() => setMostrarConfigSello(v => !v)}
          className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-black active:scale-[0.99] transition-colors ${mostrarConfigSello ? 'bg-white text-slate-900' : 'bg-slate-700 text-white'}`}
        >
          <span>Configurar Sello de Exportación</span>
          <ChevronDown size={14} className={`transition-transform ${mostrarConfigSello ? 'rotate-180' : ''}`} />
        </button>

        {mostrarConfigSello && (() => {
          const fondo = stampConfig.fondoSello || 'white';
          const prevBarBg = fondo === 'black' ? 'rgba(0,0,0,0.80)' : fondo === 'glass' ? 'rgba(50,50,50,0.45)' : 'rgba(255,255,255,0.92)';
          const prevClr1 = fondo === 'white' ? '#000000' : fondo === 'black' ? '#FCBF26' : '#ffffff';
          const prevClr2 = fondo === 'white' ? '#000000' : fondo === 'black' ? '#FCBF26' : '#ffffff';
          const prevClr3 = fondo === 'white' ? '#000000' : '#ffffff';
          const prevClrR = fondo === 'white' ? '#000000' : '#ffffff';
          const prevClrRL = fondo === 'white' ? '#000000' : '#ffffff';
          const prevDiv = fondo === 'white' ? '#cbd5e1' : fondo === 'glass' ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)';
          return (
          <div className="border-t border-slate-300 p-3 bg-white space-y-3">

            {/* Posición del Logo */}
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5 block">Logo en la parte superior</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStampConfig(c => ({ ...c, logoPosition: 'left' }))}
                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${stampConfig.logoPosition === 'left' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}
                >
                  Izquierda
                </button>
                <button
                  onClick={() => setStampConfig(c => ({ ...c, logoPosition: 'right' }))}
                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${stampConfig.logoPosition === 'right' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}
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
                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${stampConfig.mostrarNroPoste ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}
                >
                  Item
                </button>
                <button
                  onClick={() => setStampConfig(c => ({ ...c, mostrarCodFat: !c.mostrarCodFat }))}
                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${stampConfig.mostrarCodFat ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}
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
                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${stampConfig.fondoSello === 'glass' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}
                >
                  Vidrio
                </button>
                <button
                  onClick={() => setStampConfig(c => ({ ...c, fondoSello: 'white' }))}
                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${stampConfig.fondoSello === 'white' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}
                >
                  Blanco
                </button>
                <button
                  onClick={() => setStampConfig(c => ({ ...c, fondoSello: 'black' }))}
                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${stampConfig.fondoSello === 'black' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}
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
        {['EXCEL', ...(proyecto?.modoFotos !== 'altaCalidad' ? ['ZIP'] : []), 'KMZ'].map(tab => (
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

        {/* PANTALLA DE CONFIGURACIÓN */}
        {resultadosExportacion.filter(r => r.type === activeTab).length === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

            {/* TEXTO DESCRIPTIVO (Tenue y Pequeño - Sin Fondo, Pegado Arriba) */}
            <div className="text-center mt-1 px-4">
              <p className={`text-[10px] uppercase font-bold tracking-widest ${activeTab === 'ZIP' ? 'text-blue-400' :
                activeTab === 'EXCEL' ? 'text-green-600' :
                  'text-amber-600'
                }`}>
                {activeTab === 'EXCEL' && "Reporte detallado + Fotos"}
                {activeTab === 'ZIP' && "Carpeta de Fotos Organizada"}
                {activeTab === 'KMZ' && "Google Earth + Ubicaciones"}
              </p>
            </div>

            {/* SELECTOR DE CANTIDAD */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-slate-700">Cantidad de Archivos</span>
                <span className={`text-xs font-black ${colorPeso}`}>{pesoPorArchivo} MB <span className="text-slate-400 font-normal">/ archivo</span></span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCantidadArchivos(Math.max(1, cantidadArchivos - 1))}
                  className="w-10 h-10 rounded-lg bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100 active:scale-95"
                >
                  <Minus size={18} />
                </button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-black text-slate-800">{cantidadArchivos}</span>
                </div>
                <button
                  onClick={() => setCantidadArchivos(cantidadArchivos + 1)}
                  className="w-10 h-10 rounded-lg bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100 active:scale-95"
                >
                  <Plus size={18} />
                </button>
              </div>
              {pesoPorArchivo > 500 && (
                <div className="mt-2 flex items-center gap-1.5 text-red-600 bg-red-50 p-2 rounded text-[10px]">
                  <AlertTriangle size={12} />
                  <span>El archivo será muy pesado para móviles.</span>
                </div>
              )}
            </div>

            {/* BOTÓN GENERAR */}
            <button
              onClick={() => {
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
                          fotos += Object.keys(section).length;
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

                setExportPendiente({ tipo: activeTab, proyecto, limiteCalculado });
                if (!logoApp) {
                  setModalExportStep('logo');
                } else {
                  setModalExportStep('datos');
                }
              }}
              className={`w-full py-3 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${activeTab === 'ZIP' ? 'bg-blue-600 hover:bg-blue-700' : activeTab === 'EXCEL' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              GENERAR {cantidadArchivos > 1 ? `(${cantidadArchivos})` : ''} ARCHIVOS
            </button>

          </div>
        )}

        {/* VISTA DE RESULTADOS (incluye tarjetas de carga) */}
        {resultadosExportacion.filter(r => r.type === activeTab).length > 0 && (
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
                      ? 'Servidor trabajando — puedes cerrar la app'
                      : `${(archivo.blob.size / 1024 / 1024).toFixed(2)} MB • ${archivo.numPuntos} pts`
                    }
                  </p>
                </div>

                {/* Botón Compartir Link */}
                <button
                  disabled={archivo.cargando || !archivo.downloadUrl}
                  onClick={() => navigator.share?.({ url: archivo.downloadUrl, title: archivo.name })}
                  className={`p-2 rounded-lg border-2 transition-all flex-shrink-0 ${
                    archivo.cargando || !archivo.downloadUrl
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-slate-900 text-slate-900 hover:bg-slate-50 active:scale-95'
                  }`}
                >
                  <Link2 size={16} />
                </button>

                {/* Botón Descargar → Compartir Archivo */}
                {!!archivo.descargado ? (
                  <button
                    onClick={() => handleCompartirArchivo(archivo)}
                    className="p-2 rounded-lg border-2 border-green-400 text-green-600 hover:bg-green-50 active:scale-95 flex-shrink-0"
                  >
                    <Share2 size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => !archivo.cargando && handleDescargar(archivo)}
                    disabled={archivo.cargando || descargandoId === archivo.id}
                    className={`p-2 rounded-lg border-2 transition-all flex-shrink-0 ${
                      archivo.cargando || descargandoId === archivo.id
                        ? 'border-slate-100 text-slate-300 pointer-events-none'
                        : 'border-purple-300 text-purple-600 hover:bg-purple-50 active:scale-95'
                    }`}
                  >
                    {descargandoId === archivo.id
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Download size={16} />
                    }
                  </button>
                )}

                {/* Barra de progreso animada en el borde inferior */}
                {archivo.cargando && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                    <div className={`h-full animate-progress ${
                      activeTab === 'ZIP' ? 'bg-blue-500' :
                      activeTab === 'EXCEL' ? 'bg-green-500' :
                      'bg-amber-500'
                    }`} />
                  </div>
                )}
              </div>
            ))}

            {resultadosExportacion.filter(r => r.type === activeTab && !r.cargando).length > 0 && (
              <button
                onClick={async () => {
                  const aEliminar = resultadosExportacion.filter(r => r.type === activeTab && !r.cargando && r.downloadUrl);
                  // Borrar archivos de Firebase Storage
                  if (aEliminar.length > 0) {
                    try {
                      const { ref, deleteObject } = await import('firebase/storage');
                      const { storage } = await import('../firebaseConfig');
                      await Promise.all(aEliminar.map(async (r) => {
                        try {
                          const match = r.downloadUrl.match(/\/o\/(.+?)\?/);
                          if (match) await deleteObject(ref(storage, decodeURIComponent(match[1])));
                        } catch (e) { /* si ya no existe, ignorar */ }
                      }));
                    } catch (e) { console.error('Error borrando de Storage:', e); }
                  }
                  setResultadosExportacion(prev => prev.filter(r => r.type !== activeTab || r.cargando));
                }}
                className="w-full mt-4 py-3 text-red-500 font-bold text-xs border border-red-200 rounded-xl hover:bg-red-50 active:scale-95"
              >
                ELIMINAR Y GENERAR NUEVO
              </button>
            )}
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

      {/* MODAL: ¿IMPRIMIR DATOS EN FOTOS? */}
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
                  {proyecto?.modoFotos === 'altaCalidad'
                    ? 'Este proyecto usa fotos de alta calidad con sello ya aplicado. Se exportará sin sello adicional.'
                    : 'Con datos imprime el sello con GPS, fecha y proyecto. Sin datos usa las fotos originales limpias.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {proyecto?.modoFotos !== 'altaCalidad' && (
                <button
                  onClick={() => {
                    setModalExportStep(null);
                    const { tipo, proyecto: proy, limiteCalculado } = exportPendiente;
                    handleExportarServidor(tipo, proy, limiteCalculado, stampConfig);
                    setExportPendiente(null);
                  }}
                  className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
                >
                  CON DATOS
                </button>
              )}
              <button
                onClick={() => {
                  setModalExportStep(null);
                  const { tipo, proyecto: proy, limiteCalculado } = exportPendiente;
                  handleExportarServidor(tipo, proy, limiteCalculado, { ...stampConfig, sinDatos: true });
                  setExportPendiente(null);
                }}
                className={`w-full font-bold py-3 rounded-xl active:scale-95 transition-transform ${proyecto?.modoFotos === 'altaCalidad' ? 'bg-slate-900 text-white' : 'border-2 border-slate-300 text-slate-700'}`}
              >
                {proyecto?.modoFotos === 'altaCalidad' ? 'EXPORTAR' : 'SIN DATOS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VistaProyectos;