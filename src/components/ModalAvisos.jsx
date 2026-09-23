import React from 'react';
import { Bell } from 'lucide-react';
import { ROL_TEXTO } from '../utils/equipoProyecto';

// Avisos a pantalla completa al abrir Kipo (paso 3b del rediseño de equipos): por
// ejemplo, "Fulano te agregó como EDITOR del proyecto X". Se muestran todos juntos y se
// marcan como vistos al tocar ENTENDIDO.
const ModalAvisos = ({ avisos, theme, onEntendido }) => (
  <div className="fixed inset-0 z-[4500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div className={`${theme.card} border-2 ${theme.border} rounded-2xl w-full max-w-sm p-5`}>
      <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
        <Bell size={22} className="text-orange-600" />
      </div>
      <h3 className={`text-center font-black text-lg ${theme.text} uppercase mb-3`}>
        {avisos.length === 1 ? 'Tienes un aviso' : `Tienes ${avisos.length} avisos`}
      </h3>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {avisos.map(a => (
          <p key={a.id} className={`text-sm ${theme.text} border-2 ${theme.border} rounded-xl px-3 py-2`}>
            <span className="font-black">{a.deNombre || 'Alguien'}</span> te agregó como{' '}
            <span className="font-black">{(ROL_TEXTO[a.rol] || a.rol || '').toUpperCase()}</span> del proyecto{' '}
            <span className="font-black">{a.proyectoNombre}</span>. Ya está en tu lista de proyectos.
          </p>
        ))}
      </div>
      <button onClick={onEntendido} className="mt-4 w-full py-3 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest active:scale-95">
        ENTENDIDO
      </button>
    </div>
  </div>
);

export default ModalAvisos;
