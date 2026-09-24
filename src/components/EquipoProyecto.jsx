import React, { useEffect, useRef, useState } from 'react';
import { Users, X, Trash2, Share2, QrCode } from 'lucide-react';
import { doc, updateDoc, deleteField, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import ChatBitacora from './ChatBitacora';
import { claseBotonCabecera } from '../utils/cabeceras';
import { ROL_TEXTO, rolEnProyecto, miembrosDelProyecto, linkInvitacion } from '../utils/equipoProyecto';
import { crearInvitacion, anularInvitacion, escucharInvitacionesAbiertas, traspasarProyecto } from '../services/invitaciones';
import { avisarAgregado } from '../services/amigos';

const COLOR_ROL = {
  dueno: 'bg-slate-900 text-white',
  editor: 'bg-blue-600 text-white',
  supervisor: 'bg-blue-100 text-blue-700',
};

const fechaCorta = (iso) => {
  try {
    return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

// EQUIPO de un proyecto (paso 3a del rediseño de equipos; CONTEXTO.md): quién es miembro
// y con qué rol. Solo el dueño invita, cambia roles, quita y anula invitaciones sin usar.
// Debajo, la bitácora, como antes.
//
// Desde el paso 5 los miembros viven solo en `miembros` / `miembrosUids`, con su nombre. Los
// campos viejos (`compartidoCon`, `permisos`, `supervisoresInfo`) ya no se escriben: solo
// se limpian al cambiar el rol de alguien o al quitarlo.
const EquipoProyecto = ({ proyecto, user, config, theme, amigos = [], setAlertData, setConfirmData, onClose }) => {
  const soyDueno = rolEnProyecto(proyecto, user?.uid) === 'dueno';
  const miembros = miembrosDelProyecto(proyecto);
  const [invitaciones, setInvitaciones] = useState([]);
  const [qr, setQr] = useState(null); // { codigo, rol, imagen }
  const [ocupado, setOcupado] = useState(false);
  const [nuevoDueno, setNuevoDueno] = useState('');
  // El QR sirve solo mientras está en pantalla: si se sale de EQUIPO con uno abierto,
  // se cierra igual.
  const qrAbierto = useRef(null);

  useEffect(() => {
    if (!soyDueno || !user?.uid) return undefined;
    return escucharInvitacionesAbiertas(proyecto.id, user.uid, setInvitaciones);
  }, [soyDueno, proyecto.id, user?.uid]);

  useEffect(() => () => {
    if (qrAbierto.current) anularInvitacion(qrAbierto.current, 'cerrada').catch(() => {});
  }, []);

  const nombreDe = (uid) => (String(uid) === String(proyecto.ownerId)
    ? (proyecto.ownerNombre || 'Dueño')
    : (proyecto.miembros?.[uid]?.nombre || proyecto.supervisoresInfo?.[uid]?.nombre || 'Miembro'));

  const refProyecto = () => doc(db, 'proyectos', String(proyecto.id));

  const avisarFallo = (titulo, e) => {
    console.error(titulo, e);
    setAlertData?.({ title: titulo, message: 'Revisa la conexión e inténtalo de nuevo.' });
  };

  const invitarPorLink = async (rol) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const inv = await crearInvitacion({ proyecto, rol, tipo: 'link', user, config });
      const link = linkInvitacion(inv.codigo, window.location.origin);
      const texto = `Te invito a ser ${ROL_TEXTO[rol].toUpperCase()} del proyecto "${proyecto.nombre}" en Kipo: ${link}`;
      if (navigator.share) {
        // Si cancela el menú de compartir, la invitación queda en "sin usar" y se anula ahí.
        try { await navigator.share({ text: texto }); } catch { /* canceló */ }
      } else {
        await navigator.clipboard?.writeText(texto);
        setAlertData?.({ title: 'Link copiado', message: 'Pégalo en WhatsApp. Sirve una sola vez.' });
      }
    } catch (e) { avisarFallo('No se pudo crear la invitación', e); }
    setOcupado(false);
  };

  const mostrarQR = async (rol) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const inv = await crearInvitacion({ proyecto, rol, tipo: 'qr', user, config });
      const QRCode = (await import('qrcode')).default;
      const imagen = await QRCode.toDataURL(linkInvitacion(inv.codigo, window.location.origin),
        { width: 480, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
      qrAbierto.current = inv.codigo;
      setQr({ codigo: inv.codigo, rol, imagen });
    } catch (e) { avisarFallo('No se pudo crear el QR', e); }
    setOcupado(false);
  };

  const cerrarQR = () => {
    if (qr) anularInvitacion(qr.codigo, 'cerrada').catch(e => console.error('Cerrar QR:', e));
    qrAbierto.current = null;
    setQr(null);
  };

  const anular = (inv) => {
    if (qr?.codigo === inv.codigo) { cerrarQR(); return; }
    anularInvitacion(inv.codigo).catch(e => avisarFallo('No se pudo anular la invitación', e));
  };

  const cambiarRol = async (uid, rol) => {
    try {
      // El rol vive solo en `miembros`. Si la persona venía del reflejo viejo, se la saca
      // de ahí: con `permisos` puesto, las reglas viejas le seguirían dando el de antes.
      await updateDoc(refProyecto(), {
        [`miembros.${uid}.rol`]: rol,
        miembrosUids: arrayUnion(uid),
        compartidoCon: arrayRemove(uid),
        [`permisos.${uid}`]: deleteField(),
      });
    } catch (e) { avisarFallo('No se pudo cambiar el rol', e); }
  };

  const quitar = (uid) => setConfirmData?.({
    title: 'Quitar del proyecto',
    message: `${nombreDe(uid)} dejará de ver "${proyecto.nombre}" hasta que lo vuelvas a invitar. No se borra nada de lo que hizo.`,
    actionText: 'QUITAR',
    theme,
    onConfirm: async () => {
      setConfirmData(null);
      try {
        await updateDoc(refProyecto(), {
          [`miembros.${uid}`]: deleteField(),
          miembrosUids: arrayRemove(uid),
          compartidoCon: arrayRemove(uid),
          [`permisos.${uid}`]: deleteField(),
          [`supervisoresInfo.${uid}`]: deleteField(),
          enListaDe: arrayRemove(uid),
        });
      } catch (e) { avisarFallo('No se pudo quitar', e); }
    },
  });

  // Amigos que todavía no están en el proyecto: el dueño los suma directo, sin link ni
  // aceptación (paso 3b). Por eso la amistad pide consentimiento de los dos.
  const amigosFuera = amigos.filter(a => !miembros.some(m => m.uid === String(a.uid)));

  const agregarAmigo = async (amigo, rol) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await updateDoc(refProyecto(), {
        [`miembros.${amigo.uid}`]: { rol, desde: new Date().toISOString(), por: user.uid, nombre: amigo.nombre || '' },
        miembrosUids: arrayUnion(amigo.uid),
      });
      // El aviso no frena nada: si falla, el amigo igual quedó adentro y ve el proyecto.
      avisarAgregado({
        para: amigo.uid, proyecto, rol, deUid: user.uid,
        deNombre: config?.nombrePersonal || user.email?.split('@')[0] || '',
      }).catch(e => console.error('Aviso de agregado:', e));
    } catch (e) { avisarFallo('No se pudo agregar', e); }
    setOcupado(false);
  };

  // Pasar el proyecto (paso 3c): solo a alguien que ya es miembro. Lo hace el servidor.
  const candidatosDueno = miembros.filter(m => m.rol !== 'dueno');

  const pasar = () => {
    if (!nuevoDueno) return;
    const nombre = nombreDe(nuevoDueno);
    setConfirmData?.({
      title: 'Pasar el proyecto',
      message: `"${proyecto.nombre}" pasará a ser de ${nombre}: podrá borrarlo, invitar y cambiar roles, y tú quedarás como editor. No se copia nada, y las invitaciones sin usar se anulan. ¿Continuar?`,
      actionText: 'PASAR',
      theme,
      onConfirm: async () => {
        setConfirmData(null);
        setOcupado(true);
        try {
          const r = await traspasarProyecto(proyecto.id, nuevoDueno);
          setNuevoDueno('');
          setAlertData?.({
            title: 'Proyecto pasado',
            message: `Ahora "${r.proyectoNombre}" es de ${nombre}. Tú sigues como editor.`
              + (r.agregados ? ` Se le sumaron ${r.agregados} material(es) a su catálogo de ferretería.` : '')
              + (r.sinOrigen ? ` Ojo: ${r.sinOrigen} material(es) de la obra no se pudieron pasar a su catálogo.` : '')
              + (r.completo === false ? ' Faltó anular las invitaciones sin usar o avisarle: avísale al administrador.' : ''),
          });
        } catch (e) {
          console.error('Pasar el proyecto:', e);
          setAlertData?.({ title: 'No se pudo pasar el proyecto', message: e?.message || 'Revisa la conexión e inténtalo de nuevo.' });
        }
        setOcupado(false);
      },
    });
  };

  const tituloSeccion = `text-xs font-black ${theme.text} uppercase tracking-wider`;
  const botonInvitar = `flex-1 h-9 rounded-lg border-2 ${theme.border} ${theme.text} text-[11px] font-black tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40`;

  return (
    <div className={`fixed inset-0 z-[300] ${theme.card} flex flex-col`}>

      {/* Encabezado */}
      <div className={`${theme.header} px-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Users size={18} className="text-purple-600" />
          </div>
          <div className="min-w-0">
            <h3 className={`font-black text-lg ${theme.text} uppercase`}>Equipo</h3>
            <p className={`text-xs ${theme.textSec} font-medium truncate`}>{proyecto.nombre}</p>
          </div>
        </div>
        <button onClick={onClose} className={claseBotonCabecera(theme)} title="Cerrar">
          <X size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* Miembros, invitar e invitaciones sin usar (arriba, con su propio scroll) */}
      <div className={`shrink-0 max-h-[55vh] overflow-y-auto px-4 py-3 space-y-4 border-b-2 ${theme.border}`}>
        <div className="space-y-2">
          <h4 className={tituloSeccion}>Miembros</h4>
          {miembros.map(m => {
            const esYo = String(m.uid) === String(user?.uid);
            const editable = soyDueno && m.rol !== 'dueno';
            return (
              <div key={m.uid} className={`${theme.card} border-2 ${theme.border} rounded-xl px-3 py-1.5 flex items-center gap-2`}>
                <p className={`flex-1 min-w-0 text-sm font-black ${theme.text} truncate`}>
                  {nombreDe(m.uid)}{esYo ? ' (tú)' : ''}
                </p>
                {editable ? (
                  <select
                    value={m.rol}
                    onChange={(e) => cambiarRol(m.uid, e.target.value)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-black border-0 shrink-0 ${COLOR_ROL[m.rol]}`}
                    title="Cambiar rol"
                  >
                    <option value="editor">EDITOR</option>
                    <option value="supervisor">SUPERVISOR</option>
                  </select>
                ) : (
                  <span className={`px-2 py-1.5 rounded-lg text-[10px] font-black shrink-0 ${COLOR_ROL[m.rol]}`}>
                    {ROL_TEXTO[m.rol].toUpperCase()}
                  </span>
                )}
                {editable && (
                  <button onClick={() => quitar(m.uid)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg active:scale-95 transition-all shrink-0" title="Quitar del proyecto">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {soyDueno && (
          <div className="space-y-2">
            <h4 className={tituloSeccion}>Invitar</h4>
            {['editor', 'supervisor'].map(rol => (
              <div key={rol} className="flex items-center gap-2">
                <span className={`w-24 shrink-0 text-[11px] font-black ${theme.text}`}>{ROL_TEXTO[rol].toUpperCase()}</span>
                <button onClick={() => invitarPorLink(rol)} disabled={ocupado} className={botonInvitar}>
                  <Share2 size={14} /> LINK
                </button>
                <button onClick={() => mostrarQR(rol)} disabled={ocupado} className={botonInvitar}>
                  <QrCode size={14} /> QR
                </button>
              </div>
            ))}
            <p className={`text-[10px] ${theme.textSec}`}>
              El link sirve una sola vez. El QR sirve mientras lo tengas abierto en pantalla.
            </p>
          </div>
        )}

        {soyDueno && amigosFuera.length > 0 && (
          <div className="space-y-2">
            <h4 className={tituloSeccion}>Agregar un amigo</h4>
            {amigosFuera.map(a => (
              <div key={a.uid} className={`border-2 ${theme.border} rounded-xl px-3 py-1.5 flex items-center gap-2`}>
                <p className={`flex-1 min-w-0 text-sm font-black ${theme.text} truncate`}>{a.nombre || 'Amigo'}</p>
                <button onClick={() => agregarAmigo(a, 'editor')} disabled={ocupado}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black bg-blue-600 text-white active:scale-95 shrink-0 disabled:opacity-40">
                  + EDITOR
                </button>
                <button onClick={() => agregarAmigo(a, 'supervisor')} disabled={ocupado}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black bg-blue-100 text-blue-700 active:scale-95 shrink-0 disabled:opacity-40">
                  + SUPERVISOR
                </button>
              </div>
            ))}
            <p className={`text-[10px] ${theme.textSec}`}>Entra al instante, sin link, y le aparece un aviso al abrir Kipo.</p>
          </div>
        )}

        {soyDueno && invitaciones.length > 0 && (
          <div className="space-y-2">
            <h4 className={tituloSeccion}>Invitaciones sin usar</h4>
            {invitaciones.map(inv => (
              <div key={inv.codigo} className={`border-2 border-dashed ${theme.border} rounded-xl px-3 py-1.5 flex items-center gap-2`}>
                <p className={`flex-1 min-w-0 text-xs font-bold ${theme.text} truncate`}>
                  {ROL_TEXTO[inv.rol] || inv.rol} · {inv.tipo === 'qr' ? 'QR' : 'link'} · {fechaCorta(inv.creada)}
                </p>
                <button onClick={() => anular(inv)} className="text-[10px] font-black text-red-600 px-2 py-1 rounded-lg border-2 border-red-600 active:scale-95 shrink-0">
                  ANULAR
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pasar el proyecto: al final, porque es lo más drástico (paso 3c) */}
        {soyDueno && candidatosDueno.length > 0 && (
          <div className="space-y-2">
            <h4 className={tituloSeccion}>Pasar el proyecto</h4>
            <div className="flex items-center gap-2">
              <select
                value={nuevoDueno}
                onChange={(e) => setNuevoDueno(e.target.value)}
                className={`flex-1 min-w-0 h-9 rounded-lg border-2 ${theme.border} ${theme.card} ${theme.text} text-xs font-bold px-2`}
              >
                <option value="">Elegir a quién…</option>
                {candidatosDueno.map(m => <option key={m.uid} value={m.uid}>{nombreDe(m.uid)}</option>)}
              </select>
              <button onClick={pasar} disabled={!nuevoDueno || ocupado}
                className="h-9 px-3 rounded-lg bg-red-600 text-white text-[11px] font-black tracking-widest active:scale-95 disabled:opacity-40 shrink-0">
                PASAR
              </button>
            </div>
            <p className={`text-[10px] ${theme.textSec}`}>
              El nuevo dueño podrá borrar el proyecto, invitar y cambiar roles. Tú quedarás como editor. No se copia nada: la obra sigue siendo la misma.
            </p>
          </div>
        )}
      </div>

      {/* Bitácora (abajo) */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ChatBitacora proyectoId={proyecto.id} user={user} theme={theme} esCompartido={false} config={config} />
      </div>

      {/* QR a pantalla completa: se escanea desde Kipo (PROYECTOS → UNIRME) o con la cámara */}
      {qr && (
        <div className="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center p-4" onClick={cerrarQR}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Invitación a {ROL_TEXTO[qr.rol].toUpperCase()}</p>
            <p className="text-base font-black text-slate-900 mb-3 truncate">{proyecto.nombre}</p>
            <img src={qr.imagen} alt="QR de invitación" className="w-full max-w-[320px] mx-auto" />
            <p className="text-[11px] text-slate-500 mt-3">
              Que lo escaneen desde Kipo, en PROYECTOS → UNIRME, o con la cámara del teléfono. Al cerrarlo deja de servir.
            </p>
            <button onClick={cerrarQR} className="mt-4 w-full py-3 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest active:scale-95">
              CERRAR QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipoProyecto;
