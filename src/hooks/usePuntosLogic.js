import { useRef } from 'react';
import { prepararFoto, procesarImagenInput } from '../utils/helpers';
import { enviarMensajeSistema, detectarCambiosFotos, detectarCambiosCaracteristicas, formatId } from '../utils/bitacoraAuto';
import { uploadImage, deleteImage } from '../utils/storage';

// 👇 EL GANCHO (HOOK) RECIBE TODO EL ESTADO NECESARIO
export const usePuntosLogic = ({
  user,
  puntoSeleccionado, setPuntoSeleccionado,
  puntoTemporal, setPuntoTemporal,
  modoEdicion, setModoEdicion,
  setModoLectura,
  datosFormulario, setDatosFormulario,
  memoriaUltimoPunto, setMemoriaUltimoPunto,
  diaActual, proyectoActual,
  puntos, setPuntos, setConexiones,
  setVista,
  setConfirmData, setAlertData,
  agregarTarea, theme,
  vistaAnterior, setVistaAnterior
}) => {






  // Ref para rastrear URLs subidas en la sesión actual (limpieza si se cancela)
  const fotosSubidasRef = useRef([]);

  const solicitarBorrarPunto = () => {
    const puntoABorrar = puntos.find(p => p.id === puntoSeleccionado);
    const identificador = formatId(puntoABorrar?.datos);
    setConfirmData({
      title: '¿Eliminar Poste?',
      message: 'Se borrará permanentemente de la base de datos.',
      actionText: 'BORRAR DEFINITIVAMENTE',
      theme,
      onConfirm: () => {
        setPuntos(prev => prev.filter(p => p.id !== puntoSeleccionado));
        setConexiones(prev => prev.filter(c => c.from !== puntoSeleccionado && c.to !== puntoSeleccionado));

        agregarTarea('borrar_punto', {
          coleccion: 'puntos',
          idDoc: String(puntoSeleccionado)
        });

        if (proyectoActual?.id) {
          enviarMensajeSistema(proyectoActual.id, `Se eliminó:\n${identificador}`, user.uid);
        }

        setPuntoSeleccionado(null);
        setConfirmData(null);
      }
    });
  };

  const intentarAgregarDatos = (e) => {
    e.stopPropagation();
    if (puntoTemporal) abrirFormulario();
    else setAlertData({ title: "Falta el punto", message: "Toca el mapa primero para crear un punto (gris).", theme });
  };

  // --- NUEVA FUNCIÓN: VER DETALLE ---
  const verDetalle = () => {
    // 1. Buscamos el punto igual que en iniciarEdicion
    const punto = puntos.find(p => p.id === puntoSeleccionado);

    if (punto) {
      // 2. Cargamos los datos COMPLETOS incluyendo coords y direccion
      setDatosFormulario({
        ...JSON.parse(JSON.stringify(punto.datos)),
        coords: punto.coords,  // ← Agregar coords del nivel superior
        direccion: punto.datos.direccion || punto.direccion  // ← Direccion
      });

      // 3. ACTIVAMOS MODO LECTURA (Bloquea los inputs)
      setModoLectura(true);

      // 4. Mostramos el formulario
      setModoEdicion(true);
      setVista('verDetalle');
    }
  };

  const cancelarPunto = () => {
    const urls = [...fotosSubidasRef.current];
    fotosSubidasRef.current = [];
    urls.forEach(url => deleteImage(url).catch(() => {}));
    setVista(vistaAnterior);
  };

  const iniciarEdicion = () => {
    fotosSubidasRef.current = [];
    const punto = puntos.find(p => p.id === puntoSeleccionado);
    if (punto) {
      setDatosFormulario({
        ...JSON.parse(JSON.stringify(punto.datos)),
        coords: punto.coords,  // ← Agregar coords
        direccion: punto.datos.direccion || punto.direccion
      });
      setVistaAnterior('mapa');  // ← Desde mapa siempre vuelve a mapa
      setModoLectura(false);
      setModoEdicion(true);
      setVista('formulario');
    }
  };

  const abrirFormulario = () => {
    fotosSubidasRef.current = [];
    setModoEdicion(false);
    setModoLectura(false);
    setVistaAnterior('mapa'); // Siempre volver al mapa al cancelar/guardar nuevo punto
    const now = new Date();
    const fecha = now.toISOString();
    const hora = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (memoriaUltimoPunto) {
      setDatosFormulario({ ...memoriaUltimoPunto, codigo: '', suministro: '', numero: '', fotos: [], observaciones: '', fecha, hora });
    } else {
      setDatosFormulario({ codigo: '', suministro: '', altura: null, fuerza: null, material: null, tipo: null, extrasSeleccionados: [], armadoSeleccionado: null, cables: null, ferreteriaExtraSeleccionada: [], fotos: [], observaciones: '', fecha, hora });
    }
    setVista('formulario');
  };


  // --- FUNCIÓN GUARDAR PUNTO (V2 - COMPATIBILIDAD TOTAL FIREBASE) ---
  const guardarPunto = async () => {
    fotosSubidasRef.current = []; // Fotos confirmadas, ya no son huérfanas
    // 1. Cierre inmediato visual - volver a vista anterior
    setVista(vistaAnterior);

    // IDs
    const idFinal = (modoEdicion && puntoSeleccionado) ? puntoSeleccionado : puntoTemporal.id;
    const datosPreliminares = { ...datosFormulario };

    // Actualización Optimista en UI
    if (modoEdicion && puntoSeleccionado) {
      setPuntos(prev => prev.map(p => p.id === idFinal ? { ...p, datos: datosPreliminares } : p));
    } else {
      const pVisual = {
        id: idFinal, diaId: diaActual, proyectoId: proyectoActual.id, ownerId: user.uid,
        coords: { lat: puntoTemporal?.lat || 0, lng: puntoTemporal?.lng || 0, x: puntoTemporal?.x || 0, y: puntoTemporal?.y || 0 },
        datos: datosPreliminares
      };
      setPuntos(prev => [...prev, pVisual]);
      setPuntoTemporal(null);
    }

    if (!modoEdicion) {
      // Actualizar memoria para el siguiente punto
      setMemoriaUltimoPunto({
        altura: datosFormulario.altura,
        fuerza: datosFormulario.fuerza,
        material: datosFormulario.material,
        tipo: datosFormulario.tipo,
        extrasSeleccionados: datosFormulario.extrasSeleccionados,
        armadoSeleccionado: datosFormulario.armadoSeleccionado,
        cables: datosFormulario.cables,
        ferreteriaExtraSeleccionada: datosFormulario.ferreteriaExtraSeleccionada
      });
    }

    // 2. PROCESAMIENTO DE FOTOS PARA FIREBASE (SIMPLIFICADO)
    try {
      let fotosProcesadas = {};

      // A. FOTOS ESTRUCTURADAS (PhotoManager) -> OBJETOS
      if (datosFormulario.fotos && !Array.isArray(datosFormulario.fotos)) {
        const secciones = Object.keys(datosFormulario.fotos);
        for (const seccion of secciones) {
          const dataSeccion = datosFormulario.fotos[seccion];
          fotosProcesadas[seccion] = {};
          const keys = Object.keys(dataSeccion);

          for (const key of keys) {
            const valor = dataSeccion[key];
            if (!valor) continue;

            if (typeof valor === 'object' && valor.url) {
              if (valor.url.startsWith('https://') || valor.url.startsWith('http://')) {
                // Ya subido a Firebase → conservar tal cual
                fotosProcesadas[seccion][key] = valor;
              } else if (valor.url.startsWith('data:')) {
                // Foto nueva desde PhotoManager (data URL comprimida) → subir a Firebase
                const arr = valor.url.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                const u8arr = new Uint8Array(bstr.length);
                for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
                const blob = new Blob([u8arr], { type: mime });

                const path = `proyectos/${proyectoActual?.id || 'temp'}/fotos_detalle/${seccion}_${key}_${Date.now()}.jpg`;
                const downloadUrl = await uploadImage(blob, path);

                fotosProcesadas[seccion][key] = {
                  url: downloadUrl,
                  thumb: valor.thumb || '',
                  timestamp: new Date().toISOString()
                };
              } else {
                fotosProcesadas[seccion][key] = valor;
              }
            } else if (typeof valor === 'string') {
              if (valor.startsWith('blob:')) {
                // blob: URL → saltar (no se puede recuperar)
                continue;
              } else if (valor.startsWith('data:')) {
                // String data URL (formato legacy) → subir a Firebase
                const blob = await fetch(valor).then(r => r.blob());
                const file = new File([blob], "temp.jpg", { type: "image/jpeg" });
                const { fullBlob, thumbBase64 } = await procesarImagenInput(file);
                const path = `proyectos/${proyectoActual?.id || 'temp'}/fotos_detalle/${seccion}_${key}_${Date.now()}.jpg`;
                const downloadUrl = await uploadImage(fullBlob, path);
                fotosProcesadas[seccion][key] = {
                  url: downloadUrl,
                  thumb: thumbBase64,
                  timestamp: new Date().toISOString()
                };
              } else {
                // URL http directa (formato legacy) → conservar
                fotosProcesadas[seccion][key] = valor;
              }
            }
          }
        }
      }

      // B. FOTOS GENERALES (Formulario bottom-bar) -> ARRAY
      // Estas ya vienen subidas a Storage (URLs http) por procesarFoto de Formulario.
      // Solo nos aseguramos de que existan en el objeto final.
      let fotosGeneralesProcesadas = datosFormulario.fotosGenerales || [];

      // 3. EMPAQUETADO FINAL (Filtrar valores undefined para evitar error de Firebase)
      const datosLimpios = {};
      Object.keys(datosFormulario).forEach(key => {
        if (datosFormulario[key] !== undefined) {
          datosLimpios[key] = datosFormulario[key];
        }
      });

      const paquete = {
        modo: (modoEdicion && puntoSeleccionado) ? 'editar' : 'crear',
        coleccion: 'puntos',
        idDoc: String(idFinal),
        datos: {
          id: idFinal,
          diaId: diaActual,
          proyectoId: proyectoActual.id,
          ownerId: user.uid,
          coords: { lat: puntoTemporal?.lat || 0, lng: puntoTemporal?.lng || 0, x: puntoTemporal?.x || 0, y: puntoTemporal?.y || 0 },
          datos: {
            ...datosLimpios,
            fotos: fotosProcesadas,
            fotosGenerales: fotosGeneralesProcesadas
          },
          timestamp: new Date().toISOString()
        }
      };

      agregarTarea('guardar_punto', paquete);
      console.log("Enviando a BBDD (Estructura Fija):", paquete);

      // Mensaje automático en bitácora
      if (proyectoActual?.id) {
        const id = formatId(datosFormulario);
        if (modoEdicion && puntoSeleccionado) {
          const puntoAnterior = puntos.find(p => p.id === puntoSeleccionado);
          const partes = [];
          const cambiosFotos = detectarCambiosFotos(puntoAnterior?.datos?.fotos, fotosProcesadas);
          if (cambiosFotos.length > 0) partes.push(...cambiosFotos);
          if (detectarCambiosCaracteristicas(puntoAnterior?.datos, datosFormulario)) {
            partes.push('Se editaron características del poste');
          }
          let msg = `Editado:\n${id}`;
          if (partes.length > 0) msg += `\n${partes.join('\n')}`;
          enviarMensajeSistema(proyectoActual.id, msg, user.uid);
        } else {
          enviarMensajeSistema(proyectoActual.id, `Punto creado:\n${id}`, user.uid);
        }
      }

    } catch (e) {
      console.error("ERROR GUARDANDO PUNTO:", e);
      alert("Error al guardar: " + e.message);
    }


    // Limpieza final
    setModoEdicion(false);
    setPuntoSeleccionado(null);
  };

  const procesarFoto = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // 1. Creamos un enlace temporal local (blob:...)
      // Esto permite que la foto se vea al instante sin usar internet
      const urlLocal = URL.createObjectURL(file);

      // 2. Guardamos la foto en el formulario
      // (La función guardarPunto se encargará de leer este archivo y subirlo después)
      setDatosFormulario(prev => ({ ...prev, fotos: [...prev.fotos, urlLocal] }));
    }
  };





  // --- FUNCIÓN MOVER PUNTO ---
  const moverPunto = async (puntoId, nuevaLat, nuevaLng) => {
    const puntoActual = puntos.find(p => p.id === puntoId);
    if (!puntoActual) return;

    // 1. Actualizar coords optimistamente
    const nuevasCoords = { ...puntoActual.coords, lat: nuevaLat, lng: nuevaLng };
    setPuntos(prev => prev.map(p => p.id === puntoId ? { ...p, coords: nuevasCoords } : p));

    // 2. Geocoding con nuevas coords
    let direccion = puntoActual.datos?.direccion || '';
    let ubicacion = puntoActual.datos?.ubicacion || '';
    try {
      const nominatimBase = import.meta.env.DEV ? '/api/nominatim' : 'https://nominatim.openstreetmap.org';
      const res = await fetch(`${nominatimBase}/reverse?format=json&lat=${nuevaLat}&lon=${nuevaLng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data.address) {
        const road = data.address.road || data.address.street || '';
        const house = data.address.house_number || '';
        direccion = `${road} ${house}`.trim() || '-';
        const city = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
        const state = data.address.state || data.address.region || '';
        ubicacion = [city, state].filter(Boolean).join(', ') || '';
      }
    } catch (e) {
      console.warn('Geocoding falló al mover punto:', e);
    }

    // 3. Actualizar estado con dirección y ubicación nuevas
    const datosMover = { ...puntoActual.datos, direccion, ubicacion };
    setPuntos(prev => prev.map(p =>
      p.id === puntoId ? { ...p, coords: nuevasCoords, datos: datosMover } : p
    ));

    // 4. Persistir en Firebase
    agregarTarea('mover_punto', {
      coleccion: 'puntos',
      idDoc: String(puntoId),
      coords: nuevasCoords,
      datos: datosMover
    });

    // 5. Bitácora
    if (proyectoActual?.id) {
      const id = formatId(puntoActual.datos);
      enviarMensajeSistema(proyectoActual.id, `Punto movido:\n${id}`, user.uid);
    }
  };

  // 👇 2. AL FINAL, DEVUELVE LAS FUNCIONES
  return {
    abrirFormulario,
    iniciarEdicion,
    verDetalle,
    intentarAgregarDatos,
    solicitarBorrarPunto,
    guardarPunto,
    procesarFoto,
    cancelarPunto,
    fotosSubidasRef,
    moverPunto
  };
};