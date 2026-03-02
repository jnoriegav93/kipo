import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Send, MessageCircle } from 'lucide-react';

export default function ChatBitacora({ proyectoId, user, theme, esCompartido, config }) {
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const messagesEndRef = useRef(null);
  const primeraCargar = useRef(true);

  // Cargar mensajes en tiempo real
  useEffect(() => {
    if (!proyectoId) return;
    primeraCargar.current = true;

    const q = query(
      collection(db, "bitacora"),
      where("proyectoId", "==", proyectoId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMensajes(msgs);

      // Auto-scroll: instantáneo la primera vez, suave después
      const behavior = primeraCargar.current ? "auto" : "smooth";
      primeraCargar.current = false;
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
      }, 50);
    });

    return () => unsubscribe();
  }, [proyectoId]);

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || enviando) return;

    setEnviando(true);

    try {
      const nombreAutor = config?.nombrePersonal || user.displayName || user.email?.split('@')[0] || 'Usuario';
      const empresaAutor = config?.empresaPersonal || '';

      await addDoc(collection(db, "bitacora"), {
        proyectoId,
        mensaje: nuevoMensaje.trim(),
        autorUid: user.uid,
        autorNombre: nombreAutor,
        autorEmpresa: empresaAutor,
        autorEmail: user.email,
        timestamp: new Date().toISOString(),
        essupervisor: esCompartido
      });

      setNuevoMensaje('');
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      alert("Error al enviar mensaje");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={`${theme.card} rounded-xl overflow-hidden`}>

      {/* Mensajes */}
      <div className="h-64 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageCircle size={32} className="mb-2 opacity-30" />
            <p className="text-xs font-bold">No hay mensajes aún</p>
          </div>
        ) : (
          mensajes.map(msg => {
            const esMio = msg.autorUid === user.uid;
            const fecha = new Date(msg.timestamp);
            const hora = fecha.toLocaleTimeString('es-PE', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });

            // Mensaje de sistema (automático)
            if (msg.tipo === 'sistema') {
              const lineas = msg.mensaje.split('\n');
              return (
                <div key={msg.id} className="flex justify-center my-1">
                  <div className="bg-slate-200 rounded-lg px-3 py-1.5 max-w-[85%]">
                    <div className="text-[11px] text-slate-500 text-center">
                      {lineas.map((linea, idx) => {
                        if (linea.endsWith(':')) {
                          return <span key={idx} className="block font-bold">{linea}</span>;
                        }
                        if (linea.includes('COD FAT:')) {
                          const match = linea.match(/COD FAT:\s*([^|]*)\|\s*NRO PT:\s*(.*)/);
                          if (match) {
                            return (
                              <span key={idx} className="block">
                                <span className="font-bold">COD FAT: </span>{match[1].trim()} <span className="font-bold">| NRO PT: </span>{match[2].trim()}
                              </span>
                            );
                          }
                        }
                        return <span key={idx} className="block font-normal">{linea}</span>;
                      })}
                    </div>
                    <p className="text-[9px] text-slate-400 text-center mt-0.5">{hora}</p>
                  </div>
                </div>
              );
            }

            // Observación del supervisor (burbuja amarilla)
            if (msg.tipo === 'observacion') {
              return (
                <div key={msg.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] bg-amber-100 border-2 border-amber-400 rounded-xl p-3 shadow-sm">
                    <div className="mb-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-black text-amber-500 bg-amber-200 px-1.5 py-0.5 rounded">
                          OBS
                        </span>
                        <span className="text-[10px] font-bold text-amber-600">
                          COD FAT: {msg.codFat || '-'} | NRO PT: {msg.nroPt || '-'}
                        </span>
                      </div>
                      <span className="text-xs font-black text-amber-800 block">{msg.autorNombre}</span>
                      {msg.autorEmpresa && (
                        <span className="text-[10px] font-bold text-amber-600 block">{msg.autorEmpresa}</span>
                      )}
                    </div>
                    <p className="text-sm text-amber-900 break-words font-medium">
                      {msg.mensaje}
                    </p>
                    <p className="text-[9px] text-amber-500 mt-1">{hora}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${esMio ? 'bg-blue-600 text-white' : 'bg-white border-2 border-slate-200'} rounded-xl p-3 shadow-sm`}>
                  <div className="mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${esMio ? 'text-blue-100' : 'text-slate-600'}`}>
                        {msg.autorNombre}
                      </span>
                      <span className={`text-[10px] ${esMio ? 'text-blue-200' : 'text-slate-400'}`}>
                        {hora}
                      </span>
                    </div>
                    {msg.autorEmpresa && (
                      <span className={`text-[10px] font-bold ${esMio ? 'text-blue-200' : 'text-slate-400'} block`}>
                        {msg.autorEmpresa}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${esMio ? 'text-white' : 'text-slate-900'} break-words`}>
                    {msg.mensaje}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-3 border-t-2 ${theme.border} ${theme.bg} flex gap-2`}>
        <input
          type="text"
          value={nuevoMensaje}
          onChange={(e) => setNuevoMensaje(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
          placeholder="Escribe un mensaje..."
          disabled={enviando}
          className={`flex-1 ${theme.input} border-2 ${theme.border} rounded-xl px-4 py-2 ${theme.text} text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50`}
        />
        <button
          onClick={enviarMensaje}
          disabled={!nuevoMensaje.trim() || enviando}
          className="bg-blue-600 text-white p-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:bg-slate-400"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}