// Reemplazo de src/firebaseConfig.js para renderizar componentes en Node: sin conexión.
// Al renderizar no se llama a Firebase (las escuchas van en efectos, que el render del
// servidor no corre), así que basta con objetos vacíos.
export const app = {};
export const db = {};
export const auth = {};
export const storage = {};
