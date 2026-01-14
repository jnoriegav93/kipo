import React, { useState } from 'react';
import { auth, db } from './firebaseConfig';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { generarHuellaDigital } from './security';
import { Eye, EyeOff, Copy, Check, MessageCircle, ShieldAlert, MapPin, ChevronRight, Lock } from 'lucide-react'; // Agregamos 'Check'

const Login = ({ onLogin, initialBlocked }) => {
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deviceCode, setDeviceCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  //const [bloqueoDispositivo, setBloqueoDispositivo] = useState(false);
  const [bloqueoDispositivo, setBloqueoDispositivo] = useState(initialBlocked || false);
  
  // Estado para feedback visual de copiado
  const [copied, setCopied] = useState(false);

  const DOMINIO_FIJO = "@kipo.com";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setBloqueoDispositivo(false);

    try {
      let emailFinal = emailInput.trim();
      if (!emailFinal.includes('@')) {
        emailFinal = emailFinal + DOMINIO_FIJO;
      }

      const huellaActual = generarHuellaDigital();
      const userCredential = await signInWithEmailAndPassword(auth, emailFinal, password);
      const user = userCredential.user;

      const userRef = doc(db, "usuarios", user.email);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const datos = userSnap.data();
        const permitidos = datos.dispositivosAutorizados || [];

        if (permitidos.includes(huellaActual)) {
          onLogin({ 
            name: datos.nombre || user.email.split('@')[0], 
            uid: user.uid,
            email: user.email
          });
        } else {
          await signOut(auth); 
          setDeviceCode(huellaActual);
          setBloqueoDispositivo(true);
        }
      } else {
        await signOut(auth);
        setErrorMsg("Usuario sin membresía activa configurada.");
      }
    } catch (error) {
      console.error(error);
      if(error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') setErrorMsg("Usuario o contraseña incorrectos.");
      else setErrorMsg("Error de conexión o credenciales.");
    } finally {
      setLoading(false);
    }
  };

  // Función de copiado corregida (Sin alert)
  const copiarAlPortapapeles = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Vuelve a la normalidad en 2s
    }
  };

  const enviarPorWhatsapp = () => {
    const telefono = "51914754413";
    const mensaje = `Hola, solicito acceso a Kipo.\n\nCódigo: *${deviceCode}*\nUsuario: ${emailInput}`;
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

// Agregar esto dentro de Login.jsx antes del return
React.useEffect(() => {
  if (initialBlocked) {
    setDeviceCode(generarHuellaDigital());
    setBloqueoDispositivo(true);
  }
}, [initialBlocked]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative font-sans"
         style={{ backgroundColor: '#10101D' }}>
      
      <div className="w-full max-w-md z-10">
        
        {/* LOGO */}
        <div className="text-center mb-8 animate-in slide-in-from-top duration-500">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FCBF26]/10 mb-4 border border-[#FCBF26]/30 shadow-[0_0_20px_rgba(252,191,38,0.15)]">
            <MapPin size={32} color="#FCBF26" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            Kipo
          </h1>
          <p className="text-slate-400 text-sm font-bold tracking-widest mt-2 uppercase">Plataforma de Operaciones</p>
        </div>

        {!bloqueoDispositivo ? (
          /* --- LOGIN FORM --- */
          <div className="bg-[#1A1929]/80 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-[#FCBF26] uppercase tracking-wider mb-2 block">Usuario</label>
                <div className="relative">
                    <input 
                    type="text" 
                    required 
                    value={emailInput} 
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-[#0B0A14] border border-slate-700 text-white px-4 py-4 rounded-xl focus:border-[#FCBF26] focus:ring-1 focus:ring-[#FCBF26] outline-none transition-all placeholder-slate-600 font-bold"
                    placeholder="usuario"
                    />
                    {!emailInput.includes('@') && emailInput.length > 0 && (
                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-600 font-bold pointer-events-none select-none">
                            {DOMINIO_FIJO}
                        </span>
                    )}
                </div>
              </div>

              <div className="relative">
                <label className="text-[10px] font-black text-[#FCBF26] uppercase tracking-wider mb-2 block">Contraseña</label>
                <input 
                  type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0B0A14] border border-slate-700 text-white px-4 py-4 rounded-xl focus:border-[#FCBF26] focus:ring-1 focus:ring-[#FCBF26] outline-none transition-all placeholder-slate-600 font-bold pr-12"
                  placeholder="••••••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[38px] text-slate-500 hover:text-[#FCBF26] transition-colors">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {errorMsg && <div className="text-red-400 text-xs font-bold text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">{errorMsg}</div>}

              <button type="submit" disabled={loading}
                className="w-full bg-[#FCBF26] hover:bg-[#D9A310] text-[#100F1D] font-black py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-[#FCBF26]/20 flex justify-center items-center gap-2 mt-4 text-sm tracking-wide">
                {loading ? 'VERIFICANDO...' : <>INGRESAR <ChevronRight size={20} strokeWidth={3}/></>}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
               {!deviceCode ? (
                 <button onClick={() => setDeviceCode(generarHuellaDigital())} className="text-slate-500 text-[10px] font-bold hover:text-[#FCBF26] transition-colors flex items-center justify-center gap-2 mx-auto uppercase tracking-widest">
                   <MapPin size={14} /> Obtener código de activación
                 </button>
               ) : (
                 <div className="bg-black/40 rounded-lg p-3 border border-[#FCBF26]/30 animate-in fade-in zoom-in">
                    <p className="text-[9px] text-slate-400 mb-2 uppercase font-bold">Código de Activación</p>
                    {/* Botón de Copiar Mejorado */}
                    <div 
                      onClick={copiarAlPortapapeles} 
                      className={`flex items-center justify-between border rounded px-3 py-2 cursor-pointer transition-all duration-300 ${copied ? 'bg-green-500/20 border-green-500/50' : 'bg-[#FCBF26]/10 border-[#FCBF26]/50 hover:bg-[#FCBF26]/20'}`}
                    >
                      <code className={`font-mono font-bold text-sm tracking-widest ${copied ? 'text-green-400' : 'text-[#FCBF26]'}`}>
                        {copied ? '¡COPIADO!' : deviceCode}
                      </code>
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-[#FCBF26]" />}
                    </div>

                    <button onClick={enviarPorWhatsapp} className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold py-2 rounded flex items-center justify-center gap-2">
                       <MessageCircle size={14} /> SOLICITAR ACTIVACIÓN
                    </button>
                 </div>
               )}
            </div>
          </div>
        ) : (
          /* --- PANTALLA BLOQUEO --- */
          <div className="bg-[#1A1929] border border-red-500/50 rounded-3xl p-8 text-center animate-in zoom-in-95 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
            <ShieldAlert size={64} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-black text-white uppercase mb-2">Dispositivo No Registrado</h2>
            <p className="text-slate-400 text-sm mb-6">Para usar Kipo en este equipo, necesitas activarlo.</p>
            
            <div className="bg-black/50 p-4 rounded-xl border border-white/10 mb-6">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Tu Código</p>
              {/* Copiado en Pantalla Roja */}
              <div 
                onClick={copiarAlPortapapeles} 
                className={`flex justify-center items-center gap-3 cursor-pointer transition-colors ${copied ? 'text-green-500' : ''}`}
              >
                <span className={`text-2xl font-mono font-bold tracking-widest ${copied ? 'text-green-500' : 'text-[#FCBF26]'}`}>
                    {copied ? '¡COPIADO!' : deviceCode}
                </span>
                {copied ? <Check size={18} /> : <Copy size={18} className="text-slate-500" />}
              </div>
            </div>

            <button onClick={enviarPorWhatsapp} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 mb-4 shadow-lg shadow-green-900/40 transition-transform active:scale-95">
              <MessageCircle size={20} /> SOLICITAR ACTIVACIÓN
            </button>
            <button onClick={() => { setBloqueoDispositivo(false); setDeviceCode(''); }} className="text-slate-500 text-xs font-bold hover:text-white underline">Volver al Login</button>
          </div>
        )}

        {/* CREDITOS */}
        <div className="mt-8 text-center">
          <a 
            href="https://www.evadigitalgroup.com/index.html" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 text-[10px] text-[#FCBF26] opacity-60 hover:opacity-100 transition-all duration-300"
          >
             <Lock size={10} />
             <span>
               App desarrollada por <strong className="font-black underline underline-offset-2">EVA Digital</strong>
             </span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
