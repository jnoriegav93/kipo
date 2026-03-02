import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from '../firebaseConfig';
import { generarHuellaDigital } from '../security';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [deviceBlocked, setDeviceBlocked] = useState(false);



  // 🔔 DETECTOR DE SESIÓN MEJORADO
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuarioFirebase) => {
      if (usuarioFirebase) {
        // 🛑 ANTES DE DAR PASO, VERIFICAMOS LA HUELLA
        const huellaActual = generarHuellaDigital(); // Asegúrate que security.js se importa en App.jsx
        
        try {
          const userRef = doc(db, "usuarios", usuarioFirebase.email);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
             const datos = userSnap.data();
             const permitidos = datos.dispositivosAutorizados || [];

             if (permitidos.includes(huellaActual)) {
               // ✅ AUTORIZADO: Pasamos los datos y abrimos la App
               setDeviceBlocked(false);
               setUser({
                 uid: usuarioFirebase.uid,
                 email: usuarioFirebase.email,
                 name: usuarioFirebase.displayName || usuarioFirebase.email.split('@')[0],
                 photoURL: usuarioFirebase.photoURL
               });
             } else {
               // ⛔ NO AUTORIZADO: Bloqueamos y cerramos sesión interna
               console.warn("Dispositivo no autorizado. Bloqueando...");
               setDeviceBlocked(true); // Esto activará el escudo en Login
               await signOut(auth); // Cerramos sesión para que no pueda entrar
               setUser(null);
             }
          } else {
             // Usuario no existe en DB
             setUser(null);
          }
        } catch (error) {
          console.error("Error verificando dispositivo:", error);
          setUser(null);
        }
      } else {
        setUser(null);
        // Nota: No reseteamos deviceBlocked aquí para que el mensaje persista si fue un bloqueo
      }
    });
    return () => unsubscribe();
  }, []);

// FUNCIÓN PARA CERRAR SESIÓN REAL
  const cerrarSesion = async () => {
    try {
      await signOut(auth); // 1. Avisar a Firebase
      setUser(null);       // 2. Limpiar variable local
      setVista('mapa');    // 3. Resetear vista por si acaso
      setMenuAbierto(false);
    } catch (error) {
      console.error("Error al salir:", error);
    }
  };  





  return {
    user,
    deviceBlocked,
    cerrarSesion
  };
};