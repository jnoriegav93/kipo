export const generarHuellaDigital = () => {
  try {
    // 1. PRIMER INTENTO: ¿Ya tenemos un ID guardado en este navegador?
    // Esto evita que el código cambie al refrescar la página.
    const idGuardado = localStorage.getItem('kipo_device_id');
    if (idGuardado) {
      return idGuardado;
    }

    // 2. SI NO EXISTE, LO CREAMOS (Basado en Hardware)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Usamos medidas fijas para evitar variaciones por zoom
    canvas.width = 200; 
    canvas.height = 50;
    
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Kipo-Security", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Kipo-Security", 4, 17);

    // Datos del sistema (Sin resolución de pantalla para más estabilidad)
    const systemInfo = [
      navigator.platform,
      navigator.hardwareConcurrency, 
      navigator.language,            
      new Date().getTimezoneOffset() 
    ].join('|');

    const b64 = canvas.toDataURL();
    const huellaBruta = b64 + systemInfo; 

    // Generamos el Hash
    let hash = 0;
    for (let i = 0; i < huellaBruta.length; i++) {
      const char = huellaBruta.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; 
    }

    const idFinal = `ID-${Math.abs(hash).toString(16).toUpperCase()}`;

    // 3. GUARDAMOS EL ID EN MEMORIA PARA SIEMPRE
    localStorage.setItem('kipo_device_id', idFinal);

    return idFinal;

  } catch (error) {
    console.error("Error generando huella", error);
    // En caso de error extremo, generamos uno al azar y lo guardamos
    const fallbackId = `ID-ERR-${Date.now().toString(16).toUpperCase()}`;
    localStorage.setItem('kipo_device_id', fallbackId);
    return fallbackId;
  }
};
