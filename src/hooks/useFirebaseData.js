import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db, auth } from '../firebaseConfig';
import { permisoViejo, rolEnProyecto } from '../utils/equipoProyecto';

// Firestore no acepta más de 30 valores en un `in`. Con más proyectos hay que partir la
// consulta en grupos y abrir una escucha por grupo. Antes se hacía `slice(0, 30)` y los
// proyectos que sobraban se quedaban sin datos, en silencio y sin aviso.
const TOPE_IN = 30;

// UNA sola escucha por colección, por `proyectoId`: trae TODO lo de los proyectos que el
// usuario ve, lo haya creado quien lo haya creado. Reemplaza a las dos de antes (lo
// propio por `ownerId` y lo ajeno por proyecto), que bajaban dos veces lo propio y
// partían la app en "lo mío" y "lo de todos": varias funciones miraban solo lo mío y
// fallaban con lo de un compañero de obra.
//
// Devuelve [docs, setDocs]. El setter sirve para los cambios optimistas de las
// escrituras DIRECTAS, que el SDK confirma enseguida con su propio snapshot. Lo que
// espera en la cola de sincronización no depende de él: lo aplica encima
// `aplicarPendientes` (src/utils/colaSync.js), porque cualquier snapshot lo pisaría.
const useDocsPorProyecto = (coleccion, ids) => {
  const [docs, setDocs] = useState([]);
  // La lista se compara como texto: un array nuevo en cada render reabriría las
  // escuchas sin parar.
  const clave = ids.join(',');
  useEffect(() => {
    if (!clave) { setDocs([]); return; }
    const lista = clave.split(',');
    const grupos = [];
    for (let i = 0; i < lista.length; i += TOPE_IN) grupos.push(lista.slice(i, i + TOPE_IN));
    // Cada grupo guarda su propio resultado: un snapshot de uno no borra lo de los otros.
    // Y no se publica nada hasta que llegaron todos una vez: si no, al cambiar la lista
    // de proyectos el mapa se vaciaría a medias mientras llegan los demás grupos.
    const porGrupo = grupos.map(() => []);
    const llegaron = grupos.map(() => false);
    const publicar = () => { if (llegaron.every(Boolean)) setDocs(porGrupo.flat()); };
    const unsubs = grupos.map((grupo, i) => onSnapshot(
      query(collection(db, coleccion), where('proyectoId', 'in', grupo)),
      (snap) => {
        porGrupo[i] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        llegaron[i] = true;
        publicar();
      },
      (error) => {
        console.error(`Error escuchando ${coleccion} por proyecto:`, error);
        // Un grupo que falla no puede dejar a los demás sin mostrarse
        llegaron[i] = true;
        publicar();
      }
    ));
    return () => unsubs.forEach(u => u());
  }, [coleccion, clave]);
  return [docs, setDocs];
};

export const useFirebaseData = (user) => {
  // 1. ESTADOS (El almacén de datos)
  const [proyectos, setProyectos] = useState([]);
  const [proyectosSupervisados, setProyectosSupervisados] = useState([]);
  const [config, setConfig] = useState(null);

  // 2. EFECTO: los proyectos y la configuración. Lo que hay DENTRO de cada proyecto
  // (puntos, fibras, cables) se escucha más abajo, por proyecto.
  useEffect(() => {
    if (!user) {
      setProyectos([]);
      setProyectosSupervisados([]);
      setConfig(null);
      return;
    }

    let unsubProyectos, unsubSupervisados, unsubConfig;
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
        },
        (error) => console.error("Error en proyectos de miembro:", error));

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

  const [puntos, setPuntos] = useDocsPorProyecto('puntos', idsVisibles);
  const [conexiones, setConexiones] = useDocsPorProyecto('conexiones', idsVisibles);
  const [cablesAcero, setCablesAcero] = useDocsPorProyecto('cablesAcero', idsVisibles);

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
