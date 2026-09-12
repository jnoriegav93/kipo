import React from 'react';
// Importamos TODOS los iconos que usan tus modales
import { X, AlertTriangle, AlertCircle, FileDown, Share2 } from 'lucide-react';

// --- COMPONENTES UI ---

export const Modal = ({ isOpen, onClose, title, children, theme, bottomSheet = false, topAnchor = false }) => {
  if (!isOpen) return null;
  if (bottomSheet) {
    return (
      <div className="fixed inset-0 z-[300] flex items-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className={`${theme.card} border-2 ${theme.border} w-full rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200`}>
          <div className={`${theme.header} p-4 border-b-2 ${theme.border} flex justify-between items-center`}>
            <h3 className={`font-black ${theme.text} text-xl uppercase`}>{title}</h3>
            <button onClick={onClose}><X size={28} className={theme.text}/></button>
          </div>
          <div className="p-4" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
            {children}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`fixed inset-0 z-[300] flex ${topAnchor ? 'items-start' : 'items-center'} justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200`}
      style={{
        paddingLeft: 16, paddingRight: 16,
        // topAnchor: anclado abajo de la barra de estado y crece HACIA ABAJO (no se sube
        // sobre la hora/batería al aparecer el buscador). Centrado: como siempre.
        paddingTop: topAnchor
          ? 'max(52px, calc(env(safe-area-inset-top) + 36px))'
          : 'max(16px, calc(env(safe-area-inset-top) + 8px))',
        paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom) + 8px))',
      }}
    >
      {/* max-h-full = nunca sale del área segura (no se sube sobre la barra de estado);
          el contenido interno hace scroll si crece con el buscador. */}
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden max-h-full flex flex-col`}>
        <div className={`${theme.header} p-4 border-b-2 ${theme.border} flex justify-between items-center shrink-0`}>
          <h3 className={`font-black ${theme.text} text-xl uppercase`}>{title}</h3>
          <button onClick={onClose}><X size={28} className={theme.text}/></button>
        </div>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, onExtra, title, message, actionText, extraText, theme }) => {
  // Candado anti doble-toque: si el onConfirm tarda (escrituras remotas), un segundo toque
  // repetía la acción (ej: punto duplicado en papelera). Se rehabilita solo a los 2.5 s por
  // si el flujo encadena otro diálogo sin cerrar este.
  const [procesando, setProcesando] = React.useState(false);
  React.useEffect(() => { if (isOpen) setProcesando(false); }, [isOpen, title, message]);
  const ejecutarUnaVez = (fn) => {
    if (procesando) return;
    setProcesando(true);
    setTimeout(() => setProcesando(false), 2500);
    fn?.();
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden p-6 text-center`}>
        <div className="flex justify-center mb-4 text-yellow-500"><AlertTriangle size={48} /></div>
        <h3 className={`font-black ${theme.text} text-2xl mb-2`}>{title}</h3>
        <p className={`${theme.text} text-sm mb-6 font-medium whitespace-pre-line`}>{message}</p>
        <div className="flex flex-col gap-3">
          {extraText && (
            <button onClick={() => ejecutarUnaVez(onExtra)} disabled={procesando} className="w-full py-2 rounded-xl font-bold text-sm bg-green-600 text-white shadow-lg border-2 border-green-800 disabled:opacity-50">{extraText}</button>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className={`flex-1 py-2 rounded-xl font-bold text-sm ${theme.bg} ${theme.text} border-2 ${theme.border}`}>CANCELAR</button>
            <button onClick={() => ejecutarUnaVez(onConfirm)} disabled={procesando} className="flex-1 py-2 rounded-xl font-bold text-sm bg-red-600 text-white shadow-lg border-2 border-red-800 disabled:opacity-50">{actionText || 'ELIMINAR'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AlertModal = ({ isOpen, onClose, title, message, theme }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm animate-in fade-in duration-300 flex items-center justify-center p-4">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-5 text-center animate-in zoom-in-95 duration-300`}>
        <div className="flex justify-center mb-3 text-blue-500"><AlertCircle size={40} /></div>
        <h3 className={`font-black ${theme.text} text-xl mb-2`}>{title}</h3>
        <p className={`${theme.text} text-sm mb-5 font-medium leading-relaxed`}>{message}</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl font-bold bg-blue-600 text-white shadow-lg border-2 border-blue-800 active:scale-95 transition-transform">ACEPTAR</button>
      </div>
    </div>
  );
};

export const ExportModal = ({ isOpen, onClose, fileName, onConfirm, theme }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden p-6 text-center`}>
        <div className="flex justify-center mb-4 text-green-500"><FileDown size={48} /></div>
        <h3 className={`font-black ${theme.text} text-xl mb-2`}>EXPORTAR DATOS</h3>
        <p className={`${theme.text} text-sm mb-6 font-medium break-all`}>{fileName}</p>
        <button onClick={onConfirm} className="w-full py-3 rounded-xl font-bold bg-green-600 text-white shadow-lg border-2 border-green-800 flex items-center justify-center gap-2">
            <Share2 size={20}/> DESCARGAR / COMPARTIR
        </button>
        <button onClick={onClose} className={`mt-3 w-full py-3 rounded-xl font-bold ${theme.bg} ${theme.text} border-2 ${theme.border}`}>CANCELAR</button>
      </div>
    </div>
  );
};

export const BotonMenu = ({ icon, label, active, onClick, theme }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-colors border-2 ${active ? theme.activeItem : theme.inactiveItem}`}>
    <div className={active ? 'text-brand-500' : ''}>{icon}</div>
    <span className={`font-bold text-lg ${active ? 'text-brand-500' : theme.text}`}>{label}</span>
  </button>
);

export const ThemedInput = ({ placeholder, val, onChange, theme, autoFocus, disabled }) => (
  <input 
    type="text" 
    autoFocus={autoFocus}
    value={val} 
    onChange={onChange} 
    disabled={disabled} 
    className={`w-full ${theme.input} border-2 rounded-xl px-4 py-4 text-lg font-bold placeholder-slate-500 focus:border-brand-500 focus:outline-none transition-colors
      ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100/50' : ''} 
    `} 
    placeholder={placeholder} 
  />
);