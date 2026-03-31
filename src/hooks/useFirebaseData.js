import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db } from '../firebaseConfig';

export const useFirebaseData = (user) => {
  // 1. ESTADOS (El almacén de datos)
  const [proyectos, setProyectos] = useState([]);
  const [proyectosSupervisados, setProyectosSupervisados] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [puntosCompartidos, setPuntosCompartidos] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [config, setConfig] = useState(null);

  // 2. EFECTO (La lógica de conexión que me pasaste)
  useEffect(() => {
if (!user) {
      setProyectos([]); 
      setProyectosSupervisados([]);
      setPuntos([]); 
      setConexiones([]); 
      setConfig(null);
      return;
    }

    console.log("Iniciando conexión con Firebase para UID:", user.uid);

    // A. ESCUCHAR PROYECTOS
    const qProyectos = query(collection(db, "proyectos"), where("ownerId", "==", user.uid));
    const unsubProyectos = onSnapshot(qProyectos, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      console.log("Proyectos cargados:", docs.length);
      setProyectos(docs);
    }, (error) => console.error("Error en Proyectos:", error));

    // A2. ESCUCHAR PROYECTOS SUPERVISADOS
    const qSupervisados = query(
      collection(db, "proyectos"), 
      where("compartidoCon", "array-contains", user.uid)
    );
    const unsubSupervisados = onSnapshot(qSupervisados, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        ...doc.data(), 
        id: doc.id,
        esCompartido: true,
        permisoActual: doc.data().permisos?.[user.uid] || 'solo_lectura'
      }));
      console.log("Proyectos supervisados:", docs.length);
      setProyectosSupervisados(docs);
    }, (error) => console.error("Error en Supervisados:", error));

    // B. ESCUCHAR PUNTOS
    const qPuntos = query(collection(db, "puntos"), where("ownerId", "==", user.uid));
    const unsubPuntos = onSnapshot(qPuntos, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      console.log("Puntos cargados:", docs.length);
      setPuntos(docs);
    }, (error) => console.error("Error en Puntos:", error));

    // C. ESCUCHAR CABLES
    const qConexiones = query(collection(db, "conexiones"), where("ownerId", "==", user.uid));
    const unsubConexiones = onSnapshot(qConexiones, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setConexiones(docs);
    });

    // D. ESCUCHAR CONFIGURACIÓN
    const configRef = doc(db, "configuraciones", user.uid);
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) setConfig(docSnap.data());
    });

    return () => { 
      unsubProyectos(); 
      unsubSupervisados();
      unsubPuntos(); 
      unsubConexiones(); 
      unsubConfig(); 
    };
  }, [user]);

  // Efecto para cargar puntos de proyectos donde el usuario es editor
  useEffect(() => {
    if (!user || proyectosSupervisados.length === 0) {
      setPuntosCompartidos([]);
      return;
    }
    const proyectosEditor = proyectosSupervisados.filter(p => {
      const permiso = p.permisoActual;
      return permiso === 'edicion' || permiso === 'ambos';
    });
    if (proyectosEditor.length === 0) {
      setPuntosCompartidos([]);
      return;
    }
    const ids = proyectosEditor.map(p => p.id).slice(0, 30);
    const q = query(collection(db, "puntos"), where("proyectoId", "in", ids));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setPuntosCompartidos(docs);
    }, (error) => console.error("Error en PuntosCompartidos:", error));
    return () => unsub();
  }, [user, proyectosSupervisados]);

  // 3. RETURN (Entregamos los datos a App.jsx)
  return {
    proyectos, setProyectos,
    proyectosSupervisados, setProyectosSupervisados,
    puntos, setPuntos,
    puntosCompartidos,
    conexiones, setConexiones,
    config, setConfig
  };
};