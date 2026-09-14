import React, { useEffect, useState } from 'react';
import { PERFILES, normalizarPerfil } from '../utils/perfiles';
import { Shield, ArrowLeft, ChevronDown, ChevronUp, User, Folder, MapPin, RefreshCw, Smartphone, Plus, Trash2, X, Lock, Camera, CheckCircle2, LogIn, AlertTriangle } from 'lucide-react';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '../firebaseConfig';
import InspectorHuerfanas from '../components/InspectorHuerfanas';
import { useFerreteriaBase, guardarFerreteriaBase } from '../hooks/useFerreteriaBase';
import { FERRETERIA_BASE_DEFAULT } from '../data/constantes';

// ─── Fetch / write helpers ──────────────────────────────────────────────────────

const fetchErrores = async () => {
  const snap = await getDocs(collection(db, 'errores'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

const deleteErrorDoc = async (id) => {
  await deleteDoc(doc(db, 'errores', id));
};

const fetchUsuarios = async () => {
  // El perfil vive en usuarios/{email}; se cruza con configuraciones para mostrarlo
  const [snap, usnap] = await Promise.all([
    getDocs(collection(db, 'configuraciones')),
    getDocs(collection(db, 'usuarios')),
  ]);
  const perfilPorEmail = {};
  usnap.docs.forEach(d => { perfilPorEmail[d.id] = d.data().perfil; });
  return snap.docs.map(d => ({
    uid: d.id,
    nombre: d.data().nombrePersonal || '(sin nombre)',
    empresa: d.data().empresaPersonal || '(sin empresa)',
    email: d.data().email || '',
    perfil: perfilPorEmail[d.data().email || ''],
  }));
};

const fetchProyectosDeUsuario = async (uid) => {
  const q = query(collection(db, 'proyectos'), where('ownerId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre || '(sin nombre)' }));
};

const fetchPuntosDeProyecto = async (proyectoId) => {
  const q = query(collection(db, 'puntos'), where('proyectoId', '==', proyectoId));
  const snap = await getDocs(q);
  return snap.size;
};

const fetchDispositivos = async (email) => {
  if (!email) return [];
  const snap = await getDoc(doc(db, 'usuarios', email));
  if (!snap.exists()) return [];
  return snap.data().dispositivosAutorizados || [];
};

const agregarDispositivo = async (email, huella) => {
  const ref = doc(db, 'usuarios', email);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { dispositivosAutorizados: [huella], perfil: 'basico' });
  } else {
    await updateDoc(ref, { dispositivosAutorizados: arrayUnion(huella) });
  }
};

const quitarDispositivo = async (email, huella) => {
  await updateDoc(doc(db, 'usuarios', email), {
    dispositivosAutorizados: arrayRemove(huella),
  });
};

const fetchPermisos = async (email) => {
  if (!email) return null;
  const snap = await getDoc(doc(db, 'usuarios', email));
  if (!snap.exists()) return { tipoAcceso: 'total', calidadFotos: 'alta' };
  const d = snap.data();
  return {
    tipoAcceso: d.tipoAcceso || 'total',
    calidadFotos: d.calidadFotos || 'alta',
  };
};

const actualizarPermisos = async (email, permisos) => {
  const ref = doc(db, 'usuarios', email);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...permisos, perfil: 'basico' });
  } else {
    await updateDoc(ref, permisos);
  }
};

const eliminarUsuarioCompleto = async (usuario) => {
  const { uid, email } = usuario;

  // 1. Proyectos del usuario
  const proySnap = await getDocs(query(collection(db, 'proyectos'), where('ownerId', '==', uid)));
  for (const proyDoc of proySnap.docs) {
    const proyId = proyDoc.id;

    // Puntos
    const puntosSnap = await getDocs(query(collection(db, 'puntos'), where('proyectoId', '==', proyId)));
    for (const p of puntosSnap.docs) await deleteDoc(p.ref);

    // Conexiones
    const conexSnap = await getDocs(query(collection(db, 'conexiones'), where('proyectoId', '==', proyId)));
    for (const c of conexSnap.docs) await deleteDoc(c.ref);

    // Cables de acero
    const aceroSnap = await getDocs(query(collection(db, 'cablesAcero'), where('proyectoId', '==', proyId)));
    for (const c of aceroSnap.docs) await deleteDoc(c.ref);

    // Bitácora
    const bitSnap = await getDocs(query(collection(db, 'bitacora'), where('proyectoId', '==', proyId)));
    for (const b of bitSnap.docs) await deleteDoc(b.ref);

    // Proyecto
    await deleteDoc(proyDoc.ref);
  }

  // 2. Configuración
  if (uid) await deleteDoc(doc(db, 'configuraciones', uid));

  // 3. Doc de usuarios (dispositivos, permisos, contraseña)
  if (email) await deleteDoc(doc(db, 'usuarios', email));

  // Borrar cuenta de Firebase Auth via Cloud Function
  try {
    const functions = getFunctions(undefined, 'us-central1');
    const eliminarAuth = httpsCallable(functions, 'eliminarUsuarioAuth');
    await eliminarAuth({ uid });
  } catch (e) {
    console.warn('No se pudo eliminar la cuenta Auth:', e.message);
  }
};

// ─── Sub-componentes ────────────────────────────────────────────────────────────

const ProyectoRow = ({ proyecto, isDark }) => {
  const [puntos, setPuntos] = useState(null);

  useEffect(() => {
    fetchPuntosDeProyecto(proyecto.id).then(setPuntos);
  }, [proyecto.id]);

  const rowBg  = isDark ? 'bg-slate-700/50' : 'bg-slate-100';
  const textSm = isDark ? 'text-slate-300'  : 'text-slate-600';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rowBg}`}>
      <Folder size={14} strokeWidth={2.5} className="text-orange-500 shrink-0" />
      <span className={`flex-1 text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
        {proyecto.nombre}
      </span>
      <div className={`flex items-center gap-1 text-[11px] font-bold ${textSm}`}>
        <MapPin size={11} strokeWidth={2.5} />
        {puntos === null ? '…' : puntos}
      </div>
    </div>
  );
};

// ─── Panel de dispositivos ──────────────────────────────────────────────────────

const DispositivosPanel = ({ email, isDark }) => {
  const [dispositivos, setDispositivos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [nuevaHuella, setNuevaHuella] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!email) { setDispositivos([]); setCargando(false); return; }
    fetchDispositivos(email).then(d => { setDispositivos(d); setCargando(false); });
  }, [email]);

  const handleAgregar = async () => {
    const huella = nuevaHuella.trim().toUpperCase();
    if (!huella) return;
    if (dispositivos?.includes(huella)) { setError('Esa huella ya está registrada.'); return; }
    setGuardando(true);
    setError('');
    try {
      await agregarDispositivo(email, huella);
      setDispositivos(prev => [...(prev || []), huella]);
      setNuevaHuella('');
    } catch (e) {
      setError('Error al agregar dispositivo.');
      console.error(e);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (huella) => {
    setEliminando(huella);
    try {
      await quitarDispositivo(email, huella);
      setDispositivos(prev => prev.filter(h => h !== huella));
    } catch (e) {
      console.error(e);
    } finally {
      setEliminando(null);
    }
  };

  const rowBg    = isDark ? 'bg-slate-700/50' : 'bg-slate-100';
  const inputCls = isDark
    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400';

  if (cargando) {
    return (
      <div className="flex justify-center py-4">
        <RefreshCw size={18} className="text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!email) {
    return (
      <p className={`text-xs text-center py-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Este usuario no tiene email registrado — no se pueden gestionar dispositivos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Lista de dispositivos */}
      {dispositivos && dispositivos.length > 0 ? (
        dispositivos.map(huella => (
          <div key={huella} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rowBg}`}>
            <Smartphone size={13} strokeWidth={2.5} className="text-brand-500 shrink-0" />
            <span className={`flex-1 text-xs font-bold font-mono truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {huella}
            </span>
            <button
              onClick={() => handleEliminar(huella)}
              disabled={eliminando === huella}
              className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-40"
            >
              {eliminando === huella
                ? <RefreshCw size={13} className="animate-spin" />
                : <Trash2 size={13} strokeWidth={2.5} />
              }
            </button>
          </div>
        ))
      ) : (
        <p className={`text-xs text-center py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Sin dispositivos autorizados
        </p>
      )}

      {/* Agregar nuevo dispositivo */}
      <div className={`flex items-center gap-2 mt-1 rounded-xl border-2 border-dashed ${isDark ? 'border-slate-600' : 'border-slate-300'} px-3 py-2`}>
        <Smartphone size={13} strokeWidth={2.5} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
        <input
          type="text"
          value={nuevaHuella}
          onChange={e => { setNuevaHuella(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleAgregar()}
          placeholder="ID-XXXXXXXX"
          className={`flex-1 text-xs font-bold font-mono bg-transparent border-none outline-none ${inputCls.split(' ').filter(c => c.startsWith('text-') || c.startsWith('placeholder-')).join(' ')}`}
        />
        <button
          onClick={handleAgregar}
          disabled={!nuevaHuella.trim() || guardando}
          className="p-1 rounded-lg bg-brand-500 text-white disabled:opacity-40 active:scale-95 transition-all"
        >
          {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={2.5} />}
        </button>
      </div>

      {error && (
        <p className="text-[10px] text-red-500 font-bold px-1">{error}</p>
      )}

    </div>
  );
};

// ─── Panel de permisos ──────────────────────────────────────────────────────────

const PermisosPanel = ({ email, isDark }) => {
  const [permisos, setPermisos] = useState(null);
  const [guardando, setGuardando] = useState(null); // campo que se está guardando
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!email) { setCargando(false); return; }
    fetchPermisos(email).then(p => { setPermisos(p); setCargando(false); });
  }, [email]);

  const cambiar = async (campo, valor) => {
    if (!email || guardando) return;
    const nuevos = { ...permisos, [campo]: valor };
    setPermisos(nuevos);
    setGuardando(campo);
    try {
      await actualizarPermisos(email, { [campo]: valor });
    } catch (e) {
      console.error(e);
      setPermisos(permisos); // revertir
    } finally {
      setGuardando(null);
    }
  };

  const rowBg = isDark ? 'bg-slate-700/50' : 'bg-slate-100';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const labelCls = `text-[10px] font-black uppercase tracking-widest mb-2 ${textMuted}`;

  const OptionBtn = ({ campo, valor, label, icon: Icon }) => {
    const activo = permisos?.[campo] === valor;
    const spinning = guardando === campo;
    return (
      <button
        onClick={() => cambiar(campo, valor)}
        disabled={!!guardando}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-black transition-all active:scale-95 disabled:opacity-60 ${
          activo
            ? 'bg-orange-500 text-white shadow-sm'
            : isDark
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {spinning
          ? <RefreshCw size={11} className="animate-spin" />
          : Icon && <Icon size={11} strokeWidth={2.5} />
        }
        {label}
        {activo && !spinning && <CheckCircle2 size={10} strokeWidth={2.5} />}
      </button>
    );
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-4">
        <RefreshCw size={18} className="text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!email) {
    return (
      <p className={`text-xs text-center py-3 ${textMuted}`}>
        Este usuario no tiene email registrado — no se pueden gestionar permisos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Tipo de acceso */}
      <div>
        <p className={labelCls}>Tipo de acceso</p>
        <div className="flex gap-2">
          <OptionBtn campo="tipoAcceso" valor="levantamiento" label="Solo levantamiento" icon={MapPin} />
          <OptionBtn campo="tipoAcceso" valor="total" label="Total" icon={Lock} />
        </div>
      </div>

      {/* Calidad de fotos */}
      <div>
        <p className={labelCls}>Calidad de fotos</p>
        <div className="flex gap-2">
          <OptionBtn campo="calidadFotos" valor="comprimidas" label="Comprimidas" icon={Camera} />
          <OptionBtn campo="calidadFotos" valor="alta" label="Alta calidad" icon={Camera} />
        </div>
      </div>

    </div>
  );
};

// ─── Panel de FERRETERÍA BASE (global, solo admin) ────────────────────────────────
const FerreteriaBasePanel = ({ isDark }) => {
  const { ferreteriaBase } = useFerreteriaBase();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editId, setEditId] = useState(null); // id en edición o 'nuevo'
  const [form, setForm] = useState({ nombre: '', codigo: '', detalle: '' });
  const [busca, setBusca] = useState('');

  const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const inputCl = `w-full px-3 py-2 rounded-lg border-2 text-sm ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`;

  const persistir = async (items) => {
    setGuardando(true);
    try { await guardarFerreteriaBase(items); }
    catch (e) { console.error(e); alert('No se pudo guardar (¿permisos de admin?).'); }
    finally { setGuardando(false); }
  };

  const abrirNuevo = () => { setEditId('nuevo'); setForm({ nombre: '', codigo: '', detalle: '' }); };
  const abrirEdit = (it) => { setEditId(it.id); setForm({ nombre: it.nombre || '', codigo: it.codigo || '', detalle: it.detalle || '', porMetro: !!it.porMetro }); };
  const cancelar = () => { setEditId(null); setForm({ nombre: '', codigo: '', detalle: '' }); };

  const guardarItem = async () => {
    const nombre = (form.nombre || '').trim();
    if (!nombre) return;
    const datos = { nombre, codigo: (form.codigo || '').trim(), detalle: (form.detalle || '').trim() };
    // La marca solo se escribe cuando vale: sin ella el ítem se cuenta por poste
    const conMarca = (it) => (form.porMetro ? { ...it, porMetro: true } : it);
    let items;
    if (editId === 'nuevo') {
      items = [...ferreteriaBase, conMarca({ id: `b_${Date.now()}`, ...datos })];
    } else {
      items = ferreteriaBase.map(it => {
        if (it.id !== editId) return it;
        const { porMetro: _porMetro, ...resto } = it;
        return conMarca({ ...resto, ...datos });
      });
    }
    await persistir(items);
    cancelar();
  };

  const borrarItem = async (id) => {
    if (!confirm('¿Borrar esta ferretería base?')) return;
    await persistir(ferreteriaBase.filter(it => it.id !== id));
  };

  const cargarInicial = async () => {
    if (!confirm(`Cargar la lista inicial de ${FERRETERIA_BASE_DEFAULT.length} ferreterías? (reemplaza la base actual)`)) return;
    await persistir(FERRETERIA_BASE_DEFAULT);
  };

  const lista = ferreteriaBase.filter(it => !busca || (it.nombre || '').toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className={`mb-4 rounded-2xl border overflow-hidden ${cardBg}`}>
      <button onClick={() => setAbierto(v => !v)} className={`w-full flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
        <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0"><Lock size={16} className="text-white" strokeWidth={2.5} /></div>
        <div className="flex-1 text-left">
          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Ferretería base (global)</p>
          <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ferreteriaBase.length} ítems {guardando ? '· guardando…' : ''}</p>
        </div>
        {abierto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex gap-2">
            <button onClick={abrirNuevo} className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center justify-center gap-1 active:scale-95"><Plus size={14} /> Agregar</button>
            {ferreteriaBase.length === 0 && (
              <button onClick={cargarInicial} className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-black active:scale-95">Cargar lista inicial ({FERRETERIA_BASE_DEFAULT.length})</button>
            )}
          </div>

          {editId && (
            <div className={`rounded-xl border-2 p-3 space-y-2 ${isDark ? 'border-slate-600 bg-slate-900' : 'border-slate-300 bg-slate-50'}`}>
              <input autoFocus placeholder="Nombre (se muestra en la app)" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputCl} />
              <input placeholder="Código (interno)" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className={inputCl} />
              <input placeholder="Detalle (interno)" value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} className={inputCl} />
              <label className={`flex items-center gap-2 text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <input type="checkbox" checked={!!form.porMetro} onChange={e => setForm({ ...form, porMetro: e.target.checked })} />
                Se tiende como cable: se liquida por metro, no por poste
              </label>
              <div className="flex gap-2">
                <button onClick={cancelar} className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>Cancelar</button>
                <button onClick={guardarItem} disabled={!form.nombre.trim() || guardando} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-black disabled:opacity-40">Guardar</button>
              </div>
            </div>
          )}

          {ferreteriaBase.length > 6 && (
            <input placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)} className={inputCl} />
          )}

          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {lista.map(it => (
              <div key={it.id} className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{it.nombre}{it.porMetro && <span className="ml-1.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-700 text-white">por metro</span>}</p>
                  <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{it.codigo || 's/código'} · {it.detalle || 's/detalle'}</p>
                </div>
                <button onClick={() => abrirEdit(it)} className={`w-8 h-8 flex items-center justify-center rounded-lg border-2 ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'} active:scale-95`}><span className="text-[10px] font-black">EDIT</span></button>
                <button onClick={() => borrarItem(it.id)} className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-red-300 text-red-500 active:scale-95"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Panel de errores ───────────────────────────────────────────────────────────

const ErroresPanel = ({ errores, isDark, onDelete }) => {
  const [expandidoId, setExpandidoId] = useState(null);
  const [eliminando, setEliminando] = useState(null);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setEliminando(id);
    try {
      await deleteErrorDoc(id);
      onDelete(id);
    } catch (_) {
      /* silencioso */
    } finally {
      setEliminando(null);
    }
  };

  const rowBg = isDark ? 'bg-slate-700/50' : 'bg-slate-100';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  if (!errores || errores.length === 0) {
    return (
      <p className={`text-xs text-center py-3 ${textMuted}`}>Sin errores registrados</p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {errores.map(err => (
        <div key={err.id} className={`rounded-xl overflow-hidden ${rowBg}`}>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-left"
            onClick={() => setExpandidoId(v => v === err.id ? null : err.id)}
          >
            <AlertTriangle size={13} strokeWidth={2.5} className="text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {err.mensaje || '(sin mensaje)'}
              </p>
              <p className={`text-[10px] ${textMuted}`}>
                {err.fecha ? new Date(err.fecha).toLocaleString() : ''} · {err.contexto || ''}
              </p>
            </div>
            <button
              onClick={e => handleDelete(e, err.id)}
              disabled={eliminando === err.id}
              className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-40 shrink-0"
            >
              {eliminando === err.id
                ? <RefreshCw size={12} className="animate-spin" />
                : <Trash2 size={12} strokeWidth={2.5} />
              }
            </button>
            {expandidoId === err.id
              ? <ChevronUp size={13} className={textMuted + ' shrink-0'} />
              : <ChevronDown size={13} className={textMuted + ' shrink-0'} />
            }
          </button>
          {expandidoId === err.id && (
            <div className={`px-3 pb-3 flex flex-col gap-1 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
              {err.stack && (
                <pre className={`text-[10px] whitespace-pre-wrap break-all mt-2 ${textMuted} max-h-40 overflow-y-auto`}>
                  {err.stack}
                </pre>
              )}
              {err.dispositivo && (
                <p className={`text-[10px] ${textMuted} mt-1`}>
                  <span className="font-bold">Dispositivo:</span> {err.dispositivo}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Tarjeta de usuario ─────────────────────────────────────────────────────────

const TABS = ['PROYECTOS', 'DISPOSITIVOS', 'PERMISOS'];

const PW_KEY = (uid) => `kipo_admin_pw_${uid}`;

const UsuarioCard = ({ usuario, isDark, theme, onEntrarComo, errores = [], onDeleteError }) => {
  const [expandido, setExpandido] = useState(false);
  // Perfil (nivel) del usuario — editable por el admin aquí mismo
  const [perfilU, setPerfilU] = useState(normalizarPerfil(usuario.perfil));
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const cambiarPerfilUsuario = async (nuevo) => {
    if (guardandoPerfil || nuevo === perfilU || !usuario.email) return;
    setGuardandoPerfil(true);
    const anterior = perfilU;
    setPerfilU(nuevo);
    try {
      await updateDoc(doc(db, 'usuarios', usuario.email), { perfil: nuevo });
    } catch (e) {
      console.error('Cambiar perfil:', e);
      setPerfilU(anterior);
    }
    setGuardandoPerfil(false);
  };
  const [tabActiva, setTabActiva] = useState('PROYECTOS');
  const [proyectos, setProyectos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [errorEntrar, setErrorEntrar] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [mostrarInputPw, setMostrarInputPw] = useState(false);
  const [inputPw, setInputPw] = useState('');
  const [mostrarErrores, setMostrarErrores] = useState(false);

  const handleEliminar = async () => {
    setEliminando(true);
    try {
      await eliminarUsuarioCompleto(usuario);
      if (typeof window !== 'undefined') window.location.reload();
    } catch (e) {
      console.error(e);
      setEliminando(false);
      setConfirmarEliminar(false);
    }
  };

  const loginConPassword = async (password) => {
    const adminEmail = auth.currentUser?.email;
    if (adminEmail) localStorage.setItem('kipoAdminSession', adminEmail);
    await signInWithEmailAndPassword(auth, usuario.email, password);
    localStorage.setItem(PW_KEY(usuario.uid), password);
    if (onEntrarComo) onEntrarComo();
  };

  const handleEntrarComo = async (e) => {
    e.stopPropagation();
    if (!usuario.email) { setErrorEntrar('Sin email'); return; }
    const saved = localStorage.getItem(PW_KEY(usuario.uid));
    if (saved) {
      setEntrando(true);
      setErrorEntrar('');
      try {
        await loginConPassword(saved);
      } catch (err) {
        // Contraseña guardada ya no es válida, pedir de nuevo
        localStorage.removeItem(PW_KEY(usuario.uid));
        setErrorEntrar('');
        setMostrarInputPw(true);
      } finally {
        setEntrando(false);
      }
      return;
    }
    setMostrarInputPw(true);
  };

  const handleSubmitPw = async (e) => {
    e.stopPropagation();
    if (!inputPw.trim()) return;
    setEntrando(true);
    setErrorEntrar('');
    try {
      await loginConPassword(inputPw.trim());
      setMostrarInputPw(false);
      setInputPw('');
    } catch (err) {
      setErrorEntrar('Contraseña incorrecta');
    } finally {
      setEntrando(false);
    }
  };

  const toggleExpand = async () => {
    if (!expandido && proyectos === null && tabActiva === 'PROYECTOS') {
      setCargando(true);
      const p = await fetchProyectosDeUsuario(usuario.uid);
      setProyectos(p);
      setCargando(false);
    }
    setExpandido(v => !v);
  };

  const handleTab = async (tab) => {
    setTabActiva(tab);
    if (tab === 'PROYECTOS' && proyectos === null) {
      setCargando(true);
      const p = await fetchProyectosDeUsuario(usuario.uid);
      setProyectos(p);
      setCargando(false);
    }
  };

  const cardBg    = isDark ? 'bg-slate-800 border-slate-700'  : 'bg-white border-slate-200';
  const subtextCl = isDark ? 'text-slate-400' : 'text-slate-500';
  const countCl   = expandido
    ? 'border-2 border-orange-500 text-orange-500'
    : isDark
      ? 'border-2 border-slate-500 text-slate-300'
      : 'border-2 border-slate-400 text-slate-600';

  return (
    <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>

      {/* Cabecera */}
      <button
        onClick={toggleExpand}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}
      >
        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
          <span className="text-white font-black text-base leading-none">
            {usuario.nombre.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 overflow-hidden text-left">
          <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {usuario.nombre}
          </p>
          <p className={`text-[11px] truncate ${subtextCl}`}>{usuario.empresa}</p>
          {usuario.email && (
            <p className={`text-[10px] truncate ${subtextCl}`}>{usuario.email}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleEntrarComo}
            disabled={entrando}
            title="Entrar como este usuario"
            className="p-1.5 rounded-xl bg-brand-500 text-white active:scale-95 transition-all disabled:opacity-40"
          >
            {entrando
              ? <RefreshCw size={13} className="animate-spin" />
              : <LogIn size={13} strokeWidth={2.5} />
            }
          </button>
          <button
            onClick={e => { e.stopPropagation(); setMostrarErrores(v => !v); }}
            title="Ver errores registrados"
            className={`p-1.5 rounded-xl active:scale-95 transition-all flex items-center gap-1 ${
              errores.length > 0
                ? mostrarErrores ? 'bg-red-500 text-white' : 'bg-red-100 text-red-500'
                : isDark ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400'
            }`}
          >
            <AlertTriangle size={13} strokeWidth={2.5} />
            {errores.length > 0 && (
              <span className="text-[10px] font-black leading-none">{errores.length}</span>
            )}
          </button>
          <button
            onClick={e => { e.stopPropagation(); setConfirmarEliminar(true); }}
            title="Eliminar usuario"
            className="p-1.5 rounded-xl bg-red-500 text-white active:scale-95 transition-all"
          >
            <Trash2 size={13} strokeWidth={2.5} />
          </button>
          {expandido
            ? <ChevronUp  size={16} className={subtextCl} />
            : <ChevronDown size={16} className={subtextCl} />
          }
        </div>
      </button>

      {/* Perfil (nivel) del usuario — fila propia, botones estilo app */}
      <div className="px-4 pb-3 flex gap-1.5">
        {PERFILES.map(pf => (
          <button key={pf.id} onClick={() => cambiarPerfilUsuario(pf.id)} disabled={guardandoPerfil}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide border-2 transition-all active:scale-95 disabled:opacity-50 ${
              perfilU === pf.id
                ? 'bg-orange-500 border-orange-600 text-white shadow-sm'
                : isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'
            }`}>
            {pf.label}
          </button>
        ))}
      </div>
      {mostrarInputPw && (
        <div className={`border-t px-4 py-3 flex flex-col gap-2 ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-100 bg-slate-50'}`}
          onClick={e => e.stopPropagation()}>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Contraseña de {usuario.nombre}
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={inputPw}
              onChange={e => { setInputPw(e.target.value); setErrorEntrar(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmitPw(e)}
              placeholder="Contraseña"
              autoFocus
              className={`flex-1 px-3 py-2 rounded-xl text-sm border outline-none ${
                isDark
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-orange-400'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-orange-400'
              }`}
            />
            <button
              onClick={handleSubmitPw}
              disabled={!inputPw.trim() || entrando}
              className="px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-black disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1"
            >
              {entrando ? <RefreshCw size={13} className="animate-spin" /> : <LogIn size={13} strokeWidth={2.5} />}
              {!entrando && 'OK'}
            </button>
            <button
              onClick={() => { setMostrarInputPw(false); setInputPw(''); setErrorEntrar(''); }}
              className={`px-3 py-2 rounded-xl text-xs font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-white border border-slate-200 text-slate-600'} active:scale-95`}
            >
              <X size={13} />
            </button>
          </div>
          {errorEntrar && (
            <p className="text-[10px] text-red-500 font-bold">{errorEntrar}</p>
          )}
        </div>
      )}

      {!mostrarInputPw && errorEntrar && (
        <p className="text-[10px] text-red-500 font-bold text-center py-1 px-4">{errorEntrar}</p>
      )}

      {/* Confirmación de eliminar */}
      {confirmarEliminar && (
        <div className={`border-t px-4 py-3 ${isDark ? 'border-red-900 bg-red-950/40' : 'border-red-100 bg-red-50'}`}>
          <p className={`text-xs font-black text-red-500 mb-1`}>¿Eliminar a {usuario.nombre}?</p>
          <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Se borrarán todos sus proyectos, puntos, conexiones y bitácora. Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmarEliminar(false)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              CANCELAR
            </button>
            <button
              onClick={handleEliminar}
              disabled={eliminando}
              className="flex-1 py-2 rounded-xl text-[11px] font-black bg-red-500 text-white disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {eliminando ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} strokeWidth={2.5} />}
              {eliminando ? 'ELIMINANDO...' : 'ELIMINAR'}
            </button>
          </div>
        </div>
      )}

      {/* Panel de errores */}
      {mostrarErrores && (
        <div className={`border-t px-4 py-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Errores registrados
          </p>
          <ErroresPanel
            errores={errores}
            isDark={isDark}
            onDelete={id => { if (onDeleteError) onDeleteError(usuario.uid, id); }}
          />
        </div>
      )}

      {/* Panel expandido */}
      {expandido && (
        <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>

          {/* Tabs */}
          <div className={`flex border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => handleTab(tab)}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                  tabActiva === tab
                    ? 'text-brand-500 border-b-2 border-brand-500'
                    : subtextCl + ' hover:opacity-80'
                }`}
              >
                {tab === 'PROYECTOS' && <span className="flex items-center justify-center gap-1"><Folder size={11} />{tab}</span>}
                {tab === 'DISPOSITIVOS' && <span className="flex items-center justify-center gap-1"><Smartphone size={11} />{tab}</span>}
                {tab === 'PERMISOS' && <span className="flex items-center justify-center gap-1"><Lock size={11} />{tab}</span>}
              </button>
            ))}
          </div>

          {/* Contenido del tab */}
          <div className="px-4 py-3">
            {tabActiva === 'PROYECTOS' && (
              <div className="flex flex-col gap-1.5">
                {proyectos === null || cargando ? (
                  <div className="flex justify-center py-4">
                    <RefreshCw size={18} className="text-orange-400 animate-spin" />
                  </div>
                ) : proyectos.length === 0 ? (
                  <p className={`text-xs py-2 text-center ${subtextCl}`}>Sin proyectos</p>
                ) : (
                  proyectos.map(p => (
                    <ProyectoRow key={p.id} proyecto={p} isDark={isDark} />
                  ))
                )}
              </div>
            )}

            {tabActiva === 'DISPOSITIVOS' && (
              <DispositivosPanel email={usuario.email} isDark={isDark} />
            )}

            {tabActiva === 'PERMISOS' && (
              <PermisosPanel email={usuario.email} isDark={isDark} />
            )}
          </div>

        </div>
      )}
    </div>
  );
};

// ─── Formulario nuevo usuario ───────────────────────────────────────────────────

const NuevoUsuarioForm = ({ isDark, theme, onCreado, onCancelar }) => {
  const [form, setForm] = useState({ nombre: '', empresa: '', email: '', password: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const handleCrear = async () => {
    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Nombre, email y contraseña son obligatorios.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const functions = getFunctions(undefined, 'us-central1');
      const crearUsuario = httpsCallable(functions, 'crearUsuario');
      await crearUsuario({
        email: form.email.trim().toLowerCase(),
        password: form.password.trim(),
        nombre: form.nombre.trim(),
        empresa: form.empresa.trim(),
      });
      onCreado();
    } catch (e) {
      setError(e.message || 'Error al crear usuario.');
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = `w-full px-3 py-2 rounded-xl text-sm border outline-none transition-all ${
    isDark
      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-orange-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-orange-400'
  }`;

  return (
    <div className={`rounded-2xl border-2 border-orange-500 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
      <div className="px-4 py-3 bg-orange-500 flex items-center gap-2">
        <User size={15} strokeWidth={2.5} className="text-white" />
        <p className="text-white font-black text-sm uppercase tracking-wide">Nuevo Usuario</p>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <input className={inputCls} placeholder="Nombre *" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        <input className={inputCls} placeholder="Empresa" value={form.empresa} onChange={e => set('empresa', e.target.value)} />
        <input className={inputCls} placeholder="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        <input className={inputCls} placeholder="Contraseña *" type="text" value={form.password} onChange={e => set('password', e.target.value)} />

        {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}

        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancelar}
            className={`flex-1 py-2 rounded-xl text-[11px] font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            CANCELAR
          </button>
          <button
            onClick={handleCrear}
            disabled={guardando}
            className="flex-1 py-2 rounded-xl text-[11px] font-black bg-orange-500 text-white disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {guardando ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} strokeWidth={2.5} />}
            {guardando ? 'CREANDO...' : 'CREAR'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Vista principal ────────────────────────────────────────────────────────────

const VistaAdmin = ({ theme, isDark, onVolver, onLoginComo, esAdmin = false, perfilActivo = 'claro', perfilPreview = null, onCambiarPerfil }) => {
  const [usuarios, setUsuarios] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  const [erroresMap, setErroresMap] = useState({}); // { [uid]: [errores] }

  const cargarUsuarios = async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await fetchUsuarios();
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setUsuarios(lista);
    } catch (e) {
      console.error(e);
      setError('Error cargando usuarios');
    } finally {
      setCargando(false);
    }
    // Cargar errores por separado — un fallo aquí no bloquea la lista de usuarios
    try {
      const todosErrores = await fetchErrores();
      const agrupados = {};
      for (const err of todosErrores) {
        const uid = err.uid || '__sin_uid__';
        if (!agrupados[uid]) agrupados[uid] = [];
        agrupados[uid].push(err);
      }
      for (const uid of Object.keys(agrupados)) {
        agrupados[uid].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      }
      setErroresMap(agrupados);
    } catch (_) { /* silencioso */ }
  };

  const handleDeleteError = (uid, errorId) => {
    setErroresMap(prev => {
      const lista = (prev[uid] || []).filter(e => e.id !== errorId);
      return { ...prev, [uid]: lista };
    });
  };

  useEffect(() => { cargarUsuarios(); }, []);

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${theme.bg} ${theme.text}`}>

      {/* Header */}
      <div className={`shrink-0 px-4 py-3 border-b-2 ${theme.border} ${theme.header} flex items-center gap-3`}>
        <button
          onClick={onVolver}
          className={`p-2 rounded-xl border-2 ${theme.border} ${theme.bg} active:scale-95 transition-all`}
        >
          <ArrowLeft size={20} className={theme.text} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Shield size={20} className="text-brand-500" strokeWidth={2.5} />
          <h1 className="font-black text-base tracking-wide uppercase">Panel Admin</h1>
        </div>
        <button
          onClick={() => setMostrarFormNuevo(v => !v)}
          className={`p-2 rounded-xl border-2 ${mostrarFormNuevo ? 'border-orange-500 bg-orange-500 text-white' : `${theme.border} ${theme.bg} ${theme.text}`} active:scale-95 transition-all`}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={cargarUsuarios}
          disabled={cargando}
          className={`p-2 rounded-xl border-2 ${theme.border} ${theme.bg} active:scale-95 transition-all`}
        >
          <RefreshCw size={18} className={`${theme.text} ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sección Usuarios */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Switcher de PERFIL empresarial (preview del admin) */}
        {esAdmin && onCambiarPerfil && (
          <div className={`mb-4 rounded-2xl border-2 ${theme.border} p-3 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Perfil (vista previa)</p>
            <div className="flex gap-2">
              {PERFILES.map(pf => (
                <button
                  key={pf.id}
                  onClick={() => onCambiarPerfil(pf.id)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all active:scale-95 ${
                    perfilActivo === pf.id ? 'bg-orange-500 text-white shadow-sm' : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pf.label}
                </button>
              ))}
            </div>
            <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Cambia solo TU vista para probar cada perfil. Activo: <b>{(perfilActivo || 'claro').toUpperCase()}</b>{perfilPreview ? ' (preview)' : ''}.
            </p>
          </div>
        )}

        {/* Inspector de fotos huérfanas (solo admin) */}
        {esAdmin && <InspectorHuerfanas isDark={isDark} />}

        {/* Ferretería base global (solo admin) */}
        {esAdmin && <FerreteriaBasePanel isDark={isDark} />}

        {mostrarFormNuevo && (
          <div className="mb-4">
            <NuevoUsuarioForm
              isDark={isDark}
              theme={theme}
              onCreado={() => { setMostrarFormNuevo(false); cargarUsuarios(); }}
              onCancelar={() => setMostrarFormNuevo(false)}
            />
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <User size={14} strokeWidth={2.5} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Usuarios registrados {usuarios ? `(${usuarios.length})` : ''}
          </p>
        </div>

        {cargando && !usuarios && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={28} className="text-orange-400 animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-400 text-sm font-bold">{error}</p>
          </div>
        )}

        {usuarios && (
          <div className="flex flex-col gap-3">
            {usuarios.map(u => (
              <UsuarioCard key={u.uid} usuario={u} isDark={isDark} theme={theme} onEntrarComo={onLoginComo} errores={erroresMap[u.uid] || []} onDeleteError={handleDeleteError} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VistaAdmin;
