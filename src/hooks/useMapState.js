import { useState, useEffect, useRef } from 'react';

export const useMapState = () => {
  
  const [iconSize, setIconSize] = useState(1);
  const [mapStyle, setMapStyle] = useState('google');
  // `calles` son los nombres de calle del mapa: apagados por defecto porque son un
  // SEGUNDO juego de teselas y con internet lento le quitan cupo de descarga al satélite.
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState({ item: false, pasivo: false, fibra: false, calles: false });
  const [menuEtiquetasAbierto, setMenuEtiquetasAbierto] = useState(false);
  const savedEtiquetasRef = useRef({ item: false, pasivo: false, fibra: false, calles: false });

  const toggleMenuEtiquetas = () => {
    if (menuEtiquetasAbierto) {
      // Cerrar: guardar selección actual y ocultar etiquetas del mapa
      savedEtiquetasRef.current = { ...mostrarEtiquetas };
      // `calles` se conserva igual que `fibra`: es una capa del mapa, no un rótulo de
      // punto, y no tiene por qué apagarse al cerrar el menú.
      setMostrarEtiquetas(prev => ({ item: false, pasivo: false, fibra: prev.fibra, calles: prev.calles }));
      setMenuEtiquetasAbierto(false);
    } else {
      // Abrir: restaurar selección guardada
      setMostrarEtiquetas(prev => ({ ...savedEtiquetasRef.current, fibra: prev.fibra, calles: prev.calles }));
      setMenuEtiquetasAbierto(true);
    }
  };
   const [yaSaltoAlInicio, setYaSaltoAlInicio] = useState(false);
  const [mapViewState, setMapViewState] = useState(null);
  const [gpsTrigger, setGpsTrigger] = useState(0);
  // Giro del mapa en grados (0 = norte arriba). Vive aquí para que el mapa y el
  // encabezado vean lo mismo: el botón de GPS necesita saber cuánto se torció.
  const [giro, setGiro] = useState(0);



// 🔔 EFECTO: OBTENER GPS AL INICIAR
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // ¡ÉXITO! Tenemos tu ubicación real
          setMapViewState({
            center: [position.coords.latitude, position.coords.longitude],
            zoom: 18
          });
        },
        (error) => {
          console.error("Error GPS:", error);
          // SI FALLA (ej: usuario deniega permiso), usamos una por defecto (Arequipa) para que no falle la app
          setMapViewState({ center: [-16.409047, -71.537451], zoom: 15 });
        },
        { enableHighAccuracy: true }
      );
    } else {
       // Si el navegador es muy viejo
       setMapViewState({ center: [-16.409047, -71.537451], zoom: 15 });
    }
  }, []);



  return {
    mapViewState,
    setMapViewState,
    iconSize,
    setIconSize,
    mapStyle,
    setMapStyle,
    mostrarEtiquetas,
    setMostrarEtiquetas,
    menuEtiquetasAbierto,
    setMenuEtiquetasAbierto,
    toggleMenuEtiquetas,
    gpsTrigger,
    setGpsTrigger,
    giro,
    setGiro,
    yaSaltoAlInicio,
    setYaSaltoAlInicio
  };
};