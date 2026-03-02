export const mapInteractions = {
  handleMapaClick(params) {
    const {
      e, menuAbierto, modoFibra, puntoSeleccionado, vista, diaActual,
      diasVisibles, proyectos,
      setPuntoSeleccionado, setPuntoTemporal, setVista, setAlertData
    } = params;

    if(menuAbierto) return;
    if (modoFibra) { return; }
    if (puntoSeleccionado) { setPuntoSeleccionado(null); return; }

    if(vista === 'mapa') {
      if(!diaActual) {
        if (proyectos.length === 0) setVista('proyectos');
        else setAlertData({title: "Atención", message: "Selecciona un DÍA de trabajo para empezar."});
        return;
      }
      if(!diasVisibles.includes(diaActual)) {
        setAlertData({title: "Capa Oculta", message: "El día seleccionado está oculto. Enciéndelo para ver los puntos nuevos."});
      }

      if (e.latlng) {
          setPuntoTemporal({ lat: e.latlng.lat, lng: e.latlng.lng, id: Date.now(), diaId: diaActual });
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPuntoTemporal({ x, y, id: Date.now(), diaId: diaActual });
      }
    }
  },

  handlePuntoClick(params) {
    const {
      e, puntoId, modoFibra, dibujandoFibra, setPuntosRecorrido,
      setPuntoSeleccionado, setPuntoTemporal
    } = params;

    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    } else if (e && e.originalEvent && typeof e.originalEvent.stopPropagation === 'function') {
      e.originalEvent.stopPropagation();
    }

    // En modo fibra, solo agregar puntos si está dibujando
    if (modoFibra && dibujandoFibra) {
      setPuntosRecorrido(prev => {
        if (prev.length > 0 && prev[prev.length - 1] === puntoId) return prev;
        return [...prev, puntoId];
      });
      return;
    }

    // En modo fibra sin dibujar, no hacer selección de punto
    if (modoFibra) return;

    // Selección normal
    setPuntoSeleccionado(puntoId);
    setPuntoTemporal(null);
  }
};
