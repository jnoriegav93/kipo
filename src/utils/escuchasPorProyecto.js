/* Escuchas de puntos, fibras y cables por proyecto (las usa useFirebaseData).

   Firestore no acepta más de 30 valores en un `in`, así que los proyectos van en grupos
   de hasta 30, con una escucha por grupo. Y para Firestore, un grupo con otra lista es
   una consulta NUEVA: la baja entera del servidor, aunque el equipo ya tenga casi todo.

   Hasta el 24/09, cualquier cambio en la lista de proyectos cerraba y reabría todas las
   escuchas con los grupos rehechos. Crear un proyecto volvía a bajar los postes, fibras
   y cables de hasta 30 obras, y lo que se pidiera mientras tanto (el diseño de la obra
   recién creada, por ejemplo) quedaba en cola detrás de esa descarga.

   Ahora:
   - Mientras llegan las listas de proyectos (`asentado` falso) y la primera vez con las
     dos ya llegadas, los grupos se arman como siempre: de 30 en 30, en el orden
     recibido. Así el arranque termina con las mismas consultas que antes y Firestore
     retoma lo que ya tenía guardado en el equipo. Un grupo que ya coincide se deja
     abierto.
   - Después, los proyectos que aparecen van a un grupo NUEVO, solo o con los que llegan
     con ellos, y los grupos que ya escuchaban no se tocan. Uno que desaparece se oculta
     al publicar (soloVisibles), y su grupo se cierra cuando ya no le queda ninguno a la
     vista. En el próximo arranque se vuelven a armar de 30 en 30.

   `escuchar(ids, alDatos, alError)` abre la escucha de un grupo y devuelve con qué
   cerrarla. `publicar(docs)` recibe todo lo escuchado, sin filtrar: lo que ya no está a
   la vista lo quita quien lo muestra, porque la lista de proyectos cambia en el render. */

export const TOPE_IN = 30;

const enGrupos = (ids) => {
  const grupos = [];
  for (let i = 0; i < ids.length; i += TOPE_IN) grupos.push(ids.slice(i, i + TOPE_IN));
  return grupos;
};

export const crearEscuchasPorProyecto = ({ escuchar, publicar }) => {
  let grupos = []; // { ids, clave, docs, llego, bloquea, cerrar }
  // Si ya se armaron los grupos con las dos listas llegadas. El cambio que trae la segunda
  // lista llega junto con `asentado` y todavía va de 30 en 30.
  let yaAsentado = false;

  // Un grupo de los de 30 en 30 que todavía no llegó frena la publicación: si no, al
  // rehacer los grupos el mapa se vaciaría a medias. Los grupos nuevos de después no
  // frenan nada: son de proyectos que recién aparecen y no tienen nada a la vista.
  const intentarPublicar = () => {
    if (grupos.some(g => g.bloquea && !g.llego)) return;
    publicar(grupos.flatMap(g => g.docs));
  };

  const abrir = (ids, bloquea) => {
    const g = { ids, clave: ids.join(','), docs: [], llego: false, bloquea, cerrar: null };
    const llegada = (docs) => {
      if (docs) g.docs = docs;
      g.llego = true;
      if (grupos.includes(g)) intentarPublicar(); // uno ya cerrado no publica
    };
    g.cerrar = escuchar(ids, llegada, () => llegada(null));
    return g;
  };

  return {
    sincronizar(ids, asentado) {
      const deTreintaEnTreinta = !asentado || !yaAsentado || ids.length === 0;
      yaAsentado = asentado && ids.length > 0;
      if (deTreintaEnTreinta) {
        const abiertos = new Map(grupos.map(g => [g.clave, g]));
        grupos = enGrupos(ids).map(lista => {
          const g = abiertos.get(lista.join(','));
          if (!g) return abrir(lista, true);
          abiertos.delete(g.clave);
          return g;
        });
        abiertos.forEach(g => g.cerrar());
        return;
      }
      const visibles = new Set(ids);
      grupos = grupos.filter(g => {
        if (g.ids.some(id => visibles.has(id))) return true;
        g.cerrar();
        return false;
      });
      const escuchados = new Set(grupos.flatMap(g => g.ids));
      enGrupos(ids.filter(id => !escuchados.has(id))).forEach(lista => grupos.push(abrir(lista, false)));
    },
    cerrar() {
      grupos.forEach(g => g.cerrar());
      grupos = [];
      yaAsentado = false;
    },
  };
};

/* Lo publicado, sin lo de proyectos que ya no están a la vista. Lo que no trae proyecto
   (un cambio optimista a medio armar) se deja. Si no sobra nada, devuelve la misma
   lista, para no rehacer lo que depende de ella. */
export const soloVisibles = (docs, ids) => {
  if (ids.length === 0) return [];
  const visibles = new Set(ids.map(String));
  const quedan = docs.filter(d => d?.proyectoId == null || d.proyectoId === '' || visibles.has(String(d.proyectoId)));
  return quedan.length === docs.length ? docs : quedan;
};
