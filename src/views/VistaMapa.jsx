import React from 'react';
import { Eye, Edit3, Trash2, Plus, ArrowLeft, Cable, Move } from 'lucide-react';
import { MapaReal } from '../components/Mapas';
import BarraFibra from '../components/BarraFibra';

const VistaMapa = ({
  theme, mapStyle, mapViewState, setMapViewState, handleMapaClick,
  puntosVisiblesMapa, iconSize, obtenerColorDia, puntoSeleccionado,
  handlePuntoClick, puntoTemporal, mostrarEtiquetas, gpsTrigger, yaSaltoAlInicio,
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
  totalPuntosProyecto = 0
}) => {
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
            puntoSeleccionado={puntoSeleccionado}
            handlePuntoClick={handlePuntoClick}
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


        {/* Banner de supervisión */}
        {modoSupervision && (
          <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none z-40">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg border-2 border-blue-800">
              MODO SUPERVISIÓN - SOLO LECTURA
            </div>
          </div>
        )}

        {/* Info proyecto (sutil, esquina superior derecha) */}
        {!modoSupervision && nombreProyecto && (
          <div className="absolute top-2 right-3 z-40 pointer-events-none">
            <div className="bg-black/30 backdrop-blur-sm rounded-lg px-2 py-1">
              <p className="text-[11px] font-bold text-white leading-tight max-w-[200px] truncate">{nombreProyecto} · {totalPuntosProyecto} pts</p>
            </div>
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

      {/* Botón flotante MOVER (sobre la barra inferior, solo cuando hay punto seleccionado y no modoMover) */}
      {puntoSeleccionado && !modoMover && !modoSupervision && !overlayGPSActivo && !modoFibra && (
        <div className="absolute bottom-24 right-4 z-[400]">
          <button
            onClick={iniciarMover}
            className="w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform border-b-4 border-slate-700"
          >
            <Move size={22} strokeWidth={2.5} />
            <span className="text-[9px] font-black tracking-wide">MOVER</span>
          </button>
        </div>
      )}

      {/* Barra inferior: se oculta cuando modoFibra está activo */}
      {!modoFibra && (
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
                <button onClick={intentarAgregarDatos} className={`flex-1 flex items-center justify-center gap-2 font-black text-lg ${puntoTemporal ? 'bg-slate-800 text-white' : `${theme.card} ${theme.text} hover:opacity-80`}`}>
                  <Plus size={24} strokeWidth={2.5} /> AGREGAR
                </button>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default VistaMapa;
