import React from 'react';
import { Menu, RefreshCw, Cloud, CloudOff, Navigation, Tag, ZoomOut, ZoomIn, Map, Images } from 'lucide-react';

export default function Header({
  theme,
  setMenuAbierto,
  estadoSync,
  cola,
  onClickSync,
  setGpsTrigger,
  mostrarEtiquetas,
  menuEtiquetasAbierto,
  toggleMenuEtiquetas,
  isDark,
  setIsDark,
  setIconSize,
  mapStyle,
  setMapStyle,
  totalNotificaciones = 0,
  fotoPuntosActivo = false,
  onToggleFotoPuntos,
}) {
  return (
    <div className={`${theme.header} px-4 flex items-center justify-between border-b-2 ${theme.border} z-[50] relative shrink-0`} style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))', paddingBottom: '12px', minHeight: 'calc(64px + env(safe-area-inset-top))' }}>
      
      {/* LADO IZQUIERDO: SOLO MENÚ */}
      <div className="flex items-center">
            <button onClick={() => setMenuAbierto(true)} className="relative">
              <Menu size={28} className={theme.text} strokeWidth={2.5}/>
              {totalNotificaciones > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white border-2 border-white shadow-sm">
                  {totalNotificaciones > 9 ? '9+' : totalNotificaciones}
                </span>
              )}
            </button>
      </div>

      {/* LADO DERECHO: TODAS LAS HERRAMIENTAS */}
      <div className="flex items-center gap-1">
          
          {/* 0. INDICADOR DE SINCRONIZACIÓN */}
          <button
            onClick={onClickSync}
            className={`
              flex items-center justify-center w-10 h-10 rounded-xl border-2 transition-all duration-300 relative active:scale-95
              ${estadoSync === 'synced'
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                : estadoSync === 'syncing'
                  ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
                  : estadoSync === 'error'
                    ? 'bg-red-500/10 border-red-500/50 text-red-400'
                    : estadoSync === 'offline'
                      ? 'bg-slate-700/50 border-slate-600 text-slate-500'
                      : `${theme.bg} ${theme.border} text-slate-400`
              }
            `}
          >
            {estadoSync === 'syncing' && <RefreshCw size={20} className="animate-spin" />}
            {estadoSync === 'synced' && <Cloud size={20} />}
            {estadoSync === 'offline' && <CloudOff size={20} />}
            {estadoSync === 'error' && <Cloud size={20} />}

            {cola.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white z-10 shadow-sm border border-white/20">
                {cola.length > 9 ? '9+' : cola.length}
              </span>
            )}
          </button>

          {/* 1. BOTÓN GPS */}
          <button 
            onClick={() => setGpsTrigger(t => t + 1)} 
            className={`p-2 rounded-xl border-2 font-bold transition-all active:scale-95 ${theme.bg} ${theme.text} ${theme.border}`}
            title="Ir a mi ubicación"
          >
            <Navigation size={20} className={theme.text} fill="currentColor" />
          </button>


          {/* 2. ESTILO DE MAPA — alterna entre google y vector */}
          <button
            onClick={() => setMapStyle(s => s === 'vector' ? 'google' : 'vector')}
            className={`p-2 rounded-xl border-2 font-bold transition-all active:scale-95 ${mapStyle === 'vector' ? 'bg-blue-50 border-blue-500 text-blue-600' : `${theme.bg} ${theme.text} ${theme.border}`}`}
            title="Estilo de mapa"
          >
            <Map size={20} />
          </button>

          {/* 3. ETIQUETAS */}
          <button
            onClick={toggleMenuEtiquetas}
            className={`p-2 rounded-xl border-2 font-bold transition-all active:scale-95 ${menuEtiquetasAbierto || mostrarEtiquetas.item || mostrarEtiquetas.pasivo ? 'bg-brand-50 border-brand-500 text-brand-600' : `${theme.bg} ${theme.text} ${theme.border}`}`}
          >
            <Tag size={20} />
          </button>

          {/* 4. FOTOS EN MAPA */}
          {onToggleFotoPuntos && (
            <button
              onClick={onToggleFotoPuntos}
              className={`p-2 rounded-xl border-2 font-bold transition-all active:scale-95 ${fotoPuntosActivo ? 'bg-purple-600 border-purple-700 text-white' : `${theme.bg} ${theme.text} ${theme.border}`}`}
              title="Fotos en mapa"
            >
              <Images size={20} />
            </button>
          )}

          {/* 5. ZOOM / LUPAS */}
          <div className={`flex items-center border-2 ${theme.border} rounded-xl overflow-hidden ${theme.bg}`}>
            <button 
              onClick={() => setIconSize(s => Math.max(0.5, s - 0.2))}
              className={`p-2 hover:bg-black/5 active:bg-black/10 border-r ${theme.border} ${theme.text}`}
            >
              <ZoomOut size={20} />
            </button>
            <button 
              onClick={() => setIconSize(s => Math.min(2.5, s + 0.2))}
              className={`p-2 hover:bg-black/5 active:bg-black/10 ${theme.text}`}
            >
              <ZoomIn size={20} />
            </button>
          </div>
      </div>
    </div>
  );
}