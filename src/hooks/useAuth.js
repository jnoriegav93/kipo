import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from '../firebaseConfig';
import { generarHuellaDigital } from '../security';
import { FERRETERIA_BASE_DEFAULT } from '../data/constantes';

// Huellas maestras — acceso a cualquier cuenta desde estos dispositivos
const HUELLAS_MAESTRAS = ['ID-134B2185', 'ID-3F410448'];
export const ADMIN_UID = 'E8CaZVgP4eZnjnN3OKTVi7bmoJN2';

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
          await usuarioFirebase.getIdToken();
          const userRef = doc(db, "usuarios", usuarioFirebase.email);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
             const datos = userSnap.data();
             const permitidos = datos.dispositivosAutorizados || [];

             const esMaestro = HUELLAS_MAESTRAS.includes(huellaActual);
             if (permitidos.includes(huellaActual) || esMaestro) {
               // ✅ AUTORIZADO: dispositivo en lista o huella maestra
               setDeviceBlocked(false);
               setUser({
                 uid: usuarioFirebase.uid,
                 email: usuarioFirebase.email,
                 name: usuarioFirebase.displayName || usuarioFirebase.email.split('@')[0],
                 photoURL: usuarioFirebase.photoURL,
                 tipoAcceso: datos.tipoAcceso || 'total',
                 calidadFotos: datos.calidadFotos || 'alta',
                 // Perfil empresarial: usuarios existentes (sin campo) = 'claro';
                 // los nuevos se crean con 'base' (ver crearUsuario / admin).
                 perfil: datos.perfil || 'claro'
               });
               // Config: si es un usuario NUEVO (config aún no existe), se le COPIA la lista
               // base de ferretería. Los usuarios EXISTENTES no se tocan (solo la obtienen
               // con el botón "Importar base" en el Configurador).
               (async () => {
                 try {
                   const cfgRef = doc(db, 'configuraciones', usuarioFirebase.uid);
                   const cfgSnap = await getDoc(cfgRef);
                   if (!cfgSnap.exists()) {
                     let baseItems = [];
                     try {
                       const baseSnap = await getDoc(doc(db, 'sistema', 'ferreteriaBase'));
                       baseItems = (baseSnap.exists() && Array.isArray(baseSnap.data().items)) ? baseSnap.data().items : [];
                     } catch { /* sin base en Firestore aún */ }
                     if (!baseItems.length) baseItems = FERRETERIA_BASE_DEFAULT;
                     const catalogoFerreteria = baseItems.map(b => ({
                       id: b.id, nombre: b.nombre, unidad: 'und', visible: true,
                       codigo: b.codigo || '', detalle: b.detalle || '',
                     }));
                     await setDoc(cfgRef, { email: usuarioFirebase.email, catalogoFerreteria }, { merge: true });
                   } else {
                     await setDoc(cfgRef, { email: usuarioFirebase.email }, { merge: true });
                   }
                 } catch (e) { console.error('Error config nuevo usuario:', e); }
               })();
             } else {
               // ⛔ NO AUTORIZADO: Bloqueamos y cerramos sesión interna
               console.warn("Dispositivo no autorizado. Bloqueando...");
               setDeviceBlocked(true);
               await signOut(auth);
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