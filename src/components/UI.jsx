import React from 'react';
// Importamos TODOS los iconos que usan tus modales
import { X, AlertTriangle, AlertCircle, FileDown, Share2 } from 'lucide-react';

// --- COMPONENTES UI ---

export const Modal = ({ isOpen, onClose, title, children, theme, bottomSheet = false }) => {
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden`}>
        <div className={`${theme.header} p-4 border-b-2 ${theme.border} flex justify-between items-center`}>
          <h3 className={`font-black ${theme.text} text-xl uppercase`}>{title}</h3>
          <button onClick={onClose}><X size={28} className={theme.text}/></button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, actionText, theme }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden p-6 text-center`}>
        <div className="flex justify-center mb-4 text-yellow-500"><AlertTriangle size={48} /></div>
        <h3 className={`font-black ${theme.text} text-2xl mb-2`}>{title}</h3>
        <p className={`${theme.text} text-sm mb-6 font-medium`}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className={`flex-1 py-2 rounded-xl font-bold text-sm ${theme.bg} ${theme.text} border-2 ${theme.border}`}>CANCELAR</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl font-bold text-sm bg-red-600 text-white shadow-lg border-2 border-red-800">{actionText || 'ELIMINAR'}</button>
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