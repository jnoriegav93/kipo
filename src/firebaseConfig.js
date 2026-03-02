// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
// 👇 CAMBIO: Importamos initializeFirestore en lugar de getFirestore
import { initializeFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzB0l7F2Eh-NJb7Cx2XY_9YXEz4j5UnaY",
  authDomain: "kipo-d29af.firebaseapp.com",
  projectId: "kipo-d29af",
  storageBucket: "kipo-d29af.firebasestorage.app",
  messagingSenderId: "508441352898",
  appId: "1:508441352898:web:a6fcf92d758ac9b026795b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export { app };

// 👇 CONFIGURACIÓN ESPECIAL PARA SOLUCIONAR ERRORES DE RED/CORS
// Esto fuerza a Firestore a usar un método de conexión más robusto
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

// Habilitar persistencia offline (IndexedDB)
import { enableIndexedDbPersistence } from "firebase/firestore";
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a a time.
    console.log("Persistencia falló: Multiples pestañas abiertas");
  } else if (err.code == 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.log("Persistencia no soportada en este navegador");
  }
});

export const auth = getAuth(app);
export const storage = getStorage(app);