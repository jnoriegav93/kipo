import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, ArrowLeft, Plus, Minus, X, Trash2, Link2,
  Loader2, ChevronRight, ClipboardList, Check, Search, ArrowDownUp
} from 'lucide-react';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─── Consolidado de ferretería de los puntos de un proyecto ──────────────────
const consolidarFerreteria = (puntosProyecto) => {
  const totals = {};
  puntosProyecto.forEach(p => {
    const datos = p.datos || {};
    if (datos.ferreteriaFinal && Object.keys(datos.ferreteriaFinal).length > 0) {
      Object.entries(datos.ferreteriaFinal).forEach(([id, cant]) => { if (cant) totals[id] = (totals[id] || 0) + cant; });
    } else {
      (datos.armadosSeleccionados || []).forEach(armado => {
        (armado.items || []).forEach(item => { totals[item.idRef] = (totals[item.idRef] || 0) + item.cant; });
      });
      Object.entries(datos.ferreteriaExtra || {}).forEach(([id, cant]) => { if (cant) totals[id] = (totals[id] || 0) + cant; });
    }
  });
  return totals;
};

// Normaliza el valor de recibido (compat: número antiguo → objeto)
const norm = (v) => {
  if (typeof v === 'number') return { modo: null, factor: 1, cant: v };
  if (v && typeof v === 'object') return { modo: v.modo || null, factor: v.factor || 1, cant: v.cant || 0 };
  return { modo: null, factor: 1, cant: 0 };
};
const totalDe = (v) => { const n = norm(v); return n.cant * (n.factor || 1); };

const MODO_LABEL = { cjs: 'caja', bls: 'bolsa', rlls: 'rollo' };
const MODO_BTN = { cjs: 'CJS', bls: 'BLS', rlls: 'RLL' };

// ─── Fila de una ferretería en el Recibido ────────────────────────────────────
function FilaRecibido({ item, valor, onChange, isDark, theme, muted, card }) {
  const v = norm(valor);
  const esMts = (item.unidad || '').toLowerCase().includes('mt');
  const modosDisp = esMts ? ['rlls'] : ['cjs', 'bls'];
  const [editando, setEditando] = useState(false);   // mostrando input de factor
  const [modoEdit, setModoEdit] = useState(null);     // modo que se está editando
  const [factorTmp, setFactorTmp] = useState('');

  const abrirEdicion = (m) => {
    setModoEdit(m);
    setFactorTmp(v.modo === m ? String(v.factor) : '');
    setEditando(true);
  };
  const confirmar = () => {
    const f = parseFloat(factorTmp);
    if (f > 0) onChange({ modo: modoEdit, factor: f, cant: v.cant });
    else onChange({ modo: null, factor: 1, cant: v.cant }); // factor vacío/0 → directo
    setEditando(false); setModoEdit(null); setFactorTmp('');
  };
  const setCant = (n) => onChange({ modo: v.modo, factor: v.factor, cant: Math.max(0, n) });

  const unitLabel = v.modo ? `${item.unidad} /${v.factor} x ${MODO_LABEL[v.modo]}` : item.unidad;

  return (
    <div className={`${card} border-2 rounded-xl px-2.5 py-2 flex items-center gap-2`}>
      {/* Nombre + unidad (con /factor x caja en gris) */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.nombre}</p>
        <p className={`text-[10px] uppercase font-black ${muted}`}>{unitLabel}</p>
      </div>

      {/* Área de empaque: botones, o input+check al editar (no toca el contador) */}
      <div className="flex items-center gap-1 shrink-0">
        {editando ? (
          <>
            <input type="number" inputMode="numeric" autoFocus value={factorTmp}
              onChange={e => setFactorTmp(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmar(); }}
              placeholder={esMts ? 'mts' : 'und'}
              className={`w-12 h-9 text-center font-black text-sm rounded-lg border-2 outline-none ${isDark ? 'bg-slate-700 border-orange-500 text-white' : 'bg-white border-orange-500 text-slate-900'}`} />
            <button onClick={confirmar} className="w-8 h-9 flex items-center justify-center rounded-lg bg-orange-500 text-white active:scale-90">
              <Check size={15} strokeWidth={3} />
            </button>
          </>
        ) : (
          modosDisp.map(m => {
            const activo = v.modo === m;
            return (
              <button key={m} onClick={() => abrirEdicion(m)}
                className={`w-8 h-9 flex items-center justify-center rounded-md border-2 text-[10px] font-black leading-none active:scale-95 ${activo ? 'bg-orange-500 text-white border-orange-600' : 'border-orange-400 text-orange-500'}`}>
                {MODO_BTN[m]}
              </button>
            );
          })
        )}
      </div>

      {/* Contador − cantidad + (siempre visible) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => setCant(v.cant - 1)} className={`w-9 h-9 flex items-center justify-center rounded-lg border-2 ${theme.border} ${theme.bg} active:scale-90`}>
          <Minus size={16} strokeWidth={3} />
        </button>
        <input type="number" inputMode="numeric" value={v.cant || ''}
          onChange={e => setCant(parseInt(e.target.value) || 0)} placeholder="0"
          className={`w-12 h-9 text-center font-black text-base rounded-lg border-2 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
        <button onClick={() => setCant(v.cant + 1)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 text-white active:scale-90 shadow">
          <Plus size={16} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

export default function VistaControlFerreteria({
  theme, isDark, user, config, saveConfig, proyectos = [], puntos = [],
  onVolver, setConfirmData, setAlertData,
}) {
  const [listas, setListas] = useState(null);
  const [listaAbierta, setListaAbierta] = useState(null);
  const [tab, setTab] = useState('recibido');

  const [vincularAbierto, setVincularAbierto] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreTmp, setNombreTmp] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenar, setOrdenar] = useState(false);

  const [addFerrAbierto, setAddFerrAbierto] = useState(false);
  const [ferrNombre, setFerrNombre] = useState('');
  const [ferrUnidad, setFerrUnidad] = useState('und');
  const [ferrModo, setFerrModo] = useState(null);     // empaque opcional al crear
  const [ferrFactor, setFerrFactor] = useState('');
  const [guardandoFerr, setGuardandoFerr] = useState(false);

  // ─── Listener de listas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'controlFerreteria'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, snap => setListas(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setListas([]));
    return () => unsub();
  }, [user?.uid]);

  const catalogo = useMemo(() => (config?.catalogoFerreteria || []).filter(f => f.visible !== false), [config]);
  const listaActual = useMemo(() => (listas || []).find(l => l.id === listaAbierta) || null, [listas, listaAbierta]);
  const proyectosConLista = new Set((listas || []).filter(l => l.proyectoId).map(l => l.proyectoId));
  const proyectosDisponibles = proyectos.filter(p => !proyectosConLista.has(p.id) || p.id === listaActual?.proyectoId);

  const consolidado = useMemo(() => {
    if (!listaActual?.proyectoId) return {};
    return consolidarFerreteria(puntos.filter(p => p.proyectoId === listaActual.proyectoId));
  }, [listaActual, puntos]);

  const recibido = listaActual?.recibido || {};

  // ─── Acciones ──────────────────────────────────────────────────────────────
  const crearLista = async () => {
    try {
      const ref = await addDoc(collection(db, 'controlFerreteria'), {
        ownerId: user.uid, proyectoId: null, proyectoNombre: '',
        nombre: 'Nueva lista', recibido: {}, createdAt: new Date().toISOString(),
      });
      setListaAbierta(ref.id); setTab('recibido');
      setEditandoNombre(true); setNombreTmp('Nueva lista');
    } catch (e) { console.error(e); }
  };

  const guardarNombre = async () => {
    setEditandoNombre(false);
    if (!listaActual || !nombreTmp.trim() || nombreTmp.trim() === listaActual.nombre) return;
    setListas(prev => prev.map(l => l.id === listaActual.id ? { ...l, nombre: nombreTmp.trim() } : l));
    try { await updateDoc(doc(db, 'controlFerreteria', listaActual.id), { nombre: nombreTmp.trim() }); } catch (e) { console.error(e); }
  };

  const vincularProyecto = async (proy) => {
    setVincularAbierto(false);
    if (!listaActual) return;
    setListas(prev => prev.map(l => l.id === listaActual.id ? { ...l, proyectoId: proy.id, proyectoNombre: proy.nombre } : l));
    try { await updateDoc(doc(db, 'controlFerreteria', listaActual.id), { proyectoId: proy.id, proyectoNombre: proy.nombre || '' }); } catch (e) { console.error(e); }
  };

  const eliminarLista = (lista) => {
    setConfirmData?.({
      title: 'Eliminar lista', message: `La lista "${lista.nombre}" irá a la Papelera por 15 días.`, actionText: 'ELIMINAR', theme,
      onConfirm: async () => {
        try {
          const { enviarAPapelera } = await import('../utils/papelera');
          const { id: _omit, ...snapshotLista } = lista;
          await enviarAPapelera({
            uid: user.uid, tipo: 'lista',
            snapshot: JSON.parse(JSON.stringify(snapshotLista)),
            coleccionOriginal: 'controlFerreteria', idOriginal: lista.id,
            proyectoId: lista.proyectoId || null,
            proyectoNombre: lista.proyectoNombre || '',
            nombre: lista.nombre || 'Lista de control',
          });
        } catch (e) { console.error('Papelera lista:', e); }
        try { await deleteDoc(doc(db, 'controlFerreteria', lista.id)); } catch (e) { console.error(e); }
        if (listaAbierta === lista.id) setListaAbierta(null);
        setConfirmData?.(null);
      }
    });
  };

  const setRecibido = async (ferrId, valor) => {
    if (!listaActual) return;
    const n = norm(valor);
    const nuevo = { ...recibido };
    // Quitar solo si no hay cantidad NI empaque; si hay empaque, conservar (muestra el factor con 0)
    if ((n.cant || 0) <= 0 && !n.modo) delete nuevo[ferrId];
    else nuevo[ferrId] = { modo: n.modo || null, factor: n.factor || 1, cant: n.cant || 0 };
    setListas(prev => prev.map(l => l.id === listaActual.id ? { ...l, recibido: nuevo } : l));
    try { await updateDoc(doc(db, 'controlFerreteria', listaActual.id), { recibido: nuevo }); } catch (e) { console.error(e); }
  };

  const agregarFerreteria = async () => {
    if (!ferrNombre.trim()) return;
    const existe = (config?.catalogoFerreteria || []).some(f => f.nombre.toLowerCase() === ferrNombre.trim().toLowerCase());
    if (existe) { setAlertData?.({ title: 'Duplicado', message: 'Ya existe una ferretería con ese nombre.' }); return; }
    setGuardandoFerr(true);
    try {
      const id = `f_${Date.now()}`;
      const nuevo = { id, nombre: ferrNombre.trim(), unidad: ferrUnidad, visible: true };
      await saveConfig({ ...config, catalogoFerreteria: [...(config?.catalogoFerreteria || []), nuevo] });
      // Si se eligió empaque + factor, dejarlo preconfigurado en la lista actual
      const f = parseFloat(ferrFactor);
      if (ferrModo && f > 0) await setRecibido(id, { modo: ferrModo, factor: f, cant: 0 });
      setAddFerrAbierto(false); setFerrNombre(''); setFerrUnidad('und'); setFerrModo(null); setFerrFactor('');
    } catch (e) { console.error(e); }
    setGuardandoFerr(false);
  };

  const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-orange-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-orange-400'}`;

  // ─── Editor de lista (pantalla completa) ─────────────────────────────────────
  if (listaActual) {
    const idsConDato = new Set([...Object.keys(recibido), ...Object.keys(consolidado)].filter(id => totalDe(recibido[id]) > 0 || (consolidado[id] || 0) > 0));
    const nombreDe = (id) => (config?.catalogoFerreteria || []).find(f => f.id === id)?.nombre || id;
    const filasComp = [...idsConDato].map(id => ({ id, nombre: nombreDe(id), rec: totalDe(recibido[id]), con: consolidado[id] || 0 })).sort((a, b) => a.nombre.localeCompare(b.nombre));

    return (
      <div className={`flex-1 flex flex-col overflow-hidden ${theme.bg} ${theme.text}`}>
        {/* Header */}
        <div className={`shrink-0 px-4 py-3 border-b-2 ${theme.border} ${theme.header} flex items-center gap-3`}>
          <button onClick={() => { setListaAbierta(null); setEditandoNombre(false); }} className={`p-2 rounded-xl border-2 ${theme.border} ${theme.bg} active:scale-95`}>
            <ArrowLeft size={20} className={theme.text} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className={`text-[11px] font-black shrink-0 ${muted}`}>LIST:</span>
            {editandoNombre ? (
              <>
                <input autoFocus value={nombreTmp} onChange={e => setNombreTmp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') guardarNombre(); }}
                  className={`flex-1 min-w-0 px-2 py-1 rounded-lg outline-none font-black text-sm uppercase ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'}`} />
                <button onClick={guardarNombre} className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-500 text-white active:scale-90 shrink-0">
                  <Check size={15} strokeWidth={3} />
                </button>
              </>
            ) : (
              <p className="font-black text-sm uppercase truncate cursor-pointer active:opacity-60"
                onClick={() => { setEditandoNombre(true); setNombreTmp(listaActual.nombre); }}>
                {listaActual.nombre}
              </p>
            )}
          </div>
          {/* Proyecto vinculado — a la derecha */}
          {!editandoNombre && (
            <button onClick={() => setVincularAbierto(true)}
              className="shrink-0 max-w-[42%] flex items-center gap-1 active:opacity-60">
              <span className={`text-[11px] font-black shrink-0 ${muted}`}>PROY:</span>
              <span className={`font-black text-sm uppercase truncate ${listaActual.proyectoId ? 'text-orange-500' : muted}`}>
                {listaActual.proyectoId ? listaActual.proyectoNombre : 'Sin vincular'}
              </span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className={`flex border-b-2 ${theme.border} shrink-0`}>
          {[['recibido', 'RECIBIDO'], ['comparativo', 'COMPARATIVO']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all ${tab === k ? 'text-orange-500 border-b-2 border-orange-500 -mb-[2px]' : muted}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tab === 'recibido' ? (
            <>
              {/* Barra: búsqueda + limpiar + ordenar + agregar */}
              <div className="flex items-center gap-2 sticky top-0 z-10">
                <div className="relative flex-1">
                  <Search size={15} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${muted}`} />
                  <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar ferretería..."
                    className={`w-full pl-8 pr-8 py-2.5 rounded-xl text-sm border-2 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-orange-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-400'}`} />
                  {busqueda && (
                    <button onClick={() => setBusqueda('')} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${muted} active:scale-90`}>
                      <X size={15} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                <button onClick={() => setOrdenar(o => !o)} title="Ordenar (con cantidad primero)"
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 active:scale-90 ${ordenar ? 'bg-orange-500 border-orange-600 text-white' : `${theme.border} ${theme.bg} ${theme.text}`}`}>
                  <ArrowDownUp size={17} strokeWidth={2.5} />
                </button>
                <button onClick={() => setAddFerrAbierto(true)} title="Agregar ferretería"
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500 text-white active:scale-90">
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
              {(() => {
                const q = busqueda.trim().toLowerCase();
                let lista = catalogo.filter(f => (f.nombre || '').toLowerCase().includes(q));
                if (ordenar) lista = [...lista].sort((a, b) => {
                  const ca = totalDe(recibido[a.id]) > 0 ? 0 : 1;
                  const cb = totalDe(recibido[b.id]) > 0 ? 0 : 1;
                  return ca - cb;
                });
                if (lista.length === 0) return <p className={`text-center py-8 text-sm ${muted}`}>{catalogo.length === 0 ? 'No hay ferretería en el catálogo' : 'Sin resultados'}</p>;
                return lista.map(item => (
                  <FilaRecibido key={item.id} item={item} valor={recibido[item.id]}
                    onChange={(val) => setRecibido(item.id, val)} isDark={isDark} theme={theme} muted={muted} card={card} />
                ));
              })()}
            </>
          ) : (
            <>
              {!listaActual.proyectoId && (
                <div className={`rounded-xl px-3 py-2 text-xs font-bold ${isDark ? 'bg-amber-950/30 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                  Vinculá un proyecto para ver el consolidado y la diferencia.
                </div>
              )}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <span className={`flex-1 text-[10px] font-black uppercase ${muted}`}>Ferretería</span>
                <span className={`w-16 text-center text-[10px] font-black uppercase ${muted}`}>Recib.</span>
                <span className={`w-16 text-center text-[10px] font-black uppercase ${muted}`}>Consol.</span>
                <span className={`w-16 text-center text-[10px] font-black uppercase ${muted}`}>Difer.</span>
              </div>
              {filasComp.length === 0 ? (
                <p className={`text-center py-8 text-sm ${muted}`}>Sin datos para comparar todavía</p>
              ) : filasComp.map(f => {
                const dif = f.rec - f.con;
                const difColor = dif > 0 ? 'text-green-600' : dif < 0 ? 'text-red-600' : muted;
                return (
                  <div key={f.id} className={`${card} border-2 rounded-xl px-3 py-2 flex items-center gap-2`}>
                    <span className={`flex-1 text-xs font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{f.nombre}</span>
                    <span className="w-16 text-center text-sm font-black">{Number.isInteger(f.rec) ? f.rec : f.rec.toFixed(1)}</span>
                    <span className="w-16 text-center text-sm font-black">{Number.isInteger(f.con) ? f.con : f.con.toFixed(1)}</span>
                    <span className={`w-16 text-center text-sm font-black ${difColor}`}>{dif > 0 ? '+' : ''}{Number.isInteger(dif) ? dif : dif.toFixed(1)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Modal vincular proyecto */}
        {vincularAbierto && (
          <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
            <div className={`w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-base font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Vincular proyecto</p>
                <button onClick={() => setVincularAbierto(false)} className={`p-2 rounded-xl ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><X size={16} /></button>
              </div>
              {proyectosDisponibles.length === 0 ? (
                <p className={`text-xs ${muted}`}>No hay proyectos disponibles (todos ya tienen una lista).</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {proyectosDisponibles.map(p => (
                    <button key={p.id} onClick={() => vincularProyecto(p)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${listaActual.proyectoId === p.id ? 'border-orange-500 bg-orange-500/10 text-orange-600' : `${theme.border} ${theme.text}`}`}>
                      {p.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal agregar ferretería */}
        {addFerrAbierto && (
          <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
            <div className={`w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-base font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Nueva ferretería</p>
                <button onClick={() => setAddFerrAbierto(false)} className={`p-2 rounded-xl ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><X size={16} /></button>
              </div>
              <input className={inputCls} placeholder="Nombre *" value={ferrNombre} onChange={e => setFerrNombre(e.target.value)} autoFocus />
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${muted}`}>Unidad</p>
                <div className="flex gap-2">
                  {['und', 'mts'].map(u => (
                    <button key={u} onClick={() => { setFerrUnidad(u); setFerrModo(null); setFerrFactor(''); }}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-black uppercase transition-colors ${ferrUnidad === u ? 'border-orange-500 bg-orange-500 text-white' : `${theme.border} ${theme.text}`}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              {/* Empaque opcional */}
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${muted}`}>Empaque (opcional)</p>
                <div className="flex gap-2 items-center">
                  {(ferrUnidad === 'mts' ? ['rlls'] : ['cjs', 'bls']).map(m => (
                    <button key={m} onClick={() => setFerrModo(ferrModo === m ? null : m)}
                      className={`px-3 py-2.5 rounded-lg border-2 text-xs font-black uppercase transition-colors ${ferrModo === m ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-400 text-orange-500'}`}>
                      {MODO_BTN[m]}
                    </button>
                  ))}
                  {ferrModo && (
                    <input type="number" inputMode="numeric" value={ferrFactor} onChange={e => setFerrFactor(e.target.value)}
                      placeholder={ferrUnidad === 'mts' ? 'mts x rollo' : `und x ${MODO_LABEL[ferrModo]}`}
                      className={`flex-1 min-w-0 px-2 py-2.5 text-center font-black text-sm rounded-lg border-2 outline-none ${isDark ? 'bg-slate-700 border-orange-500 text-white' : 'bg-white border-orange-500 text-slate-900'}`} />
                  )}
                </div>
              </div>
              <p className={`text-[10px] ${muted}`}>Se agrega también al catálogo de Configuración.</p>
              <div className="flex gap-2">
                <button onClick={() => setAddFerrAbierto(false)} className={`flex-1 py-3 rounded-xl text-xs font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>CANCELAR</button>
                <button onClick={agregarFerreteria} disabled={!ferrNombre.trim() || guardandoFerr}
                  className="flex-1 py-3 rounded-xl text-xs font-black bg-orange-500 text-white disabled:opacity-40 flex items-center justify-center gap-1 active:scale-95">
                  {guardandoFerr ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} AGREGAR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Lista de listas ──────────────────────────────────────────────────────────
  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${theme.bg} ${theme.text}`}>
      <div className={`shrink-0 px-4 py-3 border-b-2 ${theme.border} ${theme.header} flex items-center gap-3`}>
        <button onClick={onVolver} className={`p-2 rounded-xl border-2 ${theme.border} ${theme.bg} active:scale-95`}>
          <ArrowLeft size={20} className={theme.text} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <ClipboardList size={20} className="text-brand-500" strokeWidth={2.5} />
          <h1 className="font-black text-base tracking-wide uppercase">Control de Ferretería</h1>
        </div>
        <button onClick={crearLista} className="p-2 rounded-xl bg-orange-500 text-white active:scale-95">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {listas === null ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-orange-500" /></div>
        ) : listas.length === 0 ? (
          <div className="flex flex-col items-center gap-4 pt-10">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <ClipboardList size={32} className="text-orange-500" strokeWidth={2} />
            </div>
            <p className={`text-sm font-bold text-center ${muted}`}>Aún no tenés listas de control.</p>
            <button onClick={crearLista} className="px-5 py-3 rounded-2xl bg-orange-500 text-white font-black text-sm uppercase tracking-widest active:scale-95 flex items-center gap-2">
              <Plus size={16} strokeWidth={3} /> Crear lista
            </button>
          </div>
        ) : (
          listas.map(l => (
            <div key={l.id} className={`rounded-2xl border-2 ${isDark ? 'border-slate-500' : 'border-slate-900'} ${card.split(' ')[0]} overflow-hidden`}>
              <div className={`w-full flex items-center gap-3 px-4 py-3`}>
                <button onClick={() => { setListaAbierta(l.id); setTab('recibido'); }} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
                    <Package size={18} className="text-orange-500" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <span className={muted}>Lista: </span>{l.nombre}
                    </p>
                    <p className={`text-xs font-bold truncate ${muted}`}>
                      Proyecto: <span className={l.proyectoId ? 'text-orange-500' : ''}>{l.proyectoId ? l.proyectoNombre : 'Sin vincular'}</span>
                    </p>
                  </div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); eliminarLista(l); }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500 text-white active:scale-90 shrink-0">
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
