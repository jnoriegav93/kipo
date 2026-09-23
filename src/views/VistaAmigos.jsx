import React, { useMemo, useState } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import { claseBotonCabecera, claseCabecera } from '../utils/cabeceras';
import { coincidencias } from '../utils/amigos';
import { enviarSolicitud, aceptarSolicitud, borrarAmistad } from '../services/amigos';

// AMIGOS (paso 3b del rediseño de equipos; CONTEXTO.md, "Amigos"). Reemplaza a EQUIPOS
// en el menú. A un amigo el dueño lo puede agregar directo a un proyecto, sin link ni
// aceptación; por eso la amistad es mutua y con consentimiento: uno manda la solicitud
// y el otro la acepta. Borrarla también es mutuo, y no saca a nadie de ningún proyecto.
// Los equipos de antes siguen a un toque, abajo, hasta el paso 5.
const VistaAmigos = ({
  theme, user, config, proyectos, amistades, notifEquipos = 0,
  onVolver, onAbrirEquipos, setAlertData, setConfirmData,
}) => {
  const { amigos, recibidas, enviadas } = amistades;
  const miNombre = config?.nombrePersonal || user?.email?.split('@')[0] || '';
  const [ocupado, setOcupado] = useState(null);
  const personas = useMemo(
    () => coincidencias(proyectos, user?.uid, amistades).filter(p => p.relacion === 'libre'),
    [proyectos, user?.uid, amistades]
  );

  const hacer = async (clave, accion, titulo) => {
    if (ocupado) return;
    setOcupado(clave);
    try { await accion(); } catch (e) {
      console.error(titulo, e);
      setAlertData?.({ title: titulo, message: 'Revisa la conexión e inténtalo de nuevo.' });
    }
    setOcupado(null);
  };

  const agregar = (p) => hacer(p.uid,
    () => enviarSolicitud({ yo: user.uid, miNombre, otro: p.uid, otroNombre: p.nombre }),
    'No se pudo enviar la solicitud');
  const aceptar = (s) => hacer(s.id, () => aceptarSolicitud({ id: s.id, yo: user.uid, miNombre }), 'No se pudo aceptar');
  const quitarSolicitud = (s, titulo) => hacer(s.id, () => borrarAmistad(s.id), titulo);
  const eliminar = (a) => setConfirmData?.({
    title: 'Eliminar amigo',
    message: `${a.nombre || 'Esta persona'} y tú dejarán de ser amigos. No sale de ningún proyecto: eso se hace desde el EQUIPO de cada proyecto.`,
    actionText: 'ELIMINAR',
    theme,
    onConfirm: () => { setConfirmData(null); quitarSolicitud(a, 'No se pudo eliminar'); },
  });

  const tarjeta = `${theme.card} border-2 ${theme.border} rounded-xl p-4`;
  const titulo = `text-xs font-black ${theme.text} uppercase tracking-wider opacity-70 mb-2`;
  const fila = `flex items-center gap-2 py-2 border-b last:border-0 ${theme.border}`;
  const nombre = `flex-1 min-w-0 text-sm font-black ${theme.text} truncate`;
  const boton = 'px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shrink-0 disabled:opacity-40';
  const vacio = `text-xs ${theme.textSec}`;

  return (
    <div className={`seccion-menu flex-1 ${theme.bg} flex flex-col overflow-hidden`}>
      <div className={claseCabecera(theme)}>
        <button onClick={onVolver} className={claseBotonCabecera(theme)} title="Volver">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <span className={`font-black ${theme.text} text-lg uppercase`}>Amigos</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {recibidas.length > 0 && (
          <div className={`${tarjeta} border-orange-500`}>
            <h3 className={titulo}>Te invitaron a ser su amigo</h3>
            {recibidas.map(s => (
              <div key={s.id} className={fila}>
                <p className={nombre}>{s.nombre || 'Alguien'}</p>
                <button onClick={() => quitarSolicitud(s, 'No se pudo rechazar')} disabled={!!ocupado}
                  className={`${boton} border-2 ${theme.border} ${theme.text}`}>Rechazar</button>
                <button onClick={() => aceptar(s)} disabled={!!ocupado} className={`${boton} bg-green-600 text-white`}>Aceptar</button>
              </div>
            ))}
          </div>
        )}

        <div className={tarjeta}>
          <h3 className={titulo}>Mis amigos</h3>
          {amigos.length === 0 ? (
            <p className={vacio}>Todavía no tienes amigos. A un amigo lo puedes sumar a tus proyectos sin mandarle un link.</p>
          ) : amigos.map(a => (
            <div key={a.id} className={fila}>
              <p className={nombre}>{a.nombre || 'Amigo'}</p>
              <button onClick={() => eliminar(a)} disabled={!!ocupado} className={`${boton} border-2 border-red-600 text-red-600`}>Eliminar</button>
            </div>
          ))}
        </div>

        {enviadas.length > 0 && (
          <div className={tarjeta}>
            <h3 className={titulo}>Solicitudes que enviaste</h3>
            {enviadas.map(s => (
              <div key={s.id} className={fila}>
                <p className={nombre}>{s.nombre || 'Alguien'}</p>
                <span className={`text-[10px] font-bold ${theme.textSec} shrink-0`}>esperando</span>
                <button onClick={() => quitarSolicitud(s, 'No se pudo cancelar')} disabled={!!ocupado}
                  className={`${boton} border-2 ${theme.border} ${theme.text}`}>Cancelar</button>
              </div>
            ))}
          </div>
        )}

        <div className={tarjeta}>
          <h3 className={titulo}>Personas con las que coincides</h3>
          {personas.length === 0 ? (
            <p className={vacio}>Aquí aparece la gente con la que compartes algún proyecto.</p>
          ) : personas.map(p => (
            <div key={p.uid} className={fila}>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black ${theme.text} truncate`}>{p.nombre || 'Sin nombre'}</p>
                <p className={`text-[10px] ${theme.textSec} truncate`}>en {p.proyectos.join(', ')}</p>
              </div>
              <button onClick={() => agregar(p)} disabled={!!ocupado} className={`${boton} bg-slate-900 text-white`}>Agregar a amigos</button>
            </div>
          ))}
        </div>

        {onAbrirEquipos && (
          <div className={tarjeta}>
            <h3 className={titulo}>Equipos (anterior)</h3>
            <p className={`${vacio} mb-3`}>
              Los equipos de antes siguen aquí mientras pasamos a los proyectos con miembros.
            </p>
            <button onClick={onAbrirEquipos}
              className={`relative w-full py-2.5 rounded-xl border-2 ${theme.border} ${theme.text} text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95`}>
              <Users size={14} /> Abrir equipos
              {notifEquipos > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                  {notifEquipos > 9 ? '9+' : notifEquipos}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VistaAmigos;
