export const mapInteractions = {
  handleMapaClick(params) {
    const {
      e, menuAbierto, modoFibra, dibujandoFibra, setPuntosRecorrido,
      puntoSeleccionado, vista, diaActual,
      diasVisibles, proyectos, proyectoActual, theme,
      setPuntoSeleccionado, setPuntoTemporal, setVista, setAlertData,
      setConfirmData, onEncenderDia
    } = params;

    if(menuAbierto) return;
    // Dibujando fibra: un toque en el mapa (fuera de cualquier poste) agrega un
    // VÉRTICE LIBRE. La fibra tiene geometría propia, así que no necesita un poste
    // debajo para doblar.
    if (modoFibra && dibujandoFibra && e?.latlng) {
      setPuntosRecorrido?.(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
      return;
    }
    if (modoFibra) { return; }
    if (puntoSeleccionado) { setPuntoSeleccionado(null); return; }

    if(vista === 'mapa') {
      if(!proyectoActual) {
        if (proyectos.length === 0) setVista('proyectos');
        else setAlertData({title: "Atención", message: "Selecciona un proyecto para empezar."});
        return;
      }

      // Día de HOY: el punto nuevo se asigna automáticamente a la fecha actual.
      const hoy = new Date().toLocaleDateString();
      const diaHoy = (proyectoActual.dias || []).find(d => d.fecha === hoy);

      // Solo avisar si el día de HOY ya existe y está oculto (sus puntos no se verán).
      if (diaHoy && !diasVisibles.includes(diaHoy.id)) {
        if (setConfirmData) {
          setConfirmData({
            title: "Capa Oculta",
            message: "Los puntos del día de hoy están ocultos. ¿Encender la capa para ver el punto nuevo?",
            actionText: "ENCENDER DÍA",
            theme,
            onConfirm: () => { if (onEncenderDia) onEncenderDia(diaHoy.id); setConfirmData(null); }
          });
        } else {
          setAlertData({title: "Capa Oculta", message: "Los puntos del día de hoy están ocultos."});
        }
      }

      const diaTemp = diaHoy ? diaHoy.id : diaActual;
      // ID globalmente único (timestamp + aleatorio): permite crear el punto con
      // setDoc y que el id local sea el id definitivo en la base (sin colisión
      // entre dispositivos). El prefijo de tiempo conserva el orden por parseInt(id).
      const nuevoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (e.latlng) {
          setPuntoTemporal({ lat: e.latlng.lat, lng: e.latlng.lng, id: nuevoId, diaId: diaTemp });
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPuntoTemporal({ x, y, id: nuevoId, diaId: diaTemp });
      }
    }
  },

  handlePuntoClick(params) {
    const {
      e, puntoId, puntoCoords, modoFibra, dibujandoFibra, setPuntosRecorrido,
      setPuntoSeleccionado, setPuntoTemporal
    } = params;

    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    } else if (e && e.originalEvent && typeof e.originalEvent.stopPropagation === 'function') {
      e.originalEvent.stopPropagation();
    }

    // En modo fibra, solo agregar vértices si está dibujando.
    // Tocar un poste clava el vértice EXACTAMENTE en su coordenada y deja anotado
    // de qué poste se trata; tocar el mapa (handleMapaClick) crea un vértice libre.
    if (modoFibra && dibujandoFibra) {
      if (!puntoCoords || puntoCoords.lat == null) return;
      setPuntosRecorrido(prev => {
        const ult = prev[prev.length - 1];
        if (ult && String(ult.puntoId) === String(puntoId)) return prev; // no repetir
        return [...prev, { lat: puntoCoords.lat, lng: puntoCoords.lng, puntoId: String(puntoId) }];
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
