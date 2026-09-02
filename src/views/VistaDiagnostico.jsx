import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Trash2, CheckCircle, AlertTriangle, XCircle, Loader2, Cpu, HardDrive, Wifi, Smartphone, Share2, Camera, Zap, X, Check } from 'lucide-react';
import { getAllUploadsPending, getRespaldosSubidos, liberarRespaldos } from '../utils/photoDB';

const APP_VERSION = '1.2.0';
const IOS_PWA_LIMIT = 50 * 1024 * 1024; // 50 MB
const CHROME_LIMIT   = 6 * 1024 * 1024 * 1024; // 6 GB

const fmt = (bytes) => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);

// Versiones mínimas consideradas actualizadas
const MIN_VER = { chrome: 100, samsung: 18, edge: 100, firefox: 100, safari_ios: 15 };

const detectBrowser = () => {
  const ua = navigator.userAgent;
  const ios = isIOS();
  if (ios) {
    const iosVer = parseInt((ua.match(/OS (\d+)[_ ]/) || [])[1] || '0');
    const desactualizado = iosVer > 0 && iosVer < MIN_VER.safari_ios;
    const safariV = (ua.match(/Version\/(\d+)/) || [])[1] || iosVer || '?';
    if (/CriOS/.test(ua)) {
      const v = (ua.match(/CriOS\/(\d+)/) || [])[1] || '?';
      return { name: `Chrome (iOS) ${v}`, ok: !desactualizado, esIOS: true, desactualizado };
    }
    if (/FxiOS/.test(ua)) {
      const v = (ua.match(/FxiOS\/(\d+)/) || [])[1] || '?';
      return { name: `Firefox (iOS) ${v}`, ok: !desactualizado, esIOS: true, desactualizado };
    }
    return { name: `Safari ${safariV}`, ok: !desactualizado, esIOS: true, desactualizado };
  }
  if (/SamsungBrowser/.test(ua)) {
    const v = (ua.match(/SamsungBrowser\/([\d.]+)/) || [])[1] || '?';
    const desactualizado = parseInt(v) > 0 && parseInt(v) < MIN_VER.samsung;
    return { name: `Samsung Browser ${v}`, ok: !desactualizado, esIOS: false, desactualizado };
  }
  if (/Edg\//.test(ua)) {
    const v = (ua.match(/Edg\/([\d.]+)/) || [])[1] || '?';
    const desactualizado = parseInt(v) > 0 && parseInt(v) < MIN_VER.edge;
    return { name: `Edge ${v}`, ok: !desactualizado, esIOS: false, desactualizado };
  }
  if (/Chrome\//.test(ua)) {
    const v = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || '?';
    const desactualizado = parseInt(v) > 0 && parseInt(v) < MIN_VER.chrome;
    return { name: `Chrome ${v}`, ok: !desactualizado, esIOS: false, desactualizado };
  }
  if (/Firefox\//.test(ua)) {
    const v = (ua.match(/Firefox\/([\d.]+)/) || [])[1] || '?';
    const desactualizado = parseInt(v) > 0 && parseInt(v) < MIN_VER.firefox;
    return { name: `Firefox ${v}`, ok: !desactualizado, esIOS: false, desactualizado };
  }
  return { name: 'Desconocido', ok: false, esIOS: false, desactualizado: false };
};

const detectPlatform = () => {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const model = ua.match(/Android [^;]+; ([^)]+)/)?.[1] || 'Android';
    return model.trim();
  }
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'Mac';
  return navigator.platform || 'Desconocido';
};

const getConnectionInfo = () => {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return { type: 'Desconocido', speed: null };
  return {
    type: conn.effectiveType || conn.type || 'Desconocido',
    speed: conn.downlink ? `${conn.downlink} Mbps` : null,
    saveData: conn.saveData || false,
  };
};

const getSwCacheEntries = async () => {
  try {
    if (!('caches' in window)) return 0;
    const keys = await caches.keys();
    let total = 0;
    for (const key of keys) {
      const cache = await caches.open(key);
      const reqs = await cache.keys();
      total += reqs.length;
    }
    return total;
  } catch { return 0; }
};

const StatusRow = ({ label, value, ok, warn, sub }) => {
  const Icon = ok === true ? CheckCircle : ok === false ? XCircle : AlertTriangle;
  const color = ok === true ? 'text-green-500' : ok === false ? 'text-red-500' : 'text-amber-500';
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-100 last:border-0 gap-2">
      <div>
        <span className="text-xs text-slate-600 font-medium">{label}</span>
        {sub && <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs font-black text-slate-800 text-right">{value}</span>
        {ok !== null && <Icon size={13} className={color} />}
      </div>
    </div>
  );
};

const StorageBar = ({ used, limit, labelLimit, usage }) => {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div>
      <div className="flex justify-between items-end mb-1">
        <span className="text-[10px] font-black text-slate-500 uppercase">Límite: {labelLimit}</span>
        <span className="text-[10px] font-bold text-slate-600">{fmt(used)} usado</span>
      </div>
      <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500 flex items-center justify-end pr-1`}
          style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}>
          {pct > 10 && <span className="text-[8px] text-white font-black">{pct.toFixed(0)}%</span>}
        </div>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-slate-400">{fmt(limit - used)} libres</span>
        <span className="text-[9px] text-slate-400">{fmt(limit)} total</span>
      </div>
      {usage && (
        <div className="mt-2 space-y-1">
          {usage.map((u, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${u.color}`} />
              <span className="text-[9px] text-slate-500 flex-1">{u.label}</span>
              <span className="text-[9px] font-bold text-slate-600">{u.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── LIBERAR ESPACIO: respaldos YA SUBIDOS agrupados por proyecto ──────────────
const LiberarEspacioModal = ({ isDark, card, proyectos = [], onClose }) => {
  const [grupos, setGrupos] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [liberando, setLiberando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [huboCambios, setHuboCambios] = useState(false);

  const cargar = async () => {
    const lista = await getRespaldosSubidos().catch(() => []);
    const g = {};
    lista.forEach(r => {
      const k = r.proyectoId || 'otros';
      if (!g[k]) g[k] = { proyectoId: k, n: 0, bytes: 0, paths: [] };
      g[k].n++; g[k].bytes += r.bytes || 0; g[k].paths.push(r.path);
    });
    const arr = Object.values(g).map(x => ({
      ...x,
      nombre: proyectos.find(p => String(p.id) === String(x.proyectoId))?.nombre || `Proyecto ${x.proyectoId}`,
    })).sort((a, b) => b.bytes - a.bytes);
    setGrupos(arr);
    setSel(new Set());
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const seleccion = (grupos || []).filter(x => sel.has(x.proyectoId));
  const totalN = seleccion.reduce((t, x) => t + x.n, 0);
  const totalB = seleccion.reduce((t, x) => t + x.bytes, 0);

  const liberar = async () => {
    if (liberando) return;
    setLiberando(true);
    try {
      await liberarRespaldos(seleccion.flatMap(x => x.paths));
      setHuboCambios(true);
      await cargar();
    } catch {}
    setConfirmando(false);
    setLiberando(false);
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`${card} border-2 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden`}>
        <div className="bg-slate-900 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-white text-xs font-black uppercase tracking-widest">Liberar espacio</span>
          <button onClick={() => onClose(huboCambios)} className="p-1.5 rounded-lg bg-white/10 text-white active:scale-95"><X size={16} /></button>
        </div>
        <p className={`px-4 pt-3 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Solo se listan respaldos de fotos YA SUBIDAS a la nube. Las pendientes de subir no aparecen y nunca se tocan.
        </p>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {grupos === null ? (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
          ) : grupos.length === 0 ? (
            <p className={`text-xs text-center py-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No hay respaldos que liberar.</p>
          ) : (<>
            <button onClick={() => setSel(sel.size === grupos.length ? new Set() : new Set(grupos.map(x => x.proyectoId)))}
              className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-dashed active:scale-95 ${isDark ? 'border-slate-500 text-slate-300' : 'border-slate-400 text-slate-600'}`}>
              {sel.size === grupos.length ? 'Quitar selección' : 'Seleccionar todo lo ya subido'}
            </button>
            {grupos.map(x => (
              <button key={x.proyectoId} onClick={() => toggle(x.proyectoId)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left active:scale-[0.98] ${sel.has(x.proyectoId) ? 'border-slate-900 bg-slate-900 text-white' : isDark ? 'border-slate-600 text-slate-200' : 'border-slate-300 text-slate-800'}`}>
                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${sel.has(x.proyectoId) ? 'bg-white border-white' : isDark ? 'border-slate-500' : 'border-slate-400'}`}>
                  {sel.has(x.proyectoId) && <Check size={13} className="text-slate-900" strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-black truncate uppercase">{x.nombre}</span>
                  <span className={`block text-[10px] font-bold ${sel.has(x.proyectoId) ? 'text-slate-300' : 'text-slate-400'}`}>{x.n} foto{x.n !== 1 ? 's' : ''} · {fmt(x.bytes)}</span>
                </span>
              </button>
            ))}
          </>)}
        </div>
        <div className={`p-4 border-t-2 shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          {confirmando ? (
            <div className="space-y-2">
              <p className={`text-xs font-bold text-center ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                ¿Liberar {totalN} foto{totalN !== 1 ? 's' : ''} ({fmt(totalB)})? Sus copias siguen en la nube.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmando(false)} disabled={liberando}
                  className={`flex-1 py-3 rounded-xl text-xs font-black border-2 ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'}`}>CANCELAR</button>
                <button onClick={liberar} disabled={liberando}
                  className="flex-1 py-3 rounded-xl text-xs font-black bg-red-600 border-2 border-red-800 text-white active:scale-95 flex items-center justify-center gap-1">
                  {liberando ? <Loader2 size={13} className="animate-spin" /> : null} LIBERAR
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => sel.size && setConfirmando(true)} disabled={!sel.size}
              className="w-full py-3 rounded-xl text-xs font-black bg-slate-900 text-white uppercase tracking-widest active:scale-95 disabled:opacity-40">
              Liberar seleccionados{sel.size ? ` (${fmt(totalB)})` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function VistaDiagnostico({ theme, isDark, onVolver, proyectos = [] }) {
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState(null);
  const [accion, setAccion] = useState(null);
  const [mensajeAccion, setMensajeAccion] = useState(null);
  const [testCamara, setTestCamara] = useState(null);
  const [testWorker, setTestWorker] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setMensajeAccion(null);
    try {
      const browser = detectBrowser();
      const platform = detectPlatform();
      const conn = getConnectionInfo();
      const ios = isIOS();

      const [storageEst, swEntries, pendientes, persistido, respaldosList] = await Promise.all([
        navigator.storage?.estimate?.().catch(() => ({ quota: 0, usage: 0 })) || Promise.resolve({ quota: 0, usage: 0 }),
        getSwCacheEntries(),
        getAllUploadsPending().catch(() => []),
        (navigator.storage?.persisted?.() || Promise.resolve(null)).catch?.(() => null) ?? Promise.resolve(null),
        getRespaldosSubidos().catch(() => []),
      ]);
      const respaldos = { n: respaldosList.length, bytes: respaldosList.reduce((t, r) => t + (r.bytes || 0), 0) };

      // Límite real según plataforma
      // Cuota REAL reportada por el navegador (la constante vieja de 50 MB era solo la
      // caché de Safari antigua y daba porcentajes imposibles como 347%).
      const storageLimit = storageEst.quota || (ios ? IOS_PWA_LIMIT : CHROME_LIMIT);
      const storageUsed = storageEst.usage || 0;

      let swState = 'no-soportado';
      let swWaiting = false;
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
          swState = reg.active ? 'activo' : reg.installing ? 'instalando' : 'inactivo';
          swWaiting = !!reg.waiting;
        }
      } catch {}

      // Capacidades
      const tieneWasm = typeof WebAssembly === 'object';
      const tieneIDB = 'indexedDB' in window;
      const tieneCamera = !!(navigator.mediaDevices?.getUserMedia);
      const ram = navigator.deviceMemory || null;
      const cores = navigator.hardwareConcurrency || null;
      const screenRes = `${window.screen.width}×${window.screen.height}`;
      const pixelRatio = window.devicePixelRatio || 1;

      // Permiso de cámara
      let cameraPermission = 'desconocido';
      try {
        const perm = await navigator.permissions.query({ name: 'camera' });
        cameraPermission = perm.state; // 'granted' | 'denied' | 'prompt'
      } catch (_) {}

      // Heap JS (Chrome/Android)
      const heapInfo = performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      } : null;

      setDatos({
        browser, platform, conn, ios,
        storageLimit, storageUsed, swEntries,
        idb: { pendientes: pendientes.length },
        persistido, respaldos,
        sw: { state: swState, waiting: swWaiting },
        version: APP_VERSION,
        ua: navigator.userAgent,
        caps: { tieneWasm, tieneIDB, tieneCamera, ram, cores, screenRes, pixelRatio, cameraPermission, heapInfo },
        online: navigator.onLine,
        pwa: window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
      });
    } catch (e) { console.error(e); }
    setCargando(false);
  }, []);

  useState(() => { cargarDatos(); }, []);

  // Llamar cargarDatos al montar
  useState(() => { cargarDatos(); });
  // Workaround: usar un ref para ejecutar al montar
  const [iniciado, setIniciado] = useState(false);
  if (!iniciado) { setIniciado(true); cargarDatos(); }

  const forzarActualizacion = async () => {
    setAccion('sw');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => window.location.reload(), 800);
      } else if (reg) {
        await reg.update();
        setMensajeAccion('Sin actualizaciones pendientes. La app está al día.');
      } else {
        setMensajeAccion('Service Worker no disponible en este equipo.');
      }
    } catch { setMensajeAccion('No se pudo verificar la actualización.'); }
    setAccion(null);
  };

  // Confirmación propia (estilo app) para las acciones de limpieza
  const [confirmar, setConfirmar] = useState(null); // { titulo, mensaje, accion }
  const [liberarOpen, setLiberarOpen] = useState(false);

  const limpiarCacheSW = async () => {
    setAccion('cache');
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      setMensajeAccion(`Caché limpiada (${keys.length} caches). La app se recargará.`);
      setTimeout(() => window.location.reload(), 1500);
    } catch { setMensajeAccion('Error al limpiar caché.'); }
    setAccion(null);
  };

  const limpiarBorrador = () => {
    setAccion('local');
    try {
      const tenia = !!localStorage.getItem('kipo_draft');
      localStorage.removeItem('kipo_draft');
      setMensajeAccion(tenia ? 'Borrador eliminado correctamente.' : 'No había borrador guardado.');
      cargarDatos();
    } catch { setMensajeAccion('Error al limpiar.'); }
    setAccion(null);
  };

  // "Limpiar subidas pendientes" ELIMINADO (jul 2026): borraba fotos que solo existían
  // en este equipo. La cola ya salta tareas fallidas y la purga automática de respaldos
  // (30 días, limpiarBlobsVencidos) hace el mantenimiento sin riesgo.

  const probarCamara = async () => {
    setTestCamara('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setTestCamara({ ok: true });
    } catch (e) {
      setTestCamara({ ok: false, error: `${e.name}: ${e.message}` });
    }
  };

  const probarWorker = () => {
    setTestWorker('testing');
    try {
      const blob = new Blob(['self.onmessage = () => self.postMessage("ok");'], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const w = new Worker(url);
      const timeout = setTimeout(() => {
        w.terminate(); URL.revokeObjectURL(url);
        setTestWorker({ ok: false, error: 'Sin respuesta (timeout 3s)' });
      }, 3000);
      w.onmessage = () => {
        clearTimeout(timeout); w.terminate(); URL.revokeObjectURL(url);
        setTestWorker({ ok: true });
      };
      w.onerror = (e) => {
        clearTimeout(timeout); URL.revokeObjectURL(url);
        setTestWorker({ ok: false, error: e.message || 'Error desconocido' });
      };
      w.postMessage('test');
    } catch (e) {
      setTestWorker({ ok: false, error: e.message });
    }
  };

  const compartirDiagnostico = () => {
    if (!datos) return;
    const pct = datos.storageLimit > 0 ? Math.round((datos.storageUsed / datos.storageLimit) * 100) : 0;
    const permLabel = { granted: 'Concedido', denied: 'Denegado', prompt: 'Sin decidir', desconocido: 'Desconocido' };
    const lines = [
      `📱 DIAGNÓSTICO KIPO v${datos.version}`,
      `📅 ${new Date().toLocaleString()}`,
      ``,
      `🖥️ EQUIPO`,
      `Dispositivo: ${datos.platform}`,
      `Navegador: ${datos.browser.name}`,
      `RAM: ${datos.caps.ram ? datos.caps.ram + ' GB' : 'No disponible'}`,
      `CPU: ${datos.caps.cores ? datos.caps.cores + ' núcleos' : 'No disponible'}`,
      `Pantalla: ${datos.caps.screenRes} @${datos.caps.pixelRatio}x`,
      `Conexión: ${datos.conn.type}${datos.conn.speed ? ' · ' + datos.conn.speed : ''}`,
      ``,
      `📷 CÁMARA`,
      `API disponible: ${datos.caps.tieneCamera ? 'Sí' : 'No'}`,
      `Permiso: ${permLabel[datos.caps.cameraPermission] || datos.caps.cameraPermission}`,
      testCamara && testCamara !== 'testing' ? `Test activo: ${testCamara.ok ? '✅ OK' : '❌ ' + testCamara.error}` : null,
      testWorker && testWorker !== 'testing' ? `Test Worker: ${testWorker.ok ? '✅ OK' : '❌ ' + testWorker.error}` : null,
      ``,
      `💾 ALMACENAMIENTO`,
      `Usado por la app: ${fmt(datos.storageUsed)}`,
      datos.caps.heapInfo ? `Heap JS: ${fmt(datos.caps.heapInfo.used)} / ${fmt(datos.caps.heapInfo.limit)}` : null,
      ``,
      `⚙️ APP`,
      `Modo: ${datos.pwa ? 'PWA instalada' : 'Navegador'}`,
      `Online: ${datos.online ? 'Sí' : 'No'}`,
      `Service Worker: ${datos.sw.state}`,
      `WebAssembly: ${datos.caps.tieneWasm ? 'Sí' : 'No'}`,
    ].filter(l => l !== null).join('\n');

    if (navigator.share) {
      navigator.share({ title: 'Diagnóstico Kipo', text: lines }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
    }
  };

  const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';

  return (
    <div className={`w-full h-full flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
      {/* Header */}
      <div className="bg-slate-900 px-4 flex items-center justify-between border-b-2 border-slate-700 shrink-0" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
        <button onClick={onVolver} className="flex items-center gap-2 bg-white/10 text-white px-3 py-2 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
          <ArrowLeft size={14} strokeWidth={3} /> VOLVER
        </button>
        <div className="flex flex-col items-end">
          <span className="text-white font-black uppercase tracking-wider text-sm">DIAGNÓSTICO</span>
          <span className="text-[9px] text-orange-500 font-bold">EQUIPO</span>
        </div>
        <div className="flex items-center gap-2">
          {datos && (
            <button onClick={compartirDiagnostico} className="w-[33px] h-[33px] rounded-lg border-2 border-white text-white flex items-center justify-center active:scale-95 transition-all" title="Compartir diagnóstico">
              <Share2 size={14} strokeWidth={2.5} />
            </button>
          )}
          <button onClick={cargarDatos} disabled={cargando} className="w-[33px] h-[33px] rounded-lg border-2 border-white text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-40" title="Re-analizar">
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-orange-500" />
          </div>
        ) : datos ? (
          <>
            {mensajeAccion && (
              <div className="bg-green-50 border-2 border-green-400 rounded-xl px-4 py-3">
                <p className="text-green-700 text-xs font-bold">{mensajeAccion}</p>
              </div>
            )}

            {/* ESTADO DE LA APP */}
            <div className={`${card} border-2 rounded-xl overflow-hidden`}>
              <div className="bg-slate-900 px-4 py-2 flex items-center gap-2">
                <CheckCircle size={12} className="text-orange-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Estado de la App</span>
              </div>
              <div className="px-4 py-2">
                <StatusRow label="Versión app" value={`v${datos.version}`} ok={!datos.sw.waiting} warn={datos.sw.waiting} />
                <StatusRow label="Compilado el" value={import.meta.env.VITE_BUILD || '—'} ok />
                <StatusRow label="Service Worker" value={datos.sw.state} ok={datos.sw.state === 'activo'} />
                <StatusRow label="Modo instalación" value={datos.pwa ? 'PWA instalada' : 'Navegador'} ok={datos.pwa} />
                <StatusRow label="Conectividad" value={datos.online ? 'En línea' : 'Sin conexión'} ok={datos.online} />
                {datos.idb.pendientes > 0 && (
                  <StatusRow label="Fotos pendientes de subir" value={`${datos.idb.pendientes}`} ok={false}
                    sub="Hay fotos en cola que aún no se subieron a la nube" />
                )}
                {datos.sw.waiting ? (
                  <button onClick={forzarActualizacion} disabled={!!accion}
                    className="w-full mt-2 py-2.5 rounded-xl bg-amber-500 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    {accion === 'sw' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    APLICAR ACTUALIZACIÓN PENDIENTE
                  </button>
                ) : (
                  <button onClick={forzarActualizacion} disabled={!!accion}
                    className="w-full mt-2 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    {accion === 'sw' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    VERIFICAR ACTUALIZACIÓN
                  </button>
                )}
              </div>
            </div>

            {/* EQUIPO */}
            <div className={`${card} border-2 rounded-xl overflow-hidden`}>
              <div className="bg-slate-900 px-4 py-2 flex items-center gap-2">
                <Smartphone size={12} className="text-orange-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Equipo</span>
              </div>
              <div className="px-4 py-2">
                <StatusRow label="Dispositivo" value={datos.platform} ok={null} />
                <StatusRow
                  label="Navegador"
                  value={datos.browser.name}
                  ok={datos.browser.desactualizado ? false : datos.browser.ok}
                  sub={
                    datos.browser.desactualizado
                      ? 'Versión desactualizada — puede causar problemas en la app'
                      : datos.browser.esIOS
                        ? 'En iOS todos los navegadores usan el motor de Safari'
                        : null
                  }
                />
                <StatusRow label="Resolución pantalla" value={`${datos.caps.screenRes} @${datos.caps.pixelRatio}x`} ok={null} />
                <StatusRow label="RAM total" value={datos.caps.ram ? `${datos.caps.ram} GB` : 'No disponible'}
                  ok={datos.caps.ram >= 4 ? true : datos.caps.ram >= 2 ? null : datos.caps.ram ? false : null}
                  sub={datos.caps.ram < 2 ? 'Poca RAM — puede afectar el rendimiento' : null} />
                <StatusRow label="Núcleos CPU" value={datos.caps.cores ? `${datos.caps.cores} núcleos` : 'No disponible'}
                  ok={datos.caps.cores >= 4 ? true : datos.caps.cores ? null : null} />
                <StatusRow label="Conexión" value={`${datos.conn.type}${datos.conn.speed ? ` · ${datos.conn.speed}` : ''}`}
                  ok={['4g', 'wifi'].includes(datos.conn.type?.toLowerCase()) ? true : datos.conn.type === '3g' ? null : null} />
              </div>
            </div>

            {/* CAPACIDADES */}
            <div className={`${card} border-2 rounded-xl overflow-hidden`}>
              <div className="bg-slate-900 px-4 py-2 flex items-center gap-2">
                <Cpu size={12} className="text-orange-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Capacidades del Navegador</span>
              </div>
              <div className="px-4 py-2">
                <StatusRow label="IndexedDB (datos offline)" value={datos.caps.tieneIDB ? 'Soportado' : 'No soportado'}
                  ok={datos.caps.tieneIDB} sub="Necesario para funcionamiento offline" />
                <StatusRow label="WebAssembly" value={datos.caps.tieneWasm ? 'Soportado' : 'No soportado'}
                  ok={datos.caps.tieneWasm} sub="Necesario para procesamiento de imágenes" />
                <StatusRow
                  label="Acceso a cámara"
                  value={datos.caps.tieneCamera ? 'Disponible' : 'No disponible'}
                  ok={datos.caps.tieneCamera}
                />
                {(() => {
                  const p = datos.caps.cameraPermission;
                  const label = { granted: 'Concedido', denied: 'Denegado', prompt: 'Sin decidir', desconocido: 'Desconocido' }[p] || p;
                  const ok = p === 'granted' ? true : p === 'denied' ? false : null;
                  return <StatusRow label="Permiso de cámara" value={label} ok={ok} sub={p === 'denied' ? 'El usuario bloqueó la cámara — revisar configuración del navegador' : p === 'prompt' ? 'Se pedirá permiso la primera vez que se use' : null} />;
                })()}
                <StatusRow label="Service Worker" value={datos.sw.state !== 'no-soportado' ? 'Soportado' : 'No soportado'}
                  ok={datos.sw.state !== 'no-soportado'} sub="Necesario para funcionamiento como PWA" />
                {datos.caps.heapInfo && (
                  <StatusRow
                    label="Memoria JS (heap)"
                    value={`${fmt(datos.caps.heapInfo.used)} / ${fmt(datos.caps.heapInfo.limit)}`}
                    ok={datos.caps.heapInfo.used / datos.caps.heapInfo.limit < 0.8 ? true : null}
                    sub={datos.caps.heapInfo.used / datos.caps.heapInfo.limit > 0.8 ? 'Uso alto de memoria — puede causar cierres inesperados' : null}
                  />
                )}
              </div>
            </div>

            {/* PRUEBAS ACTIVAS */}
            <div className={`${card} border-2 rounded-xl overflow-hidden`}>
              <div className="bg-slate-900 px-4 py-2 flex items-center gap-2">
                <Zap size={12} className="text-orange-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Pruebas Activas</span>
              </div>
              <div className="px-4 py-3 space-y-3">

                {/* Test cámara */}
                <div>
                  <button
                    onClick={probarCamara}
                    disabled={testCamara === 'testing'}
                    className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {testCamara === 'testing' ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                    PROBAR CÁMARA
                  </button>
                  {testCamara && testCamara !== 'testing' && (
                    <div className={`mt-1.5 px-3 py-2 rounded-xl text-[10px] font-bold ${testCamara.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {testCamara.ok ? '✓ Cámara funcionando correctamente' : `✗ ${testCamara.error}`}
                    </div>
                  )}
                </div>

                {/* Test Worker */}
                <div>
                  <button
                    onClick={probarWorker}
                    disabled={testWorker === 'testing'}
                    className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {testWorker === 'testing' ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                    PROBAR WORKER (PROCESO EN SEGUNDO PLANO)
                  </button>
                  {testWorker && testWorker !== 'testing' && (
                    <div className={`mt-1.5 px-3 py-2 rounded-xl text-[10px] font-bold ${testWorker.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {testWorker.ok ? '✓ Worker respondió correctamente' : `✗ ${testWorker.error}`}
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-slate-400 leading-relaxed">
                  · Probar cámara abre brevemente el acceso para verificar que funciona.<br />
                  · Probar Worker verifica que el procesamiento de imágenes en segundo plano funciona correctamente.
                </p>
              </div>
            </div>

            {/* ALMACENAMIENTO */}
            <div className={`${card} border-2 rounded-xl overflow-hidden`}>
              <div className="bg-slate-900 px-4 py-2 flex items-center gap-2">
                <HardDrive size={12} className="text-orange-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Almacenamiento</span>
              </div>
              <div className="px-4 py-3">
                {/* Uso REAL, sin límites teóricos (el navegador no informa el espacio libre
                    verdadero del teléfono; la válvula de captura protege contra disco lleno) */}
                <div className={`flex items-center justify-between rounded-xl border-2 px-3 py-2.5 mb-2 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Espacio usado por la app</span>
                  <span className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(datos.storageUsed)}</span>
                </div>
                <div className="space-y-1 mb-1">
                  {[
                    { label: 'Firebase offline (puntos, fotos, proyectos)', color: 'bg-blue-500', value: '~' + fmt(Math.max(0, datos.storageUsed - 5 * 1024 * 1024)) },
                    { label: 'Archivos de la app (SW cache)', color: 'bg-purple-500', value: `${datos.swEntries} archivos` },
                    { label: 'Datos locales (kipo_*)', color: 'bg-orange-500', value: '< 1 MB' },
                  ].map((u, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${u.color}`} />
                      <span className="text-[9px] text-slate-500 flex-1">{u.label}</span>
                      <span className="text-[9px] font-bold text-slate-600">{u.value}</span>
                    </div>
                  ))}
                </div>
                <StatusRow label="Protección de datos" value={datos.persistido === true ? 'Activa' : datos.persistido === false ? 'Pendiente' : '—'}
                  ok={datos.persistido === true ? true : undefined}
                  sub={datos.ios && datos.persistido !== true
                    ? 'iPhone no usa esta función: la app instalada conserva sus datos igual.'
                    : datos.persistido === true
                    ? 'El navegador no borrará los datos de Kipo automáticamente.'
                    : 'Se solicita sola al abrir la app; se concede al instalar/usar la app.'} />
                <div className={`mt-2 rounded-xl border-2 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-slate-50'} px-3 py-2 flex items-center justify-between gap-2`}>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Respaldos de fotos ya subidas</p>
                    <p className="text-[9px] text-slate-400">{datos.respaldos?.n || 0} foto{(datos.respaldos?.n || 0) !== 1 ? 's' : ''} · {fmt(datos.respaldos?.bytes || 0)}</p>
                  </div>
                  <button onClick={() => setLiberarOpen(true)} disabled={!datos.respaldos?.n}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-40 shrink-0">
                    Liberar espacio
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 pt-1 leading-relaxed">
                  Si el almacenamiento se llena, la app libera espacio sola: primero mapas descargados, luego los respaldos más antiguos ya subidos. Las fotos sin subir nunca se tocan.
                </p>
              </div>
            </div>

            {/* LIMPIEZA */}
            <div className={`${card} border-2 rounded-xl overflow-hidden`}>
              <div className="bg-slate-900 px-4 py-2 flex items-center gap-2">
                <Trash2 size={12} className="text-orange-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Limpieza</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                <button onClick={() => setConfirmar({
                  titulo: 'Limpiar caché de la app',
                  mensaje: 'La app se recargará y necesitará INTERNET para volver a descargarse. No lo hagas en campo sin señal. No borra datos ni fotos.',
                  accion: () => limpiarCacheSW(),
                })} disabled={!!accion}
                  className="w-full py-3 rounded-xl border-2 border-red-500 text-red-600 font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-red-50">
                  {accion === 'cache' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  LIMPIAR CACHÉ DE LA APP
                </button>
                <button onClick={() => setConfirmar({
                  titulo: 'Limpiar borrador',
                  mensaje: 'Se eliminará el respaldo temporal del último punto sin guardar. Si tenías un punto a medias, sus datos locales se pierden.',
                  accion: () => limpiarBorrador(),
                })} disabled={!!accion}
                  className="w-full py-3 rounded-xl border-2 border-amber-500 text-amber-600 font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-amber-50">
                  {accion === 'local' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  LIMPIAR BORRADOR
                </button>
                <p className="text-[9px] text-slate-400 pt-1 leading-relaxed">
                  · Limpiar caché fuerza descarga de la última versión (recarga automática). No borra datos de Firestore ni fotos subidas.<br />
                  · Limpiar borrador elimina el formulario guardado temporalmente si quedó atascado.<br />
                  · Limpiar caché reinstala los archivos de la app desde cero (no borra datos ni fotos).
                </p>
              </div>
            </div>

          </>
        ) : (
          <div className="text-center py-16 text-slate-400 text-sm">Error al cargar diagnóstico</div>
        )}
      </div>

      {/* LIBERAR ESPACIO por proyecto */}
      {liberarOpen && (
        <LiberarEspacioModal isDark={isDark} card={card} proyectos={proyectos}
          onClose={(huboCambios) => { setLiberarOpen(false); if (huboCambios) cargarDatos(); }} />
      )}

      {/* Confirmación propia para acciones de limpieza */}
      {confirmar && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className={`${card} border-2 rounded-2xl w-full max-w-xs p-5 text-center`}>
            <AlertTriangle size={36} className="mx-auto mb-2 text-amber-500" />
            <h3 className={`font-black text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{confirmar.titulo}</h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{confirmar.mensaje}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmar(null)} className={`flex-1 py-3 rounded-xl text-xs font-black border-2 ${isDark ? 'border-slate-600 text-slate-200' : 'border-slate-300 text-slate-700'}`}>CANCELAR</button>
              <button onClick={() => { const a = confirmar.accion; setConfirmar(null); a(); }}
                className="flex-1 py-3 rounded-xl text-xs font-black bg-red-600 border-2 border-red-800 text-white active:scale-95">
                CONTINUAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
