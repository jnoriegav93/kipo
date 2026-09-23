import React, { useEffect, useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { ROL_TEXTO, estadoInvitacion } from '../utils/equipoProyecto';
import { leerInvitacion, aceptarInvitacion } from '../services/invitaciones';

const MENSAJE = {
  inexistente: 'Esta invitación no existe. Revisa que el link esté completo, o pide uno nuevo.',
  usada: 'Esta invitación ya se usó: cada link sirve una sola vez. Pide uno nuevo.',
  anulada: 'Esta invitación ya no está disponible. Pide una nueva.',
  vencida: 'Este QR ya venció. Pide que te muestren uno nuevo.',
  propia: 'Esta invitación la creaste tú. Compártela con la persona que quieras sumar.',
  error: 'No se pudo leer la invitación. Revisa la conexión e inténtalo de nuevo.',
};

// Aceptar una invitación a un proyecto (paso 3a del rediseño de equipos). Muestra quién
// invita, a qué proyecto y con qué rol; aceptar lo hace la función del servidor, porque
// el teléfono no se puede sumar solo a un proyecto.
const ModalAceptarInvitacion = ({ codigo, user, theme, onCerrar, onAceptada }) => {
  const [inv, setInv] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const [aceptando, setAceptando] = useState(false);

  useEffect(() => {
    let vivo = true;
    leerInvitacion(codigo)
      .then((datos) => {
        if (!vivo) return;
        setInv(datos);
        const e = estadoInvitacion(datos, Date.now());
        setEstado(e === 'abierta' && datos?.deUid === user?.uid ? 'propia' : e);
      })
      .catch((err) => {
        console.error('Leer invitación:', err);
        if (vivo) setEstado('error');
      });
    return () => { vivo = false; };
  }, [codigo, user?.uid]);

  const aceptar = async () => {
    setAceptando(true);
    try {
      const r = await aceptarInvitacion(codigo);
      onAceptada?.(r);
    } catch (e) {
      console.error('Aceptar invitación:', e);
      // El servidor dice en `message` por qué no sirve: 'usada', 'vencida'…
      setEstado(MENSAJE[e?.message] ? e.message : 'error');
    }
    setAceptando(false);
  };

  const boton = 'flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[5000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`${theme.card} border-2 ${theme.border} rounded-2xl w-full max-w-sm p-5 text-center`}>
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
          <Users size={22} className="text-purple-600" />
        </div>

        {estado === 'cargando' && (
          <p className={`text-sm font-bold ${theme.textSec} flex items-center justify-center gap-2 py-4`}>
            <Loader2 size={16} className="animate-spin" /> Leyendo la invitación…
          </p>
        )}

        {estado === 'abierta' && inv && (<>
          <p className={`text-sm ${theme.textSec}`}>
            <span className={`font-black ${theme.text}`}>{inv.deNombre || 'Alguien'}</span> te invita a ser
          </p>
          <p className={`text-xl font-black ${theme.text} uppercase my-1`}>{ROL_TEXTO[inv.rol] || inv.rol}</p>
          <p className={`text-sm ${theme.textSec}`}>
            del proyecto <span className={`font-black ${theme.text}`}>{inv.proyectoNombre || ''}</span>
          </p>
          <div className="flex gap-2 mt-5">
            <button onClick={onCerrar} disabled={aceptando} className={`${boton} border-2 ${theme.border} ${theme.text}`}>
              CANCELAR
            </button>
            <button onClick={aceptar} disabled={aceptando} className={`${boton} bg-green-600 text-white flex items-center justify-center gap-1.5`}>
              {aceptando && <Loader2 size={14} className="animate-spin" />} ACEPTAR
            </button>
          </div>
        </>)}

        {MENSAJE[estado] && (<>
          <p className={`text-sm font-bold ${theme.text} py-2`}>{MENSAJE[estado]}</p>
          <button onClick={onCerrar} className={`${boton} w-full mt-3 bg-slate-900 text-white`}>CERRAR</button>
        </>)}
      </div>
    </div>
  );
};

export default ModalAceptarInvitacion;
