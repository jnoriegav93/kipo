export const filtrosVisibilidad = {

  // El color del día es de cada persona (decidido el 22/09, como las etiquetas y el
  // filtro por días): primero el que eligió quien mira (`personales`, de su
  // configuración) y, si no eligió, el que el día trae guardado en el proyecto.
  // `proyectos` tiene que ser la lista completa (propios y compartidos): con solo los
  // propios, los postes de un proyecto compartido caían al rojo de respaldo.
  obtenerColorDia(diaId, proyectos, personales) {
    if (personales && personales[diaId]) return personales[diaId];
    for (const proy of proyectos) {
      const dia = (proy.dias || []).find(d => d.id === diaId);
      if (dia) return dia.color;
    }
    return '#ef4444';
  },

  // Los días de un proyecto con el color personal de quien mira encima del guardado.
  // Siempre devuelve una lista NUEVA: quien la recibe la ordena, y ordenar la del
  // proyecto la cambiaría en el estado.
  conColoresPersonales(dias, personales) {
    if (!personales) return [...(dias || [])];
    return (dias || []).map(d => (personales[d.id] ? { ...d, color: personales[d.id] } : d));
  },

  getPuntosVisibles(puntos, diasVisibles, proyectos) {
    return puntos.filter(p => {
      const esVisible = diasVisibles.includes(p.diaId);
      const proyectoExiste = proyectos.some(proy => proy.id === p.proyectoId);
      return esVisible && proyectoExiste;
    });
  },

  // Las fibras y los cables de acero NO se filtran por día: un ramal no pertenece a
  // una jornada, se recorre a lo largo de varias. Tienen su propio encendido y
  // apagado en su barra. Solo los PUNTOS van asociados a un día.
  // `diasVisibles` se sigue recibiendo para no cambiar las llamadas, pero no se usa.
  getConexionesVisibles(conexiones, diasVisibles, proyectos) {
    return conexiones.filter(c => proyectos.some(proy => proy.id === c.proyectoId));
  }

};
