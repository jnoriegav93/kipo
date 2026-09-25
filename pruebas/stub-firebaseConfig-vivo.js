// Reemplazo de src/firebaseConfig.js con una sesión abierta, para montar hooks que
// esperan el token antes de escuchar (useFirebaseData). Va con stub-firestore-vivo.js.
export const app = {};
export const db = {};
export const auth = { currentUser: { uid: 'U', getIdToken: async () => 'token' } };
export const storage = {};
