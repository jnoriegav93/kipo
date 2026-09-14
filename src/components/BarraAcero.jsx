import React, { useState, useRef, useEffect } from 'react';
import { Save, Trash2, Eye, EyeOff, X, List, Undo2, Crosshair } from 'lucide-react';

// Barra del CABLE DE ACERO. Se abre desde la barra de fibra (selector FIBRA | ACERO),
// pero no comparte nada con ella: el trazo son exactamente dos postes, se guarda en
// otra colección y se liquida como ferretería, por metro (distancia + 1 m, al metro
// superior). Los tipos de cable son los ítems del catálogo marcados "por metro".
export default function BarraAcero({
  theme,
  isDark,
  selector = null,
  trazo = [],
  setTrazo,
  descripcionTrazo = null,  // { etiqueta: 'P12 → P13', metros: 25 } con los dos postes elegidos
  tipos = [],
  tipoId,
  setTipoId,
  onGuardar,
  cables = [],              // visibles, ya resueltos: { id, ferrId, nombreTipo, etiqueta, metros, timestamp }
  cableSeleccionado,
  setCableSeleccionado,
  onCambiarTipo,
  onEliminar,
  onCentrar,
  visibles,
  setVisibles,
  total = 0,
  onCerrar,
}) {
  const [panel, setPanel] = useState(null); // null | 'guardar' | 'lista'
  const [tipoElegido, setTipoElegido] = useState(null);
  const refBarra = useRef(null);

  useEffect(() => {
    if (!panel) return;
    const handler = (e) => {
      if (refBarra.current && !refBarra.current.contains(e.target)) setPanel(null);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [panel]);

  const puedeGuardar = trazo.length === 2;

  // Arranca con el último tipo usado, si sigue en el catálogo
  const abrirGuardar = () => {
    setTipoElegido(tipos.some(t => t.id === tipoId) ? tipoId : (tipos[0]?.id || null));
    setPanel('guardar');
  };

  const confirmarGuardar = async () => {
    if (!tipoElegido) return;
    setPanel(null);
    setTipoId?.(tipoElegido);
    await onGuardar?.(tipoElegido);
  };

  const btnBase = "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0";
  const btnNormal = isDark
    ? 'bg-slate-700 text-slate-200 border-slate-500'
    : 'bg-white text-slate-700 border-slate-500';
  const btnDisabled = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-500'
    : 'bg-white border-slate-400 text-slate-400';
  const btnActivo = 'bg-slate-800 text-white border-slate-950';
  const panelBase = `pointer-events-auto mt-1 rounded-2xl ${isDark ? 'bg-slate-800/95 border-slate-600' : 'bg-white/95 border-slate-400'} border-2 shadow-xl backdrop-blur-sm`;
  const rotulo = `block text-[9px] font-black tracking-widest mb-1 ${theme.text} opacity-60`;

  // Los más nuevos arriba
  const ordenados = [...cables].sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const metrosTotal = cables.reduce((t, c) => t + (c.metros || 0), 0);

  const aviso = trazo.length === 0 ? 'TOCA EL PRIMER POSTE'
    : trazo.length === 1 ? 'TOCA EL SEGUNDO POSTE'
    : descripcionTrazo ? `${descripcionTrazo.etiqueta} · ${descripcionTrazo.metros} M` : '';

  return (
    <div className="relative shrink-0 flex flex-col items-center justify-center w-full pointer-events-none" ref={refBarra}>
      {selector}

      {/* Barra principal flotante */}
      <div className={`pointer-events-auto mt-1.5 rounded-2xl ${isDark ? 'bg-slate-800/95 border-slate-600' : 'bg-white/95 border-slate-400'} border-2 px-2 py-1.5 flex items-center gap-1.5 shadow-xl backdrop-blur-sm`}>

        {/* ATRÁS — suelta el último poste elegido */}
        <button
          onClick={() => setTrazo?.(prev => prev.slice(0, -1))}
          disabled={trazo.length === 0}
          className={`${btnBase} border-2 ${trazo.length > 0 ? `${btnNormal} active:scale-95` : `${btnDisabled} opacity-40 cursor-not-allowed`}`}
          title="Quitar el último poste"
        >
          <Undo2 size={18} />
        </button>

        {/* GUARDAR — pide el tipo de cable */}
        <button
          onClick={() => (panel === 'guardar' ? setPanel(null) : abrirGuardar())}
          disabled={!puedeGuardar}
          className={`${btnBase} border-2 ${puedeGuardar ? `${btnActivo} active:scale-95` : `${btnDisabled} opacity-40 cursor-not-allowed`}`}
          title="Guardar cable de acero"
        >
          <Save size={18} />
        </button>

        {/* LISTA — el contador abre el listado */}
        <button
          onClick={() => setPanel(panel === 'lista' ? null : 'lista')}
          className={`${btnBase} border-2 gap-1 px-1 ${panel === 'lista'
            ? btnActivo
            : (isDark ? 'bg-slate-950 border-slate-500 text-slate-300' : 'bg-slate-700 border-slate-600 text-white')} text-[11px] font-black`}
          title="Lista de cables de acero"
        >
          <List size={13} />
          {total}
        </button>

        <div className={`w-[1px] h-7 ${isDark ? 'bg-slate-600' : 'bg-slate-400'} shrink-0`} />

        {/* ELIMINAR — actúa sobre el cable elegido en la lista */}
        <button
          onClick={() => { if (cableSeleccionado) onEliminar?.(cableSeleccionado); }}
          disabled={!cableSeleccionado}
          className={`${btnBase} border-2 ${cableSeleccionado
            ? 'border-red-500 text-red-500 bg-white active:bg-red-500/10'
            : `${btnDisabled} opacity-30 cursor-not-allowed`}`}
          title="Eliminar el cable seleccionado"
        >
          <Trash2 size={18} />
        </button>

        {/* VER/OCULTAR */}
        <button
          onClick={() => setVisibles?.(!visibles)}
          className={`${btnBase} border-2 ${visibles ? btnNormal : 'bg-slate-600 text-white border-slate-700'}`}
          title={visibles ? 'Ocultar cables de acero' : 'Mostrar cables de acero'}
        >
          {visibles ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>

        {/* CERRAR */}
        <button
          onClick={onCerrar}
          className={`${btnBase} border-2 border-red-500 text-red-600 bg-white active:bg-red-50 active:scale-95`}
          title="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Qué falta para cerrar el tramo, o cuánto se va a liquidar */}
      {!panel && aviso && (
        <div className={`${panelBase} px-3 py-1.5`}>
          <p className={`text-[10px] font-black tracking-widest ${theme.text}`}>{aviso}</p>
        </div>
      )}

      {/* Panel de guardado: tipo de cable */}
      {panel === 'guardar' && (
        <div className={`${panelBase} px-3 py-2.5 w-[min(92vw,340px)]`}>
          <label className={rotulo}>TIPO DE CABLE</label>
          {tipos.length === 0 ? (
            <p className={`text-[11px] font-bold py-2 ${theme.text} opacity-70`}>
              Tu catálogo no tiene cables por metro. Márcalos en Configuración → Ferretería.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 mb-2.5">
              {tipos.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTipoElegido(t.id)}
                  className={`w-full px-3 py-2 rounded-xl text-[11px] font-black text-left uppercase border-2 transition-all ${tipoElegido === t.id
                    ? btnActivo
                    : isDark ? 'bg-slate-700 text-slate-200 border-slate-500' : 'bg-white text-slate-700 border-slate-400'}`}
                >
                  {t.nombre}
                </button>
              ))}
            </div>
          )}

          {descripcionTrazo && (
            <p className={`text-[10px] font-bold mb-2.5 ${theme.text} opacity-70`}>
              {descripcionTrazo.etiqueta} · se liquidan <b>{descripcionTrazo.metros} m</b> (distancia + 1 m)
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setPanel(null)}
              className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-black tracking-widest ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-400 text-slate-600'}`}
            >
              CANCELAR
            </button>
            <button
              onClick={confirmarGuardar}
              disabled={!tipoElegido}
              className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-black tracking-widest ${tipoElegido ? `${btnActivo} active:scale-95` : `${btnDisabled} opacity-40`}`}
            >
              GUARDAR
            </button>
          </div>
        </div>
      )}

      {/* Lista de cables: consultar, elegir cuál borrar, cambiarle el tipo y centrar */}
      {panel === 'lista' && (
        <div className={`${panelBase} w-[min(92vw,360px)] max-h-[55vh] overflow-y-auto p-1.5`}>
          <div className={`flex items-center justify-between px-2 pb-1.5 mb-1 border-b-2 ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
            <span className={`text-[10px] font-black tracking-widest ${theme.text} opacity-60`}>
              {ordenados.length} CABLE{ordenados.length === 1 ? '' : 'S'} DE ACERO
            </span>
            <span className={`text-[10px] font-black tracking-widest ${theme.text} opacity-60`}>
              {metrosTotal > 0 ? `${metrosTotal.toLocaleString('es-PE')} m` : ''}
            </span>
          </div>

          {ordenados.length === 0 ? (
            <p className={`text-[11px] font-bold text-center py-4 ${theme.text} opacity-50`}>Todavía no hay cables de acero.</p>
          ) : ordenados.map(c => {
            const sel = cableSeleccionado && String(cableSeleccionado.id) === String(c.id);
            return (
              <div
                key={c.id}
                className={`rounded-xl border-2 mb-1 transition-all ${sel ? 'border-slate-800 bg-slate-500/10' : isDark ? 'border-slate-600' : 'border-slate-300'}`}
              >
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCableSeleccionado?.(sel ? null : c)}
                    className="flex-1 flex items-center gap-2 px-2 py-2 text-left min-w-0"
                  >
                    <div className="w-4 h-1.5 rounded-full bg-slate-400 border border-black/40 shrink-0" />
                    <span className={`flex-1 text-[11px] font-black uppercase truncate ${theme.text}`}>{c.nombreTipo}</span>
                    <span className={`text-[10px] font-bold shrink-0 ${theme.text} opacity-60`}>{c.etiqueta}</span>
                    <span className={`text-[10px] font-bold shrink-0 w-12 text-right ${theme.text} opacity-50`}>{c.metros} m</span>
                  </button>
                  <button
                    onClick={() => onCentrar?.(c)}
                    className={`shrink-0 w-8 h-8 mr-1 rounded-lg flex items-center justify-center ${theme.text} opacity-60 active:opacity-100`}
                    title="Centrar el mapa en este cable"
                  >
                    <Crosshair size={15} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Cambiar el tipo: se guarda al tocar, no hay nada pendiente */}
                {sel && tipos.length > 0 && (
                  <div className={`px-2 pb-2 pt-1 border-t-2 flex flex-wrap gap-1 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    {tipos.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { if (t.id !== c.ferrId) onCambiarTipo?.(c, t.id); }}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase border-2 ${t.id === c.ferrId
                          ? btnActivo
                          : isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-white text-slate-700 border-slate-400'}`}
                      >
                        {t.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
