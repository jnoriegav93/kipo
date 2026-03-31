import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cola, setCola] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [erroresTareas, setErroresTareas] = useState({});
  const erroresRef = useRef({});

  const _setError = (taskId, mensaje) => {
    const intentos = (erroresRef.current[taskId]?.intentos || 0) + 1;
    erroresRef.current = { ...erroresRef.current, [taskId]: { mensaje, intentos } };
    setErroresTareas({ ...erroresRef.current });
  };

  const _clearError = (taskId) => {
    const next = { ...erroresRef.current };
    delete next[taskId];
    erroresRef.current = next;
    setErroresTareas(next);
  };

  const eliminarTarea = (id) => {
    setCola(prev => prev.filter(t => t.id !== id));
    _clearError(id);
  };

  const reintentarTarea = (id) => {
    _clearError(id);
    setCola(prev => {
      const tarea = prev.find(t => t.id === id);
      if (!tarea) return prev;
      return [tarea, ...prev.filter(t => t.id !== id)];
    });
  };

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
  const procesarFotosRecursivo = async (item, ownerId, proyectoId) => {
      if (!item) return item;
      if (Array.isArray(item)) return Promise.all(item.map(subItem => procesarFotosRecursivo(subItem, ownerId, proyectoId)));
      if (typeof item === 'object' && item !== null) {
          const nuevoObjeto = {};
          for (const key of Object.keys(item)) {
              nuevoObjeto[key] = await procesarFotosRecursivo(item[key], ownerId, proyectoId);
          }
          return nuevoObjeto;
      }
      if (typeof item === 'string' && item.startsWith('data:')) {
          try {
              const res = await fetch(item);
              const blob = await res.blob();
              // Usar proyectoId si está disponible, para que las fotos queden bajo el proyecto
              const basePath = proyectoId
                ? `proyectos/${proyectoId}/fotos_generales`
                : `fotos/${ownerId || 'anon'}`;
              const refName = `${basePath}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
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

  // --- MOTOR DE SUBIDA ---
  const procesarCola = async () => {
    if (procesando || cola.length === 0) return;
    // Buscar primera tarea que no haya fallado 3 veces
    const tareaIndex = cola.findIndex(t => (erroresRef.current[t.id]?.intentos || 0) < 3);
    if (tareaIndex === -1) return; // todas bloqueadas, esperar reintento manual
    const tarea = cola[tareaIndex];
    setProcesando(true);

    try {
      console.log(`🟡 Procesando tarea: ${tarea.tipo}`, tarea);

      if (tarea.tipo === 'guardar_punto') {
        const { modo, coleccion, datos, idDoc } = tarea.datos;
        const fotosProcesadas = await procesarFotosRecursivo(datos?.datos?.fotos, datos.ownerId, datos.proyectoId);
        const fotosGeneralesProcesadas = await procesarFotosRecursivo(datos?.datos?.fotosGenerales, datos.ownerId, datos.proyectoId);
        const datosFinales = { ...datos, datos: { ...datos.datos, fotos: fotosProcesadas, fotosGenerales: fotosGeneralesProcesadas } };
        if (modo === 'crear') {
          await addDoc(collection(db, coleccion), datosFinales);
        } else {
          await updateDoc(doc(db, coleccion, idDoc), { datos: datosFinales.datos });
        }
      } else if (tarea.tipo === 'mover_punto') {
        const { coleccion, idDoc, coords, datos } = tarea.datos;
        await updateDoc(doc(db, coleccion, idDoc), { coords, datos });
      } else if (tarea.tipo === 'borrar_punto') {
        const { coleccion, idDoc } = tarea.datos;
        await deleteDoc(doc(db, coleccion, idDoc));
      }

      console.log(`✅ Tarea ${tarea.id} completada.`);
      setCola(prev => prev.filter(t => t.id !== tarea.id));
      _clearError(tarea.id);

    } catch (error) {
      console.error("❌ Error sync:", error);
      // Borrar no encontrado: limpiar igual
      if (tarea.tipo === 'borrar_punto' && error.code === 'not-found') {
        setCola(prev => prev.filter(t => t.id !== tarea.id));
        _clearError(tarea.id);
      } else {
        _setError(tarea.id, error.message || 'Error desconocido');
      }
    } finally {
      setProcesando(false);
    }
  };

  const getEstadoSync = () => {
    if (!isOnline) return 'offline';
    if (cola.length === 0) return 'synced';
    const todasBloqueadas = cola.every(t => (erroresRef.current[t.id]?.intentos || 0) >= 3);
    if (todasBloqueadas) return 'error';
    return 'syncing';
  };

  return (
    <SyncContext.Provider value={{ isOnline, cola, agregarTarea, estadoSync: getEstadoSync(), erroresTareas, procesando, eliminarTarea, reintentarTarea }}>
      {children}
    </SyncContext.Provider>
  );
};