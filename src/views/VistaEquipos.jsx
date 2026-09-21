import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, ArrowLeft, Plus, X, RefreshCw, Copy, Check, ChevronDown, ChevronUp,
  UserPlus, UserMinus, Loader2, MessageCircle, MapPin, LogOut, Info, Image as ImageIcon,
  Folder, AlertTriangle, Settings, Trash2
} from 'lucide-react';
import {
  collection, addDoc, setDoc, getDocs, getDoc, doc, query, where,
  updateDoc, arrayUnion, arrayRemove, onSnapshot, deleteField, deleteDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { colorDiaAleatorio } from '../data/constantes';
import ChatBitacora from '../components/ChatBitacora';
import VerDetalle from '../components/VerDetalle';

// ─── Escáner QR (cámara + BarcodeDetector nativo, con fallback a jsQR) ───────
const ScannerQR = ({ onResult, onClose }) => {
  const videoRef = useRef(null);
  const [errorCam, setErrorCam] = useState('');
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let stream = null, raf = 0, activo = true, detector = null, jsqr = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = async () => {
      if (!activo) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes.length && activo) { activo = false; onResultRef.current(codes[0].rawValue); return; }
          } else if (jsqr) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsqr(img.data, img.width, img.height);
            if (code?.data && activo) { activo = false; onResultRef.current(code.data); return; }
          }
        } catch { /* frame fallido, seguir intentando */ }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if ('BarcodeDetector' in window) {
          try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }
        }
        if (!detector) jsqr = (await import('jsqr')).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        raf = requestAnimationFrame(tick);
      } catch (e) {
        console.error('Cámara QR:', e);
        setErrorCam('No se pudo abrir la cámara. Revisa los permisos de cámara de la app.');
      }
    })();

    return () => { activo = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  return (
    <div className="fixed inset-0 z-[4000] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 pb-3 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <p className="text-white font-black text-sm uppercase tracking-wider">Escanear QR del equipo</p>
        <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white active:scale-95"><X size={18} /></button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56 rounded-3xl border-4 border-orange-500/90" />
        </div>
        {errorCam && (
          <div className="absolute inset-x-6 top-6 bg-red-600 text-white text-xs font-bold rounded-xl px-4 py-3 text-center">{errorCam}</div>
        )}
      </div>
      <p className="text-slate-300 text-[11px] text-center px-6 py-4 shrink-0">Apunta al QR que muestra el creador del equipo en su pantalla.</p>
    </div>
  );
};

// ─── Contador de puntos ───────────────────────────────────────────────────────
const PuntosCount = ({ proyectoId }) => {
  const [count, setCount] = useState(null);
  useEffect(() => {
    getDocs(query(collection(db, 'puntos'), where('proyectoId', '==', proyectoId)))
      .then(s => setCount(s.size))
      .catch(() => setCount('?'));
  }, [proyectoId]);
  return <span>{count === null ? '…' : count}</span>;
};

// ─── Fila de proyecto ─────────────────────────────────────────────────────────
const ProyectoRowEquipo = ({
  proyecto, equipo, uid, isDark, muted, rowBg,
  onChat, onLista, onGPS, onEditar,
  notif = 0,
}) => {
  // ROL A NIVEL EQUIPO: el creador del equipo y los miembros con rol 'editor' pueden editar
  // CUALQUIER proyecto del grupo; los 'supervisor' solo lectura. Sin solicitudes por proyecto.
  const esOwnerProy = proyecto.ownerId === uid;
  const rolEquipo = equipo?.ownerId === uid
    ? 'editor'
    : ((equipo?.miembros || []).find(m => m.uid === uid)?.rol || 'editor');

  const badge = esOwnerProy
    ? { label: 'Propio', cls: 'bg-slate-900 text-white' }
    : rolEquipo === 'supervisor'
      ? { label: 'Supervisor', cls: isDark ? 'bg-slate-600 text-slate-200' : 'bg-slate-200 text-slate-700' }
      : { label: 'Editor', cls: 'bg-blue-500 text-white' };

  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <div className={`flex items-center gap-2 px-3 py-2.5 ${rowBg}`}>
        <Folder size={13} strokeWidth={2.5} className="text-orange-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{proyecto.nombre}</p>
          <p className={`text-[10px] ${muted}`}>
            {proyecto.ownerNombre || '—'} · <PuntosCount proyectoId={proyecto.id} /> puntos
          </p>
        </div>

        <span className={`text-[9px] font-black px-2 py-1.5 rounded-lg shrink-0 ${badge.cls}`}>{badge.label}</span>

        {rolEquipo === 'supervisor' && !esOwnerProy ? (
          /* Supervisor: solo lectura desde aquí (bitácora, lista de puntos, mapa) */
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onChat(proyecto)} className="relative p-1.5 rounded-xl bg-slate-900 text-white active:scale-95">
              <MessageCircle size={13} strokeWidth={2.5} />
              {notif > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">{notif > 9 ? '9+' : notif}</span>}
            </button>
            <button onClick={() => onLista(proyecto)} className="p-1.5 rounded-xl bg-slate-600 text-white active:scale-95">
              <Info size={13} strokeWidth={2.5} />
            </button>
            <button onClick={() => onGPS(proyecto)} className="p-1.5 rounded-xl bg-blue-600 text-white active:scale-95">
              <MapPin size={13} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          /* Owner o editor: EDITAR jala el proyecto a tu lista personal y lo abre */
          <button
            onClick={() => onEditar?.(proyecto)}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-green-600 text-white active:scale-95 shrink-0"
            title="Llevar a mi lista de proyectos y editar"
          >
            EDITAR
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Card equipo propio (creador) ─────────────────────────────────────────────
const EquipoCardPropio = ({
  equipo, isDark, card, muted, rowBg, expandido, onToggle,
  onCopiar, copiado, aprobando, onAprobar, onRechazar,
  proyectos, cargandoProyectos, uid,
  onChat, onLista, onGPS, notificaciones,
  onRemoverMiembro, onCopiarConfig,
  onCrearProyecto, onCompartirProyecto, onEditarProyecto,
  onInvitar, onEliminarEquipo,
}) => {
  const totalMiembros = equipo.miembros?.length || 0;
  const totalPendientes = equipo.pendientes?.length || 0;
  const [tab, setTab] = useState('proyectos');

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <div onClick={onToggle} role="button" className={`w-full flex items-center gap-3 px-4 py-3 transition-all cursor-pointer ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
          <span className="text-white font-black text-base leading-none">{equipo.nombre.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 overflow-hidden text-left">
          <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{equipo.nombre}</p>
          <p className={`text-[10px] ${muted}`}>
            {totalMiembros} miembro{totalMiembros !== 1 ? 's' : ''}
            {totalPendientes > 0 && <span className="ml-1.5 text-red-500 font-black">· {totalPendientes} pendiente{totalPendientes !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onInvitar?.(equipo); }}
            className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center active:scale-95"
            title="Invitar miembro (QR / enlace)">
            <UserPlus size={15} strokeWidth={2.5} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEliminarEquipo?.(equipo); }}
            className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center active:scale-95"
            title="Eliminar equipo">
            <Trash2 size={15} strokeWidth={2.5} />
          </button>
          <span className={`w-9 h-9 rounded-lg border flex items-center justify-center ${isDark ? 'border-slate-500' : 'border-slate-900'}`}>
            {expandido ? <ChevronUp size={16} className={muted} /> : <ChevronDown size={16} className={muted} />}
          </span>
        </div>
      </div>

      {expandido && (
        <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          {/* Tabs */}
          <div className={`flex border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            {['proyectos', 'miembros'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${tab === t ? 'text-orange-500 border-b-2 border-orange-500' : muted}`}>
                {t === 'proyectos' ? `Proyectos${proyectos?.length ? ` (${proyectos.length})` : ''}` : `Miembros (${totalMiembros + 1})`}
                {t === 'miembros' && totalPendientes > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-black text-white align-middle">{totalPendientes}</span>
                )}
              </button>
            ))}
          </div>

          <div className="px-3 py-3">
            {tab === 'proyectos' && (
              <div className="space-y-1.5">
                {/* Solo el creador crea proyectos en el equipo; también puede compartir uno suyo */}
                <div className="flex gap-1.5 mb-1">
                  <button onClick={() => onCrearProyecto?.(equipo)}
                    className="flex-1 py-2 rounded-xl text-[10px] font-black bg-slate-900 text-white active:scale-95">
                    + CREAR PROYECTO
                  </button>
                  <button onClick={() => onCompartirProyecto?.(equipo)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black border-2 border-dashed active:scale-95 ${isDark ? 'border-slate-400 text-slate-200' : 'border-slate-900 text-slate-900'}`}>
                    COMPARTIR UNO MÍO
                  </button>
                </div>
                {cargandoProyectos
                  ? <div className="flex justify-center py-4"><RefreshCw size={16} className="text-orange-400 animate-spin" /></div>
                  : !proyectos?.length
                    ? <p className={`text-xs text-center py-3 ${muted}`}>Sin proyectos en este equipo aún</p>
                    : proyectos.map(p => (
                      <ProyectoRowEquipo key={p.id} proyecto={p} equipo={equipo} uid={uid} isDark={isDark} muted={muted} rowBg={rowBg}
                        onChat={onChat} onLista={onLista} onGPS={onGPS} onEditar={onEditarProyecto}
                        notif={notificaciones?.[p.id] || 0}
                      />
                    ))
                }
              </div>
            )}
            {tab === 'miembros' && (
              <div className="space-y-1.5">
                {/* Solicitudes pendientes al equipo */}
                {totalPendientes > 0 && (
                  <div className="mb-2">
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 text-red-500">Solicitudes de ingreso</p>
                    {equipo.pendientes.map(p => (
                      <div key={p.uid} className={`px-3 py-2 rounded-xl mb-1 ${isDark ? 'bg-red-950/30 border border-red-900/30' : 'bg-red-50 border border-red-100'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                            <span className="text-red-500 font-black text-xs">{(p.nombre || '?').charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{p.nombre}</p>
                            <p className={`text-[10px] truncate ${muted}`}>{p.empresa || p.email}</p>
                          </div>
                        </div>
                        {/* Botones en segunda fila para no tapar el nombre */}
                        <div className="flex gap-1.5 mt-2">
                          <button onClick={() => onRechazar(equipo, p)} disabled={aprobando === p.uid + '_r' || aprobando === p.uid}
                            className={`flex-1 py-1.5 rounded-xl text-[10px] font-black active:scale-95 disabled:opacity-40 flex items-center justify-center ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-white border border-slate-200 text-slate-600'}`}>
                            {aprobando === p.uid + '_r' ? <RefreshCw size={10} className="animate-spin" /> : 'RECHAZAR'}
                          </button>
                          <button onClick={() => onAprobar(equipo, p, 'editor')} disabled={aprobando === p.uid || aprobando === p.uid + '_r'}
                            className="flex-1 py-1.5 rounded-xl text-[10px] font-black bg-slate-900 text-white active:scale-95 disabled:opacity-40 flex items-center justify-center"
                            title="Podrá editar cualquier proyecto del equipo">
                            {aprobando === p.uid ? <RefreshCw size={10} className="animate-spin" /> : 'EDITOR'}
                          </button>
                          <button onClick={() => onAprobar(equipo, p, 'supervisor')} disabled={aprobando === p.uid || aprobando === p.uid + '_r'}
                            className="flex-1 py-1.5 rounded-xl text-[10px] font-black bg-blue-600 text-white active:scale-95 disabled:opacity-40 flex items-center justify-center"
                            title="Solo lectura de los proyectos del equipo">
                            {aprobando === p.uid ? <RefreshCw size={10} className="animate-spin" /> : 'SUPERV.'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Creador (Yo) */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rowBg}`}>
                  <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-xs">{(equipo.ownerNombre || '?').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{equipo.ownerNombre}</p>
                    <p className={`text-[10px] truncate ${muted}`}>Creador</p>
                  </div>
                  <span className="text-[9px] font-black text-orange-500 uppercase shrink-0">Yo</span>
                </div>
                {/* Miembros */}
                {equipo.miembros?.map(m => (
                  <div key={m.uid} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rowBg}`}>
                    <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                      <span className="text-white font-black text-xs">{(m.nombre || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{m.nombre}</p>
                      <p className={`text-[10px] truncate ${muted}`}>{m.rol === 'supervisor' ? 'Supervisor' : 'Editor'}</p>
                    </div>
                    <button
                      onClick={() => onCopiarConfig?.({ uid: m.uid, nombre: m.nombre, empresa: m.empresa })}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 text-white active:scale-95 transition-all shrink-0"
                      title="Copiar configuración de este usuario"
                    >
                      <Settings size={12} strokeWidth={2.5} />
                      <span className="text-[8px] font-black tracking-wide leading-[1.2] text-left">COPIAR<br />CONFIGURACIÓN</span>
                    </button>
                    <button
                      onClick={() => onRemoverMiembro?.(equipo, m)}
                      className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center active:scale-95 transition-all shrink-0"
                      title="Remover del equipo"
                    >
                      <UserMinus size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
                {totalMiembros === 0 && totalPendientes === 0 && (
                  <p className={`text-xs text-center py-2 ${muted}`}>Aún no hay miembros. Invita con el botón de la personita (+) del encabezado.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Card equipo en el que soy miembro ───────────────────────────────────────
const EquipoCardMiembro = ({
  equipo, user, isDark, card, muted, rowBg, expandido, onToggle,
  proyectos, cargandoProyectos,
  onChat, onLista, onGPS, notificaciones,
  onSalirEquipo, onCopiarConfig,
  onCompartirProyecto, onEditarProyecto,
}) => {
  const [tab, setTab] = useState('proyectos');
  const totalMiembros = (equipo.miembros?.length || 0) + 1;

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <button onClick={onToggle} className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
          <Users size={18} className="text-brand-500" strokeWidth={2.5} />
        </div>
        <div className="flex-1 overflow-hidden text-left">
          <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{equipo.nombre}</p>
          <p className={`text-[10px] ${muted}`}>{equipo.ownerNombre} · {totalMiembros} miembro{totalMiembros !== 1 ? 's' : ''}</p>
        </div>
        <span className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${isDark ? 'border-slate-500' : 'border-slate-900'}`}>
          {expandido ? <ChevronUp size={16} className={muted} /> : <ChevronDown size={16} className={muted} />}
        </span>
      </button>

      {expandido && (
        <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <div className={`flex border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            {['proyectos', 'miembros'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${tab === t ? 'text-orange-500 border-b-2 border-orange-500' : muted}`}>
                {t === 'proyectos' ? `Proyectos${proyectos?.length ? ` (${proyectos.length})` : ''}` : `Miembros (${totalMiembros})`}
              </button>
            ))}
          </div>

          <div className="px-3 py-3">
            {tab === 'proyectos' && (
              <div className="space-y-1.5">
                {/* Miembro: puede TRANSFERIR un proyecto suyo al equipo (el dominio pasa al creador) */}
                <button onClick={() => onCompartirProyecto?.(equipo)}
                  className={`w-full py-2 rounded-xl text-[10px] font-black border-2 border-dashed active:scale-95 mb-1 ${isDark ? 'border-slate-400 text-slate-200' : 'border-slate-900 text-slate-900'}`}>
                  COMPARTIR UN PROYECTO MÍO
                </button>
                {cargandoProyectos
                  ? <div className="flex justify-center py-4"><RefreshCw size={16} className="text-orange-400 animate-spin" /></div>
                  : !proyectos?.length
                    ? <p className={`text-xs text-center py-3 ${muted}`}>Sin proyectos aún</p>
                    : proyectos.map(p => (
                      <ProyectoRowEquipo key={p.id} proyecto={p} equipo={equipo} uid={user?.uid} isDark={isDark} muted={muted} rowBg={rowBg}
                        onChat={onChat} onLista={onLista} onGPS={onGPS} onEditar={onEditarProyecto}
                        notif={notificaciones?.[p.id] || 0}
                      />
                    ))
                }
              </div>
            )}
            {tab === 'miembros' && (
              <div className="space-y-1">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rowBg}`}>
                  <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-xs">{(equipo.ownerNombre || '?').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{equipo.ownerNombre}</p>
                    <p className={`text-[10px] truncate ${muted}`}>Creador</p>
                  </div>
                  <span className="text-[9px] font-black text-orange-500 shrink-0">Creador</span>
                  {equipo.ownerId !== user?.uid && (
                    <button
                      onClick={() => onCopiarConfig?.({ uid: equipo.ownerId, nombre: equipo.ownerNombre, empresa: equipo.ownerEmpresa })}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 text-white active:scale-95 transition-all shrink-0"
                      title="Copiar configuración del creador"
                    >
                      <Settings size={12} strokeWidth={2.5} />
                      <span className="text-[8px] font-black tracking-wide leading-[1.2] text-left">COPIAR<br />CONFIGURACIÓN</span>
                    </button>
                  )}
                </div>
                {equipo.miembros?.map(m => (
                  <div key={m.uid} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rowBg}`}>
                    <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                      <span className="text-white font-black text-xs">{(m.nombre || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{m.nombre}</p>
                      <p className={`text-[10px] truncate ${muted}`}>{m.rol === 'supervisor' ? 'Supervisor' : 'Editor'}</p>
                    </div>
                    {m.uid === user?.uid ? (
                      <span className={`text-[9px] font-black uppercase shrink-0 ${muted}`}>Yo</span>
                    ) : (
                      <button
                        onClick={() => onCopiarConfig?.({ uid: m.uid, nombre: m.nombre, empresa: m.empresa })}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 text-white active:scale-95 transition-all shrink-0"
                        title="Copiar configuración de este usuario"
                      >
                        <Settings size={12} strokeWidth={2.5} />
                        <span className="text-[8px] font-black tracking-wide leading-[1.2] text-left">COPIAR<br />CONFIGURACIÓN</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Botón salir del equipo */}
            <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
              <button
                onClick={() => onSalirEquipo?.(equipo)}
                className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all border-2 border-red-500 text-red-500 ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}
              >
                <LogOut size={13} strokeWidth={2.5} /> SALIR DEL EQUIPO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Vista principal ──────────────────────────────────────────────────────────
export default function VistaEquipos({
  theme, isDark, user, config, saveConfig, setConfirmData, setAlertData, onVolver,
  onGPSProyecto, marcarChatLeido, notificacionesSupervisados = {},
  proyectosPropios = [], onAbrirProyecto,
  invitacionEquipoId, onInvitacionConsumida, perfilActivo = 'avanzado',
}) {
  // Copiar la configuración (armados + ferretería) de otro usuario hacia la mía
  const copiarConfigDe = useCallback(async (persona) => {
    if (!persona?.uid) return;
    try {
      const snap = await getDoc(doc(db, 'configuraciones', persona.uid));
      if (!snap.exists()) {
        setAlertData?.({ title: 'Sin configuración', message: `${persona.nombre || 'Ese usuario'} no tiene configuración guardada.` });
        return;
      }
      const data = snap.data();
      const armados = Array.isArray(data.armados) ? data.armados : [];
      const ferreteria = Array.isArray(data.catalogoFerreteria) ? data.catalogoFerreteria : [];
      const nombresArmados = armados.map(a => a?.nombre).filter(Boolean);
      setConfirmData?.({
        title: 'Copiar configuración',
        message: (
          <span className="block text-left">
            Se borrará tu configuración actual y se reemplazará por la de <b>{persona.nombre || 'este usuario'}</b>.
            <span className="block mt-3 font-black">Ferretería: {ferreteria.length} ítem{ferreteria.length !== 1 ? 's' : ''}</span>
            <span className="block mt-2 font-black">Armados ({nombresArmados.length}):</span>
            <span className="block max-h-40 overflow-y-auto mt-1 pr-1">
              {nombresArmados.length
                ? nombresArmados.map((n, i) => <span key={i} className="block text-xs">• {n}</span>)
                : <span className="block text-xs opacity-60">(ninguno)</span>}
            </span>
          </span>
        ),
        actionText: 'COPIAR',
        theme,
        onConfirm: async () => {
          try {
            await saveConfig?.({ ...config, armados, catalogoFerreteria: ferreteria });
            setConfirmData?.(null);
            setAlertData?.({ title: 'Listo', message: 'Configuración copiada correctamente.' });
          } catch (e) {
            console.error('Error guardando config copiada:', e);
            setConfirmData?.(null);
            setAlertData?.({ title: 'Error', message: 'No se pudo guardar la configuración.' });
          }
        },
      });
    } catch (e) {
      console.error('Error copiando config:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo leer la configuración de ese usuario.' });
    }
  }, [config, saveConfig, setConfirmData, setAlertData, theme]);
  // Equipos
  const [equiposPropios, setEquiposPropios] = useState([]);
  const [equiposUnido, setEquiposUnido] = useState([]);
  const [cargando, setCargando] = useState(true);

  // UI estado
  const [modal, setModal] = useState(null);
  const [equipoCreado, setEquipoCreado] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [expandido, setExpandido] = useState({});
  const [aprobando, setAprobando] = useState(null);

  // Proyectos por equipo
  const [proyectosEquipo, setProyectosEquipo] = useState({});
  const [cargandoProyectos, setCargandoProyectos] = useState({});
  const listenersRef = useRef({});

  // Sub-vistas
  const [chatAbierto, setChatAbierto] = useState(null);
  const [viendoLista, setViendoLista] = useState(null);
  const [puntosSupervisados, setPuntosSupervisados] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [filtroPunto, setFiltroPunto] = useState('');
  const [puntoDetalle, setPuntoDetalle] = useState(null);
  const [configPropietario, setConfigPropietario] = useState(null);

  // ─── Listeners de equipos ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    let r1 = false, r2 = false;
    const check = () => { if (r1 && r2) setCargando(false); };
    const u1 = onSnapshot(
      query(collection(db, 'equipos'), where('ownerId', '==', user.uid)),
      s => { setEquiposPropios(s.docs.map(d => ({ id: d.id, ...d.data() }))); r1 = true; check(); },
      () => { r1 = true; check(); }
    );
    const u2 = onSnapshot(
      query(collection(db, 'equipos'), where('miembrosUids', 'array-contains', user.uid)),
      s => { setEquiposUnido(s.docs.map(d => ({ id: d.id, ...d.data() }))); r2 = true; check(); },
      () => { r2 = true; check(); }
    );
    return () => { u1(); u2(); };
  }, [user?.uid]);

  // Cleanup project listeners on unmount
  useEffect(() => {
    return () => { Object.values(listenersRef.current).forEach(u => u()); };
  }, []);

  // ─── Cargar proyectos del equipo ───────────────────────────────────────────
  // NUEVO MODELO: los proyectos del equipo son SOLO los marcados con grupoId (creados en
  // el equipo o compartidos/transferidos a él) — ya no todos los proyectos de los miembros.
  const iniciarListenerProyectos = useCallback((equipo) => {
    if (listenersRef.current[equipo.id]) return;
    setCargandoProyectos(prev => ({ ...prev, [equipo.id]: true }));
    const q = query(collection(db, 'proyectos'), where('grupoId', '==', equipo.id));
    const unsub = onSnapshot(
      q,
      snap => {
        setProyectosEquipo(prev => ({ ...prev, [equipo.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        setCargandoProyectos(prev => ({ ...prev, [equipo.id]: false }));
      },
      () => setCargandoProyectos(prev => ({ ...prev, [equipo.id]: false }))
    );
    listenersRef.current[equipo.id] = unsub;
  }, []);

  const toggleExpand = (equipo) => {
    const abre = !expandido[equipo.id];
    setExpandido(prev => ({ ...prev, [equipo.id]: abre }));
    if (abre) iniciarListenerProyectos(equipo);
  };

  // ─── Crear equipo ──────────────────────────────────────────────────────────
  const handleCrear = async () => {
    if (!nombreNuevo.trim()) return;
    setGuardando(true); setError('');
    try {
      const ref = await addDoc(collection(db, 'equipos'), {
        nombre: nombreNuevo.trim(),
        ownerId: user.uid,
        ownerNombre: config?.nombrePersonal || user.email?.split('@')[0] || 'Sin nombre',
        ownerEmpresa: config?.empresaPersonal || '',
        miembrosUids: [], miembros: [], pendientesUids: [], pendientes: [],
        createdAt: new Date().toISOString(),
      });
      setEquipoCreado({ id: ref.id, nombre: nombreNuevo.trim() });
      setNombreNuevo(''); setModal('creado');
    } catch { setError('Error al crear el equipo.'); }
    setGuardando(false);
  };

  // ─── Aprobar/rechazar miembro al equipo ────────────────────────────────────
  // Al aprobar se elige el ROL del miembro EN EL EQUIPO: editor (edita cualquier proyecto
  // del grupo) o supervisor (solo lectura de cualquier proyecto del grupo).
  const handleAprobarMiembro = async (equipo, pendiente, rol = 'editor') => {
    setAprobando(pendiente.uid);
    try {
      await updateDoc(doc(db, 'equipos', equipo.id), {
        miembros: arrayUnion({ uid: pendiente.uid, nombre: pendiente.nombre, empresa: pendiente.empresa, email: pendiente.email, fechaIngreso: new Date().toISOString(), rol }),
        miembrosUids: arrayUnion(pendiente.uid),
        pendientes: arrayRemove(pendiente),
        pendientesUids: arrayRemove(pendiente.uid),
      });
    } catch (e) { console.error(e); }
    setAprobando(null);
  };

  const handleRechazarMiembro = async (equipo, pendiente) => {
    setAprobando(pendiente.uid + '_r');
    try {
      await updateDoc(doc(db, 'equipos', equipo.id), {
        pendientes: arrayRemove(pendiente),
        pendientesUids: arrayRemove(pendiente.uid),
      });
    } catch (e) { console.error(e); }
    setAprobando(null);
  };

  // ─── BLOQUE 5: invitación por QR / enlace ─────────────────────────────────
  const [modalInvitar, setModalInvitar] = useState(null);       // { equipo } — el creador muestra QR/enlace
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [scannerAbierto, setScannerAbierto] = useState(false);
  const [modalInvitacion, setModalInvitacion] = useState(null); // { id, nombre, ownerNombre } — confirmar unirse
  const [procesandoInvitacion, setProcesandoInvitacion] = useState(false);

  const linkInvitacion = (equipoId) => `${window.location.origin}/?equipo=${equipoId}`;

  const abrirInvitar = async (equipo) => {
    setModalInvitar({ equipo }); setQrDataUrl(null);
    try {
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(linkInvitacion(equipo.id), { width: 480, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
      setQrDataUrl(url);
    } catch (e) { console.error('Generar QR:', e); }
  };

  const compartirInvitacion = async (equipo) => {
    const url = linkInvitacion(equipo.id);
    const texto = `Únete a mi equipo "${equipo.nombre}" en Kipo: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ text: texto }); } catch { /* usuario canceló */ }
    } else {
      navigator.clipboard?.writeText(url).catch(() => {});
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    }
  };

  // Procesa un id de equipo llegado por enlace (?equipo=ID) o QR → valida y pide confirmación
  const procesarInvitacion = useCallback(async (equipoId) => {
    try {
      const snap = await getDoc(doc(db, 'equipos', String(equipoId)));
      if (!snap.exists()) { setAlertData?.({ title: 'Equipo no encontrado', message: 'El enlace o QR no corresponde a un equipo válido.' }); return; }
      const data = snap.data();
      if (data.ownerId === user?.uid) { setAlertData?.({ title: 'Es tu equipo', message: 'Eres el creador de este equipo.' }); return; }
      if (data.miembrosUids?.includes(user?.uid)) { setAlertData?.({ title: 'Ya eres miembro', message: `Ya formas parte de "${data.nombre}".` }); return; }
      if (data.pendientesUids?.includes(user?.uid)) { setAlertData?.({ title: 'Solicitud pendiente', message: `Ya enviaste una solicitud a "${data.nombre}". Espera la aprobación del creador.` }); return; }
      setModalInvitacion({ id: snap.id, nombre: data.nombre, ownerNombre: data.ownerNombre || '' });
    } catch (e) {
      console.error('Procesar invitación:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo leer la invitación.' });
    }
  }, [user?.uid, setAlertData]);

  const enviarSolicitudInvitacion = async () => {
    if (!modalInvitacion || procesandoInvitacion) return;
    setProcesandoInvitacion(true);
    try {
      await updateDoc(doc(db, 'equipos', modalInvitacion.id), {
        pendientes: arrayUnion({ uid: user.uid, nombre: config?.nombrePersonal || user.email?.split('@')[0] || 'Sin nombre', empresa: config?.empresaPersonal || '', email: user.email || '', fechaSolicitud: new Date().toISOString() }),
        pendientesUids: arrayUnion(user.uid),
      });
      setModalInvitacion(null); setModal('solicitado');
    } catch (e) {
      console.error('Solicitud de ingreso:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo enviar la solicitud.' });
    }
    setProcesandoInvitacion(false);
  };

  // Enlace ?equipo=ID capturado por App al abrir la app
  useEffect(() => {
    if (invitacionEquipoId) {
      procesarInvitacion(invitacionEquipoId);
      onInvitacionConsumida?.();
    }
  }, [invitacionEquipoId, procesarInvitacion, onInvitacionConsumida]);

  // Resultado del escáner: acepta la URL completa de invitación o un id de equipo pelado
  const onQREscaneado = (texto) => {
    setScannerAbierto(false);
    let id = null;
    try { id = new URL(texto).searchParams.get('equipo'); } catch { /* no es una URL */ }
    if (!id && /^[A-Za-z0-9_-]{10,}$/.test((texto || '').trim())) id = texto.trim();
    if (id) procesarInvitacion(id);
    else setAlertData?.({ title: 'QR no válido', message: 'Ese código no es una invitación de equipo de Kipo.' });
  };

  // ─── BLOQUE 3: proyectos del grupo (crear / compartir / editar) ────────────
  const [modalProyecto, setModalProyecto] = useState(null); // { tipo: 'crear'|'compartir', equipo }
  const [nombreProyEquipo, setNombreProyEquipo] = useState('');
  const [tipoProyEquipo, setTipoProyEquipo] = useState('levantamiento');
  const [modoFotosProyEquipo, setModoFotosProyEquipo] = useState('comprimido');
  const [guardandoProy, setGuardandoProy] = useState(false);

  // Crear proyecto DENTRO del equipo (solo el creador). Vive en el equipo (enListaDe vacío)
  // hasta que alguien lo "jale" a su lista con EDITAR.
  const crearProyectoEnEquipo = async () => {
    const equipo = modalProyecto?.equipo;
    if (!equipo || !nombreProyEquipo.trim() || guardandoProy) return;
    setGuardandoProy(true);
    try {
      const idProyecto = String(Date.now());
      const diaUno = { id: `d_${Date.now()}`, nombre: 'Día 1', fecha: new Date().toLocaleDateString(), color: colorDiaAleatorio() };
      await setDoc(doc(db, 'proyectos', idProyecto), {
        id: idProyecto,
        nombre: nombreProyEquipo.trim(),
        tipo: tipoProyEquipo,
        modoFotos: modoFotosProyEquipo,
        dias: [diaUno],
        ownerId: user.uid,
        ownerNombre: config?.nombrePersonal || user?.email?.split('@')[0] || '',
        ownerEmpresa: config?.empresaPersonal || '',
        compartidoCon: [], permisos: {},
        grupoId: equipo.id,
        enListaDe: [],
        createdAt: new Date().toISOString(),
      });
      setModalProyecto(null); setNombreProyEquipo('');
    } catch (e) { console.error('Crear proyecto en equipo:', e); setAlertData?.({ title: 'Error', message: 'No se pudo crear el proyecto.' }); }
    setGuardandoProy(false);
  };

  // Compartir un proyecto MÍO al equipo.
  //  - Creador del equipo: el proyecto se marca del equipo y sigue siendo suyo (queda en su lista).
  //  - Miembro: TRANSFIERE el dominio al creador del equipo y él queda como editor (naranja).
  const compartirAlEquipo = (proyecto) => {
    const equipo = modalProyecto?.equipo;
    if (!equipo || guardandoProy) return;
    const esOwnerEquipo = equipo.ownerId === user.uid;
    const ejecutar = async () => {
      setGuardandoProy(true);
      try {
        if (esOwnerEquipo) {
          await updateDoc(doc(db, 'proyectos', String(proyecto.id)), {
            grupoId: equipo.id,
            enListaDe: arrayUnion(user.uid),
          });
        } else {
          await updateDoc(doc(db, 'proyectos', String(proyecto.id)), {
            grupoId: equipo.id,
            ownerId: equipo.ownerId,
            ownerNombre: equipo.ownerNombre || '',
            ownerEmpresa: equipo.ownerEmpresa || '',
            compartidoCon: arrayUnion(user.uid),
            [`permisos.${user.uid}`]: 'edicion',
            [`supervisoresInfo.${user.uid}`]: { nombre: config?.nombrePersonal || user?.email?.split('@')[0] || '', empresa: config?.empresaPersonal || '' },
            enListaDe: arrayUnion(user.uid),
          });
        }
        setModalProyecto(null);
      } catch (e) { console.error('Compartir al equipo:', e); setAlertData?.({ title: 'Error', message: 'No se pudo compartir el proyecto.' }); }
      setGuardandoProy(false);
    };
    if (esOwnerEquipo) { ejecutar(); return; }
    setConfirmData?.({
      title: 'Transferir al equipo',
      message: `"${proyecto.nombre}" pasará a ser propiedad de ${equipo.ownerNombre || 'el creador del equipo'}. Tú seguirás editándolo desde tu lista (naranja), pero el dominio será del equipo. ¿Continuar?`,
      actionText: 'TRANSFERIR', theme,
      onConfirm: () => { setConfirmData(null); ejecutar(); },
    });
  };

  // EDITAR desde el equipo: jala el proyecto a tu lista personal y lo abre para editar.
  // Rol EDITOR del equipo = acceso automático a cualquier proyecto del grupo (sin solicitudes).
  const editarDesdeEquipo = async (proyecto) => {
    try {
      if (proyecto.ownerId === user.uid) {
        if (!(proyecto.enListaDe || []).includes(user.uid)) {
          await updateDoc(doc(db, 'proyectos', String(proyecto.id)), { enListaDe: arrayUnion(user.uid) });
        }
      } else if (!(proyecto.compartidoCon || []).includes(user.uid)) {
        await updateDoc(doc(db, 'proyectos', String(proyecto.id)), {
          compartidoCon: arrayUnion(user.uid),
          [`permisos.${user.uid}`]: 'edicion',
          [`supervisoresInfo.${user.uid}`]: { nombre: config?.nombrePersonal || user?.email?.split('@')[0] || '', empresa: config?.empresaPersonal || '' },
          enListaDe: arrayUnion(user.uid),
        });
      } else if (!(proyecto.enListaDe || []).includes(user.uid)) {
        await updateDoc(doc(db, 'proyectos', String(proyecto.id)), { enListaDe: arrayUnion(user.uid) });
      }
      onAbrirProyecto?.({ ...proyecto, enListaDe: [...(proyecto.enListaDe || []), user.uid] });
    } catch (e) { console.error('Editar desde equipo:', e); }
  };

  // ─── Lista de puntos supervisados (tiempo real) ───────────────────────────
  const puntosListenerRef = useRef(null);

  const verListaPuntos = async (proyecto) => {
    // Limpiar listener anterior si existe
    if (puntosListenerRef.current) { puntosListenerRef.current(); puntosListenerRef.current = null; }
    setViendoLista(proyecto); setCargandoLista(true); setFiltroPunto(''); setPuntoDetalle(null); setConfigPropietario(null);
    // Cargar configuración del propietario (una sola vez)
    if (proyecto.ownerId) {
      getDoc(doc(db, 'configuraciones', proyecto.ownerId))
        .then(d => { if (d.exists()) setConfigPropietario(d.data()); })
        .catch(() => {});
    }
    // Listener en tiempo real para puntos
    const q = query(collection(db, 'puntos'), where('proyectoId', '==', proyecto.id));
    puntosListenerRef.current = onSnapshot(
      q,
      snap => { setPuntosSupervisados(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setCargandoLista(false); },
      () => setCargandoLista(false)
    );
  };

  // Limpiar listener de puntos al salir de la lista
  useEffect(() => {
    if (!viendoLista && puntosListenerRef.current) {
      puntosListenerRef.current();
      puntosListenerRef.current = null;
    }
  }, [viendoLista]);

  const gpsProyecto = async (proyecto) => {
    try {
      const snap = await getDocs(query(collection(db, 'puntos'), where('proyectoId', '==', proyecto.id)));
      const pts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (pts.length > 0 && onGPSProyecto) onGPSProyecto(proyecto, pts, null);
    } catch (e) { console.error(e); }
  };

  // ─── Phase 3: salir / remover miembro ────────────────────────────────────
  const [modalSalir, setModalSalir] = useState(null); // { equipo, miembro|null, uid, propios, conAcceso }
  const [cargandoSalir, setCargandoSalir] = useState(false);
  const [procesandoSalir, setProcesandoSalir] = useState(false);

  const prepararSalida = async (equipo, miembro) => {
    const uid = miembro ? miembro.uid : user.uid;
    setCargandoSalir(true);
    let proyectos = proyectosEquipo[equipo.id];
    if (!proyectos) {
      const snap = await getDocs(query(collection(db, 'proyectos'), where('grupoId', '==', equipo.id)));
      proyectos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const propios = proyectos.filter(p => p.ownerId === uid);
    const conAcceso = proyectos.filter(p => p.ownerId !== uid && (p.compartidoCon || []).includes(uid));
    setModalSalir({ equipo, miembro, uid, propios, conAcceso });
    setCargandoSalir(false);
  };

  const confirmarSalida = async () => {
    if (!modalSalir) return;
    const { equipo, miembro, uid, propios, conAcceso } = modalSalir;
    setProcesandoSalir(true);
    try {
      // 1. Copiar cada proyecto propio del que sale → copia 100% independiente del creador del equipo
      //    El proyecto original NO se toca (queda con su dueño). La copia es del creador.
      let contadorId = Date.now();
      for (const proy of propios) {
        // a. Crear el proyecto copia (nuevo doc) propiedad del creador del equipo
        const nuevoProyRef = doc(collection(db, 'proyectos'));
        const nuevoProyId = nuevoProyRef.id;
        const { id: _oldProyId, ...proyData } = proy;
        await setDoc(nuevoProyRef, {
          ...proyData,
          ownerId: equipo.ownerId,
          ownerNombre: equipo.ownerNombre,
          ownerEmpresa: equipo.ownerEmpresa || '',
          compartidoCon: [],
          permisos: {},
          solicitudesPendientes: [],
          copiadoDe: _oldProyId,
          copiadoEn: new Date().toISOString(),
        });

        // b. Copiar puntos con nuevos IDs numéricos, construyendo mapa oldId → newId
        const puntosSnap = await getDocs(query(collection(db, 'puntos'), where('proyectoId', '==', _oldProyId)));
        const mapaIds = {};
        const puntosOps = [];
        puntosSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => parseInt(a.id) - parseInt(b.id))
          .forEach(pt => {
            const nuevoPuntoId = String(contadorId++);
            mapaIds[pt.id] = nuevoPuntoId;
            const { id: _oldPtId, ...ptData } = pt;
            puntosOps.push(setDoc(doc(db, 'puntos', nuevoPuntoId), {
              ...ptData,
              id: nuevoPuntoId,
              proyectoId: nuevoProyId,
              ownerId: equipo.ownerId,
            }));
          });
        await Promise.all(puntosOps);

        // c. Copiar conexiones remapeando los IDs de puntos, y anotar el id nuevo de cada
        // una: los cables de acero lo necesitan para sus fibras apoyadas
        const conexSnap = await getDocs(query(collection(db, 'conexiones'), where('proyectoId', '==', _oldProyId)));
        const mapaConex = {};
        const conexOps = conexSnap.docs.map(cd => {
          const { id: _oldCId, ...cData } = { id: cd.id, ...cd.data() };
          const nuevaRef = doc(collection(db, 'conexiones'));
          mapaConex[cd.id] = nuevaRef.id;
          return setDoc(nuevaRef, {
            ...cData,
            proyectoId: nuevoProyId,
            ownerId: equipo.ownerId,
            puntos: (cData.puntos || []).map(pid => mapaIds[pid] || pid),
            from: mapaIds[cData.from] || cData.from,
            to: mapaIds[cData.to] || cData.to,
          });
        });
        await Promise.all(conexOps);

        // d. Copiar cables de acero, con sus postes, su medio tramo y sus fibras remapeados
        const aceroSnap = await getDocs(query(collection(db, 'cablesAcero'), where('proyectoId', '==', _oldProyId)));
        await Promise.all(aceroSnap.docs.map(ad => {
          const cable = ad.data();
          return setDoc(doc(collection(db, 'cablesAcero')), {
            ...cable,
            proyectoId: nuevoProyId,
            ownerId: equipo.ownerId,
            puntos: (cable.puntos || []).map(pid => mapaIds[pid] || pid),
            fibras: (cable.fibras || []).map(fid => mapaConex[fid] || fid),
            medioTramo: cable.medioTramo != null ? (mapaIds[cable.medioTramo] || cable.medioTramo) : null,
          });
        }));
      }

      // 2. Quitar acceso de proyectos donde era editor/supervisor
      const accesoOps = conAcceso.map(p => updateDoc(doc(db, 'proyectos', p.id), {
        compartidoCon: arrayRemove(uid),
        [`permisos.${uid}`]: deleteField(),
      }));
      await Promise.all(accesoOps);

      // 3. Remover del equipo
      const miembroObj = miembro || equipo.miembros?.find(m => m.uid === uid);
      if (miembroObj) {
        await updateDoc(doc(db, 'equipos', equipo.id), {
          miembros: arrayRemove(miembroObj),
          miembrosUids: arrayRemove(uid),
        });
      }

      setModalSalir(null);
    } catch (e) { console.error(e); }
    setProcesandoSalir(false);
  };

  // ─── Eliminar EQUIPO (solo el creador) ─────────────────────────────────────
  // Los proyectos que ya están en la lista personal del creador se conservan ahí.
  // Los que existen SOLO en el grupo: el creador elige llevarlos o mandarlos a su papelera.
  const [modalBorrarEquipo, setModalBorrarEquipo] = useState(null);
  const [borrandoEquipo, setBorrandoEquipo] = useState(false);

  const prepararEliminarEquipo = async (equipo) => {
    if (borrandoEquipo) return;
    setBorrandoEquipo(true);
    try {
      const { contarFotos } = await import('../utils/papelera');
      let proys = proyectosEquipo[equipo.id];
      if (!proys) {
        const snap = await getDocs(query(collection(db, 'proyectos'), where('grupoId', '==', equipo.id)));
        proys = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const llevar = proys.filter(p => (p.enListaDe || []).includes(user.uid));
      const sueltosBase = proys.filter(p => !(p.enListaDe || []).includes(user.uid));
      const sueltos = [];
      for (const p of sueltosBase) {
        const sp = await getDocs(query(collection(db, 'puntos'), where('proyectoId', '==', String(p.id))));
        let fotos = 0;
        sp.docs.forEach(d => { fotos += contarFotos(d.data()?.datos); });
        sueltos.push({ proy: p, puntos: sp.size, fotos, checked: true });
      }
      setModalBorrarEquipo({ equipo, llevar, sueltos, fase: 'seleccion', llevarFinal: [], pendientes: [], idx: 0, aBorrar: [] });
    } catch (e) {
      console.error('Preparar borrar equipo:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo preparar el borrado del equipo.' });
    }
    setBorrandoEquipo(false);
  };

  // El proyecto pasa a la lista personal del creador: sin equipo y sin colaboradores
  const pasarAPersonal = async (p) => {
    await updateDoc(doc(db, 'proyectos', String(p.id)), {
      grupoId: deleteField(), enListaDe: deleteField(),
      compartidoCon: [], permisos: {}, supervisoresInfo: {},
    });
  };

  // Proyecto no deseado → papelera del MENÚ del creador (mismo mecanismo que borrar de la lista)
  const borrarProyectoAPapelera = async (p) => {
    const proyId = String(p.id);
    const [snapPuntos, snapCables, snapAcero] = await Promise.all([
      getDocs(query(collection(db, 'puntos'), where('proyectoId', '==', proyId))),
      getDocs(query(collection(db, 'conexiones'), where('proyectoId', '==', proyId))),
      getDocs(query(collection(db, 'cablesAcero'), where('proyectoId', '==', proyId))),
    ]);
    const { enviarAPapelera, enviarCableAceroAPapelera, extraerStoragePaths, contarFotos } = await import('../utils/papelera');
    const grupo = proyId;
    let totalFotos = 0;
    for (const dp of snapPuntos.docs) {
      const datos = { id: dp.id, ...dp.data() };
      totalFotos += contarFotos(datos.datos);
      await enviarAPapelera({
        uid: user.uid, tipo: 'punto',
        snapshot: JSON.parse(JSON.stringify(datos)),
        coleccionOriginal: 'puntos', idOriginal: dp.id,
        proyectoId: proyId, proyectoNombre: p.nombre || '',
        nombre: `${datos.datos?.numero || dp.id} (de ${p.nombre || 'proyecto'})`,
        storagePaths: extraerStoragePaths(datos.datos),
        meta: { grupo },
      });
    }
    for (const dc of snapCables.docs) {
      const datos = { id: dc.id, ...dc.data() };
      await enviarAPapelera({
        uid: user.uid, tipo: 'fibra',
        snapshot: JSON.parse(JSON.stringify(datos)),
        coleccionOriginal: 'conexiones', idOriginal: dc.id,
        proyectoId: proyId, proyectoNombre: p.nombre || '',
        nombre: `Fibra ${datos.capacidad || ''} (de ${p.nombre || 'proyecto'})`.trim(),
        meta: { grupo, puntos: [] },
      });
    }
    for (const da of snapAcero.docs) {
      await enviarCableAceroAPapelera({
        uid: user.uid, cable: { id: da.id, ...da.data() },
        proyectoNombre: p.nombre || '',
        nombre: `Cable de acero (de ${p.nombre || 'proyecto'})`,
        meta: { grupo },
      });
    }
    // Snapshot del proyecto LIMPIO de equipo (si se restaura, vuelve como personal)
    const { grupoId: _g, enListaDe: _e, ...pLimpio } = p;
    await enviarAPapelera({
      uid: user.uid, tipo: 'proyecto',
      snapshot: JSON.parse(JSON.stringify({ ...pLimpio, compartidoCon: [], permisos: {}, supervisoresInfo: {} })),
      coleccionOriginal: 'proyectos', idOriginal: proyId,
      proyectoId: proyId, nombre: p.nombre || proyId,
      meta: { hijos: snapPuntos.size + snapCables.size + snapAcero.size, puntos: snapPuntos.size, fibras: snapCables.size, aceros: snapAcero.size, fotos: totalFotos },
    });
    const batch = writeBatch(db);
    batch.delete(doc(db, 'proyectos', proyId));
    snapPuntos.forEach(d => batch.delete(d.ref));
    snapCables.forEach(d => batch.delete(d.ref));
    snapAcero.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  const ejecutarBorradoEquipo = async (equipo, paraLlevar, paraBorrar) => {
    setBorrandoEquipo(true);
    try {
      for (const p of paraLlevar) await pasarAPersonal(p);
      for (const p of paraBorrar) await borrarProyectoAPapelera(p);
      await deleteDoc(doc(db, 'equipos', equipo.id));
      setModalBorrarEquipo(null);
      const partes = [];
      if (paraLlevar.length) partes.push(`${paraLlevar.length} proyecto${paraLlevar.length !== 1 ? 's' : ''} en tu lista personal`);
      if (paraBorrar.length) partes.push(`${paraBorrar.length} en tu papelera (15 días)`);
      setAlertData?.({ title: 'Equipo eliminado', message: partes.length ? `Quedaron: ${partes.join(' y ')}.` : `El equipo "${equipo.nombre}" fue eliminado.` });
    } catch (e) {
      console.error('Borrar equipo:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo completar el borrado. Revisa tu conexión e inténtalo de nuevo.' });
    }
    setBorrandoEquipo(false);
  };

  // ACEPTAR de la fase de selección: los no marcados se confirman uno por uno
  const aceptarSeleccionBorrado = () => {
    const m = modalBorrarEquipo;
    if (!m) return;
    const llevarTodo = [...m.llevar, ...m.sueltos.filter(x => x.checked).map(x => x.proy)];
    const noSel = m.sueltos.filter(x => !x.checked);
    if (noSel.length === 0) { ejecutarBorradoEquipo(m.equipo, llevarTodo, []); return; }
    setModalBorrarEquipo({ ...m, fase: 'confirmar', llevarFinal: llevarTodo, pendientes: noSel, idx: 0, aBorrar: [] });
  };

  const responderConfirmBorrado = (borrar) => {
    const m = modalBorrarEquipo;
    if (!m) return;
    const actual = m.pendientes[m.idx];
    const aBorrar = borrar ? [...m.aBorrar, actual.proy] : m.aBorrar;
    const llevarFinal = borrar ? m.llevarFinal : [...m.llevarFinal, actual.proy];
    if (m.idx + 1 < m.pendientes.length) {
      setModalBorrarEquipo({ ...m, idx: m.idx + 1, aBorrar, llevarFinal });
    } else {
      ejecutarBorradoEquipo(m.equipo, llevarFinal, aBorrar);
    }
  };

  const copiarCodigo = (codigo) => {
    navigator.clipboard?.writeText(codigo).catch(() => {});
    setCopiado(true); setTimeout(() => setCopiado(false), 2000);
  };

  const totalPendientesEquipo = equiposPropios.reduce((s, e) => s + (e.pendientes?.length || 0), 0);
  const hayEquipos = equiposPropios.length > 0 || equiposUnido.length > 0;
  const card  = isDark ? 'bg-slate-800 border-slate-500'  : 'bg-white border-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const rowBg = isDark ? 'bg-slate-700/50' : 'bg-slate-100';
  const inputCls = `w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-orange-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-orange-400'}`;

  const commonProyectoProps = {
    isDark, muted, rowBg,
    onChat: (p) => { setChatAbierto(p); if (marcarChatLeido) marcarChatLeido(p.id); },
    onLista: verListaPuntos,
    onGPS: gpsProyecto,
    notificaciones: notificacionesSupervisados,
    // Bloque 3: proyectos del grupo
    onEditarProyecto: editarDesdeEquipo,
    onCompartirProyecto: (eq) => setModalProyecto({ tipo: 'compartir', equipo: eq }),
    onCrearProyecto: (eq) => { setNombreProyEquipo(''); setTipoProyEquipo('levantamiento'); setModoFotosProyEquipo('comprimido'); setModalProyecto({ tipo: 'crear', equipo: eq }); },
  };

  // ─── Sub-vista: detalle de punto ──────────────────────────────────────────
  if (puntoDetalle) {
    return (
      <VerDetalle
        datos={puntoDetalle.datos}
        proyectoActual={viendoLista}
        config={configPropietario || config}
        theme={theme}
        readOnly={true}
        esSupervision={true}
        proyectoId={viendoLista?.id}
        user={user}
        onVolver={() => setPuntoDetalle(null)}
        onEditar={() => {}}
        onEditarFotos={() => {}}
      />
    );
  }

  // ─── Sub-vista: lista de puntos ───────────────────────────────────────────
  if (viendoLista) {
    const filtrados = puntosSupervisados
      .sort((a, b) => parseInt(a.id) - parseInt(b.id))
      .filter(p => {
        if (!filtroPunto) return true;
        const b = filtroPunto.toLowerCase();
        return (p.datos?.numero || '').toLowerCase().includes(b) ||
               (p.datos?.pasivo || '').toLowerCase().includes(b);
      });

    return (
      <div className={`flex-1 flex flex-col overflow-hidden ${theme.bg} ${theme.text}`}>
        <div className={`${theme.header} px-4 py-3 flex items-center gap-3 border-b-2 ${theme.border} shrink-0`}>
          <button onClick={() => setViendoLista(null)} className={`p-2 rounded-xl border-2 ${theme.border} ${theme.bg} active:scale-95`}>
            <ArrowLeft size={20} className={theme.text} />
          </button>
          <div className="flex-1">
            <p className={`font-black text-sm uppercase truncate ${theme.text}`}>{viendoLista.nombre}</p>
            <p className={`text-[10px] ${muted}`}>{puntosSupervisados.length} puntos</p>
          </div>
        </div>
        <div className="px-3 pt-3 pb-2 shrink-0">
          <input type="text" placeholder="Buscar por item o pasivo..." value={filtroPunto} onChange={e => setFiltroPunto(e.target.value)}
            className={`w-full px-3 py-2 rounded-xl text-sm border-2 ${theme.border} ${theme.bg} ${theme.text} outline-none`} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {cargandoLista ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-orange-500" /></div>
          ) : filtrados.length === 0 ? (
            <p className={`text-center py-8 text-sm ${muted}`}>{filtroPunto ? 'Sin resultados' : 'Sin puntos'}</p>
          ) : filtrados.map(punto => {
            const datos = punto.datos || {};
            const totalFotos = (() => {
              const f = datos.fotos;
              if (!f) return 0;
              return Object.values(f).reduce((s, sec) => s + (sec ? Object.values(sec).filter(v => v && (v.url || v.thumb)).length : 0), 0);
            })();
            return (
              <div key={punto.id} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-2 rounded-xl px-3 py-2`}>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`text-[10px] ${muted}`}>ITEM:</span>
                    <span className={`text-xs font-black ${theme.text} truncate`}>{datos.numero || '-'}</span>
                  </div>
                  <div className={`w-px h-3 ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <span className={`text-[10px] ${muted}`}>PASIVO:</span>
                    <span className={`text-xs font-black ${theme.text} truncate`}>{datos.pasivo || '-'}</span>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black text-white ${totalFotos > 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                    <ImageIcon size={12} /><span>{totalFotos}</span>
                  </div>
                  <button onClick={() => setPuntoDetalle(punto)} className="p-1.5 rounded-lg border-2 border-slate-900 bg-white text-slate-900 active:scale-95">
                    <Info size={13} />
                  </button>
                  <button onClick={() => { if (onGPSProyecto) onGPSProyecto(viendoLista, puntosSupervisados, punto.coords); }}
                    className="p-1.5 rounded-lg bg-blue-600 text-white active:scale-95">
                    <MapPin size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Vista principal ──────────────────────────────────────────────────────
  return (
    <div className={`seccion-menu flex-1 flex flex-col overflow-hidden ${theme.bg} ${theme.text}`}>

      {/* Header */}
      <div className={`shrink-0 px-4 py-3 border-b-2 ${theme.border} ${theme.header} flex items-center gap-3`}>
        <button onClick={onVolver} className={`p-2 rounded-xl border-2 ${theme.border} ${theme.bg} active:scale-95 transition-all`}>
          <ArrowLeft size={20} className={theme.text} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Users size={20} className="text-brand-500" strokeWidth={2.5} />
          <h1 className="font-black text-base tracking-wide uppercase">Equipos</h1>
          {totalPendientesEquipo > 0 && (
            <span className="min-w-[20px] h-5 px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white">{totalPendientesEquipo}</span>
          )}
        </div>
        <button onClick={() => { setModal('crear'); setError(''); setNombreNuevo(''); }}
          className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center active:scale-95 transition-all">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {cargando ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-orange-500" /></div>
        ) : !hayEquipos ? (
          <div className="flex flex-col items-center gap-4 pt-8">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Users size={32} className="text-orange-500" strokeWidth={2} />
            </div>
            <div className="text-center">
              <p className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Aún no tenés equipos</p>
              <p className={`text-sm mt-1 ${muted}`}>Crea un equipo para trabajar con tu gente</p>
            </div>
            <div className="w-full flex flex-col gap-3 mt-2">
              <button onClick={() => { setModal('crear'); setError(''); setNombreNuevo(''); }}
                className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2">
                <Plus size={16} strokeWidth={3} /> CREAR EQUIPO
              </button>
              <button onClick={() => setScannerAbierto(true)}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 border-2 ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-700'}`}>
                <UserPlus size={16} strokeWidth={2.5} /> UNIRSE POR QR
              </button>
            </div>
          </div>
        ) : (
          <>
            {equiposPropios.length > 0 && (
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${muted}`}>Mis equipos</p>
                <div className="space-y-3">
                  {equiposPropios.map(eq => (
                    <EquipoCardPropio key={eq.id} equipo={eq} isDark={isDark} card={card} muted={muted} rowBg={rowBg}
                      expandido={!!expandido[eq.id]} onToggle={() => toggleExpand(eq)}
                      onCopiar={copiarCodigo} copiado={copiado} aprobando={aprobando}
                      onAprobar={handleAprobarMiembro} onRechazar={handleRechazarMiembro}
                      proyectos={proyectosEquipo[eq.id]} cargandoProyectos={!!cargandoProyectos[eq.id]}
                      uid={user?.uid} {...commonProyectoProps}
                      onRemoverMiembro={(eq2, m) => prepararSalida(eq2, m)}
                      onCopiarConfig={copiarConfigDe}
                      onInvitar={abrirInvitar}
                      onEliminarEquipo={prepararEliminarEquipo}
                    />
                  ))}
                </div>
              </div>
            )}

            {equiposUnido.length > 0 && (
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${muted}`}>Equipos en los que participo</p>
                <div className="space-y-3">
                  {equiposUnido.map(eq => (
                    <EquipoCardMiembro key={eq.id} equipo={eq} user={user} isDark={isDark} card={card} muted={muted} rowBg={rowBg}
                      expandido={!!expandido[eq.id]} onToggle={() => toggleExpand(eq)}
                      proyectos={proyectosEquipo[eq.id]} cargandoProyectos={!!cargandoProyectos[eq.id]}
                      {...commonProyectoProps}
                      onSalirEquipo={(eq2) => prepararSalida(eq2, null)}
                      onCopiarConfig={copiarConfigDe}
                    />
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setScannerAbierto(true)}
              className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 border-2 border-dashed ${isDark ? 'border-slate-400 text-slate-200' : 'border-slate-900 text-slate-900'}`}>
              <UserPlus size={14} strokeWidth={2.5} /> UNIRSE A UN EQUIPO POR QR
            </button>
          </>
        )}
      </div>

      {/* MODAL: crear proyecto en el equipo / compartir un proyecto mío */}
      {modalProyecto && (
        <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !guardandoProy && setModalProyecto(null)}>
          <div className={`rounded-2xl w-full max-w-sm shadow-2xl p-5 ${isDark ? 'bg-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            {modalProyecto.tipo === 'crear' ? (
              <>
                <h3 className={`font-black text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Nuevo proyecto en "{modalProyecto.equipo.nombre}"</h3>
                <p className={`text-[11px] mb-3 ${muted}`}>Vivirá en el equipo. Usa su botón EDITAR para llevarlo a tu lista personal.</p>
                <input
                  autoFocus
                  placeholder="Nombre del proyecto"
                  value={nombreProyEquipo}
                  onChange={e => setNombreProyEquipo(e.target.value)}
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-1.5 my-3">
                  {(perfilActivo === 'basico'
                    ? [['levantamiento', 'LEVANT.']]
                    : [['levantamiento', 'LEVANT.'], ['liquidacion', 'D. PRECO'], ['desbMecanica', 'D. MECÁNICA'], ['balanceada', 'BALANCEADA'], ['instalacionPostes', 'INST. POSTES']]).map(([v, l]) => (
                    <button key={v} onClick={() => setTipoProyEquipo(v)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black border-2 transition-colors ${tipoProyEquipo === v ? 'bg-slate-900 text-white border-slate-900' : isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${muted}`}>Calidad de fotos</p>
                <div className="flex gap-1.5 mb-3">
                  <button onClick={() => setModoFotosProyEquipo('comprimido')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black border-2 transition-colors ${modoFotosProyEquipo === 'comprimido' ? 'bg-slate-900 text-white border-slate-900' : isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                    COMPRIMIR
                  </button>
                  {perfilActivo !== 'basico' && user?.calidadFotos !== 'comprimidas' && (
                    <button onClick={() => setModoFotosProyEquipo('altaCalidad')}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black border-2 transition-colors ${modoFotosProyEquipo === 'altaCalidad' ? 'bg-slate-900 text-white border-slate-900' : isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                      ALTA CALIDAD
                    </button>
                  )}
                </div>
                <button
                  onClick={crearProyectoEnEquipo}
                  disabled={!nombreProyEquipo.trim() || guardandoProy}
                  className="w-full py-3 rounded-xl font-black text-sm bg-slate-900 text-white active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {guardandoProy ? <RefreshCw size={14} className="animate-spin" /> : null} CREAR PROYECTO
                </button>
              </>
            ) : (
              <>
                <h3 className={`font-black text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Compartir al equipo "{modalProyecto.equipo.nombre}"</h3>
                <p className={`text-[11px] mb-3 ${muted}`}>
                  {modalProyecto.equipo.ownerId === user?.uid
                    ? 'El proyecto quedará en el equipo y seguirá siendo tuyo (se mantiene en tu lista).'
                    : 'El proyecto se TRANSFIERE al equipo: el dominio pasa al creador y tú quedas como editor.'}
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {proyectosPropios.filter(p => !p.grupoId).length === 0 ? (
                    <p className={`text-xs text-center py-4 ${muted}`}>No tienes proyectos personales para compartir.</p>
                  ) : proyectosPropios.filter(p => !p.grupoId).map(p => (
                    <button key={p.id} onClick={() => compartirAlEquipo(p)} disabled={guardandoProy}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left active:scale-95 disabled:opacity-50 ${isDark ? 'border-slate-600 bg-slate-700/50' : 'border-slate-200 bg-slate-50'}`}>
                      <Folder size={13} className="text-orange-500 shrink-0" />
                      <span className={`text-xs font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{p.nombre}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button onClick={() => setModalProyecto(null)} disabled={guardandoProy} className={`w-full mt-3 py-2 rounded-xl text-[11px] font-bold ${muted}`}>CANCELAR</button>
          </div>
        </div>
      )}

      {/* MODAL: invitar al equipo (QR + enlace) — lo muestra el creador */}
      {modalInvitar && (
        <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0" onClick={() => setModalInvitar(null)}>
          <div className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 flex flex-col gap-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className={`text-base font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Invitar al equipo</p>
              <button onClick={() => setModalInvitar(null)} className={`p-2 rounded-xl ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><X size={16} /></button>
            </div>
            <p className={`text-sm font-black text-center -mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{modalInvitar.equipo.nombre}</p>
            <div className="bg-white rounded-2xl p-3 mx-auto shadow-inner border border-slate-200">
              {qrDataUrl
                ? <img src={qrDataUrl} alt="QR de invitación" className="w-52 h-52" />
                : <div className="w-52 h-52 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-orange-500" /></div>}
            </div>
            <p className={`text-[11px] text-center ${muted}`}>
              El invitado escanea el QR con "UNIRSE POR QR" (o la cámara del teléfono), o abre el enlace.
              Después apruebas su ingreso como EDITOR o SUPERVISOR.
            </p>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(linkInvitacion(modalInvitar.equipo.id)).catch(() => {}); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
                className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                {copiado ? <Check size={13} className="text-green-500" /> : <Copy size={13} />} COPIAR ENLACE
              </button>
              <button onClick={() => compartirInvitacion(modalInvitar.equipo)}
                className="flex-1 py-3 rounded-xl text-xs font-black bg-slate-900 text-white flex items-center justify-center gap-1.5 active:scale-95">
                <UserPlus size={13} strokeWidth={2.5} /> COMPARTIR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: confirmar solicitud de unirse (llegó por enlace o QR) */}
      {modalInvitacion && (
        <div className="fixed inset-0 z-[3100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
          <div className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 flex flex-col gap-4 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto">
              <Users size={28} className="text-orange-500" strokeWidth={2} />
            </div>
            <div>
              <p className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Unirse a "{modalInvitacion.nombre}"</p>
              <p className={`text-sm mt-1 ${muted}`}>Equipo de {modalInvitacion.ownerNombre || '—'}. Tu solicitud quedará pendiente hasta que el creador la apruebe.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModalInvitacion(null)} disabled={procesandoInvitacion}
                className={`flex-1 py-3 rounded-xl text-xs font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} disabled:opacity-40`}>
                CANCELAR
              </button>
              <button onClick={enviarSolicitudInvitacion} disabled={procesandoInvitacion}
                className="flex-1 py-3 rounded-xl text-xs font-black bg-slate-900 text-white disabled:opacity-40 flex items-center justify-center gap-1 active:scale-95">
                {procesandoInvitacion ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} SOLICITAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: eliminar equipo (selección de proyectos sueltos + confirmaciones) */}
      {modalBorrarEquipo && (
        <div className="fixed inset-0 z-[3200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
          <div className={`w-full max-w-sm rounded-3xl shadow-2xl p-6 flex flex-col gap-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            {borrandoEquipo ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <Loader2 size={26} className="animate-spin text-red-500" />
                <p className={`text-xs font-bold ${muted}`}>Eliminando equipo…</p>
              </div>
            ) : modalBorrarEquipo.fase === 'seleccion' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <Trash2 size={20} className="text-red-500" strokeWidth={2.5} />
                  </div>
                  <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>¿Eliminar "{modalBorrarEquipo.equipo.nombre}"?</p>
                </div>
                {modalBorrarEquipo.llevar.length > 0 && (
                  <p className={`text-[11px] ${muted}`}>
                    {modalBorrarEquipo.llevar.length} proyecto{modalBorrarEquipo.llevar.length !== 1 ? 's' : ''} que ya está{modalBorrarEquipo.llevar.length !== 1 ? 'n' : ''} en tu lista personal se conservará{modalBorrarEquipo.llevar.length !== 1 ? 'n' : ''} ahí.
                  </p>
                )}
                {modalBorrarEquipo.sueltos.length > 0 ? (
                  <>
                    <p className={`text-[11px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      Estos proyectos existen SOLO en el equipo. Marca los que quieras llevar a tu lista personal:
                    </p>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {modalBorrarEquipo.sueltos.map((sx, i) => (
                        <button key={sx.proy.id}
                          onClick={() => setModalBorrarEquipo(m => ({ ...m, sueltos: m.sueltos.map((y, j) => j === i ? { ...y, checked: !y.checked } : y) }))}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left active:scale-[0.98] ${isDark ? 'border-slate-600 bg-slate-700/50' : 'border-slate-300 bg-slate-50'}`}>
                          <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${sx.checked ? 'bg-slate-900 border-slate-900' : isDark ? 'border-slate-500' : 'border-slate-400'}`}>
                            {sx.checked && <Check size={13} className="text-white" strokeWidth={3} />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-xs font-black truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{sx.proy.nombre}</span>
                            <span className={`block text-[10px] ${muted}`}>{sx.puntos} punto{sx.puntos !== 1 ? 's' : ''} · {sx.fotos} foto{sx.fotos !== 1 ? 's' : ''}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={`text-[11px] ${muted}`}>No hay proyectos que existan solo en el equipo.</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setModalBorrarEquipo(null)}
                    className={`flex-1 py-3 rounded-xl text-xs font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    CANCELAR
                  </button>
                  <button onClick={aceptarSeleccionBorrado}
                    className="flex-1 py-3 rounded-xl text-xs font-black bg-red-600 text-white active:scale-95">
                    ACEPTAR
                  </button>
                </div>
              </>
            ) : (
              (() => {
                const px = modalBorrarEquipo.pendientes[modalBorrarEquipo.idx];
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                        <AlertTriangle size={20} className="text-red-500" strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>¿Borrar "{px.proy.nombre}"?</p>
                        <p className={`text-[10px] ${muted}`}>{px.puntos} punto{px.puntos !== 1 ? 's' : ''} · {px.fotos} foto{px.fotos !== 1 ? 's' : ''} · irá a tu papelera del menú (15 días)</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => responderConfirmBorrado(false)}
                        className={`flex-1 py-3 rounded-xl text-[11px] font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                        NO, LLEVARLO A MI LISTA
                      </button>
                      <button onClick={() => responderConfirmBorrado(true)}
                        className="flex-1 py-3 rounded-xl text-[11px] font-black bg-red-600 text-white active:scale-95">
                        SÍ, BORRAR
                      </button>
                    </div>
                    {modalBorrarEquipo.pendientes.length > 1 && (
                      <p className={`text-[10px] text-center ${muted}`}>{modalBorrarEquipo.idx + 1} de {modalBorrarEquipo.pendientes.length}</p>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Escáner QR para unirse */}
      {scannerAbierto && <ScannerQR onResult={onQREscaneado} onClose={() => setScannerAbierto(false)} />}

      {/* Chat bitácora */}
      {chatAbierto && (
        <div className="fixed inset-0 z-[3000]">
          <ChatBitacora
            proyecto={chatAbierto}
            user={user}
            config={config}
            theme={theme}
            onClose={() => { if (marcarChatLeido) marcarChatLeido(chatAbierto.id); setChatAbierto(null); }}
            onRead={() => marcarChatLeido && marcarChatLeido(chatAbierto.id)}
          />
        </div>
      )}

      {/* ─── Modales ─────────────────────────────────────────────────────────── */}
      {/* Modal confirmación salir / remover */}
      {(modalSalir || cargandoSalir) && (
        <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
          <div className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            {cargandoSalir ? (
              <div className="p-8 flex justify-center"><Loader2 size={24} className="animate-spin text-orange-500" /></div>
            ) : modalSalir && (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} className="text-red-500" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {modalSalir.miembro ? `¿Remover a ${modalSalir.miembro.nombre}?` : `¿Salir de "${modalSalir.equipo.nombre}"?`}
                    </p>
                    <p className={`text-[10px] ${muted}`}>Esta acción no se puede deshacer</p>
                  </div>
                </div>

                {modalSalir.propios.length > 0 && (
                  <div className={`rounded-xl p-3 ${isDark ? 'bg-amber-950/30 border border-amber-900/30' : 'bg-amber-50 border border-amber-200'}`}>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">
                      Se copiará{modalSalir.propios.length > 1 ? 'n' : ''} {modalSalir.propios.length} proyecto{modalSalir.propios.length > 1 ? 's' : ''} al creador del equipo (tus originales se conservan):
                    </p>
                    {modalSalir.propios.map(p => (
                      <p key={p.id} className={`text-xs font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>· {p.nombre}</p>
                    ))}
                  </div>
                )}

                {modalSalir.conAcceso.length > 0 && (
                  <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${muted}`}>
                      Accesos que se perderán:
                    </p>
                    {modalSalir.conAcceso.map(p => (
                      <p key={p.id} className={`text-xs font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>· {p.nombre}</p>
                    ))}
                  </div>
                )}

                {modalSalir.propios.length === 0 && modalSalir.conAcceso.length === 0 && (
                  <p className={`text-sm ${muted}`}>No tenés proyectos ni accesos en este equipo.</p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setModalSalir(null)} disabled={procesandoSalir}
                    className={`flex-1 py-3 rounded-xl text-xs font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} disabled:opacity-40`}>
                    CANCELAR
                  </button>
                  <button onClick={confirmarSalida} disabled={procesandoSalir}
                    className="flex-1 py-3 rounded-xl text-xs font-black bg-red-500 text-white disabled:opacity-40 flex items-center justify-center gap-1 active:scale-95">
                    {procesandoSalir ? <Loader2 size={13} className="animate-spin" /> : null}
                    {modalSalir.miembro ? 'REMOVER' : 'SALIR'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
          <div className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>

            {modal === 'crear' && (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className={`text-base font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Crear equipo</p>
                  <button onClick={() => setModal(null)} className={`p-2 rounded-xl ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><X size={16} /></button>
                </div>
                <input className={inputCls} placeholder="Nombre del equipo *" value={nombreNuevo} onChange={e => { setNombreNuevo(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleCrear()} autoFocus />
                {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setModal(null)} className={`flex-1 py-3 rounded-xl text-xs font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>CANCELAR</button>
                  <button onClick={handleCrear} disabled={!nombreNuevo.trim() || guardando} className="flex-1 py-3 rounded-xl text-xs font-black bg-slate-900 text-white disabled:opacity-40 flex items-center justify-center gap-1 active:scale-95">
                    {guardando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} CREAR
                  </button>
                </div>
              </div>
            )}

            {modal === 'creado' && equipoCreado && (
              <div className="p-6 flex flex-col gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
                  <Check size={28} className="text-green-500" strokeWidth={2.5} />
                </div>
                <div>
                  <p className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>¡Equipo creado!</p>
                  <p className={`text-sm mt-1 ${muted}`}>{equipoCreado.nombre}</p>
                </div>
                <p className={`text-[11px] ${muted}`}>Invita miembros mostrándoles el QR o enviándoles el enlace.</p>
                <button onClick={() => { setModal(null); abrirInvitar(equipoCreado); }}
                  className="w-full py-3 rounded-xl text-xs font-black bg-slate-900 text-white active:scale-95 flex items-center justify-center gap-1.5">
                  <UserPlus size={13} strokeWidth={2.5} /> INVITAR MIEMBROS
                </button>
                <button onClick={() => setModal(null)} className={`w-full py-3 rounded-xl text-xs font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} active:scale-95`}>ENTENDIDO</button>
              </div>
            )}

            {modal === 'solicitado' && (
              <div className="p-6 flex flex-col gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto">
                  <UserPlus size={28} className="text-orange-500" strokeWidth={2} />
                </div>
                <div>
                  <p className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Solicitud enviada</p>
                  <p className={`text-sm mt-1 ${muted}`}>Pendiente de aprobación por el creador del equipo.</p>
                </div>
                <button onClick={() => setModal(null)} className="w-full py-3 rounded-xl text-xs font-black bg-slate-900 text-white active:scale-95">ENTENDIDO</button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
