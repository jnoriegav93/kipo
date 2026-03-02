import { useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, storage } from '../firebaseConfig';

// Convierte un File local a base64 comprimido via canvas (sin CORS, sin red)
const fileABase64 = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      const maxDim = 500;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objUrl);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(null); };
    img.src = objUrl;
  });
};

const LOGO_STORAGE_KEY = (email) => `kipo_logo_${email}`;

export const useLogo = (user) => {

  const [logoApp, setLogoApp] = useState(() => {
    try {
      const keys = Object.keys(localStorage);
      const logoKey = keys.find(k => k.startsWith('kipo_logo_'));
      if (logoKey) {
        const val = localStorage.getItem(logoKey);
        console.log('[LOGO] ✅ Cargado desde localStorage:', logoKey, '| tipo:', val?.substring(0, 30));
        return val;
      }
    } catch { /* ignore */ }
    console.log('[LOGO] ⚠️ No hay logo en localStorage');
    return null;
  });

  useEffect(() => {
    const fetchLogo = async () => {
      if (user && user.email) {
        console.log('[LOGO] 🔍 Buscando logo en Firestore para:', user.email);
        try {
          const snap = await getDoc(doc(db, "usuarios", user.email));
          if (snap.exists()) {
            const data = snap.data();
            console.log('[LOGO] Firestore tiene logoEmpresaBase64:', !!data.logoEmpresaBase64, '| logoEmpresa:', !!data.logoEmpresa);
            if (data.logoEmpresaBase64) {
              console.log('[LOGO] ✅ Usando base64 de Firestore');
              setLogoApp(data.logoEmpresaBase64);
              localStorage.setItem(LOGO_STORAGE_KEY(user.email), data.logoEmpresaBase64);
            } else if (data.logoEmpresa) {
              console.log('[LOGO] ⚠️ Solo hay URL en Firestore (sin base64):', data.logoEmpresa.substring(0, 60));
              setLogoApp(data.logoEmpresa);
            } else {
              console.log('[LOGO] ❌ No hay logo en Firestore');
            }
          } else {
            console.log('[LOGO] ❌ Documento de usuario no existe en Firestore');
          }
        } catch (error) {
          console.error('[LOGO] ❌ Error cargando logo de Firestore:', error);
        }
      }
    };
    fetchLogo();
  }, [user]);

  const handleCargarLogo = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    // Preview inmediato con blob local
    const localPreview = URL.createObjectURL(file);
    setLogoApp(localPreview);

    try {
      // Convertir a base64 comprimido (desde archivo local, sin CORS)
      const base64 = await fileABase64(file);
      if (base64) {
        setLogoApp(base64);
        localStorage.setItem(LOGO_STORAGE_KEY(user.email), base64);
      }

      // Subir al Storage para respaldo
      const storageRef = ref(storage, `logos_empresas/${user.email}`);
      await uploadBytes(storageRef, file);
      const urlDescarga = await getDownloadURL(storageRef);

      const userRef = doc(db, "usuarios", user.email);
      await setDoc(userRef, {
        logoEmpresa: urlDescarga,
        ...(base64 ? { logoEmpresaBase64: base64 } : {}),
      }, { merge: true });

      console.log("Logo actualizado en la nube correctamente");
    } catch (error) {
      console.error("Error subiendo logo:", error);
      alert("Error al subir el logo. Verifica tu conexión.");
      setLogoApp(null);
    }
  };

  return { logoApp, setLogoApp, handleCargarLogo };
};
