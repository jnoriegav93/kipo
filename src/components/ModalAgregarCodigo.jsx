import React, { useState } from 'react';
import { X } from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function ModalAgregarCodigo({ isOpen, onClose, user, theme, setAlertData, config, onSolicitudEnviada }) {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);

  const buscarYSolicitarAcceso = async () => {
    if (!codigo.trim()) {
      setAlertData({ 
        title: "Código vacío", 
        message: "Ingresa un código de proyecto.", 
        theme 
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Buscar proyecto por código
      const q = query(
        collection(db, "proyectos"), 
        where("codigoAcceso", "==", codigo.trim().toUpperCase())
      );
      
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setAlertData({ 
          title: "Código inválido", 
          message: "No existe ningún proyecto con ese código.", 
          theme 
        });
        setLoading(false);
        return;
      }

      const proyectoDoc = snapshot.docs[0];
      const proyectoData = proyectoDoc.data();

      // 2. Verificar si ya está supervisando
      if (proyectoData.compartidoCon?.includes(user.uid)) {
        setAlertData({ 
          title: "Ya supervisas este proyecto", 
          message: `Ya tienes acceso a "${proyectoData.nombre}".`, 
          theme 
        });
        setLoading(false);
        setCodigo('');
        onClose();
        return;
      }

      // 3. Verificar si ya solicitó acceso
      if (proyectoData.solicitudesPendientes?.some(s => s.uid === user.uid)) {
        setAlertData({ 
          title: "Solicitud pendiente", 
          message: "Ya solicitaste acceso a este proyecto. Espera la aprobación del dueño.", 
          theme 
        });
        setLoading(false);
        setCodigo('');
        onClose();
        return;
      }

      // 4. Agregar solicitud pendiente
      await updateDoc(proyectoDoc.ref, {
        solicitudesPendientes: arrayUnion({
          uid: user.uid,
          email: user.email,
          nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
          nombrePersonal: config?.nombrePersonal || '',
          empresaPersonal: config?.empresaPersonal || '',
          fecha: new Date().toISOString()
        })
      });

      // Notificar para mostrar en VistaSupervision como pendiente
      if (onSolicitudEnviada) {
        onSolicitudEnviada({
          id: proyectoDoc.id,
          nombre: proyectoData.nombre,
          ownerNombre: proyectoData.ownerNombre || '',
          ownerEmpresa: proyectoData.ownerEmpresa || ''
        });
      }

      setAlertData({
        title: "Solicitud enviada",
        message: `Tu solicitud para supervisar "${proyectoData.nombre}" ha sido enviada al dueño del proyecto.`,
        theme
      });

      setCodigo('');
      onClose();

    } catch (error) {
      console.error("Error buscando proyecto:", error);
      setAlertData({ 
        title: "Error", 
        message: "Ocurrió un error al buscar el proyecto. Verifica tu conexión.", 
        theme 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className={`${theme.card} rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in border-2 ${theme.border}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className={`font-black text-xl ${theme.text} uppercase`}>Supervisar Proyecto</h3>
          <button onClick={onClose} className={`${theme.text} hover:opacity-70`}>
            <X size={24} />
          </button>
        </div>

        {/* Input */}
        <div className="mb-4">
          <label className={`text-xs font-black ${theme.text} opacity-70 uppercase mb-2 block`}>
            Código de Acceso
          </label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="FIB-A7X9K2"
            maxLength={10}
            className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-4 py-3 ${theme.text} text-lg font-bold text-center focus:border-brand-500 focus:outline-none tracking-widest`}
            autoFocus
            disabled={loading}
          />
          <p className={`text-xs ${theme.textSec} mt-2 text-center`}>
            Ingresa el código que te compartió el dueño del proyecto
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <button 
            onClick={onClose}
            disabled={loading}
            className={`flex-1 ${theme.bg} ${theme.text} border-2 ${theme.border} py-3 rounded-xl font-bold active:scale-95 transition-transform disabled:opacity-50`}
          >
            CANCELAR
          </button>
          <button 
            onClick={buscarYSolicitarAcceso}
            disabled={loading || !codigo.trim()}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:bg-slate-400"
          >
            {loading ? 'BUSCANDO...' : 'SOLICITAR'}
          </button>
        </div>
      </div>
    </div>
  );
}