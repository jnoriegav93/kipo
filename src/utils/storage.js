import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebaseConfig";

/**
 * Sube un archivo a Firebase Storage
 * @param {Blob | File} file - Archivo a subir
 * @param {string} path - Ruta completa en Storage (ej: 'proyectos/123/puntos/456/foto.jpg')
 * @returns {Promise<string>} URL de descarga pública
 */
export const uploadImage = async (file, path) => {
    if (!storage) throw new Error("Storage no inicializado");

    const storageRef = ref(storage, path);
    try {
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return url;
    } catch (error) {
        console.error("Error subiendo imagen:", error);
        throw error;
    }
};

/**
 * Elimina un archivo de Firebase Storage
 * @param {string} url - URL de descarga del archivo
 */
export const deleteImage = async (url) => {
    if (!storage || !url) return;

    try {
        // Extraer la referencia desde la URL es complejo con regex, 
        // pero Firebase permite ref(storage, url)
        const fileRef = ref(storage, url);
        await deleteObject(fileRef);
    } catch (error) {
        console.error("Error eliminando imagen:", error);
        // No lanzamos error para no bloquear UI si falla limpieza
    }
};
