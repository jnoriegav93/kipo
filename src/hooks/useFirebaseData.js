import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db, auth } from '../firebaseConfig';
import { permisoViejo, rolEnProyecto } from '../utils/equipoProyecto';
import { crearEscuchasPorProyecto, soloVisibles } from '../utils/escuchasPorProyecto';

// UNA sola escucha por colección, por `proyectoId`: trae TODO lo de los proyectos que el
// usuario ve, lo haya creado quien lo haya creado. Reemplaza a las dos de antes (lo
// propio por `ownerId` y lo ajeno por proyecto), que bajaban dos veces lo propio y
// partían la app en "lo mío" y "lo de todos": varias funciones miraban solo lo mío y
// fallaban con lo de un compañero de obra.
//
// Firestore no acepta más de 30 valores en un `in`: los proyectos van en grupos, con una
// escucha por grupo. Cómo se arman y por qué un proyecto nuevo no reabre los demás
// grupos (24/09): src/utils/escuchasPorProyecto.js.
//
// Devuelve [docs, setDocs]. El setter sirve para los cambios optimistas de las
// escrituras DIRECTAS, que el SDK confirma enseguida con su propio snapshot. Lo que
// espera en la cola de sincronización no depende de él: lo aplica encima
// `aplicarPendientes` (src/utils/colaSync.js), porque cualquier snapshot lo pisaría.
const useDocsPorProyecto = (coleccion, ids, asentado) => {
  const [crudos, setCrudos] = useState([]);
  const [escuchas] = useState(() => crearEscuchasPorProyecto({
    escuchar: (grupo, alDatos, alError) => onSnapshot(
      query(collection(db, coleccion), where('proyectoId', 'in', grupo)),
      (snap) => alDatos(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      (error) => {
        console.error(`Error escuchando ${coleccion} por proyecto:`, error);
        alError(error); // un grupo que falla no puede dejar a los demás sin mostrarse
      }
    ),
    publicar: setCrudos,
  }));
  // La lista se compara como texto: un array nuevo en cada render reabriría las
  // escuchas sin parar.
  const clave = ids.join(',');
  useEffect(() => {
    escuchas.sincronizar(clave ? clave.split(',') : [], asentado);
  }, [escuchas, clave, asentado]);
  useEffect(() => () => escuchas.cerrar(), [escuchas]);
  // Un proyecto que ya no está a la vista se quita aquí: su escucha puede seguir abierta
  const docs = useMemo(() => soloVisibles(crudos, clave ? clave.split(',') : []), [crudos, clave]);
  return [docs, setCrudos];
};

export const useFirebaseData = (user) => {
  // 1. ESTADOS (El almacén de datos)
  const [proyectos, setProyectos] = useState([]);
  const [proyectosSupervisados, setProyectosSupervisados] = useState([]);
  const [config, setConfig] = useState(null);
  // Si ya llegaron las dos listas de proyectos: hasta entonces, las escuchas de puntos,
  // fibras y cables se arman como siempre (ver src/utils/escuchasPorProyecto.js)
  const [llegaron, setLlegaron] = useState({ propios: false, compartidos: false });

  // 2. EFECTO: los proyectos y la configuración. Lo que hay DENTRO de cada proyecto
  // (puntos, fibras, cables) se escucha más abajo, por proyecto.
  useEffect(() => {
    if (!user) {
      setProyectos([]);
      setProyectosSupervisados([]);
      setConfig(null);
      setLlegaron({ propios: false, compartidos: false });
      return;
    }

    let unsubProyectos, unsubSupervisados, unsubConfig;
    let cancelado = false;
    const llego = (lista) => setLlegaron(l => (l[lista] ? l : { ...l, [lista]: true }));

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
        llego('propios');
      }, (error) => { console.error("Error en Proyectos:", error); llego('propios'); });

      // A2. PROYECTOS COMPARTIDOS: donde el usuario es miembro (editor o supervisor), por
      // `miembrosUids`. Desde el paso 6 es la única escucha: la de `compartidoCon`, el
      // reflejo viejo, se retiró después de pasar a todos a `miembros`. Los propios llegan
      // por `ownerId` (arriba) y aquí se descartan. `permisoActual` sale del rol ('edicion'
      // el editor, 'lectura' el supervisor).
      unsubSupervisados = onSnapshot(
        query(collection(db, "proyectos"), where("miembrosUids", "array-contains", user.uid)),
        (snapshot) => {
          setProyectosSupervisados(snapshot.docs.map(d => ({ ...d.data(), id: d.id }))
            .filter(p => String(p.ownerId) !== String(user.uid))
            .map(p => ({ ...p, esCompartido: true, permisoActual: permisoViejo(rolEnProyecto(p, user.uid) || 'supervisor') })));
          llego('compartidos');
        },
        (error) => { console.error("Error en proyectos de miembro:", error); llego('compartidos'); });

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
      unsubConfig?.();
    };
  }, [user]);

  // Los proyectos cuyo contenido se escucha: los propios y los compartidos, sea como
  // editor o como supervisor. Los dos tienen que ver la obra completa; lo que cambia
  // entre uno y otro es si pueden TOCARLA, y eso no se decide aquí.
  const idsVisibles = useMemo(() => {
    const ids = new Set();
    proyectos.forEach(p => ids.add(String(p.id)));
    proyectosSupervisados.forEach(p => ids.add(String(p.id)));
    return Array.from(ids);
  }, [proyectos, proyectosSupervisados]);

  const asentado = llegaron.propios && llegaron.compartidos;
  const [puntos, setPuntos] = useDocsPorProyecto('puntos', idsVisibles, asentado);
  const [conexiones, setConexiones] = useDocsPorProyecto('conexiones', idsVisibles, asentado);
  const [cablesAcero, setCablesAcero] = useDocsPorProyecto('cablesAcero', idsVisibles, asentado);

  // 3. RETURN (Entregamos los datos a App.jsx)
  return {
    proyectos, setProyectos,
    proyectosSupervisados, setProyectosSupervisados,
    puntos, setPuntos,
    conexiones, setConexiones,
    cablesAcero, setCablesAcero,
    config, setConfig
  };
};
