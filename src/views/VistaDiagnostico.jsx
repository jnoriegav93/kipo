import { useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Trash2, CheckCircle, AlertTriangle, XCircle, Loader2, Cpu, HardDrive, Wifi, Smartphone, Share2, Camera, Zap } from 'lucide-react';
import { getAllUploadsPending, deleteUploadPending } from '../utils/photoDB';

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

export default function VistaDiagnostico({ theme, isDark, onVolver }) {
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

      const [storageEst, swEntries, pendientes] = await Promise.all([
        navigator.storage?.estimate?.().catch(() => ({ quota: 0, usage: 0 })) || Promise.resolve({ quota: 0, usage: 0 }),
        getSwCacheEntries(),
        getAllUploadsPending().catch(() => []),
      ]);

      // Límite real según plataforma
      const storageLimit = ios ? IOS_PWA_LIMIT : CHROME_LIMIT;
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

  const limpiarPendientes = async () => {
    setAccion('idb');
    try {
      const todos = await getAllUploadsPending();
      await Promise.all(todos.map(p => deleteUploadPending(p.path)));
      setMensajeAccion(`${todos.length} subidas pendientes eliminadas.`);
      cargarDatos();
    } catch { setMensajeAccion('Error al limpiar pendientes.'); }
    setAccion(null);
  };

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
      `Usado: ${fmt(datos.storageUsed)} / ${fmt(datos.storageLimit)} (${pct}%)`,
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
            <button onClick={compartirDiagnostico} className="flex items-center gap-1 bg-white/10 text-white px-3 py-2 rounded-xl font-black text-xs active:scale-95 transition-all">
              <Share2 size={13} strokeWidth={3} />
            </button>
          )}
          <button onClick={cargarDatos} disabled={cargando} className="flex items-center gap-1 bg-white/10 text-white px-3 py-2 rounded-xl font-black text-xs active:scale-95 transition-all disabled:opacity-40">
            <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} strokeWidth={3} />
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
                {datos.ios ? (
                  <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-amber-700 text-[10px] font-black">⚠ Dispositivo iOS — límite real de la PWA: 50 MB</p>
                    <p className="text-amber-600 text-[9px] mt-0.5">En iOS todos los navegadores comparten el mismo límite de Safari. Para trabajo intensivo se recomienda usar Android con Chrome.</p>
                  </div>
                ) : (
                  <div className="mb-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <p className="text-blue-700 text-[10px] font-black">Chrome/Android — límite estimado: 6 GB</p>
                    <p className="text-blue-600 text-[9px] mt-0.5">Chrome asigna hasta el 60% del espacio libre del disco.</p>
                  </div>
                )}
                <StorageBar
                  used={datos.storageUsed}
                  limit={datos.storageLimit}
                  labelLimit={datos.ios ? '50 MB (iOS PWA)' : '6 GB (Chrome)'}
                  usage={[
                    { label: 'Firebase offline (puntos, fotos, proyectos)', color: 'bg-blue-500', value: '~' + fmt(Math.max(0, datos.storageUsed - 5 * 1024 * 1024)) },
                    { label: 'Archivos de la app (SW cache)', color: 'bg-purple-500', value: `${datos.swEntries} archivos` },
                    { label: 'Datos locales (kipo_*)', color: 'bg-orange-500', value: '< 1 MB' },
                  ]}
                />
              </div>
            </div>

            {/* LIMPIEZA */}
            <div className={`${card} border-2 rounded-xl overflow-hidden`}>
              <div className="bg-slate-900 px-4 py-2 flex items-center gap-2">
                <Trash2 size={12} className="text-orange-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Limpieza</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                <button onClick={limpiarCacheSW} disabled={!!accion}
                  className="w-full py-3 rounded-xl border-2 border-red-500 text-red-600 font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-red-50">
                  {accion === 'cache' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  LIMPIAR CACHÉ DE LA APP
                </button>
                <button onClick={limpiarBorrador} disabled={!!accion}
                  className="w-full py-3 rounded-xl border-2 border-amber-500 text-amber-600 font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-amber-50">
                  {accion === 'local' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  LIMPIAR BORRADOR
                </button>
                {datos.idb.pendientes > 0 && (
                  <button onClick={limpiarPendientes} disabled={!!accion}
                    className="w-full py-3 rounded-xl border-2 border-slate-400 text-slate-600 font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-slate-50">
                    {accion === 'idb' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    LIMPIAR SUBIDAS PENDIENTES ({datos.idb.pendientes})
                  </button>
                )}
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
    </div>
  );
}
