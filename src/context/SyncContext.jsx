import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAllUploadsPending, deleteUploadPending } from '../utils/photoDB';
import { uploadImage } from '../utils/storage';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

const taskIdCounter = { current: Date.now() };
const nextTaskId = () => ++taskIdCounter.current;

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

  const marcarFallido = (id) => {
    setCola(prev => prev.map(t => t.id === id ? { ...t, fallido: true } : t));
    _clearError(id);
  };

  const guardarComoNuevo = (tarea) => {
    const { coleccion, datos } = tarea.datos;
    const nueva = { id: nextTaskId(), tipo: 'guardar_punto', datos: { modo: 'crear', coleccion, datos }, timestamp: new Date().toISOString() };
    setCola(prev => [...prev.filter(t => t.id !== tarea.id), nueva]);
  };

  // 1. Cargar cola al iniciar
  useEffect(() => {
    let colaInicial = [];
    const colaGuardada = localStorage.getItem('kipo_sync_queue_v2');
    if (colaGuardada) {
        try {
            colaInicial = JSON.parse(colaGuardada);
            setCola(colaInicial);
        } catch (e) {
            console.error("Error cargando cola:", e);
            setCola([]);
        }
    }

    // Cargar fotos pendientes de IndexedDB (crash recovery)
    (async () => {
      try {
        const pending = await getAllUploadsPending();
        if (pending.length > 0) {
          setCola(prev => {
            const existingPaths = new Set(
              prev.filter(t => t.tipo === 'subir_foto').map(t => t.datos.path)
            );
            const nuevas = pending
              .filter(e => e.path && !existingPaths.has(e.path))
              .map(e => ({
                id: nextTaskId(),
                tipo: 'subir_foto',
                datos: { path: e.path, section: e.section, item: e.item, puntoId: e.puntoId || null, thumb: e.thumb || null },
                timestamp: new Date(e.ts || Date.now()).toISOString()
              }));
            return nuevas.length > 0 ? [...prev, ...nuevas] : prev;
          });
        }
      } catch {}
    })();

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
    const nuevaTarea = { id: nextTaskId(), tipo, datos, timestamp: new Date().toISOString() };
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
    const tareaIndex = cola.findIndex(t => !t.fallido && (erroresRef.current[t.id]?.intentos || 0) < 3);
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
      } else if (tarea.tipo === 'reasignar_punto') {
        const { coleccion, idDoc, proyectoId, diaId } = tarea.datos;
        const campos = { proyectoId };
        if (diaId) campos.diaId = diaId;
        await updateDoc(doc(db, coleccion, idDoc), campos);
      } else if (tarea.tipo === 'borrar_punto') {
        const { coleccion, idDoc } = tarea.datos;
        await deleteDoc(doc(db, coleccion, idDoc));
      } else if (tarea.tipo === 'subir_foto') {
        const { path, section, item, puntoId, thumb } = tarea.datos;
        const pending = await getAllUploadsPending();
        const entry = pending.find(e => e.path === path);
        if (!entry?.blob) {
          // Blob ya no existe en IndexedDB — tarea huérfana, limpiar
          setCola(prev => prev.filter(t => t.id !== tarea.id));
          _clearError(tarea.id);
          return;
        }
        const url = await uploadImage(entry.blob, path);
        const fotoData = { url, thumb: thumb || entry.thumb || null, timestamp: new Date().toISOString(), _path: path };
        if (puntoId) {
          await updateDoc(doc(db, 'puntos', String(puntoId)), {
            [`datos.fotos.${section}.${item}`]: fotoData
          });
        }
        // Actualizar draft local si aplica
        try {
          const draft = JSON.parse(localStorage.getItem('kipo_draft') || 'null');
          if (draft?.fotos?.[section]?.[item]) {
            draft.fotos[section][item] = fotoData;
            localStorage.setItem('kipo_draft', JSON.stringify(draft));
          }
        } catch {}
        await deleteUploadPending(path);
      }

      console.log(`✅ Tarea ${tarea.id} completada.`);
      setCola(prev => prev.filter(t => t.id !== tarea.id));
      _clearError(tarea.id);

    } catch (error) {
      console.error("❌ Error sync:", error);
      const esPermanente = error.code === 'not-found' ||
        (error.message?.includes('No document to update'));
      if (tarea.tipo === 'borrar_punto' && esPermanente) {
        // Punto ya borrado en servidor: limpiar de cola
        setCola(prev => prev.filter(t => t.id !== tarea.id));
        _clearError(tarea.id);
      } else if (esPermanente) {
        // Edición/movimiento sobre punto inexistente: marcar FALLIDO sin bloquear
        marcarFallido(tarea.id);
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
    const activas = cola.filter(t => !t.fallido);
    if (activas.length === 0) return 'error';
    const todasBloqueadas = activas.every(t => (erroresRef.current[t.id]?.intentos || 0) >= 3);
    if (todasBloqueadas) return 'error';
    return 'syncing';
  };

  return (
    <SyncContext.Provider value={{ isOnline, cola, agregarTarea, estadoSync: getEstadoSync(), erroresTareas, procesando, eliminarTarea, reintentarTarea, guardarComoNuevo }}>
      {children}
    </SyncContext.Provider>
  );
};