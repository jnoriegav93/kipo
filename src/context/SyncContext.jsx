import React, { createContext, useState, useEffect, useContext } from 'react';
import { db, storage } from '../firebaseConfig'; 
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
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

  // 2. Guardar cola y procesar si hay internet
  useEffect(() => {
    localStorage.setItem('kipo_sync_queue_v2', JSON.stringify(cola));
    if (isOnline && cola.length > 0 && !procesando) procesarCola();
  }, [cola, isOnline, procesando]);

  const agregarTarea = (tipo, datos) => {
    const nuevaTarea = { id: Date.now(), tipo, datos, timestamp: new Date().toISOString() };
    setCola(prev => [...prev, nuevaTarea]);
  };

  // --- MOTOR DE SUBIDA (CORREGIDO) ---
  const procesarCola = async () => {
    if (procesando || cola.length === 0) return;
    setProcesando(true);
    const tarea = cola[0]; 

    try {
      console.log(`🟡 Procesando tarea: ${tarea.tipo}`, tarea);

      if (tarea.tipo === 'guardar_punto') {
        const { modo, coleccion, datos, idDoc } = tarea.datos;
        
        // --- CORRECCIÓN AQUÍ ---
        // Buscamos las fotos dentro de 'datos.datos.fotos'
        // Usamos '?.' para que si no existe no explote la app
        const arrayFotos = datos?.datos?.fotos || [];

        // A. Subir Fotos (Iterar el array)
        const fotosProcesadas = await Promise.all(arrayFotos.map(async (f) => {
             // Si es Base64 (Nueva foto), la subimos
             if (f && typeof f === 'string' && f.startsWith('data:')) { 
                 const res = await fetch(f);
                 const blob = await res.blob();
                 // Generar nombre seguro
                 const refName = `fotos/${datos.ownerId || 'anon'}/${Date.now()}_${Math.random().toString(36).substr(2,5)}.jpg`;
                 const storageRef = ref(storage, refName);
                 await uploadBytes(storageRef, blob);
                 return await getDownloadURL(storageRef);
             }
             return f; // Si ya es URL o null, la dejamos igual
        }));

        // Reconstruimos el objeto con las fotos ya subidas (URLs)
        const datosFinales = { 
            ...datos, 
            datos: {
                ...datos.datos,
                fotos: fotosProcesadas
            }
        };

        // B. Guardar en Firestore
        if (modo === 'crear') {
            await addDoc(collection(db, coleccion), datosFinales);
        } else {
            await updateDoc(doc(db, coleccion, idDoc), { datos: datosFinales.datos });
        }
      }

      // Éxito: Sacar de la cola
      console.log(`✅ Tarea ${tarea.id} completada.`);
      setCola(prev => prev.filter(t => t.id !== tarea.id));

    } catch (error) {
      console.error("❌ Error sync (tarea pospuesta):", error);
      // Opcional: Si es un error fatal, podríamos sacarla de la cola para que no atasque
      // Por ahora la dejamos para reintentar cuando la red mejore
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