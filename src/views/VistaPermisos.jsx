import { Key, Plus, Clock, Trash2, ChevronDown } from 'lucide-react';

const PERMISO_LABEL = {
  lectura:  { texto: 'SUPERVISOR',        color: 'bg-blue-600' },
  edicion:  { texto: 'EDITOR',            color: 'bg-green-600' },
  ambos:    { texto: 'SUPERVISOR+EDITOR', color: 'bg-purple-600' },
};

const VistaPermisos = ({
  theme,
  proyectosSupervisados = [],
  solicitudesPendientes = [],
  setModalCodigoAbierto,
  onVolver,
  onEliminar,
}) => {
  const hayItems = proyectosSupervisados.length > 0 || solicitudesPendientes.length > 0;

  return (
    <div className={`flex-1 ${theme.bg} flex flex-col overflow-hidden`}>

      {/* HEADER */}
      <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0 z-20`}>
        <button onClick={onVolver}>
          <ChevronDown className={`rotate-90 ${theme.text}`} size={28} />
        </button>
        <span className={`font-black ${theme.text} text-lg uppercase`}>PERMISOS</span>
        <div className="w-6" />
      </div>

      {/* BOTÓN INGRESAR CÓDIGO — solo arriba si hay items */}
      {hayItems && (
        <div className={`${theme.header} shrink-0 p-3 border-b ${theme.border}`}>
          <button
            onClick={() => setModalCodigoAbierto(true)}
            className={`w-full py-3 border-2 border-dashed ${theme.border} rounded-xl ${theme.text} font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all`}
          >
            <Plus size={18} /> INGRESAR CÓDIGO DE PROYECTO
          </button>
        </div>
      )}

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hayItems ? (
          /* VACÍO — botón centrado */
          <div className={`flex flex-col items-center justify-center h-full ${theme.textSec} p-4`}>
            <Key size={64} className="mb-4 opacity-30" />
            <p className="mb-2 font-bold text-center">Sin proyectos vinculados</p>
            <p className="text-xs text-center mb-6">Ingresá un código para solicitar acceso a un proyecto</p>
            <button
              onClick={() => setModalCodigoAbierto(true)}
              className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Plus size={20} /> INGRESAR CÓDIGO
            </button>
          </div>
        ) : (
          <div className="space-y-3">

            {/* Solicitudes en espera */}
            {solicitudesPendientes.map(proy => (
              <div
                key={`pending-${proy.id}`}
                className={`${theme.card} border-2 border-dashed border-slate-400 rounded-xl p-4 opacity-70`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-black text-base ${theme.text} uppercase leading-tight truncate`}>
                      {proy.nombre}
                    </h3>
                    <p className={`text-xs ${theme.textSec} font-bold mt-0.5`}>
                      {proy.ownerNombre || ''} {proy.ownerEmpresa ? `• ${proy.ownerEmpresa}` : ''}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300 shrink-0">
                    <Clock size={14} /> EN ESPERA
                  </span>
                </div>
              </div>
            ))}

            {/* Proyectos con acceso */}
            {proyectosSupervisados.map(proy => {
              const permiso = PERMISO_LABEL[proy.permisoActual] || PERMISO_LABEL.lectura;
              return (
                <div
                  key={proy.id}
                  className={`${theme.card} border-2 ${theme.border} rounded-xl p-4`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-black text-base ${theme.text} uppercase leading-tight truncate`}>
                        {proy.nombre}
                      </h3>
                      <p className={`text-xs ${theme.textSec} font-bold mt-0.5`}>
                        {proy.ownerNombre || ''} {proy.ownerEmpresa ? `• ${proy.ownerEmpresa}` : ''}
                      </p>
                      <span className={`inline-block mt-1.5 text-[10px] font-black text-white px-2 py-0.5 rounded-md ${permiso.color}`}>
                        {permiso.texto}
                      </span>
                    </div>
                    <button
                      onClick={() => onEliminar && onEliminar(proy)}
                      className="bg-red-600 text-white p-2.5 rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-md shrink-0"
                      title="Dejar de participar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
};

export default VistaPermisos;
