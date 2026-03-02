import React, { createContext, useState, useEffect, useContext } from 'react';
import { db, storage } from '../firebaseConfig'; 
// 👇 1. IMPORTANTE: AGREGAMOS 'deleteDoc'
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cola, setCola] = useState([]);
  const [procesando, setProcesando] = useState(false);

  // 1. Cargar cola al iniciar
  useEffect(() => {
    const colaGuardada = localStorage.getItem('kipo_sync_queue_v2');
    if (colaGuardada) {
        try {
            setCola(JSON.parse(colaGuardada));
        } catch (e) {
            console.error("Error cargando cola:", e);
            setCola([]);
        }
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Guardar cola y procesar
  useEffect(() => {
    localStorage.setItem('kipo_sync_queue_v2', JSON.stringify(cola));
    if (isOnline && cola.length > 0 && !procesando) procesarCola();
  }, [cola, isOnline, procesando]);

  const agregarTarea = (tipo, datos) => {
    const nuevaTarea = { id: Date.now(), tipo, datos, timestamp: new Date().toISOString() };
    setCola(prev => [...prev, nuevaTarea]);
  };

  // --- FUNCIÓN RECURSIVA PARA FOTOS (NECESARIA PARA GUARDAR) ---
  const procesarFotosRecursivo = async (item, ownerId) => {
      if (!item) return item;
      if (Array.isArray(item)) return Promise.all(item.map(subItem => procesarFotosRecursivo(subItem, ownerId)));
      if (typeof item === 'object' && item !== null) {
          const nuevoObjeto = {};
          for (const key of Object.keys(item)) {
              nuevoObjeto[key] = await procesarFotosRecursivo(item[key], ownerId);
          }
          return nuevoObjeto;
      }
      if (typeof item === 'string' && item.startsWith('data:')) {
          try {
              const res = await fetch(item);
              const blob = await res.blob();
              const refName = `fotos/${ownerId || 'anon'}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
              const storageRef = ref(storage, refName);
              await uploadBytes(storageRef, blob);
              return await getDownloadURL(storageRef);
          } catch (e) {
              console.error("Error subiendo foto:", e);
              return item;
          }
      }
      return item;
  };

  // --- MOTOR DE SUBIDA (ACTUALIZADO CON BORRADO) ---
  const procesarCola = async () => {
    if (procesando || cola.length === 0) return;
    setProcesando(true);
    const tarea = cola[0]; 

    try {
      console.log(`🟡 Procesando tarea: ${tarea.tipo}`, tarea);

      // CASO 1: GUARDAR O EDITAR
      if (tarea.tipo === 'guardar_punto') {
        const { modo, coleccion, datos, idDoc } = tarea.datos;
        const fotosProcesadas = await procesarFotosRecursivo(datos?.datos?.fotos, datos.ownerId);
        
        const datosFinales = { 
            ...datos, 
            datos: { ...datos.datos, fotos: fotosProcesadas }
        };

        if (modo === 'crear') {
            await addDoc(collection(db, coleccion), datosFinales);
        } else {
            await updateDoc(doc(db, coleccion, idDoc), { datos: datosFinales.datos });
        }
      } 
      
      // 👇 CASO 2: BORRAR (ESTO ES LO QUE FALTABA)
      else if (tarea.tipo === 'borrar_punto') {
          const { coleccion, idDoc } = tarea.datos;
          await deleteDoc(doc(db, coleccion, idDoc));
          console.log(`🗑️ Documento ${idDoc} eliminado de ${coleccion}`);
      }

      console.log(`✅ Tarea ${tarea.id} completada.`);
      setCola(prev => prev.filter(t => t.id !== tarea.id));

    } catch (error) {
      console.error("❌ Error sync:", error);
      // Opcional: Si el error es "documento no encontrado" al borrar, ignoramos y seguimos
      if (tarea.tipo === 'borrar_punto' && error.code === 'not-found') {
          setCola(prev => prev.filter(t => t.id !== tarea.id));
      }
    } finally {
      setProcesando(false);
    }
  };

  const getEstadoSync = () => {
    if (!isOnline) return 'offline'; 
    if (cola.length > 0) return 'syncing';
    return 'synced'; 
  };

  return (
    <SyncContext.Provider value={{ isOnline, cola, agregarTarea, estadoSync: getEstadoSync() }}>
      {children}
    </SyncContext.Provider>
  );
};