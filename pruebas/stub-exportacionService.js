// Reemplazo de src/services/exportacionService.js para renderizar en Node: el original
// pide getFunctions() al cargarse. En el render nadie exporta nada.
const nada = async () => ({});
export const crearExportacion = nada;
export const auditarFotosHuerfanas = nada;
export const clasificarFotosProyecto = nada;
export const respaldarFotosExistentes = nada;
export const verificarFotosProyecto = nada;
export const independizarFotosPuntos = nada;
export const repararDesdeRespaldo = nada;
export const repararFotosServidor = nada;
export const suscribirseAExportacion = () => () => {};
