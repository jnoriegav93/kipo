import React from 'react';
import { X, Hash, Loader2, AlertTriangle } from 'lucide-react';
import { calcularRenumeracion, formatearItem } from '../utils/renumerarItems';

// ── RENUMERAR ITEMS ───────────────────────────────────────────────────────────
// Reescribe SOLO `datos.numero` (el ITEM) de los puntos del proyecto. No toca
// códigos de pasivo, series ni ningún otro dato.
//
// Tres correlativos independientes que siguen el ORDEN GENERAL (ordenTendido):
//   POSTES (con o sin equipo pasivo) · CÁMARAS · MEDIOS TRAMOS
// Cada grupo: se elige si se renumera, su prefijo, desde qué número y el relleno
// de ceros. Requiere que antes se haya hecho el ordenamiento de posiciones.
//
// El ALCANCE decide con qué puntos se trabaja: solo los que tienen posición
// asignada (lo normal) o todos. La cuenta, incluidos los conflictos que se
// resuelven con una `b`, vive en `utils/renumerarItems.js`.

const GRUPOS = [
  { id: 'postes', label: 'POSTES', ayuda: 'Con o sin equipo pasivo' },
  { id: 'camaras', label: 'CÁMARAS', ayuda: 'Puntos marcados como CÁMARA' },
  { id: 'mediosTramos', label: 'MEDIOS TRAMOS', ayuda: 'Puntos marcados como MEDIO TRAMO' },
];

const CONFIG_INICIAL = {
  postes: { activo: true, prefijo: '', desde: 1, ceros: 0 },
  camaras: { activo: false, prefijo: '', desde: 1, ceros: 0 },
  mediosTramos: { activo: false, prefijo: '', desde: 1, ceros: 0 },
};

export default function RenumerarItems({ proyecto, puntos, theme, isDark, onAplicar, onClose }) {
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const claveCfg = `kipo_renumerar_${proyecto?.id || 'sin'}`;
  const [cfg, setCfg] = React.useState(CONFIG_INICIAL);
  // Por defecto solo lo que ya tiene posición: es lo que se quiere casi siempre, y
  // evita que lo no ordenado se cuele al final por orden de creación.
  const [alcance, setAlcance] = React.useState('conPosicion');
  const [aplicando, setAplicando] = React.useState(false);
  const [confirmar, setConfirmar] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(claveCfg);
      if (raw) {
        const g = JSON.parse(raw);
        setCfg({
          postes: { ...CONFIG_INICIAL.postes, ...(g.postes || {}) },
          camaras: { ...CONFIG_INICIAL.camaras, ...(g.camaras || {}) },
          mediosTramos: { ...CONFIG_INICIAL.mediosTramos, ...(g.mediosTramos || {}) },
        });
        setAlcance(g.alcance === 'todos' ? 'todos' : 'conPosicion');
      }
    } catch { /* config por defecto */ }
  }, [claveCfg]);

  const { filas, renombres, conflictos, totalPorGrupo, totales } = React.useMemo(
    () => calcularRenumeracion({ puntos, cfg, alcance }),
    [puntos, cfg, alcance]
  );

  // Solo se muestran los grupos que TIENEN puntos dentro del alcance elegido (en
  // levantamiento, por ejemplo, no hay cámaras ni medios tramos: todo es poste).
  const gruposVisibles = GRUPOS.filter(g => totalPorGrupo[g.id] > 0);
  const ordenamientoHecho = totales.todos > 0 && totales.conPosicion > 0;
  const totalEscrituras = filas.length + renombres.length;

  const setGrupo = (id, campo, valor) => setCfg(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));

  const aplicar = async () => {
    if (aplicando || !filas.length) return;
    setAplicando(true);
    try {
      try { localStorage.setItem(claveCfg, JSON.stringify({ ...cfg, alcance })); } catch { /* sin persistencia */ }
      // Los renombres van en el mismo viaje: también son `datos.numero`
      await onAplicar([...filas, ...renombres].map(f => ({ id: f.id, numero: f.despues })));
      onClose();
    } catch (e) {
      console.error('Renumerar:', e);
      setAplicando(false);
      setConfirmar(false);
    }
  };

  const inputCls = `${theme.input} border-2 ${theme.border} rounded-lg px-2 py-1.5 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-40`;

  // Aviso de los items que quedarían repetidos. No se elige nada: se avisa y se hace.
  const avisoConflictos = conflictos > 0 ? (
    <div className="rounded-xl border-2 border-amber-500 bg-amber-500/10 p-2.5" data-prueba="aviso-conflictos">
      <p className="text-[11px] font-black text-amber-600 uppercase tracking-wide flex items-center gap-1.5">
        <AlertTriangle size={13} className="shrink-0" />
        {conflictos} item{conflictos !== 1 ? 's' : ''} quedarí{conflictos !== 1 ? 'an' : 'a'} repetido{conflictos !== 1 ? 's' : ''}
      </p>
      <p className={`text-[10px] mt-1 leading-snug ${muted}`}>
        Esos puntos no se renumeran y ya se llaman igual que un item nuevo. Se les agrega
        una <b className={theme.text}>b</b> al final ({renombres[0].antes} → <b className={theme.text}>{renombres[0].despues}</b>)
        para que no queden dos iguales.
      </p>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className={`${theme.card} rounded-2xl w-full max-w-md max-h-full shadow-2xl border-2 ${theme.border} overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`${theme.header} px-4 py-3 border-b-2 ${theme.border} flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-blue-600 p-1.5 rounded-lg shrink-0"><Hash size={18} className="text-white" /></div>
            <h3 className={`font-black text-base ${theme.text} uppercase truncate`}>Renumerar items</h3>
          </div>
          <button onClick={onClose} className={`${theme.bg} ${theme.text} p-1.5 rounded-lg border-2 ${theme.border} active:scale-95 shrink-0`}><X size={20} /></button>
        </div>

        {!ordenamientoHecho ? (
          /* Sin ordenamiento previo: no se puede renumerar */
          <div className="p-6 text-center">
            <AlertTriangle size={40} className="mx-auto mb-3 text-amber-500" />
            <p className={`font-black text-base mb-2 ${theme.text}`}>Primero ordena los puntos</p>
            <p className={`text-xs leading-relaxed ${muted}`}>
              La numeración sigue el orden de posición del proyecto, y este proyecto todavía no lo tiene.
              <br /><br />
              Ve a <b>LISTA DE PUNTOS</b> → botón de <b>configuración (engranaje)</b> → <b>ORDENAR</b>, acomoda los puntos en el mapa y guarda. Luego vuelve aquí.
            </p>
            <button onClick={onClose} className="w-full mt-5 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest active:scale-95">ENTENDIDO</button>
          </div>
        ) : confirmar ? (
          /* Vista previa antes de aplicar */
          <>
            <div className="px-4 py-3 shrink-0 space-y-2">
              <div>
                <p className={`text-xs font-black uppercase tracking-widest ${theme.text}`}>Vista previa</p>
                <p className={`text-[11px] mt-0.5 ${muted}`} data-prueba="resumen-previa">
                  Se cambiarán {totalEscrituras} item{totalEscrituras !== 1 ? 's' : ''}. Esta acción no se puede deshacer.
                </p>
              </div>
              {avisoConflictos}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-1">
              {filas.map(f => (
                <div key={f.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-700/40' : 'bg-slate-100'}`}>
                  <span className={`text-[10px] font-black uppercase w-16 shrink-0 ${muted}`}>
                    {f.grupo === 'postes' ? 'POSTE' : f.grupo === 'camaras' ? 'CÁMARA' : 'M. TRAMO'}
                  </span>
                  <span className={`text-xs font-bold flex-1 truncate ${muted}`}>{f.antes}</span>
                  <span className={`text-xs font-black shrink-0 ${theme.text}`}>→ {f.despues}</span>
                </div>
              ))}
              {/* Los que solo reciben la `b`: van al final y se distinguen del resto */}
              {renombres.map(f => (
                <div key={`b-${f.id}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/60 bg-amber-500/10">
                  <span className="text-[10px] font-black uppercase w-16 shrink-0 text-amber-600">REPETIDO</span>
                  <span className={`text-xs font-bold flex-1 truncate ${muted}`}>{f.antes}</span>
                  <span className={`text-xs font-black shrink-0 ${theme.text}`}>→ {f.despues}</span>
                </div>
              ))}
            </div>
            <div className={`shrink-0 p-3 border-t-2 ${theme.border} flex gap-2`}>
              <button onClick={() => setConfirmar(false)} disabled={aplicando} className={`flex-1 py-3 rounded-xl text-xs font-black border-2 ${theme.border} ${theme.text} disabled:opacity-40`}>ATRÁS</button>
              <button onClick={aplicar} disabled={aplicando} className="flex-1 py-3 rounded-xl text-xs font-black bg-green-600 text-white active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2">
                {aplicando ? <Loader2 size={14} className="animate-spin" /> : null} APLICAR
              </button>
            </div>
          </>
        ) : (
          /* Configuración: alcance y los 3 grupos */
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className={`text-[11px] leading-snug ${muted}`}>
                Renumera <b>solo el ITEM</b> de los puntos, siguiendo el orden de posición del proyecto.
                Cada grupo lleva su propio correlativo.
              </p>

              {/* ALCANCE: con qué puntos se trabaja */}
              <div>
                <label className={`block text-[9px] font-black uppercase mb-1 ${muted}`}>Qué renumerar</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['conPosicion', 'Con posición', totales.conPosicion],
                    ['todos', 'Todos', totales.todos],
                  ].map(([id, texto, cuantos]) => (
                    <button
                      key={id}
                      data-prueba={`alcance-${id}`}
                      onClick={() => setAlcance(id)}
                      className={`py-2 px-2 rounded-xl border-2 text-center transition-all ${alcance === id
                        ? 'border-brand-500 bg-brand-500/10'
                        : `${theme.border} opacity-70`}`}
                    >
                      <span className={`block text-[11px] font-black uppercase ${theme.text}`}>{texto}</span>
                      <span className={`block text-[10px] font-bold ${muted}`}>{cuantos} pto{cuantos !== 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
                {alcance === 'todos' && totales.sinPosicion > 0 && (
                  <p className={`text-[10px] mt-1.5 leading-snug ${muted}`}>
                    Los {totales.sinPosicion} sin posición se numeran al final, por orden de creación.
                  </p>
                )}
                {alcance === 'conPosicion' && totales.sinPosicion > 0 && (
                  <p className={`text-[10px] mt-1.5 leading-snug ${muted}`}>
                    Los {totales.sinPosicion} sin posición no se tocan: conservan su item.
                  </p>
                )}
              </div>

              {avisoConflictos}

              {gruposVisibles.map(g => {
                const c = cfg[g.id];
                const total = totalPorGrupo[g.id];
                return (
                  <div key={g.id} className={`rounded-xl border-2 ${c.activo ? 'border-brand-500' : theme.border} p-3`}>
                    <button onClick={() => setGrupo(g.id, 'activo', !c.activo)} className="w-full flex items-center gap-2 mb-2">
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${c.activo ? 'bg-brand-500 border-brand-600' : theme.border}`}>
                        {c.activo && <span className="text-white text-[11px] font-black leading-none">✓</span>}
                      </span>
                      <span className={`flex-1 text-left text-xs font-black uppercase ${theme.text}`}>{g.label}</span>
                      <span className={`text-[10px] font-bold ${muted}`} data-prueba={`total-${g.id}`}>{total} pto{total !== 1 ? 's' : ''}</span>
                    </button>
                    <p className={`text-[10px] mb-2 ${muted}`}>{g.ayuda}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={`block text-[9px] font-black uppercase mb-1 ${muted}`}>Prefijo</label>
                        <input type="text" value={c.prefijo} disabled={!c.activo} placeholder="(opcional)"
                          onChange={e => setGrupo(g.id, 'prefijo', e.target.value.toUpperCase())}
                          className={`${inputCls} w-full`} />
                      </div>
                      <div>
                        <label className={`block text-[9px] font-black uppercase mb-1 ${muted}`}>Desde</label>
                        <input type="number" min="0" value={c.desde} disabled={!c.activo}
                          onChange={e => setGrupo(g.id, 'desde', Math.max(0, parseInt(e.target.value) || 0))}
                          className={`${inputCls} w-full`} />
                      </div>
                      <div>
                        <label className={`block text-[9px] font-black uppercase mb-1 ${muted}`}>Ceros</label>
                        <select value={c.ceros} disabled={!c.activo}
                          onChange={e => setGrupo(g.id, 'ceros', parseInt(e.target.value))}
                          className={`${inputCls} w-full`}>
                          <option value={0}>Sin ceros</option>
                          <option value={2}>01</option>
                          <option value={3}>001</option>
                        </select>
                      </div>
                    </div>
                    {c.activo && total > 0 && (
                      <p className={`text-[10px] mt-2 ${muted}`}>
                        Quedará: <b className={theme.text}>{formatearItem(c, c.desde)}</b>, {formatearItem(c, c.desde + 1)}, {formatearItem(c, c.desde + 2)}…
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={`shrink-0 p-3 border-t-2 ${theme.border}`}>
              <button onClick={() => setConfirmar(true)} disabled={!filas.length}
                data-prueba="ver-previa"
                className="w-full py-3 rounded-xl text-xs font-black bg-slate-900 text-white uppercase tracking-widest active:scale-95 disabled:opacity-40">
                VER VISTA PREVIA ({filas.length})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
