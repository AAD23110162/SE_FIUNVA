import React, { useState, useEffect } from "react";
import { UserProfile } from "../types";
import { 
  X, 
  Key, 
  User, 
  UserPlus, 
  Mail, 
  Phone, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Gift, 
  Chrome, 
  LogOut,
  Moon,
  Sun
} from "lucide-react";

interface ClientPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  usersList: UserProfile[];
  sessionEmail: string;
  onSaveUser: (user: UserProfile) => Promise<void>;
  clientType: "nuevo" | "integrado" | "registrado";
  registeredName: string;
  clientCode: string;
  onSelectClientProfile: (type: "nuevo" | "integrado" | "registrado", name: string, code: string) => void;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
}

export default function ClientPortalModal({
  isOpen,
  onClose,
  usersList,
  sessionEmail,
  onSaveUser,
  clientType,
  registeredName,
  clientCode,
  onSelectClientProfile,
  onGoogleSignIn,
  onGoogleSignOut
}: ClientPortalModalProps) {
  const [activeTab, setActiveTab] = useState<"acceso" | "registro">("acceso");
  
  // Traditional Access state
  const [searchCode, setSearchCode] = useState("");
  const [accesoFeedback, setAccesoFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Traditional Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPrefer, setRegPrefer] = useState<"celular" | "correo">("correo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);

  // Google Associated Register state (when logged in but no profile exists)
  const [googlePhone, setGooglePhone] = useState("");
  const [googlePrefer, setGooglePrefer] = useState<"celular" | "correo">("correo");

  // Keep search code synchronized or clean feedback on open
  useEffect(() => {
    if (isOpen) {
      setAccesoFeedback(null);
      setRegisteredCode(null);
      if (clientType === "registrado") {
        setActiveTab("acceso");
      }
    }
  }, [isOpen, clientType]);

  if (!isOpen) return null;

  // Find if current Google user is already in usersList
  const googleMappedUser = sessionEmail 
    ? usersList.find(u => u.email?.toLowerCase().trim() === sessionEmail.toLowerCase().trim() && u.role === "client")
    : null;

  const handleTraditionalAccess = (e: React.FormEvent) => {
    e.preventDefault();
    setAccesoFeedback(null);

    if (!searchCode.trim()) {
      setAccesoFeedback({ type: "error", msg: "Por favor, ingresa un código de cliente." });
      return;
    }

    const matched = usersList.find(
      u => u.role === "client" && u.uid.toLowerCase().trim() === searchCode.toLowerCase().trim()
    );

    if (matched) {
      onSelectClientProfile("registrado", matched.name, matched.uid);
      setAccesoFeedback({ 
        type: "success", 
        msg: `¡Acceso exitoso! Bienvenido de vuelta, ${matched.name}.` 
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setAccesoFeedback({ 
        type: "error", 
        msg: "El código no coincide con ningún cliente registrado. Compruébalo o regístrate como cliente nuevo." 
      });
    }
  };

  // Generate unique 6-character client code
  const generateClientCode = (): string => {
    const letters = "FIU";
    let isUnique = false;
    let code = "";
    while (!isUnique) {
      const num = Math.floor(100 + Math.random() * 900); // 100 - 999
      code = `${letters}-${num}`;
      isUnique = !usersList.some(u => u.uid.toLowerCase() === code.toLowerCase());
    }
    return code;
  };

  const handleTraditionalRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccesoFeedback(null);
    setRegisteredCode(null);

    if (!regName.trim() || !regEmail.trim()) {
      setAccesoFeedback({ type: "error", msg: "Nombre completo y Correo son campos obligatorios." });
      return;
    }

    // Check if email already registered
    const emailExists = usersList.some(
      u => u.email?.toLowerCase().trim() === regEmail.toLowerCase().trim()
    );

    if (emailExists) {
      setAccesoFeedback({ 
        type: "error", 
        msg: "Este correo electrónico ya se encuentra registrado. Utiliza el buscador de acceso tradicional o inicia sesión." 
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const newCode = generateClientCode();
      const newProfile: UserProfile = {
        uid: newCode,
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim() || undefined,
        role: "client",
        clientTier: "standard", // Begins as standard, updates based on purchase
        preferredContact: regPrefer
      };

      await onSaveUser(newProfile);
      
      setRegisteredCode(newCode);
      // Synchronize session profile immediately
      onSelectClientProfile("registrado", newProfile.name, newProfile.uid);
      
      setRegName("");
      setRegEmail("");
      setRegPhone("");
    } catch (err: any) {
      setAccesoFeedback({ type: "error", msg: err.message || "No se pudo completar el registro." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRegisterLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccesoFeedback(null);

    if (!sessionEmail) return;

    try {
      setIsSubmitting(true);
      const newCode = generateClientCode();
      // Derive name from Email or user name
      const nameParts = sessionEmail.split("@")[0];
      const fallbackName = nameParts.charAt(0).toUpperCase() + nameParts.slice(1);

      const newProfile: UserProfile = {
        uid: newCode,
        name: fallbackName,
        email: sessionEmail,
        phone: googlePhone.trim() || undefined,
        role: "client",
        clientTier: "standard",
        preferredContact: googlePrefer
      };

      await onSaveUser(newProfile);
      
      onSelectClientProfile("registrado", newProfile.name, newProfile.uid);
      setAccesoFeedback({ 
        type: "success", 
        msg: `¡Enhorabuena! Tu cuenta de Google se sincronizó. Tu Código es ${newCode}.` 
      });
      
      setGooglePhone("");
    } catch (err: any) {
      setAccesoFeedback({ type: "error", msg: err.message || "Error al sincronizar cuenta de Google." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignInWithFeedback = async () => {
    setAccesoFeedback(null);
    try {
      await onGoogleSignIn();
    } catch (err: any) {
      console.warn("Caught Google Auth error:", err);
      const isCancelled = err.code === "auth/cancelled-popup-request" || 
                          err.code === "auth/popup-closed-by-user" || 
                          err.message?.includes("cancelled-popup") ||
                          err.message?.includes("closed-by-user");
      if (isCancelled) {
        setAccesoFeedback({
          type: "error",
          msg: "El inicio de sesión fue cancelado o el bloqueador de ventanas emergentes impidió abrir el diálogo de Google. Si estás usando la vista previa interna de AI Studio, te recomendamos abrir la aplicación en una pestaña nueva para que funcione correctamente."
        });
      } else {
        setAccesoFeedback({
          type: "error",
          msg: `Error al iniciar sesión con Google: ${err.message || err}`
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-opacity">
      <div className="relative bg-white dark:bg-[#0c1425] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        
        {/* Header decoration */}
        <div className="px-6 py-5 bg-slate-50 dark:bg-[#0d182e]/80 border-b border-slate-150 dark:border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4.5 h-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">
                Portal de Cliente
              </h3>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 font-extrabold uppercase mt-0.5">
                FIUNVA SERVICES S.A.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal content body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          
          {/* Main Toggle Switch / Session indicators */}
          {clientType !== "registrado" && (
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl gap-1">
              <button
                onClick={() => { setActiveTab("acceso"); setAccesoFeedback(null); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
                  activeTab === "acceso" 
                    ? "bg-white dark:bg-[#121c33] text-blue-600 dark:text-blue-400 shadow-sm" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                Iniciar Sesión / Acceso
              </button>
              <button
                onClick={() => { setActiveTab("registro"); setAccesoFeedback(null); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
                  activeTab === "registro" 
                    ? "bg-white dark:bg-[#121c33] text-blue-600 dark:text-blue-400 shadow-sm" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                Crear Cuenta Nueva
              </button>
            </div>
          )}

          {/* Social login option banner */}
          <div className="bg-slate-50 dark:bg-[#070c19]/50 border border-slate-150 dark:border-slate-850 p-4 rounded-2xl flex flex-col gap-3">
            <h4 className="text-[11px] font-black tracking-wider uppercase text-slate-450 dark:text-slate-500 flex items-center gap-1.5">
              <Chrome className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              Acceso Rápido con Google
            </h4>

            {sessionEmail ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold bg-white dark:bg-[#0f192d] p-3 rounded-xl border border-slate-150 dark:border-slate-800">
                  <span className="text-slate-700 dark:text-slate-300 truncate max-w-[190px]">
                    {sessionEmail === "a23110162@ceti.mx" ? "Administrador" : sessionEmail}
                  </span>
                  <button
                    onClick={onGoogleSignOut}
                    className="text-[10px] font-extrabold text-red-500 hover:text-red-600 uppercase flex items-center gap-1 transition"
                  >
                    <LogOut className="w-3 h-3" /> Salir Google
                  </button>
                </div>

                {/* Integration status */}
                {sessionEmail === "a23110162@ceti.mx" ? (
                  <div className="flex items-start gap-2 text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/5 p-3 rounded-xl border border-amber-500/15">
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      Administrador verificado. Tienes acceso completo a la zona técnica, órdenes y catálogo de servicios.
                    </div>
                  </div>
                ) : googleMappedUser ? (
                  <div className="flex items-start gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/15">
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      Afilación enlazada: Bienvenido, <strong>{googleMappedUser.name}</strong> • Código: {googleMappedUser.uid} (Nivel {googleMappedUser.clientTier.toUpperCase()})
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleGoogleRegisterLink} className="flex flex-col gap-2.5 bg-blue-500/5 p-3.5 rounded-xl border border-blue-500/10">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-normal">
                      Tu Gmail no está asociado a ningún perfil. Termina tu alta express para sincronizar tus pedidos:
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1">Teléfono</label>
                        <input
                          type="tel"
                          value={googlePhone}
                          onChange={(e) => setGooglePhone(e.target.value)}
                          placeholder="e.g. 3312345678"
                          className="w-full text-xs font-semibold bg-white dark:bg-[#0f192d] border border-slate-250 dark:border-slate-800 rounded-xl px-2.5 py-2 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1">Contacto preferido</label>
                        <select
                          value={googlePrefer}
                          onChange={(e) => setGooglePrefer(e.target.value as "celular" | "correo")}
                          className="w-full text-xs font-bold bg-white dark:bg-[#0f192d] border border-slate-250 dark:border-slate-800 rounded-xl px-2 py-2 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="correo">Correo Electrónico</option>
                          <option value="celular">WhatsApp / Celular</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transform active:scale-95 transition disabled:opacity-50"
                    >
                      {isSubmitting ? "Sincronizando..." : "Vincular mi Cuenta de Google"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <button
                onClick={handleGoogleSignInWithFeedback}
                className="w-full py-2.5 bg-white dark:bg-[#0a0f1d] hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <Chrome className="w-4.5 h-4.5 text-blue-500" />
                Ingresar / Registrarse con Google
              </button>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-205 dark:border-slate-800"></div>
            <span className="flex-shrink mx-4 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">ó formato tradicional</span>
            <div className="flex-grow border-t border-slate-205 dark:border-slate-800"></div>
          </div>

          {/* Feedback alerts */}
          {accesoFeedback && (
            <div className={`p-4 rounded-xl border flex items-start gap-2.5 text-xs font-semibold ${
              accesoFeedback.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
            }`}>
              {accesoFeedback.type === "success" ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{accesoFeedback.msg}</span>
            </div>
          )}

          {/* UI view depending on active TAB */}
          {activeTab === "acceso" ? (
            <form onSubmit={handleTraditionalAccess} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 animate-fade-in">
                <label className="text-[10px] font-black uppercase text-slate-450 dark:text-slate-500">
                  Introduce tu Código de Cliente
                </label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    placeholder="Ej: VIP-777, CAR-123 o tu clave FIU-XXX"
                    className="w-full text-xs font-semibold bg-white dark:bg-[#070c19]/30 border border-slate-250 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-normal italic">
                  * Nota: Tu código de acceso tradicional sincroniza instantáneamente tu estatus anterior, órdenes y descuentos aplicables en toda la tienda.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transform active:scale-95 transition"
              >
                Buscar y Validar mi Acceso
              </button>
            </form>
          ) : (
            <form onSubmit={handleTraditionalRegister} className="flex flex-col gap-4 animate-fade-in">
              {registeredCode ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col gap-3 text-center my-1">
                  <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">¡Registro Exitoso!</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tu perfil ha sido dado de alta en la base de datos de FIUNVA.</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Tu Clave de Cliente es:</span>
                    <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 select-all tracking-wider block mt-1">
                      {registeredCode}
                    </strong>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 block">Cópiala y guárdala. Te servirá para loguearte más tarde.</span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-1 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
                  >
                    Entrar al Portal
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-450 dark:text-slate-500 block mb-1.5">Nombre Completo</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="w-full text-xs font-semibold bg-white dark:bg-[#070c19]/30 border border-slate-250 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-450 dark:text-slate-500 block mb-1.5">Email / Correo electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="juan@ejemplo.com"
                        className="w-full text-xs font-semibold bg-white dark:bg-[#070c19]/30 border border-slate-250 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-450 dark:text-slate-500 block mb-1.5">WhatsApp / Celular</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="33XXXXXXXX"
                          className="w-full text-xs font-semibold bg-white dark:bg-[#070c19]/30 border border-slate-250 dark:border-slate-800 rounded-2xl pl-8 pr-3 py-2.5 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-450 dark:text-slate-500 block mb-1.5">Contacto Preferido</label>
                      <select
                        value={regPrefer}
                        onChange={(e) => setRegPrefer(e.target.value as "celular" | "correo")}
                        className="w-full text-xs font-bold bg-white dark:bg-[#070c19]/30 border border-slate-250 dark:border-slate-800 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="correo">Correo Electrónico</option>
                        <option value="celular">WhatsApp / Móvil</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transform active:scale-95 transition disabled:opacity-50 mt-1"
                  >
                    {isSubmitting ? "Registrando..." : "Crear Perfil Tradicional"}
                  </button>
                </div>
              )}
            </form>
          )}

        </div>

        {/* Footer decoration */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#090f1d] border-t border-slate-150 dark:border-slate-850 flex items-center justify-between text-[11px] text-slate-450 dark:text-slate-500 font-semibold uppercase font-mono">
          <span className="flex items-center gap-1">
            <Gift className="w-3.5 h-3.5 text-indigo-500" /> Descuentos del 15% VIP
          </span>
          <span>FIUNVA SERVICES 2026</span>
        </div>

      </div>
    </div>
  );
}
