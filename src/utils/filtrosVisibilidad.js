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

  getConexionesVisibles(conexiones, diasVisibles, proyectos) {
    return conexiones.filter(c => {
      const esVisible = diasVisibles.includes(c.diaId);
      const proyectoExiste = proyectos.some(proy => proy.id === c.proyectoId);
      return esVisible && proyectoExiste;
    });
  }

};
