// src/components/Sidebar.jsx
import { useState, useEffect } from 'react';
import { Folder, Settings, LogOut, User, Shield, LogIn, Sun, Moon, Stethoscope, Users, Map, Satellite, ClipboardList, Trash2, Image } from 'lucide-react';

const ADMIN_UID = 'E8CaZVgP4eZnjnN3OKTVi7bmoJN2';


export default function Sidebar({
  isOpen,
  setMenuAbierto,
  isDark = false,
  setIsDark,
  user,
  vista,
  setVista,
  cerrarSesion,
  perfilLabel,
  config,
  totalProyectos,
  totalProyectosEditor,
  totalNotifProyectos = 0,
  notifEquipos = 0,
  mapStyle,
  fotoPuntosActivo = false,
  onToggleFotoPuntos,
  setMapStyle,
  adminReturnEmail = null,
  onVolverAAdmin,
}) {
  const [mostrarPasswordAdmin, setMostrarPasswordAdmin] = useState(false);
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [volviendoAdmin, setVolviendoAdmin] = useState(false);

  if (!isOpen) return null;

  const nombrePersonal = config?.nombrePersonal || '';
  const empresaPersonal = config?.empresaPersonal || '';
  const usuarioKipo = user?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const correoKipo = user?.email || '';
  const datosCompletos = !!(nombrePersonal && empresaPersonal);
  const inicial = (nombrePersonal || usuarioKipo).charAt(0).toUpperCase();

  // Colores según tema
  const panel    = isDark ? 'bg-slate-900 border-slate-700/40'  : 'bg-white border-slate-200';
  const header   = isDark ? 'border-slate-600'  : 'border-slate-900';
  const emailRow = isDark ? 'bg-slate-800 border border-slate-600' : 'bg-slate-50 border border-slate-900';
  const divider  = isDark ? 'bg-slate-600'  : 'bg-slate-900';
  const section  = isDark ? 'text-slate-400' : 'text-slate-900';
  const iconBox  = isDark ? 'bg-slate-800'   : 'bg-slate-100';
  const activeBox = 'bg-orange-500';
  const activeBg  = isDark ? 'bg-slate-800' : 'bg-slate-50';
  const hoverBg   = isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50';
  const labelActive   = isDark ? 'text-white'     : 'text-slate-900';
  const labelInactive = isDark ? 'text-slate-200' : 'text-slate-900';
  const iconColor     = isDark ? 'text-slate-300' : 'text-slate-900';
  const countActiveCls   = 'border-2 border-orange-500 text-orange-500';
  const countInactiveCls = isDark ? 'border-2 border-slate-500 text-slate-200' : 'border-2 border-slate-900 text-slate-900';
  const footerBorder  = isDark ? 'border-slate-600' : 'border-slate-900';

  const NavItem = ({ icon: Icon, label, vistaKey, count = 0, notif = 0 }) => {
    const active = vista === vistaKey;
    return (
      <button
        onClick={() => { setVista(vistaKey); setMenuAbierto(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl transition-all ${active ? activeBg : hoverBg}`}
      >
        {/* Icono con badge de notificación */}
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${active ? activeBox : iconBox}`}>
          <Icon size={18} strokeWidth={2.5} className={active ? 'text-white' : iconColor} />
          {notif > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-black text-white leading-none">
              {notif > 9 ? '9+' : notif}
            </span>
          )}
        </div>

        {/* Label */}
        <span className={`flex-1 text-left text-sm font-bold ${active ? labelActive : labelInactive}`}>
          {label}
        </span>

        {/* Count badge */}
        {count > 0 && (
          <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${active ? countActiveCls : countInactiveCls}`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  const Divider = () => <div className={`h-px mx-3 ${divider}`} />;

  return (
    <div className="fixed inset-0 z-[2000] flex">
      {/* Panel */}
      <div className={`w-4/5 max-w-xs h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200 border-r ${panel}`}>

        {/* Header */}
        <div className={`px-4 pb-4 border-b-2 ${header} shrink-0`} style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xl leading-none">{inicial}</span>
            </div>
            <div className="overflow-hidden flex-1">
              <p className={`text-sm leading-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span className="font-black">{nombrePersonal || usuarioKipo}</span>
                <span className="text-xs font-bold text-slate-400"> · {empresaPersonal || 'Sin empresa'}</span>
              </p>
              {perfilLabel && (
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mt-0.5">
                  Perfil {perfilLabel}
                </p>
              )}
            </div>
            {/* Dot incompleto */}
            {!datosCompletos && !adminReturnEmail && (
              <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
            )}
            {/* Botón volver al admin */}
            {adminReturnEmail && !mostrarPasswordAdmin && (
              <button
                onClick={() => setMostrarPasswordAdmin(true)}
                title={`Volver a ${adminReturnEmail}`}
                className="shrink-0 w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center active:scale-95 transition-all shadow-md"
              >
                <LogIn size={18} className="text-white" strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Password input para volver al admin */}
          {adminReturnEmail && mostrarPasswordAdmin && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-[10px] text-amber-500 font-bold">Ingresa tu contraseña de admin</p>
              <input
                type="password"
                value={passwordAdmin}
                onChange={e => setPasswordAdmin(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && passwordAdmin) {
                    setVolviendoAdmin(true);
                    onVolverAAdmin?.(passwordAdmin).finally(() => {
                      setVolviendoAdmin(false);
                      setPasswordAdmin('');
                      setMostrarPasswordAdmin(false);
                    });
                  }
                }}
                placeholder="Contraseña"
                className={`w-full rounded-xl px-3 py-2 text-sm border-2 border-amber-500 outline-none ${isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setMostrarPasswordAdmin(false); setPasswordAdmin(''); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${isDark ? 'border-slate-500 text-slate-300' : 'border-slate-300 text-slate-500'}`}
                >
                  Cancelar
                </button>
                <button
                  disabled={!passwordAdmin || volviendoAdmin}
                  onClick={() => {
                    setVolviendoAdmin(true);
                    onVolverAAdmin?.(passwordAdmin).finally(() => {
                      setVolviendoAdmin(false);
                      setPasswordAdmin('');
                      setMostrarPasswordAdmin(false);
                    });
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white disabled:opacity-50"
                >
                  {volviendoAdmin ? 'Entrando…' : 'Volver'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-0 overflow-y-auto">
          <NavItem icon={User}     label="Datos Usuario"  vistaKey="datosUsuario" />
          {/* Proyectos con badge doble si hay proyectos de editor */}
          <button
            onClick={() => { setVista('proyectos'); setMenuAbierto(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl transition-all ${vista === 'proyectos' ? activeBg : hoverBg}`}
          >
            <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${vista === 'proyectos' ? activeBox : iconBox}`}>
              <Folder size={18} strokeWidth={2.5} className={vista === 'proyectos' ? 'text-white' : iconColor} />
              {totalNotifProyectos > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-black text-white leading-none">
                  {totalNotifProyectos > 9 ? '9+' : totalNotifProyectos}
                </span>
              )}
            </div>
            <span className={`flex-1 text-left text-sm font-bold ${vista === 'proyectos' ? labelActive : labelInactive}`}>Proyectos</span>
            <div className="flex items-center gap-1">
              {totalProyectos > 0 && (
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${vista === 'proyectos' ? countActiveCls : countInactiveCls}`}>
                  {totalProyectos}
                </span>
              )}
              {totalProyectosEditor > 0 && (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-lg border-2 border-brand-500 text-brand-500">
                  +{totalProyectosEditor}
                </span>
              )}
            </div>
          </button>
          <NavItem icon={Settings} label="Configuración"  vistaKey="config" />
          <NavItem icon={ClipboardList} label="Control Ferretería" vistaKey="controlFerreteria" />
          <NavItem icon={Users}   label="Equipos"        vistaKey="equipos"      notif={notifEquipos} />
          <NavItem icon={Stethoscope} label="Diagnóstico" vistaKey="diagnostico" />
          <NavItem icon={Trash2} label="Papelera" vistaKey="papelera" />

          {setIsDark && (
            <>
                            {/* Apariencia: solo botones (tema oscuro/claro · mapa vector/satélite) */}
              <div className="px-3 py-2 flex items-center gap-2">
                <button
                  onClick={() => setIsDark(!isDark)}
                  title={isDark ? 'Modo claro' : 'Modo oscuro'}
                  className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-all ${isDark ? 'border-slate-500 bg-slate-800' : 'border-slate-900 bg-white'}`}
                >
                  {isDark ? <Sun size={18} strokeWidth={2.5} className={iconColor} /> : <Moon size={18} strokeWidth={2.5} className={iconColor} />}
                </button>
                {setMapStyle && (
                  <button
                    onClick={() => setMapStyle(v => v === 'vector' ? 'google' : 'vector')}
                    title="Estilo de mapa"
                    className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-all ${isDark ? 'border-slate-500 bg-slate-800' : 'border-slate-900 bg-white'}`}
                  >
                    {mapStyle === 'vector' ? <Satellite size={18} strokeWidth={2.5} className={iconColor} /> : <Map size={18} strokeWidth={2.5} className={iconColor} />}
                  </button>
                )}
                {onToggleFotoPuntos && (
                  <button
                    onClick={onToggleFotoPuntos}
                    title="Fotos en el mapa"
                    className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-all ${fotoPuntosActivo
                      ? 'border-purple-500 bg-purple-500/20'
                      : (isDark ? 'border-slate-500 bg-slate-800' : 'border-slate-900 bg-white')}`}
                  >
                    <Image size={18} strokeWidth={2.5} className={fotoPuntosActivo ? 'text-purple-500' : iconColor} />
                  </button>
                )}
              </div>
            </>
          )}
        </nav>

        {/* Botón Admin — fuera del footer, encima de la línea */}
        {user?.uid === ADMIN_UID && (
          <div className="px-4 pb-2">
            <button
              onClick={() => { setVista('admin'); setMenuAbierto(false); }}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 ${isDark ? 'border-slate-400 text-slate-200 hover:bg-slate-700' : 'border-slate-900 text-slate-900 hover:bg-slate-100'} font-bold active:scale-95 transition-all ${vista === 'admin' ? (isDark ? 'bg-slate-700' : 'bg-slate-100') : ''}`}
            >
              <Shield size={18} strokeWidth={2.5} />
              Admin
            </button>
          </div>
        )}

        {/* Footer: Cerrar Sesión */}
        <div className={`p-4 border-t ${footerBorder} shrink-0`}>
          <button
            onClick={cerrarSesion}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-red-500 text-red-500 font-bold hover:bg-red-500/10 active:scale-95 transition-all"
          >
            <LogOut size={18} strokeWidth={2.5} />
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Fondo */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMenuAbierto(false)} />
    </div>
  );
}
