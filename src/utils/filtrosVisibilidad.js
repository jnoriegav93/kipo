export const filtrosVisibilidad = {
  
  obtenerColorDia(diaId, proyectos) {
    for (const proy of proyectos) {
      const dia = proy.dias.find(d => d.id === diaId);
      if (dia) return dia.color;
    }
    return '#ef4444';
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
