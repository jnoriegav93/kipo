// src/components/Sidebar.jsx
import { Folder, Settings, LogOut, User, Eye } from 'lucide-react';

export default function Sidebar({
  isOpen,
  setMenuAbierto,
  isDark = false,
  user,
  vista,
  setVista,
  cerrarSesion,
  config,
  totalProyectos,
  totalSupervision,
  totalNotifProyectos = 0,
  totalNotifSupervisados = 0
}) {

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
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all ${active ? activeBg : hoverBg}`}
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
        <div className={`px-4 pb-4 border-b-2 ${header} shrink-0 pt-safe-header`}>
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xl leading-none">{inicial}</span>
            </div>
            <div className="overflow-hidden flex-1">
              <p className={`font-black text-sm leading-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {nombrePersonal || usuarioKipo}
              </p>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {empresaPersonal || 'Sin empresa'}
              </p>
            </div>
            {/* Dot incompleto */}
            {!datosCompletos && (
              <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
            )}
          </div>

          {/* Email */}
          <div className={`${emailRow} rounded-xl px-3 py-2`}>
            <span className="text-[10px] text-slate-400 truncate block">{correoKipo}</span>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0 overflow-y-auto">
          <p className={`text-[9px] font-black uppercase tracking-widest px-3 mb-2 ${section}`}>Menú</p>

          <NavItem icon={User}     label="Datos Usuario"  vistaKey="datosUsuario" />
          <Divider />
          <NavItem icon={Folder}   label="Proyectos"      vistaKey="proyectos"    count={totalProyectos}   notif={totalNotifProyectos} />
          <Divider />
          <NavItem icon={Settings} label="Configuración"  vistaKey="config" />
          <Divider />
          <NavItem icon={Eye}      label="Supervisión"    vistaKey="supervision"  count={totalSupervision} notif={totalNotifSupervisados} />
        </nav>

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
