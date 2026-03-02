import { useState, useEffect } from 'react';
import { getTheme } from '../utils/helpers';

export const useTheme = () => {
    const [isDark, setIsDark] = useState(false); 
  
  const theme = getTheme(isDark);

  // 🔔 EFECTO: CAMBIAR COLOR BARRA DE ESTADO IOS (Status Bar)
    useEffect(() => {
      // Buscamos la etiqueta meta, si no existe la creamos
      let metaThemeColor = document.querySelector("meta[name='theme-color']");
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
      }
      
      // Si es Dark Mode usamos Slate-900 (#0f172a), si es Light usamos Blanco (#ffffff)
      // Esto hará que la batería y hora se vean bien integradas
      metaThemeColor.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
    }, [isDark]);
  
  
  

  return {
    isDark,
    setIsDark,
    theme
  };
};
  
  
  
  
