import { useState, useEffect, useRef } from 'react';

export const useMapState = () => {
  
  const [iconSize, setIconSize] = useState(1);
  const [mapStyle, setMapStyle] = useState('google');
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState({ item: false, pasivo: false });
  const [menuEtiquetasAbierto, setMenuEtiquetasAbierto] = useState(false);
  const savedEtiquetasRef = useRef({ item: false, pasivo: false });

  const toggleMenuEtiquetas = () => {
    if (menuEtiquetasAbierto) {
      // Cerrar: guardar selección actual y ocultar etiquetas del mapa
      savedEtiquetasRef.current = { ...mostrarEtiquetas };
      setMostrarEtiquetas({ item: false, pasivo: false });
      setMenuEtiquetasAbierto(false);
    } else {
      // Abrir: restaurar selección guardada
      setMostrarEtiquetas({ ...savedEtiquetasRef.current });
      setMenuEtiquetasAbierto(true);
    }
  };
   const [yaSaltoAlInicio, setYaSaltoAlInicio] = useState(false);
  const [mapViewState, setMapViewState] = useState(null);
  const [gpsTrigger, setGpsTrigger] = useState(0);



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
    yaSaltoAlInicio,
    setYaSaltoAlInicio
  };
};