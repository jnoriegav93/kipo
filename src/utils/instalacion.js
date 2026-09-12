// Captura del evento de instalación de la PWA.
//
// El navegador dispara 'beforeinstallprompt' muy temprano, normalmente antes de
// que React monte nada. Si el listener se registra dentro de un componente, el
// evento ya pasó y el botón de instalar nunca aparece. Por eso se escucha aquí,
// en un módulo que main.jsx importa antes de renderizar, y se guarda el evento
// para que el banner lo recoja cuando le toque montarse.

let guardado = null;

export const promptGuardado = () => guardado;

export const AVISO_DISPONIBLE = 'kipo-instalacion-disponible';
export const AVISO_INSTALADA = 'kipo-instalacion-hecha';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Sin esto el navegador muestra su propia barra y ya no vuelve a ofrecerla
    e.preventDefault();
    guardado = e;
    window.dispatchEvent(new CustomEvent(AVISO_DISPONIBLE));
  });

  window.addEventListener('appinstalled', () => {
    guardado = null;
    window.dispatchEvent(new CustomEvent(AVISO_INSTALADA));
  });
}

// Lanza el diálogo nativo. Devuelve true si el usuario aceptó instalar.
export const instalar = async () => {
  if (!guardado) return false;
  const evento = guardado;
  guardado = null; // un prompt guardado solo sirve una vez
  evento.prompt();
  try {
    const { outcome } = await evento.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
};

// La app ya está instalada si corre fuera del navegador.
export const yaInstalada = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || window.navigator.standalone === true;
};

const esIOS = () => {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua)
    // iPadOS 13+ se anuncia como Mac; se distingue por el táctil
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// El aviso de instalar solo tiene sentido en el móvil: en el computador la app
// se usa desde el navegador y el banner solo estorbaría.
// Basta con que UNA de las dos señales diga móvil: userAgentData es la fiable
// donde existe, pero falta en Safari, así que la cadena clásica hace de respaldo.
export const esMovil = () => {
  if (typeof navigator === 'undefined') return false;
  if (navigator.userAgentData?.mobile === true) return true;
  return esIOS() || /Android|Mobile|IEMobile|Opera Mini/.test(navigator.userAgent || '');
};

// Qué instrucciones tocan cuando el navegador no ofrece el diálogo nativo.
export const plataforma = () => {
  const ua = navigator.userAgent || '';
  if (esIOS()) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-otro' : 'ios';
  // Android va antes que Firefox: su Firefox sí instala y toca la guía de Android
  if (/Android/.test(ua)) return 'android';
  if (/Firefox/.test(ua)) return 'firefox';
  return 'escritorio';
};
