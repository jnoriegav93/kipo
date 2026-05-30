import React, { useState } from 'react';
import { Eye, Edit3, Trash2, Plus, ArrowLeft, Cable, Move, X, Link2, Camera, FolderInput, Check } from 'lucide-react';
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
  theme, mapStyle, mapViewState, setMapViewState, handleMapaClick,
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
  onEliminarConexion,
  onCambiarCapacidad,
  totalFibras,
  nombreProyecto = null,
  totalPuntosProyecto = 0,
  proyectoEsCompartido = false,
  menuEtiquetasAbierto = false,
  setMostrarEtiquetas,
  mostrarEtiquetas = { item: false, pasivo: false },
  // Fotos en mapa
  fotosConCoordenadas = [],
  fotoPuntosActivo = false,
  onAsociarFoto,
  puntos = [],
  abrirCamaraDirecta,
  // Modo reasignación de puntos
  modoMoverPuntos = false,
  puntosSeleccionadosMover = [],
  setPuntosSeleccionadosMover,
  onEjecutarMoverPuntos,
  onCancelarMoverPuntos,
  proyectosDestino = [],
}) => {
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [panelAsociarVisible, setPanelAsociarVisible] = useState(false);
  const [puntosProximos, setPuntosProximos] = useState([]);
  const [puntoResaltado, setPuntoResaltado] = useState(null);
  const [confirmReemplazar, setConfirmReemplazar] = useState(null); // { foto, puntoId }
  const [asociando, setAsociando] = useState(false);
  const [showSelectorProyecto, setShowSelectorProyecto] = useState(false);
  const [confirmMoverData, setConfirmMoverData] = useState(null);

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

  const ejecutarAsociacion = async (foto, puntoId, forzar = false) => {
    setAsociando(true);
    const resultado = await onAsociarFoto?.(foto, puntoId, forzar);
    setAsociando(false);
    if (resultado === 'existe') {
      setConfirmReemplazar({ foto, puntoId });
      return;
    }
    if (resultado === 'ok') {
      setFotoSeleccionada(null);
      setPanelAsociarVisible(false);
      setPuntosProximos([]);
      setPuntoResaltado(null);
    }
  };

  return (
    <div className="flex-1 relative h-full w-full overflow-hidden flex flex-col">

      {/* Mapa */}
      <div className="flex-1 relative">
        {mapViewState ? (
          <MapaReal
            theme={theme}
            mapStyle={mapStyle}
            handleMapaClick={handleMapaClick}
            puntosVisiblesMapa={puntosVisiblesMapa}
            iconSize={iconSize}
            obtenerColorDia={obtenerColorDia}
            puntoSeleccionado={modoMoverPuntos ? null : puntoSeleccionado}
            handlePuntoClick={modoMoverPuntos
              ? (e, id) => setPuntosSeleccionadosMover(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
              : handlePuntoClick
            }
            modoMoverPuntos={modoMoverPuntos}
            puntosSeleccionadosMover={puntosSeleccionadosMover}
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
              onGuardarFibra={onGuardarFibra}
              conexionSeleccionada={conexionSeleccionada}
              onEliminarConexion={onEliminarConexion}
              onCambiarCapacidad={onCambiarCapacidad}
              fibrasVisibles={fibrasVisibles}
              setFibrasVisibles={setFibrasVisibles}
              totalFibras={totalFibras}
              onCerrar={() => {
                setModoFibra(false);
                setDibujandoFibra(false);
                setPuntosRecorrido([]);
                setConexionSeleccionada(null);
              }}
              setPuntosRecorrido={setPuntosRecorrido}
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
                  onClick={() => { const c = confirmReemplazar; setConfirmReemplazar(null); ejecutarAsociacion(c.foto, c.puntoId, true); }}
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
          <div className="absolute top-2 right-3 z-40 flex flex-col items-end gap-1.5">
            {/* Overlay nombre */}
            <div className={`rounded-lg px-2 py-1 pointer-events-none ${proyectoEsCompartido ? 'bg-brand-500' : 'bg-slate-900'}`}>
              <p className="text-[11px] font-bold text-white leading-tight max-w-[200px] truncate uppercase">{nombreProyecto} · {totalPuntosProyecto} pts</p>
            </div>

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

      {/* Botones flotantes CÁMARA + MOVER (sobre la barra inferior, solo cuando hay punto seleccionado) */}
      {puntoSeleccionado && !modoMover && !modoSupervision && !overlayGPSActivo && !modoFibra && (
        <div className="absolute bottom-24 right-4 z-[400] flex flex-col items-center gap-2">
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

      {/* Barra inferior: modo reasignación de puntos */}
      {modoMoverPuntos && (
        <div className={`h-20 ${theme.bottomBar} border-t-2 border-purple-400 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-[400] flex overflow-hidden shrink-0`}>
          <div className="flex-1 flex flex-col items-center justify-center px-3">
            <span className={`font-black text-lg text-purple-600`}>{puntosSeleccionadosMover.length}</span>
            <span className={`text-[10px] font-bold tracking-widest ${theme.text} opacity-60`}>SELECCIONADOS</span>
          </div>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button
            onClick={() => puntosSeleccionadosMover.length > 0 && setShowSelectorProyecto(true)}
            disabled={puntosSeleccionadosMover.length === 0}
            className={`flex-1 font-black text-sm flex items-center justify-center gap-2 transition-colors ${
              puntosSeleccionadosMover.length > 0 ? 'text-purple-600 active:opacity-80' : `${theme.text} opacity-30 cursor-not-allowed`
            } ${theme.card}`}
          >
            <FolderInput size={22} strokeWidth={2.5} /> MOVER
          </button>
          <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`} />
          <button
            onClick={onCancelarMoverPuntos}
            className={`w-20 ${theme.card} font-black flex flex-col items-center justify-center text-red-600 active:bg-red-500/10 transition-colors`}
          >
            <X size={24} strokeWidth={2.5} />
            <span className="text-[9px] mt-1 tracking-widest">CANCELAR</span>
          </button>
        </div>
      )}

      {/* Barra inferior: se oculta cuando modoFibra está activo */}
      {!modoFibra && !modoMoverPuntos && (
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
                  onClick={(e) => { e.stopPropagation(); setModoFibra(true); }}
                  className={`flex-1 flex items-center justify-center gap-2 font-black text-lg ${theme.card} ${theme.text} hover:opacity-80`}
                >
                  <Cable size={24} strokeWidth={2.5} /> FIBRA
                </button>
                <div className={`w-[2px] h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full`}></div>
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
              <h3 className={`font-black text-sm uppercase tracking-wide ${theme.text}`}>Selecciona el proyecto destino</h3>
              <button onClick={() => setShowSelectorProyecto(false)} className={`p-1.5 rounded-lg ${theme.text} active:scale-95`}>
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-72 p-3 space-y-2">
              {proyectosDestino.length === 0 ? (
                <p className={`text-center ${theme.text} opacity-60 py-6 text-sm font-bold`}>No hay otros proyectos disponibles</p>
              ) : (
                proyectosDestino.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setShowSelectorProyecto(false);
                      const idsSet = new Set(puntosSeleccionadosMover);
                      const nConexiones = conexionesVisiblesMapa.filter(c => {
                        const ids = c.puntos?.length >= 2 ? c.puntos : [c.from, c.to].filter(Boolean);
                        return ids.length >= 2 && ids.every(id => idsSet.has(id));
                      }).length;
                      setConfirmMoverData({ proyecto: p, nConexiones });
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 ${theme.border} ${theme.text} font-bold text-sm active:scale-95 transition-all`}
                  >
                    {p.nombre}
                  </button>
                ))
              )}
            </div>
            <div className="h-4" />
          </div>
        </div>
      )}

      {/* Modal confirmación de movimiento */}
      {confirmMoverData && (
        <div className="absolute inset-0 z-[500] bg-black/80 flex items-center justify-center p-6">
          <div className={`w-full ${theme.card} rounded-2xl p-6 space-y-4`}>
            <h3 className={`font-black text-base uppercase tracking-wide ${theme.text}`}>Confirmar movimiento</h3>
            <p className={`text-sm ${theme.text} opacity-80`}>
              Se moverán <span className="font-black text-purple-600">{puntosSeleccionadosMover.length} punto{puntosSeleccionadosMover.length !== 1 ? 's' : ''}</span>
              {confirmMoverData.nConexiones > 0 && <> y <span className="font-black text-purple-600">{confirmMoverData.nConexiones} conexión{confirmMoverData.nConexiones !== 1 ? 'es' : ''}</span></>}
              {' '}al proyecto:
            </p>
            <p className={`font-black text-base text-purple-600 border-2 border-purple-300 rounded-xl px-4 py-2`}>{confirmMoverData.proyecto.nombre}</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmMoverData(null)}
                className={`flex-1 py-3 rounded-xl border-2 ${theme.border} font-black text-sm ${theme.text} active:scale-95 transition-all`}
              >
                CANCELAR
              </button>
              <button
                onClick={() => { onEjecutarMoverPuntos(confirmMoverData.proyecto); setConfirmMoverData(null); }}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-black text-sm active:scale-95 transition-all border-b-4 border-purple-800 active:border-b-0 active:mt-1"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VistaMapa;
