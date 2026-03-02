import React, { useState } from 'react';
import { ChevronDown, User, Building2, Edit3, Check } from 'lucide-react';

const VistaDatosUsuario = ({
  theme,
  config,
  guardarConfiguracion,
  onVolver,
  user
}) => {
  const nombreGuardado = config?.nombrePersonal || '';
  const empresaGuardada = config?.empresaPersonal || '';

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(nombreGuardado);
  const [empresa, setEmpresa] = useState(empresaGuardada);

  const guardar = async () => {
    await guardarConfiguracion({
      ...config,
      nombrePersonal: nombre.trim(),
      empresaPersonal: empresa.trim()
    });
    setEditando(false);
  };

  const cancelar = () => {
    setNombre(nombreGuardado);
    setEmpresa(empresaGuardada);
    setEditando(false);
  };

  return (
    <div className={`flex-1 ${theme.bg} flex flex-col overflow-hidden`}>

      {/* HEADER */}
      <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0 z-20`}>
        <button onClick={onVolver}>
          <ChevronDown className={`rotate-90 ${theme.text}`} size={28}/>
        </button>
        <span className={`font-black ${theme.text} text-lg uppercase`}>DATOS USUARIO</span>
        <div className="w-6"></div>
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* DATOS PERSONALES */}
        <div className={`${theme.card} border-2 ${theme.border} rounded-xl p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-xs font-black ${theme.text} uppercase tracking-wider opacity-70`}>Datos Personales</h3>
            {!editando && (
              <button
                onClick={() => setEditando(true)}
                className="flex items-center gap-1 text-blue-600 text-xs font-bold active:scale-95"
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>

          {editando ? (
            <div className="space-y-3">
              <div>
                <label className={`text-xs font-bold ${theme.textSec} uppercase mb-1 block`}>Nombre</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ingresa tu nombre"
                    autoFocus
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border-2 ${theme.border} ${theme.bg} ${theme.text} font-bold focus:border-blue-500 focus:outline-none transition-colors`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-xs font-bold ${theme.textSec} uppercase mb-1 block`}>Empresa</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    placeholder="Ingresa tu empresa"
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border-2 ${theme.border} ${theme.bg} ${theme.text} font-bold focus:border-blue-500 focus:outline-none transition-colors`}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={cancelar}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase ${theme.card} ${theme.text} border-2 ${theme.border} active:scale-95 transition-all`}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  className="flex-1 py-3 rounded-xl font-bold text-sm uppercase bg-blue-600 text-white active:scale-95 transition-all shadow-md"
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <User size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className={`text-[10px] font-bold ${theme.textSec} uppercase`}>Nombre</p>
                  <p className={`text-sm font-black ${theme.text}`}>{nombreGuardado || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className={`text-[10px] font-bold ${theme.textSec} uppercase`}>Empresa</p>
                  <p className={`text-sm font-black ${theme.text}`}>{empresaGuardada || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CUENTA KIPO */}
        <div className={`${theme.card} border-2 ${theme.border} rounded-xl p-4`}>
          <h3 className={`text-xs font-black ${theme.text} uppercase tracking-wider opacity-70 mb-3`}>Cuenta Kipo</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <User size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className={`text-[10px] font-bold ${theme.textSec} uppercase`}>Usuario</p>
                <p className={`text-sm font-black ${theme.text}`}>{user?.displayName || user?.email?.split('@')[0] || 'Usuario'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <div>
                <p className={`text-[10px] font-bold ${theme.textSec} uppercase`}>Correo</p>
                <p className={`text-sm font-black ${theme.text}`}>{user?.email || '-'}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VistaDatosUsuario;
