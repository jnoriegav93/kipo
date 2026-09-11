import React, { useState, useRef } from 'react';
import { Eye, EyeOff, Edit3, Trash2, Plus, ArrowLeft, Cable, Move, X, Link2, Camera, FolderInput, Check, Copy, Scissors, RefreshCw, CalendarPlus, CornerDownRight } from 'lucide-react';
import { MapaReal } from '../components/Mapas';
import BarraFibra from '../components/BarraFibra';

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const VistaMapa = ({
  theme, isDesktop = false, mapStyle, mapViewState, setMapViewState, handleMapaClick,
  puntosVisiblesMapa, iconSize, obtenerColorDia, puntoSeleccionado,
  handlePuntoClick, puntoTemporal, gpsTrigger, yaSaltoAlInicio,
  setYaSaltoAlInicio, isDark, verDetalle, iniciarEdicion,
  solicitarBorrarPunto, intentarAgregarDatos,
  setVistaAnterior,
  modoMover, pendingCoords, iniciarMover, cancelarMover, confirmarMover, onPuntoDragEnd,
  // Props de supervisión
  modoSupervision = false,
  onVolverSupervision,
  // Overlay GPS desde lista
  overlayGPSActivo = false,
  // Props de FIBRA
  modoFibra,
  setModoFibra,
  dibujandoFibra,
  setDibujandoFibra,
  capacidadFibra,
  setCapacidadFibra,
  fibrasVisibles,
  setFibrasVisibles,
  puntosRecorrido,
  setPuntosRecorrido,
  conexionesVisiblesMapa,
  conexionSeleccionada,
  setConexionSeleccionada,
  handleConexionClick,
  onGuardarFibra,
  nombreSugeridoFibra = '',
  onActualizarConexion,
  modoAjuste = false,
  setModoAjuste,
  umbralAjuste = 3,
  setUmbralAjuste,
  previewAjuste = [],
  apoyadosAjuste = [],
  aplicandoAjuste = false,
  onAplicarAjuste,
  hayDeshacerAjuste = false,
  onDeshacerAjuste,
  onEliminarConexion,
  totalFibras,
  nombreProyecto = null,
  totalPuntosProyecto = 0,
  proyectoEsCompartido = false,
  menuEtiquetasAbierto = false,
  setMostrarEtiquetas,
  mostrarEtiquetas = { item: false, pasivo: false, fibra: false },
  simbologiaActiva = false,
  simbologiaAbierta = false,
  coloresArmado = {},
  onAsignarColorArmado,
  onToggleSimbologiaActiva,
  armadosProyecto = [],
  // Panel de días
  menuDiasAbierto = false,
  diasPanelData = [],
  diaExpandido = null,
  setDiaExpandido,
  diasVisibles = [],
  toggleVisibilidadDia,
  cambiarColorDia,
  uniformizarColorDias,
  coloresDia = [],
  proyectoActivoId = null,
  // Fotos en mapa
  fotosConCoordenadas = [],
  fotoPuntosActivo = false,
  onAsociarFoto,
  onCapturarFotoMapa,
  tabsConfig = {},
  proyectoTipo,
  puntos = [],
  abrirCamaraDirecta,
  puntoSinDia = false,
  onAsignarDiasSueltos,
  // Modo reasignación de puntos
  modoMoverPuntos = false,
  puntosSeleccionadosMover = [],
  setPuntosSeleccionadosMover,
  onEjecutarCopiarCortar,
  onCancelarMoverPuntos,
  proyectosDestino = [],
  // Modo ordenar (editar posición)
  modoOrdenar = false,
  esOrdenable,
  ordenSeleccion = [],
  setOrdenSeleccion,
  guardandoOrden = false,
  onGuardarOrden,
  onReiniciarOrden,
  onCancelarOrdenar,
  // Corregir posición (mover varios puntos detrás de otro)
  prefijoOrden = [],
  retomarOrden = false,
  hayPosicionesPrevias = false,
  onRetomarOrden,
  modoCorregir = null,
  correccionSel = [],
  setCorreccionSel,
  ordenTrabajo = [],
  huboCorreccion = false,
  onIniciarCorreccion,
  onPedirDestino,
  onVolverASeleccion,
  onAplicarCorreccion,
}) => {
  // REINICIAR es contextual. Sin correcciones hechas y sin nada marcado, lo que
  // corresponde es salir del modo corregir, así que se anuncia como VOLVER.
  // El botón es contextual. Al empezar y con posiciones ya guardadas ofrece RETOMAR;
  // en cuanto hay algo que borrar vuelve a ser REINICIAR.
  const etiquetaReiniciar = (modoCorregir && correccionSel.length === 0 && !huboCorreccion)
    ? 'VOLVER'
    : (!modoCorregir && !retomarOrden && ordenSeleccion.length === 0 && hayPosicionesPrevias)
      ? 'RETOMAR' : 'REINICIAR';
  const alPulsarReiniciar = () => {
    if (etiquetaReiniciar === 'RETOMAR') { onRetomarOrden?.(); return; }
    onReiniciarOrden?.();
  };
  // Destino al que llevar el mapa. El contador n permite repetir el mismo punto.
  // Capacidad que se está probando en el editor de la lista, para pintar la línea
  // de ese color antes de guardar.
  const [previewFibra, setPreviewFibra] = useState(null);
  // Armado con la paleta desplegada en la simbología. Solo uno a la vez: la
  // paleta tapa el nombre, así que dos abiertas dejarían la lista ilegible.
  const [paletaArmado, setPaletaArmado] = useState(null);
  // Al cerrar el panel se recoge la paleta, o al reabrirlo aparecería desplegada
  if (!simbologiaAbierta && paletaArmado !== null) setPaletaArmado(null);
  const [centrarEnCoord, setCentrarEnCoord] = useState(null);
  // Paleta básica de la app, la misma con la que se colorean los días
  const coloresSimbologia = coloresDia.length ? coloresDia : ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444'];
  const irACoord = (lat, lng) => setCentrarEnCoord(prev => ({ lat, lng, n: (prev?.n || 0) + 1 }));
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [panelAsociarVisible, setPanelAsociarVisible] = useState(false);
  const [puntosProximos, setPuntosProximos] = useState([]);
  const [puntoResaltado, setPuntoResaltado] = useState(null);
  const [confirmReemplazar, setConfirmReemplazar] = useState(null); // { foto, puntoId }
  const [asociando, setAsociando] = useState(false);
  const [showSelectorProyecto, setShowSelectorProyecto] = useState(false);
  const [confirmMoverData, setConfirmMoverData] = useState(null);
  const [modoMoverAccion, setModoMoverAccion] = useState(null); // 'copiar' | 'cortar'
  const fotoMapaInputRef = useRef(null);
  const [pickerDestino, setPickerDestino] = useState(null); // { foto, puntoId } para foto sin sección
  const [pickerTab, setPickerTab] = useState(null);

  const abrirPopup = (foto) => {
    setFotoSeleccionada(foto);
    setPanelAsociarVisible(false);
    setPuntosProximos([]);
    setPuntoResaltado(null);
    setMapViewState(prev => ({ ...prev, center: [foto.lat, foto.lng] }));
  };

  const abrirPanel = () => {
    if (!fotoSeleccionada) return;
    const proximos = puntos
      .filter(p => p.coords?.lat && p.coords?.lng)
      .map(p => ({ ...p, dist: Math.round(haversine(fotoSeleccionada.lat, fotoSeleccionada.lng, p.coords.lat, p.coords.lng)) }))
      .filter(p => p.dist <= 30)
      .sort((a, b) => a.dist - b.dist);
    setPuntosProximos(proximos);
    setPanelAsociarVisible(true);
  };

  const seleccionarPunto = (punto) => {
    setPuntoResaltado(punto.id);
    setMapViewState(prev => ({ ...prev, center: [punto.coords.lat, punto.coords.lng] }));
  };

  const ejecutarAsociacion = async (foto, puntoId, forzar = false, secId = null, itmId = null) => {
    // Foto directa sin sección: pedir destino (sección + casillero) antes de asociar
    if (!foto.sectionId && !secId) {
      setPickerDestino({ foto, puntoId });
      setPickerTab(null);
      return;
    }
    setAsociando(true);
    const resultado = await onAsociarFoto?.(foto, puntoId, forzar, secId, itmId);
    setAsociando(false);
    if (resultado === 'existe') {
      setConfirmReemplazar({ foto, puntoId, secId, itmId });
      return;
    }
    if (resultado === 'ok') {
      setFotoSeleccionada(null);
      setPanelAsociarVisible(false);
      setPuntosProximos([]);
      setPuntoResaltado(null);
      setPickerDestino(null);
      setPickerTab(null);
    }
  };

  // Estilos de botones flotantes (solo PC)
  const pill = 'flex items-center gap-2 bg-white text-slate-900 font-black text-base rounded-2xl px-5 py-3 shadow-xl border border-slate-200 active:scale-95 transition-transform hover:bg-slate-50';
  const pillOff = 'flex items-center gap-2 bg-white text-slate-400 font-black text-base rounded-2xl px-5 py-3 shadow-xl border border-slate-200 opacity-60 cursor-not-allowed';

  // Etiqueta "proyecto - Ddía" del punto seleccionado (texto suelto sobre el mapa)
  const puntoSelObj = puntoSeleccionado ? (puntosVisiblesMapa || []).find(p => p.id === puntoSeleccionado) : null;
  const diaSelNum = puntoSelObj ? (diasPanelData.find(d => d.id === puntoSelObj.diaId)?.numero) : null;
  const etiquetaPuntoSel = puntoSelObj ? `${(nombreProyecto || '').trim()}${diaSelNum != null ? ` - D${diaSelNum}` : ''}` : '';

  return (
    <div className="flex-1 relative h-full w-full overflow-hidden flex flex-col">

      {/* Mapa */}
      <div className="flex-1 relative">
        {mapViewState ? (
          <MapaReal
            theme={theme}
            mapStyle={mapStyle}
            handleMapaClick={handleMapaClick}
            centrarEnCoord={centrarEnCoord}
            previewFibra={previewFibra}
            puntosVisiblesMapa={puntosVisiblesMapa}
            iconSize={iconSize}
            obtenerColorDia={obtenerColorDia}
            puntoSeleccionado={(modoMoverPuntos || modoOrdenar) ? null : puntoSeleccionado}
            handlePuntoClick={modoCorregir
              ? (e, id) => {
                  if (esOrdenable && !esOrdenable(id)) return;
                  if (modoCorregir === 'seleccion') {
                    setCorreccionSel?.(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                  } else if (!correccionSel.includes(id)) {
                    // Destino: un punto marcado no puede ser su propio ancla
                    onAplicarCorreccion?.(id);
                  }
                }
              : modoOrdenar
              ? (e, id) => { if (esOrdenable && !esOrdenable(id)) return; setOrdenSeleccion?.(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }
              : modoMoverPuntos
                ? (e, id) => setPuntosSeleccionadosMover(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                : handlePuntoClick
            }
            modoMoverPuntos={modoMoverPuntos}
            puntosSeleccionadosMover={puntosSeleccionadosMover}
            modoOrdenar={modoOrdenar}
            ordenSeleccion={ordenSeleccion}
            simbologiaActiva={simbologiaActiva}
            coloresArmado={coloresArmado}
            previewAjuste={modoAjuste ? previewAjuste : []}
            apoyadosAjuste={modoAjuste ? apoyadosAjuste : []}
            modoAjuste={modoAjuste}
            prefijoOrden={prefijoOrden}
            modoCorregir={modoCorregir}
            correccionSel={correccionSel}
            ordenTrabajo={ordenTrabajo}
            puntoTemporal={puntoTemporal}
            modoFibra={modoFibra}
            dibujandoFibra={dibujandoFibra}
            capacidadFibra={capacidadFibra}
            puntosRecorrido={puntosRecorrido}
            conexionesVisiblesMapa={conexionesVisiblesMapa}
            mostrarEtiquetas={mostrarEtiquetas}
            viewState={mapViewState}
            setViewState={setMapViewState}
            gpsTrigger={gpsTrigger}
            yaSaltoAlInicio={yaSaltoAlInicio}
            setYaSaltoAlInicio={setYaSaltoAlInicio}
            conexionSeleccionada={conexionSeleccionada}
            handleConexionClick={handleConexionClick}
            modoMover={modoMover}
            pendingCoords={pendingCoords}
            onPuntoDragEnd={onPuntoDragEnd}
            fotosConCoordenadas={fotosConCoordenadas}
            fotoPuntosActivo={fotoPuntosActivo}
            onFotoMarkerClick={abrirPopup}
            puntoResaltado={puntoResaltado}
          />
        ) : (
          <div className={`h-full w-full flex flex-col items-center justify-center ${theme.bg} ${theme.text}`}>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-500 mb-6"></div>
            <h3 className="text-xl font-black tracking-widest animate-pulse">LOCALIZANDO...</h3>
            <p className="text-sm opacity-60 mt-2">Esperando señal GPS</p>
          </div>
        )}

        {/* Barra de fibra (flotante sobre el mapa) */}
        {modoFibra && !modoSupervision && (
          <div className="absolute top-0 left-0 right-0 z-[49]">
            <BarraFibra
              theme={theme}
              isDark={isDark}
              dibujandoFibra={dibujandoFibra}
              setDibujandoFibra={setDibujandoFibra}
              capacidadFibra={capacidadFibra}
              setCapacidadFibra={setCapacidadFibra}
              puntosRecorrido={puntosRecorrido}
              setPuntosRecorrido={setPuntosRecorrido}
              onGuardarFibra={onGuardarFibra}
              nombreSugerido={nombreSugeridoFibra}
              modoAjuste={modoAjuste}
              setModoAjuste={setModoAjuste}
              umbralAjuste={umbralAjuste}
              setUmbralAjuste={setUmbralAjuste}
              previewAjuste={previewAjuste}
              aplicandoAjuste={aplicandoAjuste}
              onAplicarAjuste={onAplicarAjuste}
              hayDeshacerAjuste={hayDeshacerAjuste}
              onDeshacerAjuste={onDeshacerAjuste}
              onPreviewFibra={setPreviewFibra}
              onActualizar={onActualizarConexion}
              onCentrar={(con) => {
                // Centro del ramal: promedio de sus vértices. En las fibras viejas,
                // que no tienen geometría propia, se usa el primer poste que resuelva.
                const vs = Array.isArray(con.vertices) ? con.vertices.filter(v => v?.lat != null) : [];
                if (vs.length > 0) {
                  irACoord(vs.reduce((a, v) => a + v.lat, 0) / vs.length,
                           vs.reduce((a, v) => a + v.lng, 0) / vs.length);
                  return;
                }
                const ids = (con.puntos?.length >= 2 ? con.puntos : [con.from, con.to]).filter(Boolean);
                const p = (puntosVisiblesMapa || []).find(x => ids.some(id => String(id) === String(x.id)) && x.coords);
                if (p) irACoord(p.coords.lat, p.coords.lng);
              }}
              conexiones={conexionesVisiblesMapa}
              conexionSeleccionada={conexionSeleccionada}
              setConexionSeleccionada={setConexionSeleccionada}
              onEliminarConexion={onEliminarConexion}
              fibrasVisibles={fibrasVisibles}
              setFibrasVisibles={setFibrasVisibles}
              totalFibras={totalFibras}
              onCerrar={() => {
                setModoFibra(false);
                setDibujandoFibra(false);
                setPuntosRecorrido([]);
                setConexionSeleccionada(null);
                setModoAjuste?.(false);
              }}
            />
          </div>
        )}

        {/* Banner GPS desde lista */}
        {!modoSupervision && !modoFibra && overlayGPSActivo && (
          <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none z-40">
            <div className={`${isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-white text-slate-600 border-slate-300'} px-4 py-2 rounded-full text-[11px] font-bold shadow-lg border-2`}>
              Presiona CERRAR para quedarte en el mapa
            </div>
          </div>
        )}

        {/* Hint modoMover — arrastrando */}
        {modoMover && !pendingCoords && (
          <div className="absolute top-2 left-0 right-0 flex justify-center z-[400] px-4">
            <div className="bg-slate-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-3">
              <Move size={14} strokeWidth={2.5} />
              <span>Arrastra el poste a la nueva posición</span>
              <button onClick={cancelarMover} className="bg-white/20 px-2 py-1 rounded-full text-[10px] font-black active:bg-white/40">
                CANCELAR
              </button>
            </div>
          </div>
        )}


        {/* Banner modo reasignación */}
        {modoMoverPuntos && (
          <div className="absolute top-2 left-0 right-0 flex justify-center z-[400] px-4">
            <div className="bg-purple-700/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg">
              Toca los puntos para seleccionarlos · Segundo toque para deseleccionar
            </div>
          </div>
        )}

        {/* Banner de supervisión */}
        {modoSupervision && (
          <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none z-40">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg border-2 border-blue-800">
              MODO SUPERVISIÓN - SOLO LECTURA
            </div>
          </div>
        )}

        {/* POPUP foto seleccionada — centrado con foto grande */}
        {fotoSeleccionada && !panelAsociarVisible && (
          <div className="absolute inset-0 z-[450] flex items-center justify-center bg-black/40 backdrop-blur-sm px-6 animate-in fade-in duration-200">
            <div className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border-2 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden`}>
              {/* Foto grande */}
              <div className="w-full aspect-square bg-black">
                <img
                  src={fotoSeleccionada.thumb?.startsWith('data:') ? fotoSeleccionada.thumb : (fotoSeleccionada.url || fotoSeleccionada.thumb)}
                  onError={(e) => { e.target.onerror = null; const fb = fotoSeleccionada.thumb || fotoSeleccionada.url; if (fb && e.target.src !== fb) e.target.src = fb; }}
                  className="w-full h-full object-cover" alt=""
                />
              </div>
              {/* Nombre */}
              <div className="px-4 pt-3 pb-1 text-center">
                <p className={`text-xs font-black uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>{fotoSeleccionada.nombre}</p>
                <p className="text-[10px] text-purple-500 font-bold mt-0.5">Foto guardada de punto incompleto</p>
              </div>
              {/* Botones */}
              <div className="flex gap-2 p-3">
                <button
                  onClick={() => { setFotoSeleccionada(null); setPuntoResaltado(null); }}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'} active:scale-95`}
                >
                  Cerrar
                </button>
                <button
                  onClick={abrirPanel}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600 text-white py-2.5 rounded-xl text-xs font-black active:scale-95 transition-all"
                >
                  <Link2 size={13} />
                  ASOCIAR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PANEL DE ASOCIACIÓN — bottom sheet máx mitad de pantalla */}
        {panelAsociarVisible && fotoSeleccionada && (
          <div className="absolute inset-x-0 bottom-0 z-[450] animate-in slide-in-from-bottom-2 duration-200" style={{ maxHeight: '50%' }}>
            <div className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border-t-2 rounded-t-2xl shadow-2xl flex flex-col h-full`}>
              {/* Header */}
              <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'} flex items-center gap-2 shrink-0`}>
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-300">
                  <img
                    src={fotoSeleccionada.thumb?.startsWith('data:') ? fotoSeleccionada.thumb : (fotoSeleccionada.url || fotoSeleccionada.thumb)}
                    onError={(e) => { e.target.onerror = null; const fb = fotoSeleccionada.url || fotoSeleccionada.thumb; if (fb && e.target.src !== fb) e.target.src = fb; }}
                    className="w-full h-full object-cover" alt=""
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-wide truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{fotoSeleccionada.nombre}</p>
                  <p className="text-[9px] text-purple-500 font-bold">
                    {puntosProximos.length === 0 ? 'Sin postes a ≤30m' : `${puntosProximos.length} poste${puntosProximos.length > 1 ? 's' : ''} a ≤30m`}
                  </p>
                </div>
                <button
                  onClick={() => { setPanelAsociarVisible(false); setFotoSeleccionada(null); setPuntoResaltado(null); }}
                  className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400' : 'text-slate-500'} active:scale-95`}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Lista scrolleable */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {puntosProximos.length === 0 ? (
                  <div className="flex items-center justify-center h-16">
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No hay postes dentro de 30m de esta foto</p>
                  </div>
                ) : puntosProximos.map(p => (
                  <div
                    key={p.id}
                    onClick={() => seleccionarPunto(p)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all active:scale-95 cursor-pointer ${puntoResaltado === p.id
                      ? 'bg-yellow-400/20 border-yellow-400'
                      : isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.datos?.numero || 'S/N'}</p>
                      <p className={`text-[9px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.datos?.pasivo || '-'} · {p.dist}m</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); ejecutarAsociacion(fotoSeleccionada, p.id); }}
                      disabled={asociando}
                      className="shrink-0 flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Link2 size={11} />
                      ASOCIAR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Confirm reemplazar foto */}
        {confirmReemplazar && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-2xl p-5 w-full max-w-xs`}>
              <p className={`text-sm font-black mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ya existe una foto</p>
              <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Este slot ya tiene una foto en el punto. ¿Deseas reemplazarla?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmReemplazar(null)} className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                  Cancelar
                </button>
                <button
                  onClick={() => { const c = confirmReemplazar; setConfirmReemplazar(null); ejecutarAsociacion(c.foto, c.puntoId, true, c.secId, c.itmId); }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black active:scale-95"
                >
                  Reemplazar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info proyecto + botones flotantes (esquina superior derecha) */}
        {!modoSupervision && nombreProyecto && (
          <div className={`absolute ${isDesktop ? 'top-20' : 'top-2'} right-3 z-40 flex flex-col items-end gap-1.5`}>
            {/* Overlay nombre */}
            <div className={`rounded-lg px-2 py-1 pointer-events-none ${proyectoEsCompartido ? 'bg-brand-500' : 'bg-slate-900'}`}>
              <p className="text-[11px] font-bold text-white leading-tight max-w-[200px] truncate uppercase">{nombreProyecto} · {totalPuntosProyecto} pts</p>
            </div>

            {/* Con la simbología encendida y el panel cerrado, el mapa no se lee por
                día: conviene avisarlo o los colores se malinterpretan. */}
            {simbologiaActiva && !simbologiaAbierta && (
              <div className="rounded-lg px-2 py-0.5 bg-brand-500 pointer-events-none">
                <p className="text-[10px] font-black text-white leading-tight">Simbología activada</p>
              </div>
            )}

            {/* Aviso de puntos ocultos (cuando el panel de días está cerrado) */}
            {!menuDiasAbierto && diasPanelData.some(d => d.count > 0 && !diasVisibles.includes(d.id)) && (
              <div className="rounded-lg px-2 py-0.5 bg-amber-500 pointer-events-none">
                <p className="text-[10px] font-black text-white leading-tight">Hay puntos ocultos</p>
              </div>
            )}

            {/* Botones ITEM / PASIVO */}
            {menuEtiquetasAbierto && (
              <div className="flex flex-col gap-1 w-20">
                <button
                  onClick={() => setMostrarEtiquetas(prev => ({ ...prev, item: !prev.item }))}
                  className={`w-full py-1.5 rounded-lg text-[11px] font-black tracking-wide border-2 shadow-md transition-all active:scale-95 ${mostrarEtiquetas.item ? 'bg-brand-500 text-white border-brand-600' : 'bg-white text-slate-900 border-slate-900'}`}
                >
                  ITEM
                </button>
                <button
                  onClick={() => setMostrarEtiquetas(prev => ({ ...prev, pasivo: !prev.pasivo }))}
                  className={`w-full py-1.5 rounded-lg text-[11px] font-black tracking-wide border-2 shadow-md transition-all active:scale-95 ${mostrarEtiquetas.pasivo ? 'bg-brand-500 text-white border-brand-600' : 'bg-white text-slate-900 border-slate-900'}`}
                >
                  PASIVO
                </button>
                <button
                  onClick={() => setMostrarEtiquetas(prev => ({ ...prev, fibra: !prev.fibra }))}
                  className={`w-full py-1.5 rounded-lg text-[11px] font-black tracking-wide border-2 shadow-md transition-all active:scale-95 ${mostrarEtiquetas.fibra ? 'bg-brand-500 text-white border-brand-600' : 'bg-white text-slate-900 border-slate-900'}`}
                >
                  FIBRA
                </button>
              </div>
            )}

            {/* SIMBOLOGÍA: un color por armado. Los puntos sin armado, o con un
                armado sin color, se pintan grises mientras esté encendida. */}
            {simbologiaAbierta && (
              <div className={`w-52 max-h-[60vh] overflow-y-auto rounded-xl border-2 ${theme.border} ${theme.card} shadow-xl p-2 space-y-1.5`}>
                <button
                  onClick={onToggleSimbologiaActiva}
                  className={`w-full py-1.5 rounded-lg text-[11px] font-black tracking-widest border-2 transition-all ${simbologiaActiva
                    ? 'bg-brand-500 text-white border-brand-600'
                    : 'bg-slate-900 text-white border-slate-900'}`}
                >
                  {simbologiaActiva ? 'SIMBOLOGÍA ACTIVADA' : 'ACTIVAR SIMBOLOGÍA'}
                </button>

                {armadosProyecto.length === 0 ? (
                  <p className={`text-[10px] font-bold text-center py-2 ${theme.text} opacity-50`}>Este proyecto no tiene armados.</p>
                ) : armadosProyecto.map(a => {
                  const abierto = paletaArmado === a.id;
                  const sel = coloresArmado[a.id] || null;
                  // El color elegido va SIEMPRE al final: cerrada la fila, la paleta
                  // se recoge hacia la derecha y solo asoma ese último círculo.
                  // 'null' es la opción "sin color" y ocupa el último sitio cuando
                  // el armado no tiene ninguno asignado.
                  const opciones = sel
                    ? [null, ...coloresSimbologia.filter(c => c !== sel), sel]
                    : [...coloresSimbologia, null];
                  const ANCHO = 28; // círculo (24) + separación (4)
                  return (
                    <div key={a.id} className={`relative h-9 rounded-lg border-2 ${theme.border} overflow-hidden flex items-center`}>
                      <p className={`flex-1 min-w-0 px-2 text-[10px] font-black uppercase truncate ${theme.text} transition-opacity duration-200 ${abierto ? 'opacity-0' : 'opacity-100'}`}>
                        {a.nombre}
                      </p>
                      {/* Ventana anclada a la derecha: al abrirse crece hacia la
                          izquierda y los círculos van saliendo sobre el nombre. */}
                      <div
                        className="absolute inset-y-0 right-1 overflow-hidden transition-all duration-200"
                        style={{ width: (abierto ? opciones.length : 1) * ANCHO + 6 }}
                      >
                        <div className="absolute right-[3px] inset-y-0 flex items-center justify-end gap-1" style={{ width: opciones.length * ANCHO }}>
                          {opciones.map(c => (
                            <button
                              key={c || 'sin'}
                              onClick={() => {
                                // Cerrada solo se ve un círculo: tocarlo despliega.
                                if (!abierto) { setPaletaArmado(a.id); return; }
                                onAsignarColorArmado?.(a.id, c);
                                setPaletaArmado(null);
                              }}
                              className={`w-6 h-6 rounded-full shrink-0 transition-transform active:scale-90 ${c
                                ? `border-2 ${sel === c ? 'border-black scale-110' : 'border-white/60'}`
                                : `border-2 border-dashed ${sel ? 'border-slate-400' : 'border-black scale-110'}`}`}
                              style={c ? { backgroundColor: c } : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PANEL DE DÍAS */}
            {menuDiasAbierto && (
              <div className="flex flex-col gap-1 items-end max-h-[65vh] overflow-y-auto py-0.5">
                {diasPanelData.length === 0 ? (
                  <div className="bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 shadow-md">Sin días</div>
                ) : (
                  <>
                    {/* Cuadro uniformizar color de todos los días */}
                    {(() => {
                      const colores = [...new Set(diasPanelData.map(d => d.color))];
                      const colorComun = colores.length === 1 ? colores[0] : null;
                      return (
                        <button
                          onClick={() => {
                            const idx = colorComun ? coloresDia.indexOf(colorComun) : -1;
                            const next = coloresDia[(idx + 1) % (coloresDia.length || 1)];
                            if (uniformizarColorDias && proyectoActivoId) uniformizarColorDias(proyectoActivoId, next);
                          }}
                          className="w-9 h-9 rounded-lg border-2 border-slate-900 shadow-md active:opacity-80 shrink-0"
                          style={{ backgroundColor: colorComun || '#9ca3af' }}
                          title="Uniformizar color de todos los días"
                        />
                      );
                    })()}

                    {diasPanelData.map(dia => {
                      const visible = diasVisibles.includes(dia.id);
                      const expandido = diaExpandido === dia.id;
                      const fechaCorta = (dia.fecha || '').replace(/(\d{4})/, m => m.slice(-2));
                      return (
                        <div key={dia.id} className="flex items-stretch rounded-lg border-2 border-slate-900 bg-white shadow-md overflow-hidden">
                          {expandido && (
                            <>
                              {/* Color (cicla colores) — cuadrado, a la izquierda */}
                              <button
                                onClick={() => {
                                  const idx = coloresDia.indexOf(dia.color);
                                  const next = coloresDia[(idx + 1) % (coloresDia.length || 1)];
                                  if (cambiarColorDia && proyectoActivoId) cambiarColorDia(proyectoActivoId, dia.id, next);
                                }}
                                className="w-9 border-r-2 border-slate-900 active:opacity-80"
                                style={{ backgroundColor: dia.color }}
                                title="Cambiar color"
                              />
                              {/* Info: cantidad de puntos (arriba, negro) + fecha (abajo, gris) */}
                              <div className="flex flex-col justify-center px-2 py-1 border-r-2 border-slate-900">
                                <span className="text-[11px] font-black text-slate-900 leading-none whitespace-nowrap">{dia.count} pts</span>
                                <span className="text-[9px] font-bold text-slate-400 leading-none mt-0.5 whitespace-nowrap">{fechaCorta}</span>
                              </div>
                              {/* Ojo (visibilidad) — cuadrado */}
                              <button
                                onClick={() => toggleVisibilidadDia && toggleVisibilidadDia(dia.id)}
                                className="w-9 flex items-center justify-center border-r-2 border-slate-900 bg-white active:bg-slate-100"
                                title={visible ? 'Ocultar' : 'Mostrar'}
                              >
                                {visible ? <Eye size={14} className="text-slate-900" strokeWidth={2.5} /> : <EyeOff size={14} className="text-slate-400" strokeWidth={2.5} />}
                              </button>
                            </>
                          )}
                          {/* Número del día (toca para expandir/comprimir) */}
                          <button
                            onClick={() => setDiaExpandido && setDiaExpandido(expandido ? null : dia.id)}
                            className="w-9 h-9 font-black text-sm active:opacity-80 flex items-center justify-center shrink-0"
                            style={visible ? { backgroundColor: dia.color, color: '#fff' } : { backgroundColor: '#fff', color: '#0f172a' }}
                            title={`Día ${dia.numero}`}
                          >
                            {dia.numero}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>


      {/* Botones CONFIRMAR / CANCELAR tras soltar el marcador */}
      {pendingCoords && (
        <div className="absolute bottom-24 left-4 right-4 z-[400] flex gap-3">
          <button
            onClick={cancelarMover}
            className="flex-1 h-12 rounded-xl border-2 border-slate-300 bg-white font-black text-slate-900 text-sm active:scale-95 transition-transform shadow-md"
          >
            CANCELAR
          </button>
          <button
            onClick={confirmarMover}
            className="flex-1 h-12 rounded-xl bg-green-600 text-white font-black text-sm active:scale-95 transition-transform shadow-lg border-b-4 border-green-800 active:border-b-0 active:mt-1"
          >
            CONFIRMAR
          </button>
        </div>
      )}

      {/* Etiqueta proyecto - Ddía del punto seleccionado (texto suelto, izquierda, sobre la barra) */}
      {puntoSeleccionado && etiquetaPuntoSel && !modoFibra && !modoMoverPuntos && !modoOrdenar && (
        <div className="absolute bottom-24 left-4 z-[400] pointer-events-none max-w-[55%]">
          <span className="block truncate text-[13px] font-black text-slate-900" style={{ textShadow: '0 1px 2px rgba(255,255,255,0.9)' }}>
            {etiquetaPuntoSel}
          </span>
        </div>
      )}

      {/* Botones flotantes CÁMARA + MOVER (sobre la barra inferior, solo cuando hay punto seleccionado) */}
      {puntoSeleccionado && !modoMover && !modoSupervision && !overlayGPSActivo && !modoFibra && (
        <div className="absolute bottom-24 right-4 z-[400] flex flex-col items-center gap-2">
          {/* Punto SIN día: asignar día por fecha (arriba de FOTOS) */}
          {puntoSinDia && onAsignarDiasSueltos && (
            <button
              onClick={onAsignarDiasSueltos}
              className="w-14 h-14 bg-purple-600 text-white rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform border-b-4 border-purple-800"
            >
              <CalendarPlus size={22} strokeWidth={2.5} />
              <span className="text-[9px] font-black tracking-wide">DÍA</span>
            </button>
          )}
          {abrirCamaraDirecta && (
            <button
              onClick={abrirCamaraDirecta}
              className="w-14 h-14 bg-orange-500 text-white rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform border-b-4 border-orange-700"
            >
              <Camera size={22} strokeWidth={2.5} />
              <span className="text-[9px] font-black tracking-wide">FOTOS</span>
            </button>
          )}
          <button
            onClick={iniciarMover}
            className="w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform border-b-4 border-slate-700"
          >
            <Move size={22} strokeWidth={2.5} />
            <span className="text-[9px] font-black tracking-wide">MOVER</span>
          </button>
        </div>
      )}

      {/* Barra flotante PC: modo reasignación de puntos */}
      {isDesktop && modoMoverPuntos && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] flex items-stretch gap-3">
          <div className="bg-white rounded-2xl px-5 py-2 shadow-xl border border-slate-200 flex flex-col items-center justify-center">
            <span className="font-black text-lg text-purple-600 leading-none">{puntosSeleccionadosMover.length}</span>
            <span className="text-[9px] font-bold tracking-widest text-slate-500">SELECC.</span>
          </div>
          <button onClick={() => { if (puntosSeleccionadosMover.length > 0) { setModoMoverAccion('copiar'); setShowSelectorProyecto(true); } }} disabled={puntosSeleccionadosMover.length === 0} className={puntosSeleccionadosMover.length > 0 ? `${pill} text-purple-600` : pillOff}>
            <Copy size={20} strokeWidth={2.5} /> COPIAR
          </button>
          <button onClick={() => { if (puntosSeleccionadosMover.length > 0) { setModoMoverAccion('cortar'); setShowSelectorProyecto(true); } }} disabled={puntosSeleccionadosMover.length === 0} className={puntosSeleccionadosMover.length > 0 ? `${pill} text-purple-600` : pillOff}>
            <Scissors size={20} strokeWidth={2.5} /> CORTAR
          </button>
          <button onClick={onCancelarMoverPuntos} className={`${pill} text-red-600`}>
            <X size={20} strokeWidth={2.5} /> CANCELAR
          </button>
        </div>
      )}

      {/* Barra inferior: modo reasignación de puntos */}
      {!isDesktop && modoMoverPuntos && (
        <div className={`h-20 ${theme.bottomBar} border-t-2 border-purple-400 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-[400] flex overflow-hidden shrink-0`}>
          <div className="flex-1 flex flex-col items-center justify-center px-3">
            <span className={`font-black text-lg text-purple-600`}>{puntosSeleccionadosMover.length}</span>
            <span className={`text-[10px] font-bold tracking-widest ${theme.text} opacity-60`}>SELECCIONADOS</span>
          </div>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button
            onClick={() => { if (puntosSeleccionadosMover.length > 0) { setModoMoverAccion('copiar'); setShowSelectorProyecto(true); } }}
            disabled={puntosSeleccionadosMover.length === 0}
            className={`flex-1 font-black text-sm flex flex-col items-center justify-center gap-0.5 transition-colors ${
              puntosSeleccionadosMover.length > 0 ? 'text-purple-600 active:opacity-80' : `${theme.text} opacity-30 cursor-not-allowed`
            } ${theme.card}`}
          >
            <Copy size={20} strokeWidth={2.5} />
            <span className="text-[10px] tracking-widest">COPIAR</span>
          </button>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button
            onClick={() => { if (puntosSeleccionadosMover.length > 0) { setModoMoverAccion('cortar'); setShowSelectorProyecto(true); } }}
            disabled={puntosSeleccionadosMover.length === 0}
            className={`flex-1 font-black text-sm flex flex-col items-center justify-center gap-0.5 transition-colors ${
              puntosSeleccionadosMover.length > 0 ? 'text-purple-600 active:opacity-80' : `${theme.text} opacity-30 cursor-not-allowed`
            } ${theme.card}`}
          >
            <Scissors size={20} strokeWidth={2.5} />
            <span className="text-[10px] tracking-widest">CORTAR</span>
          </button>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button
            onClick={onCancelarMoverPuntos}
            className={`w-16 ${theme.card} font-black flex flex-col items-center justify-center text-red-600 active:bg-red-500/10 transition-colors`}
          >
            <X size={22} strokeWidth={2.5} />
            <span className="text-[9px] mt-1 tracking-widest">CANCELAR</span>
          </button>
        </div>
      )}

      {/* Barra flotante PC: modo ORDENAR */}
      {isDesktop && modoOrdenar && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] flex items-stretch gap-3">
          <div className="bg-white rounded-2xl px-5 py-2 shadow-xl border border-slate-200 flex flex-col items-center justify-center">
            <span className="font-black text-lg text-blue-600 leading-none">{prefijoOrden.length + ordenSeleccion.length}/{totalPuntosProyecto}</span>
            <span className="text-[9px] font-bold tracking-widest text-slate-500">EN ORDEN</span>
          </div>
          <button onClick={alPulsarReiniciar} className={pill}>
            <RefreshCw size={20} strokeWidth={2.5} /> {etiquetaReiniciar}
          </button>
          <button
            onClick={() => { if (!modoCorregir) onIniciarCorreccion?.(); else if (modoCorregir === 'seleccion') onPedirDestino?.(); else onVolverASeleccion?.(); }}
            disabled={!modoCorregir ? ordenSeleccion.length > 0 : (modoCorregir === 'seleccion' && correccionSel.length === 0)}
            className={(!modoCorregir ? ordenSeleccion.length > 0 : (modoCorregir === 'seleccion' && correccionSel.length === 0)) ? pillOff : `${pill} text-orange-600`}
          >
            <CornerDownRight size={20} strokeWidth={2.5} />
            {!modoCorregir ? 'CORREGIR' : modoCorregir === 'seleccion' ? `DESPUÉS DE… (${correccionSel.length})` : 'ELIGE DESTINO'}
          </button>
          <button onClick={onGuardarOrden} disabled={guardandoOrden} className={guardandoOrden ? pillOff : `${pill} text-green-600`}>
            {guardandoOrden ? <RefreshCw size={20} className="animate-spin" /> : <Check size={20} strokeWidth={2.5} />} GUARDAR
          </button>
          <button onClick={onCancelarOrdenar} className={`${pill} text-red-600`}>
            <X size={20} strokeWidth={2.5} /> SALIR
          </button>
        </div>
      )}

      {/* Barra inferior: modo ORDENAR (editar posición) */}
      {!isDesktop && modoOrdenar && (
        <div className={`h-20 ${theme.bottomBar} border-t-2 border-blue-400 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-[400] flex overflow-hidden shrink-0`}>
          <div className="flex-1 flex flex-col items-center justify-center px-3">
            <span className="font-black text-lg text-blue-600">{prefijoOrden.length + ordenSeleccion.length}/{totalPuntosProyecto}</span>
            <span className={`text-[10px] font-bold tracking-widest ${theme.text} opacity-60`}>EN ORDEN</span>
          </div>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button onClick={alPulsarReiniciar} className={`flex-1 font-black text-sm flex flex-col items-center justify-center gap-0.5 ${theme.text} active:opacity-80 ${theme.card}`}>
            <RefreshCw size={20} strokeWidth={2.5} />
            <span className="text-[9px] tracking-widest">{etiquetaReiniciar}</span>
          </button>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button
            onClick={() => { if (!modoCorregir) onIniciarCorreccion?.(); else if (modoCorregir === 'seleccion') onPedirDestino?.(); else onVolverASeleccion?.(); }}
            disabled={!modoCorregir ? ordenSeleccion.length > 0 : (modoCorregir === 'seleccion' && correccionSel.length === 0)}
            className={`flex-1 font-black flex flex-col items-center justify-center gap-0.5 text-orange-600 disabled:opacity-40 active:opacity-80 ${theme.card}`}
          >
            <CornerDownRight size={20} strokeWidth={2.5} />
            <span className="text-[9px] tracking-widest leading-tight text-center">
              {!modoCorregir ? 'CORREGIR' : modoCorregir === 'seleccion' ? `DESPUÉS (${correccionSel.length})` : 'DESTINO'}
            </span>
          </button>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button onClick={onGuardarOrden} disabled={guardandoOrden} className={`flex-1 font-black text-sm flex flex-col items-center justify-center gap-0.5 text-green-600 active:opacity-80 disabled:opacity-40 ${theme.card}`}>
            {guardandoOrden ? <RefreshCw size={20} className="animate-spin" /> : <Check size={20} strokeWidth={2.5} />}
            <span className="text-[10px] tracking-widest">GUARDAR</span>
          </button>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button onClick={onCancelarOrdenar} className={`w-16 ${theme.card} font-black flex flex-col items-center justify-center text-red-600 active:bg-red-500/10`}>
            <X size={22} strokeWidth={2.5} />
            <span className="text-[9px] mt-1 tracking-widest">SALIR</span>
          </button>
        </div>
      )}

      {/* Barra flotante PC: acciones principales */}
      {isDesktop && !modoFibra && !modoMoverPuntos && !modoOrdenar && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] flex items-stretch gap-3">
          {modoSupervision ? (
            <>
              <button onClick={onVolverSupervision} className={pill}><ArrowLeft size={20} strokeWidth={2.5} /> VOLVER</button>
              <button onClick={() => { if (puntoSeleccionado) { setVistaAnterior('mapa'); verDetalle(); } }} disabled={!puntoSeleccionado} className={puntoSeleccionado ? pill : pillOff}><Eye size={20} strokeWidth={2.5} /> VER</button>
            </>
          ) : puntoSeleccionado ? (
            <>
              <button onClick={() => { if (!overlayGPSActivo) { setVistaAnterior('mapa'); verDetalle(); } }} disabled={overlayGPSActivo} className={overlayGPSActivo ? pillOff : pill}><Eye size={20} strokeWidth={2.5} /> VER</button>
              <button onClick={() => { if (!overlayGPSActivo) iniciarEdicion(); }} disabled={overlayGPSActivo} className={overlayGPSActivo ? pillOff : pill}><Edit3 size={20} strokeWidth={2.5} /> EDITAR</button>
              <button onClick={() => { if (!overlayGPSActivo) solicitarBorrarPunto(); }} disabled={overlayGPSActivo} className={overlayGPSActivo ? pillOff : `${pill} text-red-600`}><Trash2 size={20} strokeWidth={2.5} /> BORRAR</button>
            </>
          ) : (
            <>
              <button onClick={(e) => { e.stopPropagation(); setModoFibra(true); setDibujandoFibra(true); }} className={pill}><Cable size={20} strokeWidth={2.5} /> FIBRA</button>
              {proyectoTipo === 'instalacionPostes' && (
                <button onClick={() => fotoMapaInputRef.current?.click()} className={pill}><Camera size={20} strokeWidth={2.5} /> FOTO</button>
              )}
              <button onClick={intentarAgregarDatos} disabled={!puntoTemporal} className={puntoTemporal ? `${pill} text-green-600` : pillOff}><Plus size={20} strokeWidth={2.5} /> AGREGAR</button>
            </>
          )}
        </div>
      )}

      {/* Barra inferior: se oculta cuando modoFibra está activo */}
      {!isDesktop && !modoFibra && !modoMoverPuntos && !modoOrdenar && (
        <div className={`h-20 ${theme.bottomBar} border-t-2 ${theme.border} shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-[400] flex overflow-hidden shrink-0`}>
          {modoSupervision ? (
            // === MODO SUPERVISIÓN ===
            <>
              <button onClick={onVolverSupervision} className={`flex-1 ${theme.card} ${theme.text} font-black text-lg flex items-center justify-center gap-2 active:opacity-80 transition-colors`}>
                <ArrowLeft size={24} strokeWidth={2.5}/> VOLVER
              </button>
              <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`}></div>
              <button
                onClick={() => { if (puntoSeleccionado) { setVistaAnterior('mapa'); verDetalle(); } }}
                disabled={!puntoSeleccionado}
                className={`flex-1 font-black text-lg flex items-center justify-center gap-2 transition-colors ${
                  puntoSeleccionado
                    ? `${theme.card} ${theme.text} active:opacity-80`
                    : `${theme.card} opacity-40 cursor-not-allowed`
                }`}
              >
                <Eye size={24} strokeWidth={2.5}/> VER
              </button>
            </>
          ) : (
            // === MODO NORMAL ===
            puntoSeleccionado ? (
              // --- Punto seleccionado: VER / EDITAR / BORRAR ---
              <>
                <button
                  onClick={() => { if (!overlayGPSActivo) { setVistaAnterior('mapa'); verDetalle(); } }}
                  disabled={overlayGPSActivo}
                  className={`flex-1 ${theme.card} font-black text-lg flex items-center justify-center gap-2 transition-colors ${
                    overlayGPSActivo ? `${theme.text} opacity-40 cursor-not-allowed` : `${theme.text} active:opacity-80`
                  }`}
                >
                  <Eye size={24} strokeWidth={2.5}/> VER
                </button>
                <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`}></div>
                <button
                  onClick={() => { if (!overlayGPSActivo) iniciarEdicion(); }}
                  disabled={overlayGPSActivo}
                  className={`flex-1 ${theme.card} font-black text-lg flex items-center justify-center gap-2 transition-colors ${
                    overlayGPSActivo ? `${theme.text} opacity-40 cursor-not-allowed` : `${theme.text} active:opacity-80`
                  }`}
                >
                  <Edit3 size={24} strokeWidth={2.5}/> EDITAR
                </button>
                <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`}></div>
                <button
                  onClick={() => { if (!overlayGPSActivo) solicitarBorrarPunto(); }}
                  disabled={overlayGPSActivo}
                  className={`w-20 ${theme.card} font-black flex flex-col items-center justify-center transition-colors ${
                    overlayGPSActivo ? 'text-red-600 opacity-40 cursor-not-allowed' : 'text-red-600 active:bg-red-500/10'
                  }`}
                >
                  <Trash2 size={26} strokeWidth={2.5}/>
                  <span className="text-[9px] mt-1 tracking-widest">BORRAR</span>
                </button>
              </>
            ) : (
              // --- Sin selección: FIBRA / AGREGAR ---
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setModoFibra(true); setDibujandoFibra(true); }}
                  className={`flex-1 flex items-center justify-center gap-2 font-black text-lg ${theme.card} ${theme.text} hover:opacity-80`}
                >
                  <Cable size={24} strokeWidth={2.5} /> FIBRA
                </button>
                <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`}></div>
                {proyectoTipo === 'instalacionPostes' && (
                  <>
                    <button
                      onClick={() => fotoMapaInputRef.current?.click()}
                      className={`w-20 ${theme.card} ${theme.text} font-black flex flex-col items-center justify-center active:opacity-80 transition-colors`}
                    >
                      <Camera size={24} strokeWidth={2.5} />
                      <span className="text-[9px] mt-1 tracking-widest">FOTO</span>
                    </button>
                    <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`}></div>
                  </>
                )}
                <button
                  onClick={intentarAgregarDatos}
                  disabled={!puntoTemporal}
                  className={`flex-1 flex items-center justify-center gap-2 font-black text-lg transition-colors ${puntoTemporal ? 'bg-slate-800 text-white' : `${theme.card} ${theme.text} opacity-35 cursor-not-allowed`}`}
                >
                  <Plus size={24} strokeWidth={2.5} /> AGREGAR
                </button>
              </>
            )
          )}
        </div>
      )}

      {/* Modal selección de proyecto destino */}
      {showSelectorProyecto && (
        <div className="absolute inset-0 z-[500] bg-black/80 flex items-end justify-center" onClick={() => setShowSelectorProyecto(false)}>
          <div className={`w-full ${theme.card} rounded-t-2xl overflow-hidden`} onClick={e => e.stopPropagation()}>
            <div className={`px-5 py-4 border-b-2 ${theme.border} flex items-center justify-between`}>
              <h3 className={`font-black text-sm uppercase tracking-wide ${theme.text}`}>
                {modoMoverAccion === 'copiar' ? 'Copiar a…' : 'Cortar y mover a…'}
              </h3>
              <button onClick={() => setShowSelectorProyecto(false)} className={`p-1.5 rounded-lg ${theme.text} active:scale-95`}>
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-72 p-3 space-y-2">
              {(() => {
                const idsSet = new Set(puntosSeleccionadosMover);
                const nConexiones = conexionesVisiblesMapa.filter(c => {
                  const ids = c.puntos?.length >= 2 ? c.puntos : [c.from, c.to].filter(Boolean);
                  return ids.length >= 2 && ids.every(id => idsSet.has(id));
                }).length;
                return (
                  <>
                    {/* Nuevo proyecto */}
                    <button
                      onClick={() => { setShowSelectorProyecto(false); setConfirmMoverData({ proyecto: { id: 'NUEVO', nombre: 'nuevo' }, nConexiones, esNuevo: true }); }}
                      className="w-full text-left px-4 py-3 rounded-xl border-2 border-dashed border-purple-400 text-purple-600 font-black text-sm active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Plus size={18} strokeWidth={2.5} /> Nuevo proyecto
                    </button>
                    {proyectosDestino.length === 0 ? (
                      <p className={`text-center ${theme.text} opacity-60 py-4 text-sm font-bold`}>No hay otros proyectos</p>
                    ) : (
                      proyectosDestino.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setShowSelectorProyecto(false); setConfirmMoverData({ proyecto: p, nConexiones }); }}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 ${theme.border} ${theme.text} font-bold text-sm active:scale-95 transition-all`}
                        >
                          {p.nombre}
                        </button>
                      ))
                    )}
                  </>
                );
              })()}
            </div>
            <div className="h-4" />
          </div>
        </div>
      )}

      {/* Modal confirmación de movimiento */}
      {confirmMoverData && (
        <div className="absolute inset-0 z-[500] bg-black/80 flex items-center justify-center p-6">
          <div className={`w-full ${theme.card} rounded-2xl p-6 space-y-4`}>
            <h3 className={`font-black text-base uppercase tracking-wide ${theme.text}`}>
              {modoMoverAccion === 'copiar' ? 'Confirmar copia' : 'Confirmar movimiento'}
            </h3>
            <p className={`text-sm ${theme.text} opacity-80`}>
              Se {modoMoverAccion === 'copiar' ? 'copiarán' : 'moverán'} <span className="font-black text-purple-600">{puntosSeleccionadosMover.length} punto{puntosSeleccionadosMover.length !== 1 ? 's' : ''}</span>
              {confirmMoverData.nConexiones > 0 && <> y <span className="font-black text-purple-600">{confirmMoverData.nConexiones} conexión{confirmMoverData.nConexiones !== 1 ? 'es' : ''}</span></>}
              {' '}{modoMoverAccion === 'copiar' ? 'a' : 'al proyecto'}{confirmMoverData.esNuevo ? ' un' : ''}:
            </p>
            <p className={`font-black text-base text-purple-600 border-2 border-purple-300 rounded-xl px-4 py-2`}>
              {confirmMoverData.esNuevo ? 'Nuevo proyecto "nuevo"' : confirmMoverData.proyecto.nombre}
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmMoverData(null)}
                className={`flex-1 py-3 rounded-xl border-2 ${theme.border} font-black text-sm ${theme.text} active:scale-95 transition-all`}
              >
                CANCELAR
              </button>
              <button
                onClick={() => {
                  const destino = confirmMoverData.esNuevo ? 'NUEVO' : confirmMoverData.proyecto;
                  onEjecutarCopiarCortar(destino, modoMoverAccion);
                  setConfirmMoverData(null);
                  setModoMoverAccion(null);
                }}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-black text-sm active:scale-95 transition-all border-b-4 border-purple-800 active:border-b-0 active:mt-1"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input oculto para la cámara directa (lo dispara el botón negro de la barra en proyectos de instalación) */}
      <input ref={fotoMapaInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCapturarFotoMapa?.(f); }} />

      {/* Selector de destino para foto directa (sección + casillero) */}
      {pickerDestino && (() => {
        const flatten = (tab) => {
          const out = [];
          (tab.items || []).forEach(it => {
            if (it.items) it.items.forEach(sub => out.push({ itemId: sub.id, label: `${(it.title || it.label || '').replace(/\n/g, ' ')} ${(sub.label || '').replace(/\n/g, ' ')}`.trim() }));
            else if (it.type === 'subgallery') out.push({ itemId: `${it.id}_${Date.now()}`, label: `${(it.label || '').replace(/\n/g, ' ')} (nueva)` });
            else out.push({ itemId: it.id, label: (it.label || '').replace(/\n/g, ' ') });
          });
          if (tab.dynamic) out.push({ itemId: `extra_${Date.now()}`, label: 'Adicional (nueva)' });
          return out;
        };
        return (
          <div className="absolute inset-0 z-[500] bg-black/70 flex items-end" onClick={() => { setPickerDestino(null); setPickerTab(null); }}>
            <div className={`w-full ${isDark ? 'bg-slate-900' : 'bg-white'} rounded-t-2xl max-h-[72%] flex flex-col`} onClick={e => e.stopPropagation()}>
              <div className={`px-4 py-3 border-b-2 ${theme.border} flex items-center gap-2 shrink-0`}>
                <button onClick={() => pickerTab ? setPickerTab(null) : (setPickerDestino(null))} className={`p-1 ${theme.text} active:scale-90`}>
                  {pickerTab ? <ArrowLeft size={20} /> : <X size={20} />}
                </button>
                <p className={`font-black text-sm uppercase ${theme.text}`}>{pickerTab ? (tabsConfig[pickerTab]?.title || 'Casillero') : 'Elegí dónde va la foto'}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
                {!pickerTab ? (
                  Object.keys(tabsConfig).map(tid => (
                    <button key={tid} onClick={() => setPickerTab(tid)}
                      className={`py-3 rounded-xl border-2 ${theme.border} ${theme.text} font-black text-xs uppercase active:scale-95`}>
                      {tabsConfig[tid].title}
                    </button>
                  ))
                ) : (
                  flatten(tabsConfig[pickerTab]).map((it, i) => (
                    <button key={i} disabled={asociando}
                      onClick={() => ejecutarAsociacion(pickerDestino.foto, pickerDestino.puntoId, false, pickerTab, it.itemId)}
                      className={`py-3 px-2 rounded-xl border-2 ${theme.border} ${theme.text} font-bold text-[11px] active:scale-95 disabled:opacity-50`}>
                      {it.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default VistaMapa;
