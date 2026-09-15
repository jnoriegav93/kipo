import { useRef } from 'react';
import { prepararFoto, procesarImagenInput } from '../utils/helpers';
import { enviarMensajeSistema, detectarCambiosFotos, detectarCambiosCaracteristicas, formatId } from '../utils/bitacoraAuto';
import { uploadImage } from '../utils/storage';
import { quitarCandidatasPorUrls } from '../utils/fotoHuerfanas';
import { validarPunto } from '../utils/validarPunto';
import { nombreTipoAcero } from '../utils/cablesAcero';

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
  proyectos,
  asegurarDiaHoy,
  puntos, setPuntos, conexiones, setConexiones, cablesAcero, setCablesAcero,
  setVista,
  setConfirmData, setAlertData,
  agregarTarea, theme,
  vistaAnterior, setVistaAnterior,
  config
}) => {






  // Ref para rastrear URLs subidas en la sesión actual (limpieza si se cancela)
  const fotosSubidasRef = useRef([]);
  const datosInicialesRef = useRef(null); // snapshot del formulario al abrir (para detectar cambios al cancelar)

  // Proyecto al que pertenece un elemento (EDITANDO es independiente del punto abierto)
  const proyectoDe = (proyectoId) => (proyectos || []).find(pr => String(pr.id) === String(proyectoId)) || null;

  const solicitarBorrarPunto = () => {
    const puntoABorrar = puntos.find(p => p.id === puntoSeleccionado);
    const identificador = formatId(puntoABorrar?.datos);
    // Fibras que TOCAN el punto (extremo o intermedio): al borrar el punto se borran
    // COMPLETAS (una fibra con un punto menos ya no es válida) y van a la papelera.
    const idSel = String(puntoSeleccionado);
    const fibrasDelPunto = (conexiones || []).filter(c => {
      const ids = (c.puntos?.length >= 2 ? c.puntos : [c.from, c.to]).filter(Boolean).map(String);
      return ids.includes(idSel);
    });
    // Un cable de acero sin uno de sus dos postes o sin su medio tramo deja de existir:
    // se va con el punto
    const cablesDelPunto = (cablesAcero || []).filter(c =>
      (c.puntos || []).map(String).includes(idSel) || (c.medioTramo != null && String(c.medioTramo) === idSel));
    const conectados = [
      fibrasDelPunto.length > 0 ? `${fibrasDelPunto.length} fibra${fibrasDelPunto.length !== 1 ? 's' : ''} conectada${fibrasDelPunto.length !== 1 ? 's' : ''}` : '',
      cablesDelPunto.length > 0 ? `${cablesDelPunto.length} cable${cablesDelPunto.length !== 1 ? 's' : ''} de acero` : '',
    ].filter(Boolean);
    const notaFibras = conectados.length > 0 ? ` (y ${conectados.join(' y ')})` : '';
    setConfirmData({
      title: '¿Eliminar Poste?',
      message: `Irá a la Papelera por 15 días${notaFibras}. Puedes restaurarlo desde el menú principal.`,
      actionText: 'ELIMINAR',
      theme,
      onConfirm: async () => {
        // Cerrar el modal DE INMEDIATO: si la escritura a la papelera tarda (conexión lenta),
        // el usuario volvía a presionar ELIMINAR y el punto se duplicaba en la papelera.
        setConfirmData(null);
        setPuntoSeleccionado(null);
        const idsFibras = new Set(fibrasDelPunto.map(f => String(f.id)));
        const idsCables = new Set(cablesDelPunto.map(c => String(c.id)));
        setPuntos(prev => prev.filter(p => p.id !== puntoSeleccionado));
        setConexiones(prev => prev.filter(c => !idsFibras.has(String(c.id))));
        setCablesAcero(prev => prev.filter(c => !idsCables.has(String(c.id))));

        // 1. Snapshot a la papelera (punto + cada fibra y cable completos) ANTES de borrar
        try {
          const { enviarAPapelera, enviarCableAceroAPapelera, extraerStoragePaths } = await import('../utils/papelera');
          if (puntoABorrar) {
            await enviarAPapelera({
              uid: user.uid, tipo: 'punto',
              snapshot: JSON.parse(JSON.stringify(puntoABorrar)),
              coleccionOriginal: 'puntos', idOriginal: puntoABorrar.id,
              proyectoId: puntoABorrar.proyectoId || proyectoActual?.id || null,
              proyectoNombre: (proyectoDe(puntoABorrar.proyectoId) || proyectoActual)?.nombre || '',
              nombre: identificador || String(puntoABorrar.id),
              storagePaths: extraerStoragePaths(puntoABorrar.datos),
            });
          }
          for (const f of fibrasDelPunto) {
            const idsPts = (f.puntos?.length >= 2 ? f.puntos : [f.from, f.to]).filter(Boolean).map(String);
            // Coordenadas de cada punto AL MOMENTO del borrado (para validar al restaurar)
            const metaPuntos = idsPts.map(pid => {
              const p = pid === idSel ? puntoABorrar : puntos.find(x => String(x.id) === pid);
              return { id: pid, coords: { lat: p?.coords?.lat ?? null, lng: p?.coords?.lng ?? null } };
            });
            await enviarAPapelera({
              uid: user.uid, tipo: 'fibra',
              snapshot: JSON.parse(JSON.stringify(f)),
              coleccionOriginal: 'conexiones', idOriginal: f.id,
              proyectoId: f.proyectoId || proyectoActual?.id || null,
              proyectoNombre: (proyectoDe(f.proyectoId) || proyectoDe(puntoABorrar?.proyectoId) || proyectoActual)?.nombre || '',
              nombre: `Fibra ${f.capacidad || ''} (${idsPts.length} puntos)`.trim(),
              meta: { puntos: metaPuntos },
            });
          }
          for (const c of cablesDelPunto) {
            await enviarCableAceroAPapelera({
              uid: user.uid, cable: c,
              proyectoNombre: (proyectoDe(c.proyectoId) || proyectoActual)?.nombre || '',
              nombre: `${nombreTipoAcero(c.ferrId)} (con ${identificador || 'el poste'})`,
            });
          }
        } catch (e) { console.error('Papelera:', e); }

        // 2. Borrar de las colecciones (los archivos de Storage NO se tocan)
        agregarTarea('borrar_punto', { coleccion: 'puntos', idDoc: idSel });
        fibrasDelPunto.forEach(f => agregarTarea('borrar_punto', { coleccion: 'conexiones', idDoc: String(f.id) }));
        cablesDelPunto.forEach(c => agregarTarea('borrar_punto', { coleccion: 'cablesAcero', idDoc: String(c.id) }));

        const chatBorrar = puntoABorrar?.proyectoId || proyectoActual?.id;
        if (chatBorrar) {
          const nombre = config?.nombrePersonal || user?.displayName || user?.email?.split('@')[0] || 'Usuario';
          const empresa = config?.empresaPersonal || '';
          enviarMensajeSistema(String(chatBorrar), `Se eliminó:\n${identificador}`, user.uid, nombre, empresa);
        }
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
    // La X (cancelar) NO borra fotos ni el punto: las fotos son lo valioso y ya quedaron
    // persistidas/encoladas. Se descartan solo los cambios de campos del formulario (que
    // no se escribieron). Un punto NUEVO con fotos queda como BORRADOR (parpadea) para
    // que lo termines o lo BORRES a mano desde el mapa; un punto EXISTENTE conserva la
    // foto que tomaste (no se destruye su enlace). Así nunca se pierde una foto por cancelar.
    fotosSubidasRef.current = [];
    try { localStorage.removeItem('kipo_draft'); } catch {}
    setVista(vistaAnterior);
  };

  // Detecta qué SECCIONES se modificaron respecto al estado inicial del formulario.
  const analizarCambios = () => {
    const actual = datosFormulario || {};
    const inicial = datosInicialesRef.current || {};
    const norm = (v) => { try { return JSON.stringify(v ?? null); } catch { return ''; } };
    const FERR = ['ferreteriaFinal', 'armadosSeleccionados', 'ferreteriaExtra', 'armadoSeleccionado', 'ferreteriaExtraSeleccionada'];
    const fotos = norm(actual.fotos) !== norm(inicial.fotos) || norm(actual.fotosGenerales) !== norm(inicial.fotosGenerales);
    const ferreteria = FERR.some(k => norm(actual[k]) !== norm(inicial[k]));
    const IGNORE = new Set([...FERR, 'fotos', 'fotosGenerales', 'estado', 'coords', 'timestamp', 'fecha', 'hora', 'ordenTendido', 'revEstado', 'ferrEstado']);
    const keys = new Set([...Object.keys(actual), ...Object.keys(inicial)].filter(k => !IGNORE.has(k)));
    const datos = [...keys].some(k => norm(actual[k]) !== norm(inicial[k]));
    return { datos, ferreteria, fotos };
  };

  // X inteligente: si hubo cambios en datos/ferretería, avisa antes de descartar.
  // Las FOTOS nunca se descartan (ya están guardadas); solo se descartan campos.
  const intentarCancelar = () => {
    const esNuevo = !(modoEdicion && puntoSeleccionado);
    const { datos, ferreteria, fotos } = analizarCambios();
    // Punto NUEVO con al menos una foto: se CREA el punto con todos sus datos (datos y
    // ferretería incluidos), SIN alerta — la foto lo hace valioso, no se pierde nada.
    if (esNuevo && fotos) { guardarPunto({ omitirValidacion: true }); return; }
    const secciones = [];
    if (datos) secciones.push('datos');
    if (ferreteria) secciones.push('ferretería');
    if (secciones.length === 0) { cancelarPunto(); return; } // nada que descartar (las fotos quedan)
    const notaFotos = fotos
      ? '\n\nLas FOTOS no se descartan (quedan guardadas). Para borrar una foto, hacelo desde la sección de fotos.'
      : '';
    setConfirmData({
      title: 'Cambios sin guardar',
      message: `Se modificó: ${secciones.join(' · ')}.${notaFotos}`,
      actionText: 'DESCARTAR CAMBIOS',
      onConfirm: () => { setConfirmData(null); cancelarPunto(); },
      extraText: 'CONSERVAR CAMBIOS',
      onExtra: () => { setConfirmData(null); guardarPunto({ omitirValidacion: true }); },
      theme,
    });
  };

  const iniciarEdicion = () => {
    fotosSubidasRef.current = [];
    const punto = puntos.find(p => p.id === puntoSeleccionado);
    if (punto) {
      const cargados = {
        ...JSON.parse(JSON.stringify(punto.datos)),
        coords: punto.coords,  // ← Agregar coords
        direccion: punto.datos.direccion || punto.direccion
      };
      datosInicialesRef.current = JSON.parse(JSON.stringify(cargados)); // snapshot original para detectar cambios
      setDatosFormulario(cargados);
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
    const inicial = memoriaUltimoPunto
      ? { ...memoriaUltimoPunto, codigo: '', suministro: '', numero: '', fotos: {}, observaciones: '', fecha, hora }
      : { codigo: '', suministro: '', altura: null, fuerza: null, material: null, tipo: null, extrasSeleccionados: [], armadoSeleccionado: null, cables: null, ferreteriaExtraSeleccionada: [], fotos: {}, observaciones: '', fecha, hora };
    datosInicialesRef.current = JSON.parse(JSON.stringify(inicial)); // snapshot inicial para detectar cambios
    setDatosFormulario(inicial);
    setVista('formulario');
  };


  // --- FUNCIÓN GUARDAR PUNTO (V2 - COMPATIBILIDAD TOTAL FIREBASE) ---
  const guardarPunto = async (opts = {}) => {
    // Validación de datos mínimos. Se OMITE en el guardado automático al cancelar con
    // foto (opts.omitirValidacion), para nunca bloquear/perder una foto ya tomada.
    if (!opts?.omitirValidacion) {
      const errVal = validarPunto(datosFormulario);
      if (errVal) { setAlertData({ title: 'Faltan datos', message: errVal, theme }); return; }
    }
    fotosSubidasRef.current = []; // Fotos confirmadas, ya no son huérfanas
    // 1. Cierre inmediato visual - volver a vista anterior
    setVista(vistaAnterior);

    // IDs
    const idFinal = (modoEdicion && puntoSeleccionado) ? puntoSeleccionado : puntoTemporal.id;
    // El punto se guarda: sus fotos ya no son huérfanas (se quitan por url)
    (() => {
      const urls = [];
      const walk = (o) => {
        if (!o || typeof o !== 'object') return;
        if (typeof o.url === 'string') urls.push(o.url);
        Object.values(o).forEach(v => { if (v && typeof v === 'object') walk(v); });
      };
      walk(datosFormulario.fotos);
      quitarCandidatasPorUrls(urls);
    })();
    // Al guardar cambios se cae el visto bueno de lo que se tocó: lo revisado ya no
    // es lo que hay. Los datos y la ferretería tienen su propio check; una foto
    // afecta a los dos, porque las dos revisiones se apoyan en ellas.
    const { datos: camDatos, ferreteria: camFerr, fotos: camFotos } = analizarCambios();
    const datosPreliminares = { ...datosFormulario, estado: 'confirmado' };
    if (camDatos || camFotos) datosPreliminares.revEstado = null;
    if (camFerr || camFotos) datosPreliminares.ferrEstado = null;

    // Día: en edición se conserva el del punto; en creación se asigna por fecha de hoy (auto-días)
    const puntoExistente = (modoEdicion && puntoSeleccionado) ? puntos.find(p => p.id === puntoSeleccionado) : null;
    const diaIdFinal = puntoExistente
      ? (puntoExistente.diaId || diaActual)
      : (asegurarDiaHoy ? asegurarDiaHoy() : diaActual);
    // Proyecto: en edición SE CONSERVA el del punto (EDITANDO es independiente del punto
    // abierto); en creación va al proyecto activo.
    const proyectoIdFinal = String(puntoExistente?.proyectoId || proyectoActual.id);

    // Actualización Optimista en UI
    if (modoEdicion && puntoSeleccionado) {
      setPuntos(prev => prev.map(p => p.id === idFinal ? { ...p, datos: datosPreliminares } : p));
    } else {
      const pVisual = {
        id: idFinal, diaId: diaIdFinal, proyectoId: proyectoIdFinal, ownerId: user.uid,
        coords: { lat: puntoTemporal?.lat || 0, lng: puntoTemporal?.lng || 0, x: puntoTemporal?.x || 0, y: puntoTemporal?.y || 0 },
        datos: datosPreliminares
      };
      // Upsert: si ya existe el borrador (mismo id), lo reemplaza (confirmado); si no, lo agrega.
      setPuntos(prev => prev.some(p => p.id === idFinal) ? prev.map(p => p.id === idFinal ? pVisual : p) : [...prev, pVisual]);
      setPuntoTemporal(null);
    }

    if (!modoEdicion) {
      // Actualizar memoria para el siguiente punto (conserva selección de poste).
      // Si el punto es MEDIO TRAMO no pisa los campos de poste: así el siguiente
      // poste normal hereda los valores del último poste REAL, no del tramo.
      const rawTE = datosFormulario.tipoElemento;
      const tiposEl = Array.isArray(rawTE) ? rawTE : (rawTE ? [rawTE] : []);
      const esMedioTramo = tiposEl.includes('medioTramo');
      setMemoriaUltimoPunto(prev => ({
        ...(prev || {}),
        altura: esMedioTramo ? (prev?.altura ?? null) : datosFormulario.altura,
        fuerza: esMedioTramo ? (prev?.fuerza ?? null) : datosFormulario.fuerza,
        material: esMedioTramo ? (prev?.material ?? null) : datosFormulario.material,
        tipo: esMedioTramo ? (prev?.tipo ?? null) : datosFormulario.tipo,
        cables: esMedioTramo ? (prev?.cables ?? null) : datosFormulario.cables,
        tipoPoste: datosFormulario.tipoPoste,
        extrasSeleccionados: datosFormulario.extrasSeleccionados,
        armadoSeleccionado: datosFormulario.armadoSeleccionado,
        ferreteriaExtraSeleccionada: datosFormulario.ferreteriaExtraSeleccionada
      }));
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

                const path = `proyectos/${proyectoIdFinal || 'temp'}/fotos_detalle/${seccion}_${key}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
                const downloadUrl = await uploadImage(blob, path);

                fotosProcesadas[seccion][key] = {
                  url: downloadUrl,
                  thumb: valor.thumb || '',
                  timestamp: new Date().toISOString()
                };
              } else {
                fotosProcesadas[seccion][key] = valor;
              }
            } else if (typeof valor === 'object') {
              // Foto PENDIENTE (sin url todavía: subiendo / solo miniatura). Conservar, NO
              // descartar: el blob está a salvo en el equipo y se subirá/enganchará al
              // reconectar (cola de recuperación).
              if (valor.thumb || valor.uploading || valor._path) {
                fotosProcesadas[seccion][key] = { thumb: valor.thumb || '', uploading: true, _path: valor._path || '' };
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
                const path = `proyectos/${proyectoIdFinal || 'temp'}/fotos_detalle/${seccion}_${key}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
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
          diaId: diaIdFinal,
          proyectoId: proyectoIdFinal,
          ownerId: user.uid,
          coords: { lat: puntoTemporal?.lat || 0, lng: puntoTemporal?.lng || 0, x: puntoTemporal?.x || 0, y: puntoTemporal?.y || 0 },
          datos: {
            ...datosLimpios,
            estado: 'confirmado',
            fotos: fotosProcesadas,
            fotosGenerales: fotosGeneralesProcesadas
          },
          timestamp: new Date().toISOString()
        }
      };

      agregarTarea('guardar_punto', paquete);
      console.log("Enviando a BBDD (Estructura Fija):", paquete);

      // Limpiar borrador de fotos
      try { localStorage.removeItem('kipo_draft'); } catch {}

      // Liberar paths guardados del registro de huérfanos
      try {
        const paths = [];
        Object.values(fotosProcesadas).forEach(sec => {
          if (sec && typeof sec === 'object') {
            Object.values(sec).forEach(f => {
              if (f?._path) paths.push(f._path);
              if (f?._pathHD) paths.push(f._pathHD);
            });
          }
        });
        if (paths.length > 0) {
          const pending = JSON.parse(localStorage.getItem('kipo_pending_paths') || '[]');
          localStorage.setItem('kipo_pending_paths', JSON.stringify(
            pending.filter(e => !paths.includes(e.path))
          ));
        }
      } catch {}

      // Mensaje automático en bitácora — al chat del proyecto DEL PUNTO
      if (proyectoIdFinal) {
        const nombre = config?.nombrePersonal || user?.displayName || user?.email?.split('@')[0] || 'Usuario';
        const empresa = config?.empresaPersonal || '';
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
          enviarMensajeSistema(proyectoIdFinal, msg, user.uid, nombre, empresa);
        } else {
          enviarMensajeSistema(proyectoIdFinal, `Punto creado:\n${id}`, user.uid, nombre, empresa);
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

    // 5. Bitácora — al chat del proyecto DEL PUNTO
    const chatMover = puntoActual?.proyectoId || proyectoActual?.id;
    if (chatMover) {
      const nombre = config?.nombrePersonal || user?.displayName || user?.email?.split('@')[0] || 'Usuario';
      const empresa = config?.empresaPersonal || '';
      const id = formatId(puntoActual.datos);
      enviarMensajeSistema(String(chatMover), `Punto movido:\n${id}`, user.uid, nombre, empresa);
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
    intentarCancelar,
    fotosSubidasRef,
    moverPunto
  };
};