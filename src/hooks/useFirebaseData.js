import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db, auth } from '../firebaseConfig';

// Firestore no acepta más de 30 valores en un `in`. Con más proyectos hay que partir la
// consulta en grupos y abrir una escucha por grupo. Antes se hacía `slice(0, 30)` y los
// proyectos que sobraban se quedaban sin datos, en silencio y sin aviso.
const TOPE_IN = 30;

// Escucha una colección por `proyectoId`, para TODOS los proyectos que el usuario ve:
// los suyos y los del equipo, sea editor o supervisor.
//
// Devuelve solo lo AJENO. Lo propio ya llega por su escucha de `ownerId`, que es la lista
// que se actualiza sola al guardar o borrar. Manteniéndolas separadas, borrar algo propio
// lo quita al instante y no reaparece hasta el siguiente snapshot; si las dos trajeran lo
// mismo, el documento recién borrado volvería a aparecer por un parpadeo.
const useDocsAjenosPorProyecto = (coleccion, ids, uid) => {
  const [docs, setDocs] = useState([]);
  // La lista de ids se compara como texto: un array nuevo en cada render reabriría las
  // escuchas sin parar.
  const clave = ids.join(',');
  useEffect(() => {
    if (!uid || !clave) { setDocs([]); return; }
    const lista = clave.split(',');
    const grupos = [];
    for (let i = 0; i < lista.length; i += TOPE_IN) grupos.push(lista.slice(i, i + TOPE_IN));
    // Cada grupo guarda su propio resultado: un snapshot de uno no puede borrar lo de los
    // otros, que es lo que pasaría escribiendo el estado entero desde cada escucha.
    const porGrupo = grupos.map(() => []);
    const unsubs = grupos.map((grupo, i) => onSnapshot(
      query(collection(db, coleccion), where('proyectoId', 'in', grupo)),
      (snap) => {
        porGrupo[i] = snap.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .filter(d => d.ownerId !== uid);
        setDocs(porGrupo.flat());
      },
      (error) => console.error(`Error escuchando ${coleccion} por proyecto:`, error)
    ));
    return () => unsubs.forEach(u => u());
  }, [coleccion, clave, uid]);
  return docs;
};

export const useFirebaseData = (user) => {
  // 1. ESTADOS (El almacén de datos)
  const [proyectos, setProyectos] = useState([]);
  const [proyectosSupervisados, setProyectosSupervisados] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [cablesAcero, setCablesAcero] = useState([]);
  const [config, setConfig] = useState(null);

  // 2. EFECTO (La lógica de conexión que me pasaste)
  useEffect(() => {
    if (!user) {
      setProyectos([]);
      setProyectosSupervisados([]);
      setPuntos([]);
      setConexiones([]);
      setCablesAcero([]);
      setConfig(null);
      return;
    }

    let unsubProyectos, unsubSupervisados, unsubPuntos, unsubConexiones, unsubCablesAcero, unsubConfig;
    let cancelado = false;

    // Esperar a que el token esté validado por Firestore antes de abrir listeners
    // auth.currentUser puede ser null si el dispositivo fue bloqueado y se cerró sesión
    if (!auth.currentUser) return;
    auth.currentUser.getIdToken().then(() => {
      if (cancelado) return;

        // A. ESCUCHAR PROYECTOS
      const qProyectos = query(collection(db, "proyectos"), where("ownerId", "==", user.uid));
      unsubProyectos = onSnapshot(qProyectos, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setProyectos(docs);
      }, (error) => console.error("Error en Proyectos:", error));

      // A2. ESCUCHAR PROYECTOS SUPERVISADOS
      const qSupervisados = query(
        collection(db, "proyectos"),
        where("compartidoCon", "array-contains", user.uid)
      );
      unsubSupervisados = onSnapshot(qSupervisados, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          esCompartido: true,
          permisoActual: doc.data().permisos?.[user.uid] || 'solo_lectura'
        }));
        setProyectosSupervisados(docs);
      }, (error) => console.error("Error en Supervisados:", error));

      // B. ESCUCHAR PUNTOS
      const qPuntos = query(collection(db, "puntos"), where("ownerId", "==", user.uid));
      unsubPuntos = onSnapshot(qPuntos, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setPuntos(docs);
      }, (error) => console.error("Error en Puntos:", error));

      // C. ESCUCHAR CABLES
      const qConexiones = query(collection(db, "conexiones"), where("ownerId", "==", user.uid));
      unsubConexiones = onSnapshot(qConexiones, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setConexiones(docs);
      }, (error) => console.error("Error en Conexiones:", error));

      // C2. ESCUCHAR CABLES DE ACERO (otra capa: no son fibra, se liquidan por metro)
      const qCablesAcero = query(collection(db, "cablesAcero"), where("ownerId", "==", user.uid));
      unsubCablesAcero = onSnapshot(qCablesAcero, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setCablesAcero(docs);
      }, (error) => console.error("Error en Cables de acero:", error));

      // D. ESCUCHAR CONFIGURACIÓN
      const configRef = doc(db, "configuraciones", user.uid);
      unsubConfig = onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) setConfig(docSnap.data());
      }, (error) => console.error("Error en Config:", error));
    });

    return () => {
      cancelado = true;
      unsubProyectos?.();
      unsubSupervisados?.();
      unsubPuntos?.();
      unsubConexiones?.();
      unsubCablesAcero?.();
      unsubConfig?.();
    };
  }, [user]);

  // TODO lo que el usuario puede ver de un proyecto de equipo, sin importar quién lo
  // creó: puntos, fibras y cables de acero. Vale igual para el editor y para el
  // supervisor —los dos tienen que ver la obra completa—; lo que cambia entre uno y
  // otro es si puede TOCARLA, y eso no se decide aquí.
  //
  // Antes solo había escuchas para puntos, así que las fibras y los cables de acero del
  // otro no llegaban nunca: el editor no veía lo del dueño y el dueño no veía lo del
  // editor, aunque el reporte del servidor sí los contaba.
  const idsVisibles = useMemo(() => {
    const ids = new Set();
    proyectos.forEach(p => ids.add(String(p.id)));
    proyectosSupervisados.forEach(p => ids.add(String(p.id)));
    return Array.from(ids);
  }, [proyectos, proyectosSupervisados]);

  const puntosDeProyectos = useDocsAjenosPorProyecto('puntos', idsVisibles, user?.uid);
  const conexionesDeProyectos = useDocsAjenosPorProyecto('conexiones', idsVisibles, user?.uid);
  const acerosDeProyectos = useDocsAjenosPorProyecto('cablesAcero', idsVisibles, user?.uid);

  // 3. RETURN (Entregamos los datos a App.jsx)
  return {
    proyectos, setProyectos,
    proyectosSupervisados, setProyectosSupervisados,
    puntos, setPuntos,
    puntosDeProyectos,
    conexionesDeProyectos,
    acerosDeProyectos,
    conexiones, setConexiones,
    cablesAcero, setCablesAcero,
    config, setConfig
  };
};
