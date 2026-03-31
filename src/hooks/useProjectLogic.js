import { doc, setDoc, updateDoc, writeBatch, query, collection, where, getDocs, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { COLORES_DIA } from '../data/constantes';

// 👇 AQUÍ RECIBIMOS TODO LO QUE NECESITAN LAS FUNCIONES
export const useProjectLogic = ({
    user,
    theme,
    proyectos, setProyectos,
    proyectoActual, setProyectoActual,
    setDiaActual,
    diasVisibles, setDiasVisibles,
    puntos,
    tempData,
    setPuntos, setConexiones,
    setModalOpen, setConfirmData, setAlertData,
    setMapViewState, setVista, setMenuAbierto,
    config
}) => {

// --- FUNCIÓN AUXILIAR: GENERAR CÓDIGO ÚNICO ---
const generarCodigoAcceso = async () => {
    const prefijo = "FIB-";
    let intentos = 0;
    const maxIntentos = 10;

    while (intentos < maxIntentos) {
        // Generar 6 caracteres alfanuméricos aleatorios
        const codigo = prefijo + Array.from({ length: 6 }, () => 
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
        ).join("");

        // Verificar si ya existe en Firebase
        const q = query(collection(db, "proyectos"), where("codigoAcceso", "==", codigo));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return codigo; // Código único encontrado
        }

        intentos++;
    }

    // Fallback: usar timestamp si no se encuentra código único
    return prefijo + Date.now().toString(36).toUpperCase().slice(-6);
};

// --- NUEVA FUNCIÓN: IR A UBICACIÓN DEL PROYECTO ---
const irUbicacionProyecto = (e, proyId) => {
    e.stopPropagation();
    
    const ptsProy = puntos.filter(p => p.proyectoId === proyId); 
    
    if (ptsProy.length === 0) {
        setAlertData({ title: "Sin Ubicación", message: "Este proyecto aún no tiene puntos en el mapa." });
        return;
    }

    const sumLat = ptsProy.reduce((acc, p) => acc + p.coords.lat, 0);
    const sumLng = ptsProy.reduce((acc, p) => acc + p.coords.lng, 0);
    const centroLat = sumLat / ptsProy.length;
    const centroLng = sumLng / ptsProy.length;

    setMapViewState({ center: [centroLat, centroLng], zoom: 17 });
    setVista('mapa');
    setMenuAbierto(false);
};

// --- PROYECTOS ---
const confirmarCrearProyecto = async () => {
    if(!tempData.nombre) return;
    
    // 1. Generar código único
    const codigoAcceso = await generarCodigoAcceso();
    
    // 2. Preparar datos
    const tipo = tempData.tipo || 'levantamiento';
    const diaUno = { id: `d_${Date.now()}`, nombre: 'Día 1', fecha: new Date().toLocaleDateString(), color: '#ef4444' };
    const idProyecto = String(Date.now());

    const modoFotos = tempData.modoFotos || 'comprimido';

    const nuevo = {
        id: idProyecto,
        nombre: tempData.nombre,
        tipo,
        modoFotos,
        dias: [diaUno],
        ownerId: user.uid,
        ownerNombre: config?.nombrePersonal || user?.displayName || '',
        ownerEmpresa: config?.empresaPersonal || '',
        codigoAcceso,
        compartidoCon: [],
        permisos: {},
        solicitudesPendientes: [],
        createdAt: new Date().toISOString()
    };

    // 3. Actualizar visualmente
    setProyectos([...proyectos, nuevo]);
    setProyectoActual(nuevo);
    setDiaActual(diaUno.id);
    setDiasVisibles([...diasVisibles, diaUno.id]);
    setModalOpen(null);

    // 4. Guardar en Firebase
    try {
        await setDoc(doc(db, "proyectos", idProyecto), nuevo);
        console.log("Proyecto creado en la nube con código:", codigoAcceso);
    } catch (error) {
        console.error("Error al crear proyecto:", error);
    }
};
  
const confirmarCrearDia = async () => {
    if(!tempData.nombre || !proyectoActual) return;
    
    const nuevoDia = { id: `d_${Date.now()}`, nombre: tempData.nombre, fecha: new Date().toLocaleDateString(), color: '#ef4444' };
    const proyActualizado = { ...proyectoActual, dias: [...proyectoActual.dias, nuevoDia] };
    
    setProyectos(proyectos.map(p => p.id === proyectoActual.id ? proyActualizado : p));
    setProyectoActual(proyActualizado); 
    setDiaActual(nuevoDia.id);
    setDiasVisibles([...diasVisibles, nuevoDia.id]);
    setModalOpen(null);

    try {
        const proyectoRef = doc(db, "proyectos", String(proyectoActual.id));
        await updateDoc(proyectoRef, { dias: proyActualizado.dias });
        console.log("Nuevo día guardado en la nube");
    } catch (error) {
        console.error("Error al guardar el día:", error);
    }
};

const seleccionarProyecto = (proy) => {
    setProyectoActual(proy);
    // Guardar último proyecto abierto
    try { localStorage.setItem('ultimoProyectoId', proy.id); } catch(e) {}
    if (proy.dias && proy.dias.length > 0) {
      const ultimoDia = proy.dias[proy.dias.length - 1];
      setDiaActual(ultimoDia.id);

      // Solo agregar días que NO estén explícitamente ocultos
      let ocultos = [];
      try { ocultos = JSON.parse(localStorage.getItem('diasOcultos') || '[]'); } catch(e) {}
      const idsNuevos = proy.dias.map(d => d.id).filter(id => !ocultos.includes(id));
      setDiasVisibles(prev => [...new Set([...prev, ...idsNuevos])]);
    } else {
      setDiaActual(null);
    }
};

const toggleVisibilidadDia = (diaId) => {
    let ocultos = [];
    try { ocultos = JSON.parse(localStorage.getItem('diasOcultos') || '[]'); } catch(e) {}
    if(diasVisibles.includes(diaId)) {
      setDiasVisibles(diasVisibles.filter(d => d !== diaId));
      if (!ocultos.includes(diaId)) ocultos.push(diaId);
    } else {
      setDiasVisibles([...diasVisibles, diaId]);
      ocultos = ocultos.filter(id => id !== diaId);
    }
    try { localStorage.setItem('diasOcultos', JSON.stringify(ocultos)); } catch(e) {}
};

const toggleVisibilidadProyecto = (e, proy) => {
    e.stopPropagation();
    const idsDiasProyecto = proy.dias.map(d => d.id);
    const todosVisibles = idsDiasProyecto.every(id => diasVisibles.includes(id));
    let ocultos = [];
    try { ocultos = JSON.parse(localStorage.getItem('diasOcultos') || '[]'); } catch(e2) {}
    if (todosVisibles) {
      setDiasVisibles(diasVisibles.filter(id => !idsDiasProyecto.includes(id)));
      idsDiasProyecto.forEach(id => { if (!ocultos.includes(id)) ocultos.push(id); });
    } else {
      setDiasVisibles([...new Set([...diasVisibles, ...idsDiasProyecto])]);
      ocultos = ocultos.filter(id => !idsDiasProyecto.includes(id));
    }
    try { localStorage.setItem('diasOcultos', JSON.stringify(ocultos)); } catch(e2) {}
};

const cambiarColorDia = async (proyId, diaId, color) => {
    // Actualizar localmente
    setProyectos(prev => prev.map(p => p.id === proyId ? { 
        ...p, 
        dias: p.dias.map(d => d.id === diaId ? { ...d, color } : d) 
    } : p));
    
    if(proyectoActual?.id === proyId) {
        setProyectoActual(prev => ({ 
            ...prev, 
            dias: prev.dias.map(d => d.id === diaId ? { ...d, color } : d) 
        }));
    }

    // Guardar en Firebase
    try {
        const proyecto = proyectos.find(p => p.id === proyId);
        if (proyecto) {
            const diasActualizados = proyecto.dias.map(d => 
                d.id === diaId ? { ...d, color } : d
            );
            const proyectoRef = doc(db, "proyectos", String(proyId));
            await updateDoc(proyectoRef, { dias: diasActualizados });
        }
    } catch (error) {
        console.error("Error al guardar color del día:", error);
    }
};

const cambiarColorProyecto = async (e, proyId, color) => {
    e.stopPropagation();
    
    // Actualizar localmente
    setProyectos(prev => prev.map(p => p.id === proyId ? { 
        ...p, 
        colorGlobal: color,
        dias: p.dias.map(d => ({ ...d, color }))
    } : p));
    
    if(proyectoActual?.id === proyId) {
        setProyectoActual(prev => ({ 
            ...prev, 
            colorGlobal: color, 
            dias: prev.dias.map(d => ({ ...d, color })) 
        }));
    }

    // Guardar en Firebase
    try {
        const proyecto = proyectos.find(p => p.id === proyId);
        if (proyecto) {
            const diasActualizados = proyecto.dias.map(d => ({ ...d, color }));
            const proyectoRef = doc(db, "proyectos", String(proyId));
            await updateDoc(proyectoRef, { 
                colorGlobal: color,
                dias: diasActualizados 
            });
        }
    } catch (error) {
        console.error("Error al guardar color del proyecto:", error);
    }
};

const solicitarBorrarProyecto = (proyId) => {
    setConfirmData({
      title: '¿Eliminar Proyecto?',
      message: 'Se borrará el proyecto y TODOS sus puntos permanentemente de la base de datos.',
      actionText: 'ELIMINAR',
      theme,
      onConfirm: async () => {
        const proyecto = proyectos.find(p => p.id === proyId);
        if (proyecto) {
           const idsDias = proyecto.dias ? proyecto.dias.map(d => d.id) : [];
           setPuntos(prev => prev.filter(p => !idsDias.includes(p.diaId)));
           setConexiones(prev => prev.filter(c => !idsDias.includes(c.diaId)));
        }
        setProyectos(prev => prev.filter(p => p.id !== proyId));
        if(proyectoActual?.id === proyId) { setProyectoActual(null); setDiaActual(null); }
        setConfirmData(null);

        try {
          const batch = writeBatch(db);
          const proyRef = doc(db, "proyectos", proyId);
          batch.delete(proyRef);

          const qPuntos = query(collection(db, "puntos"), where("proyectoId", "==", proyId));
          const snapPuntos = await getDocs(qPuntos);
          snapPuntos.forEach((docPunto) => batch.delete(docPunto.ref));

          const qCables = query(collection(db, "conexiones"), where("proyectoId", "==", proyId));
          const snapCables = await getDocs(qCables);
          snapCables.forEach((docCable) => batch.delete(docCable.ref));

          await batch.commit();
          console.log("Proyecto eliminado correctamente de la nube.");

        } catch (error) {
          console.error("Error al borrar de Firebase:", error);
          alert("Ocurrió un error al borrar de la nube, revisa tu conexión.");
        }
      }
    });
};

// --- FUNCIONES DE SUPERVISIÓN ---
const aprobarSupervisor = async (proyectoId, solicitud, permiso = 'lectura') => {
    try {
        const proyectoRef = doc(db, "proyectos", proyectoId);

        const infoColaborador = {
            nombre: solicitud.nombrePersonal || solicitud.nombre || '',
            empresa: solicitud.empresaPersonal || '',
            permiso
        };

        await updateDoc(proyectoRef, {
            compartidoCon: arrayUnion(solicitud.uid),
            [`permisos.${solicitud.uid}`]: permiso,
            [`supervisoresInfo.${solicitud.uid}`]: infoColaborador,
            solicitudesPendientes: arrayRemove(solicitud)
        });

        // Actualizar estado local (con protección contra duplicados por onSnapshot)
        setProyectos(prev => prev.map(p =>
            p.id === proyectoId ? {
                ...p,
                compartidoCon: (p.compartidoCon || []).includes(solicitud.uid)
                    ? (p.compartidoCon || [])
                    : [...(p.compartidoCon || []), solicitud.uid],
                permisos: { ...p.permisos, [solicitud.uid]: permiso },
                supervisoresInfo: { ...(p.supervisoresInfo || {}), [solicitud.uid]: infoColaborador },
                solicitudesPendientes: (p.solicitudesPendientes || []).filter(s => s.uid !== solicitud.uid)
            } : p
        ));

        if (proyectoActual?.id === proyectoId) {
            setProyectoActual(prev => ({
                ...prev,
                compartidoCon: (prev.compartidoCon || []).includes(solicitud.uid)
                    ? (prev.compartidoCon || [])
                    : [...(prev.compartidoCon || []), solicitud.uid],
                permisos: { ...prev.permisos, [solicitud.uid]: permiso },
                supervisoresInfo: { ...(prev.supervisoresInfo || {}), [solicitud.uid]: infoColaborador },
                solicitudesPendientes: (prev.solicitudesPendientes || []).filter(s => s.uid !== solicitud.uid)
            }));
        }

        const labels = { lectura: 'supervisor', edicion: 'editor', ambos: 'supervisor y editor' };
        setAlertData({ title: "Aprobado", message: `${solicitud.nombrePersonal || solicitud.nombre} se agregó como ${labels[permiso] || permiso}.` });
    } catch (error) {
        console.error("Error al aprobar colaborador:", error);
        setAlertData({ title: "Error", message: "No se pudo aprobar la solicitud." });
    }
};

const rechazarSupervisor = async (proyectoId, solicitud) => {
    try {
        const proyectoRef = doc(db, "proyectos", proyectoId);
        
        await updateDoc(proyectoRef, {
            solicitudesPendientes: arrayRemove(solicitud)
        });

        // Actualizar estado local
        setProyectos(prev => prev.map(p => 
            p.id === proyectoId ? {
                ...p,
                solicitudesPendientes: (p.solicitudesPendientes || []).filter(s => s.uid !== solicitud.uid)
            } : p
        ));

        if (proyectoActual?.id === proyectoId) {
            setProyectoActual(prev => ({
                ...prev,
                solicitudesPendientes: (prev.solicitudesPendientes || []).filter(s => s.uid !== solicitud.uid)
            }));
        }

        setAlertData({ title: "Rechazado", message: "Solicitud rechazada." });
    } catch (error) {
        console.error("Error al rechazar supervisor:", error);
        setAlertData({ title: "Error", message: "No se pudo rechazar la solicitud." });
    }
};

const eliminarSupervisor = async (proyectoId, supervisorUid) => {
    try {
        const proyectoRef = doc(db, "proyectos", proyectoId);
        
        await updateDoc(proyectoRef, {
            compartidoCon: arrayRemove(supervisorUid),
            [`permisos.${supervisorUid}`]: null
        });

        // Actualizar estado local
        setProyectos(prev => prev.map(p => 
            p.id === proyectoId ? {
                ...p,
                compartidoCon: (p.compartidoCon || []).filter(uid => uid !== supervisorUid),
                permisos: Object.fromEntries(
                    Object.entries(p.permisos || {}).filter(([key]) => key !== supervisorUid)
                )
            } : p
        ));

        if (proyectoActual?.id === proyectoId) {
            setProyectoActual(prev => ({
                ...prev,
                compartidoCon: (prev.compartidoCon || []).filter(uid => uid !== supervisorUid),
                permisos: Object.fromEntries(
                    Object.entries(prev.permisos || {}).filter(([key]) => key !== supervisorUid)
                )
            }));
        }

        setAlertData({ title: "Eliminado", message: "Colaborador eliminado del proyecto." });
    } catch (error) {
        console.error("Error al eliminar supervisor:", error);
        setAlertData({ title: "Error", message: "No se pudo eliminar el supervisor." });
    }
};

    return {
        confirmarCrearProyecto,
        confirmarCrearDia,
        seleccionarProyecto,
        toggleVisibilidadDia,
        toggleVisibilidadProyecto,
        cambiarColorDia,
        cambiarColorProyecto,
        solicitarBorrarProyecto,
        irUbicacionProyecto,
        aprobarSupervisor,
        rechazarSupervisor,
        eliminarSupervisor
    };
};