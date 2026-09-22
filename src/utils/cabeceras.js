// ESTILOS DE LAS CABECERAS (modales de proyecto y secciones del menú).
//
// Los botones de cerrar y de volver estaban escritos a mano en cada pantalla y
// habían quedado de tres formas distintas: equis suelta, equis con borde, y una
// flecha sin borde que además era un chevron girado 90°. Aquí viven los dos
// estilos que valen, para que cambiarlos sea tocar un solo sitio.
//
// Van en utils y NO en UI.jsx: ese archivo exporta componentes, y mezclarle
// funciones sueltas rompe la recarga en caliente de React (la regla
// `react-refresh/only-export-components` lo marca). Es justo lo que ese aviso
// existe para evitar.
//
// Se exportan CLASES y no un componente de cabecera: cada pantalla lleva su
// propio contenido en medio —título, icono, subtítulo, contador, botones extra—
// y un componente cerrado obligaría a pasarle media docena de huecos.

// Botón de cerrar (equis) o de volver (flecha). Con borde, que es lo que lo hace
// visible sobre cualquier fondo, y con el rojo reservado para el gesto de salir.
export const claseBotonCabecera = (theme) =>
  `${theme.bg} ${theme.text} p-2 rounded-lg border-2 ${theme.border} hover:bg-red-50 hover:text-red-600 hover:border-red-600 active:scale-95 transition-all shrink-0`;

// Alto parejo para todas. `completa` es para las que ocupan la pantalla entera en
// el celular: ahí hay que respetar la barra de estado o el título se mete debajo
// de la hora y la batería.
export const claseCabecera = (theme, { completa = false } = {}) =>
  `${theme.header} px-4 flex items-center justify-between gap-3 border-b-2 ${theme.border} shrink-0 ${completa ? 'pt-safe-header pb-3' : 'py-3'}`;
