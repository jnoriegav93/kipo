import React from 'react';
import { X, RefreshCw, Trash2, Upload, Edit3, Move, CloudOff, Wifi, Cloud, AlertTriangle, FilePlus, Camera } from 'lucide-react';

const SECTION_TITLES = {
  site1: 'SITE 1', site2: 'SITE 2',
  napMec: 'NAP MEC.', mufaTroncal: 'MUFA TRONCAL',
  xbox: 'XBOX', hbox: 'HBOX', fat: 'FAT'
};

const getInfoTarea = (tarea) => {
  if (tarea.tipo === 'guardar_punto') {
    const modo = tarea.datos?.modo;
    const numero = tarea.datos?.datos?.datos?.numero;
    const label = modo === 'crear' ? 'Crear punto' : 'Editar punto';
    return { label: numero ? `${label} #${numero}` : label, Icon: modo === 'crear' ? Upload : Edit3, esEdicion: modo !== 'crear' };
  }
  if (tarea.tipo === 'mover_punto') return { label: 'Mover punto', Icon: Move, esEdicion: true };
  if (tarea.tipo === 'reasignar_punto') return { label: 'Reasignar punto', Icon: Move, esEdicion: true };
  if (tarea.tipo === 'borrar_punto') return { label: 'Borrar punto', Icon: Trash2, esEdicion: false };
  if (tarea.tipo === 'subir_foto') {
    const { section, item } = tarea.datos || {};
    const secTitle = SECTION_TITLES[section] || section || '';
    const sublabel = secTitle && item ? `${secTitle} · ${item}` : (secTitle || item || null);
    return { label: 'Subir foto', sublabel, Icon: Camera, esEdicion: false };
  }
  return { label: tarea.tipo, Icon: Cloud, esEdicion: false };
};

const formatTiempo = (timestamp) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};

export default function QueueModal({ isOpen, onClose, cola, erroresTareas, procesando, isOnline, eliminarTarea, reintentarTarea, guardarComoNuevo, theme }) {
  if (!isOpen) return null;

  const activas = cola.filter(t => !t.fallido);
  const primeraActivaIdx = cola.findIndex(t => !t.fallido && (erroresTareas[t.id]?.intentos || 0) < 3);
  const tareasConError = activas.filter(t => (erroresTareas[t.id]?.intentos || 0) >= 3);

  return (
    <div className="fixed inset-0 z-[500] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className={`relative ${theme.card} rounded-t-2xl shadow-2xl flex flex-col max-h-[78vh]`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b-2 ${theme.border} shrink-0`}>
          <div className="flex items-center gap-2">
            <span className={`text-base font-black ${theme.text}`}>Cola de sincronización</span>
            {cola.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-black">{cola.length}</span>
            )}
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${theme.text} active:scale-95`}>
            <X size={20} />
          </button>
        </div>

        {/* Estado conexión */}
        <div className={`px-4 py-2 flex items-center gap-2 border-b ${theme.border} shrink-0`}>
          {isOnline
            ? <><Wifi size={14} className="text-emerald-500 shrink-0" /><span className={`text-xs ${theme.subtext}`}>Conectado a internet</span></>
            : <><CloudOff size={14} className="text-slate-400 shrink-0" /><span className={`text-xs ${theme.subtext}`}>Sin conexión — datos guardados en el equipo</span></>
          }
          {procesando && isOnline && (
            <span className="ml-auto text-yellow-500 text-xs font-bold flex items-center gap-1 shrink-0">
              <RefreshCw size={11} className="animate-spin" /> Subiendo...
            </span>
          )}
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1">
          {cola.length === 0 ? (
            <div className={`py-12 text-center ${theme.subtext} text-sm`}>
              <Cloud size={32} className="mx-auto mb-2 opacity-30" />
              Todo sincronizado
            </div>
          ) : (
            cola.map((tarea, idx) => {
              const { label, sublabel, Icon, esEdicion } = getInfoTarea(tarea);
              const error = erroresTareas[tarea.id];
              const intentos = error?.intentos || 0;
              const bloqueada = !tarea.fallido && intentos >= 3;
              const subiendo = procesando && idx === primeraActivaIdx;
              const fallido = !!tarea.fallido;

              return (
                <div key={tarea.id} className={`flex items-start gap-3 px-4 py-3 border-b ${theme.border} last:border-0 ${fallido ? 'opacity-80' : ''}`}>

                  {/* Ícono tipo */}
                  <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    fallido  ? 'bg-orange-100 text-orange-500' :
                    bloqueada ? 'bg-red-100 text-red-500' :
                    subiendo  ? 'bg-yellow-100 text-yellow-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {fallido   ? <AlertTriangle size={16} /> :
                     subiendo  ? <RefreshCw size={16} className="animate-spin" /> :
                     <Icon size={16} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${theme.text}`}>{label}</div>
                    {sublabel && <div className={`text-xs font-mono ${theme.subtext} leading-tight`}>{sublabel}</div>}
                    <div className={`text-xs ${theme.subtext} mt-0.5`}>{formatTiempo(tarea.timestamp)}</div>
                    {fallido && (
                      <div className="text-xs text-orange-500 mt-1 leading-tight">
                        El punto ya no existe en el servidor. Podés guardarlo como nuevo punto.
                      </div>
                    )}
                    {!fallido && error?.mensaje && (
                      <div className="text-xs text-red-500 mt-1 break-all leading-tight">{error.mensaje}</div>
                    )}
                  </div>

                  {/* Badge + acciones */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {fallido ? (
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-black">FALLIDO</span>
                    ) : bloqueada ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-black">ERROR</span>
                    ) : subiendo ? (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-black">SUBIENDO</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${theme.subtext} bg-slate-100`}>EN COLA</span>
                    )}

                    <div className="flex gap-1">
                      {fallido && esEdicion && guardarComoNuevo && (
                        <button
                          onClick={() => guardarComoNuevo(tarea)}
                          className="w-7 h-7 rounded-lg bg-green-100 text-green-600 flex items-center justify-center active:scale-95"
                          title="Guardar como nuevo punto"
                        >
                          <FilePlus size={13} />
                        </button>
                      )}
                      {!fallido && bloqueada && (
                        <button
                          onClick={() => reintentarTarea(tarea.id)}
                          className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center active:scale-95"
                          title="Reintentar"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => eliminarTarea(tarea.id)}
                        className="w-7 h-7 rounded-lg bg-red-100 text-red-500 flex items-center justify-center active:scale-95"
                        title="Eliminar de la cola"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer — reintentar todos con error (excluye FALLIDO) */}
        {tareasConError.length > 0 && (
          <div className={`px-4 py-3 border-t-2 ${theme.border} shrink-0`}>
            <button
              onClick={() => tareasConError.forEach(t => reintentarTarea(t.id))}
              className="w-full h-11 rounded-xl bg-blue-500 text-white font-black text-sm active:scale-95 transition-transform flex items-center justify-center gap-2 border-b-4 border-blue-700 active:border-b-0 active:mt-1"
            >
              <RefreshCw size={16} />
              Reintentar todos con error ({tareasConError.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
