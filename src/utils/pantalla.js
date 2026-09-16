// MODO COMPACTO. La app ocupa justo el alto de la ventana y no se desplaza, así que lo
// que manda es el ALTO útil: el que queda tras las pestañas y la barra de direcciones.
// El ancho también cuenta, porque el diseño de PC reparte en dos columnas.
// Con histéresis (entra y sale en medidas distintas) para que no baile en el límite.
export const COMPACTO_ENTRA = { alto: 800, ancho: 1200 };
export const COMPACTO_SALE = { alto: 840, ancho: 1240 };

export const esPantallaCompacta = (alto, ancho, compactaAhora = false) => {
  const limite = compactaAhora ? COMPACTO_SALE : COMPACTO_ENTRA;
  return alto < limite.alto || ancho < limite.ancho;
};
