import { useEffect, useState } from 'react';
import { esPantallaCompacta } from '../utils/pantalla';

// ¿La ventana es chica para el diseño de PC? Se mide en vivo: al cambiar el tamaño de la
// ventana o el zoom del navegador vuelve a decidir. La regla está en utils/pantalla.js.
export default function usePantallaCompacta() {
  const [compacta, setCompacta] = useState(
    () => typeof window !== 'undefined' && esPantallaCompacta(window.innerHeight, window.innerWidth, false)
  );

  useEffect(() => {
    const alCambiar = () => setCompacta(previa => esPantallaCompacta(window.innerHeight, window.innerWidth, previa));
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);

  return compacta;
}
