import { doc, setDoc, updateDoc, writeBatch, query, collection, where, getDocs, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { COLORES_DIA, colorDiaAleatorio, colorParaNuevoDia } from '../data/constantes';

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
// Estructura de un proyecto nuevo: la misma si nace del modal de Kipo o del modo Diseño
const armarProyectoNuevo = ({ nombre, tipo = 'levantamiento', modoFotos = 'comprimido' }) => {
    const diaUno = { id: `d_${Date.now()}`, nombre: 'Día 1', fecha: new Date().toLocaleDateString(), color: colorDiaAleatorio() };
    const nuevo = {
        id: String(Date.now()),
        nombre,
        tipo,
        modoFotos,
        dias: [diaUno],
        ownerId: user.uid,
        ownerNombre: config?.nombrePersonal || user?.displayName || '',
        ownerEmpresa: config?.empresaPersonal || '',
        compartidoCon: [],
        permisos: {},
        solicitudesPendientes: [],
        createdAt: new Date().toISOString()
    };
    return { nuevo, diaUno };
};

/* Proyecto creado desde el modo Diseño. Nace sin postes —el diseño puede ir antes
   que el levantamiento— pero es un proyecto normal de Kipo, con su Día 1, para que
   después la cuadrilla levante sobre él. No cambia el proyecto activo del mapa.
   Devuelve el id cuando Firestore confirma; si falla, lo quita de la lista. */
const crearProyectoDiseno = async (nombre) => {
    const { nuevo } = armarProyectoNuevo({ nombre });
    nuevo.creadoDesde = 'diseno';
    setProyectos(prev => (prev.some(p => p.id === nuevo.id) ? prev : [...prev, nuevo]));
    try {
        await setDoc(doc(db, "proyectos", nuevo.id), nuevo);
    } catch (error) {
        setProyectos(prev => prev.filter(p => p.id !== nuevo.id));
        throw error;
    }
    return nuevo.id;
};

const confirmarCrearProyecto = async () => {
    if(!tempData.nombre) return;


    // 2. Preparar datos
    const { nuevo, diaUno } = armarProyectoNuevo({
        nombre: tempData.nombre,
        tipo: tempData.tipo || 'levantamiento',
        modoFotos: tempData.modoFotos || 'comprimido',
    });
    const idProyecto = nuevo.id;

    // 3. Actualizar visualmente
    setProyectos([...proyectos, nuevo]);
    setProyectoActual(nuevo);
    setDiaActual(diaUno.id);
    setDiasVisibles([...diasVisibles, diaUno.id]);
    setModalOpen(null);

    // 4. Guardar en Firebase
    try {
        await setDoc(doc(db, "proyectos", idProyecto), nuevo);
        console.log("Proyecto creado en la nube.");
    } catch (error) {
        console.error("Error al crear proyecto:", error);
    }
};
  
const confirmarCrearDia = async () => {
    if(!tempData.nombre || !proyectoActual) return;
    
    const nuevoDia = { id: `d_${Date.now()}`, nombre: tempData.nombre, fecha: new Date().toLocaleDateString(), color: colorParaNuevoDia(proyectoActual.dias) };
    const proyActualizado = { ...proyectoActual, dias: [...proyectoActual.dias, nuevoDia] };
    
    setProyectos(proyectos.map(p => p.id === proyectoActual.id ? proyActualizado : p));
    setProyectoActual(proyActualizado); 
    setDiaActual(nuevoDia.id);
    setDiasVisibles([...diasVisibles, nuevoDia.id]);
    setModalOpen(null);

    try {
        const proyectoRef = doc(db, "proyectos", String(proyectoActual.id));
        await updateDoc(proyectoRef, { dias: proyActualizado.dias, diaActivoId: nuevoDia.id });
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
      let diaDefault;
      if (proy.esCompartido && proy.diaActivoId) {
        diaDefault = proy.dias.find(d => d.id === proy.diaActivoId) || proy.dias[proy.dias.length - 1];
      } else {
        // Restaurar último día seleccionado para este proyecto
        let savedDiaId = null;
        try { savedDiaId = localStorage.getItem(`ultimoDia_${proy.id}`); } catch(e) {}
        diaDefault = (savedDiaId && proy.dias.find(d => d.id === savedDiaId)) || proy.dias[proy.dias.length - 1];
      }
      setDiaActual(diaDefault.id);

      // Al activar el proyecto, mostrar TODOS sus puntos (prender todos sus días)
      const idsProyecto = proy.dias.map(d => d.id);
      setDiasVisibles(prev => [...new Set([...prev, ...idsProyecto])]);
      // Y quitarlos de la lista de ocultos para que no vuelvan a esconderse
      try {
        let ocultos = JSON.parse(localStorage.getItem('diasOcultos') || '[]');
        ocultos = ocultos.filter(id => !idsProyecto.includes(id));
        localStorage.setItem('diasOcultos', JSON.stringify(ocultos));
      } catch(e) {}
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
    const algunoVisible = idsDiasProyecto.some(id => diasVisibles.includes(id));
    let ocultos = [];
    try { ocultos = JSON.parse(localStorage.getItem('diasOcultos') || '[]'); } catch(e2) {}
    if (algunoVisible) {
      // Hay alguno visible → apagar todos
      setDiasVisibles(diasVisibles.filter(id => !idsDiasProyecto.includes(id)));
      idsDiasProyecto.forEach(id => { if (!ocultos.includes(id)) ocultos.push(id); });
    } else {
      // Todos apagados → encender todos
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

const uniformizarColorDias = async (proyId, color) => {
    // Actualizar todos los días del proyecto al mismo color en una sola operación
    setProyectos(prev => prev.map(p => p.id === proyId
        ? { ...p, dias: p.dias.map(d => ({ ...d, color })) }
        : p
    ));
    if (proyectoActual?.id === proyId) {
        setProyectoActual(prev => ({ ...prev, dias: prev.dias.map(d => ({ ...d, color })) }));
    }
    try {
        const proyecto = proyectos.find(p => p.id === proyId);
        if (proyecto) {
            const diasActualizados = proyecto.dias.map(d => ({ ...d, color }));
            const proyectoRef = doc(db, "proyectos", String(proyId));
            await updateDoc(proyectoRef, { dias: diasActualizados });
        }
    } catch (error) {
        console.error("Error al uniformizar colores:", error);
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
      // Si el proyecto está compartido en un equipo, avisar que también desaparece de ahí
      // (es un mismo proyecto con doble entrada: lista personal + equipo).
      message: `El proyecto y TODOS sus puntos irán a la Papelera por 15 días. Puedes restaurarlo desde el menú principal.${proyectos.find(p => String(p.id) === String(proyId))?.grupoId ? '\n\n⚠ Este proyecto está compartido en un equipo: también se eliminará de la lista del equipo.' : ''}`,
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
          // 1. Leer TODO lo que se va a borrar (puntos + fibras) desde la nube
          const qPuntos = query(collection(db, "puntos"), where("proyectoId", "==", proyId));
          const snapPuntos = await getDocs(qPuntos);
          const qCables = query(collection(db, "conexiones"), where("proyectoId", "==", proyId));
          const snapCables = await getDocs(qCables);

          // 2. Snapshot a la papelera: cada hijo agrupado (meta.grupo) + el proyecto.
          //    Restaurar el proyecto restaura también todos sus hijos agrupados.
          //    Los archivos de Storage NO se tocan (los borra la purga al vencer).
          try {
            const { enviarAPapelera, extraerStoragePaths, contarFotos } = await import('../utils/papelera');
            const grupo = String(proyId);
            let totalFotos = 0;
            for (const dp of snapPuntos.docs) {
              const datos = { id: dp.id, ...dp.data() };
              totalFotos += contarFotos(datos.datos);
              await enviarAPapelera({
                uid: user.uid, tipo: 'punto',
                snapshot: JSON.parse(JSON.stringify(datos)),
                coleccionOriginal: 'puntos', idOriginal: dp.id,
                proyectoId: proyId,
                proyectoNombre: proyecto?.nombre || '',
                nombre: `${datos.datos?.numero || dp.id} (de ${proyecto?.nombre || 'proyecto'})`,
                storagePaths: extraerStoragePaths(datos.datos),
                meta: { grupo },
              });
            }
            for (const dc of snapCables.docs) {
              const datos = { id: dc.id, ...dc.data() };
              await enviarAPapelera({
                uid: user.uid, tipo: 'fibra',
                snapshot: JSON.parse(JSON.stringify(datos)),
                coleccionOriginal: 'conexiones', idOriginal: dc.id,
                proyectoId: proyId,
                proyectoNombre: proyecto?.nombre || '',
                nombre: `Fibra ${datos.capacidad || ''} (de ${proyecto?.nombre || 'proyecto'})`.trim(),
                meta: { grupo, puntos: [] }, // hija de proyecto: vuelve con el proyecto completo
              });
            }
            await enviarAPapelera({
              uid: user.uid, tipo: 'proyecto',
              snapshot: proyecto ? JSON.parse(JSON.stringify(proyecto)) : { id: proyId },
              coleccionOriginal: 'proyectos', idOriginal: proyId,
              proyectoId: proyId,
              nombre: proyecto?.nombre || String(proyId),
              meta: { hijos: snapPuntos.size + snapCables.size, puntos: snapPuntos.size, fibras: snapCables.size, fotos: totalFotos },
            });
          } catch (e) { console.error('Papelera proyecto:', e); }

          // 3. Borrar de las colecciones (archivos de Storage intactos hasta la purga)
          const batch = writeBatch(db);
          batch.delete(doc(db, "proyectos", proyId));
          snapPuntos.forEach((docPunto) => batch.delete(docPunto.ref));
          snapCables.forEach((docCable) => batch.delete(docCable.ref));
          await batch.commit();
          console.log("Proyecto enviado a papelera y eliminado de la nube.");

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
            empresa: solicitud.empresaPersonal || solicitud.empresa || '',
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
        uniformizarColorDias,
        cambiarColorProyecto,
        solicitarBorrarProyecto,
        irUbicacionProyecto,
        aprobarSupervisor,
        rechazarSupervisor,
        eliminarSupervisor,
        crearProyectoDiseno
    };
};