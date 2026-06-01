/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sun,
  Moon,
  Send,
  Sparkles,
  Award,
  Terminal,
  HelpCircle,
  CircleAlert,
  Loader2,
  ListRestart,
  Heart,
  Cpu,
  Key,
  Database,
  Sliders,
  Settings,
  Cog,
  ShieldAlert,
  FolderOpen
} from "lucide-react";
import { Product, Order, UserProfile, Message, AgentStep, UserRole } from "./types";
import AgentStatusFlow from "./components/AgentStatusFlow";
import DatabaseVisualizer from "./components/DatabaseVisualizer";
import CatalogManager from "./components/CatalogManager";
import OrderQueue from "./components/OrderQueue";

export default function App() {
  // Theme state (Dark Mode or Light Mode matching correct contrast classes)
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  
  // Role toggling (Only Standard Client and Admin)
  const [activeRole, setActiveRole] = useState<"client" | "admin">("client");
  
  // Administrator view sub-panels
  const [adminSubTab, setAdminSubTab] = useState<"quotes" | "catalog" | "collections">("quotes");

  // Server state data
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [isLocalFallback, setIsLocalFallback] = useState(false);

  // Multi-currency operational states
  const [currentCurrency, setCurrentCurrency] = useState<"USD" | "MXN" | "EUR">("USD");
  const [exchangeRates, setExchangeRates] = useState<Record<"USD" | "MXN" | "EUR", number>>({
    USD: 1.0,
    MXN: 17.50,
    EUR: 0.92
  });
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [ratesMessage, setRatesMessage] = useState<string | null>(null);

  // Currency price conversion formatter
  const formatBasePrice = (priceInUSD: number) => {
    const rate = exchangeRates[currentCurrency] || 1;
    const converted = priceInUSD * rate;
    if (currentCurrency === "MXN") {
      return `$${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
    }
    if (currentCurrency === "EUR") {
      return `€${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
    }
    return `$${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  };

  const handleCurrencyChange = async (targetCurr: "USD" | "MXN" | "EUR") => {
    if (targetCurr === currentCurrency) return;
    setIsFetchingRates(true);
    setRatesMessage("Consultando tipo de cambio en tiempo real...");
    try {
      const response = await fetch("/api/exchange-rates");
      if (response.ok) {
        const data = await response.json();
        if (data.rates) {
          setExchangeRates(data.rates);
          setCurrentCurrency(targetCurr);
          const mxnRate = data.rates.MXN.toFixed(4);
          const eurRate = data.rates.EUR.toFixed(4);
          const modeText = data.source === "live_api" ? "en vivo (vía Er-API)" : "estimada (mecanismo fallback)";
          setRatesMessage(`Cambio de divisa exitoso utilizando tasa ${modeText}. Tipos de cambio consultados: 1 USD = ${mxnRate} MXN | 1 USD = ${eurRate} EUR.`);
          setTimeout(() => setRatesMessage(null), 6000);
        }
      } else {
        setCurrentCurrency(targetCurr);
        setRatesMessage(`Se cambió a ${targetCurr}, pero no se pudo consultar el servidor de divisas. Operando con tasas de respaldo.`);
        setTimeout(() => setRatesMessage(null), 4000);
      }
    } catch (err) {
      console.error("Falla en consulta de divisas:", err);
      setCurrentCurrency(targetCurr);
      setRatesMessage(`Moneda fijada en ${targetCurr}. Error de red con el servidor de divisas. Operando con tasas predefinidas.`);
      setTimeout(() => setRatesMessage(null), 4000);
    } finally {
      setIsFetchingRates(false);
    }
  };

  // Chatbot state records
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    {
      id: "msg-welcome",
      sender: "agent",
      text: "¡Hola! Bienvenido a FIUNVA Consultores Tecnológicos. Nos especializamos en proyectos y desarrollo de electrónica de alta precisión, robótica y desarrollo de software embebido.\n\nEscribe qué componentes, cantidades o servicios requieres para tu circuito, y nuestro sistema experto multi-agente formulará una propuesta técnica aplicando optimización de precios y referencias en tiempo real.",
      timestamp: new Date().toISOString()
    }
  ]);

  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([
    { agentName: "Atención al Cliente", status: "idle", output: "" },
    { agentName: "Generador de Pedido", status: "idle", output: "" },
    { agentName: "Supervisor Explicador", status: "idle", output: "" }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Users database mapping & registration states
  const [clientType, setClientType] = useState<"nuevo" | "integrado" | "registrado">("nuevo");
  const [registeredName, setRegisteredName] = useState<string>("");
  const [clientCode, setClientCode] = useState<string>("");
  const [registrationState, setRegistrationState] = useState<{
    step: "none" | "waiting_name" | "waiting_code";
    tempName?: string;
  }>({ step: "none" });

  const activeProfile: UserProfile = activeRole === "admin" ? {
    uid: "usr_admin",
    name: "Ing. Ana Reyes (Administrador)",
    email: "admin@fiunva.com",
    role: "admin",
    clientTier: "standard"
  } : {
    uid: "usr_client",
    name: clientType === "registrado" ? registeredName : (clientType === "integrado" ? "Cliente Integrado" : "Cliente Nuevo"),
    email: clientType === "registrado" ? "registrado@fiunva.com" : (clientType === "integrado" ? "integrado@fiunva.com" : "nuevo@fiunva.com"),
    role: "client",
    clientTier: clientType === "registrado" ? "vip" : (clientType === "integrado" ? "frequent" : "standard")
  };

  // Load backend seeds on mount
  useEffect(() => {
    fetchCatalog();
    fetchOrders();
  }, []);

  // Update theme tag dynamically
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Adjust scroll when chatting
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isGenerating]);

  // Fetch products catalogue
  const fetchCatalog = async () => {
    try {
      const response = await fetch("/api/products");
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Error cargando componentes:", error);
    }
  };

  // Fetch orders database
  const fetchOrders = async () => {
    try {
      const response = await fetch("/api/orders");
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Error cargando cotizaciones:", error);
    }
  };

  // Approve workflows
  const handleApproveOrder = async (orderId: string) => {
    const response = await fetch(`/api/orders/${orderId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Falla de validación.");
    }
    const data = await response.json();
    setOrders(data.orders);
    setProducts(data.products); 
  };

  // Reject workflows
  const handleRejectOrder = async (orderId: string) => {
    const response = await fetch(`/api/orders/${orderId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (response.ok) {
      const data = await response.json();
      setOrders(data.orders);
    }
  };

  // Reset database values
  const handleResetDatabase = async () => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/system/reset", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Error cargando reset database:", error);
    } finally {
      setIsResetting(false);
    }
  };

  // Submit request to server agents
  const handleSendChat = async (overrideText?: string) => {
    const query = overrideText ? overrideText.trim() : inputText.trim();
    if (!query) return;

    if (!overrideText) {
      setInputText("");
    }

    // 1. Append user prompt to bubble listings
    const userMsg: Message = {
      id: `msg-usr-${Date.now()}`,
      sender: "client",
      text: query,
      timestamp: new Date().toISOString()
    };
    setChatHistory((prev) => [...prev, userMsg]);

    // Handle interactive validation for registered clients inside the chatbot dialog
    if (registrationState.step === "waiting_name") {
      setIsGenerating(true);
      setTimeout(() => {
        setRegistrationState({ step: "waiting_code", tempName: query });
        const botMsg: Message = {
          id: `msg-reg-code-${Date.now()}`,
          sender: "agent",
          text: `Mucho gusto, **${query}**. Por favor, escribe tu Código de Cliente para corroborar tu registro (ej: VIP-777, INT-101, FIU-999 o cualquier código de referencia):`,
          timestamp: new Date().toISOString()
        };
        setChatHistory((prev) => [...prev, botMsg]);
        setIsGenerating(false);
      }, 700);
      return;
    }

    if (registrationState.step === "waiting_code") {
      setIsGenerating(true);
      setTimeout(() => {
        const finalName = registrationState.tempName || "Cliente Registrado";
        if (query.trim().length < 3) {
          const errBotMsg: Message = {
            id: `msg-reg-err-${Date.now()}`,
            sender: "agent",
            text: `⚠️ El código "${query}" no tiene un formato válido o no está registrado. Debe tener al menos 3 caracteres (ej: VIP-777, CAR-123). Inténtalo de nuevo ingresando tu código de cliente:`,
            timestamp: new Date().toISOString()
          };
          setChatHistory((prev) => [...prev, errBotMsg]);
          setIsGenerating(false);
          return;
        }

        setClientType("registrado");
        setRegisteredName(finalName);
        setClientCode(query);
        setRegistrationState({ step: "none" });

        const okBotMsg: Message = {
          id: `msg-reg-ok-${Date.now()}`,
          sender: "agent",
          text: `¡Validación de Cliente Exitosa! 🎉\n\nBienvenido, **${finalName}**. Tu perfil ha sido sincronizado bajo el código **${query}**.\n\nHemos actualizado tu rol a **Cliente: ${finalName}**, otorgándote un **15% de descuento VIP automático** en todos tus componentes, sensores, robótica y servicios de desarrollo inteligente.`,
          timestamp: new Date().toISOString()
        };
        setChatHistory((prev) => [...prev, okBotMsg]);
        setIsGenerating(false);
      }, 900);
      return;
    }

    // Trigger registration wizard if choice clicked
    if (query.trim().toLowerCase() === "soy cliente registrado" || query === "Soy cliente registrado") {
      setIsGenerating(true);
      setTimeout(() => {
        setRegistrationState({ step: "waiting_name" });
        const botMsg: Message = {
          id: `msg-reg-start-${Date.now()}`,
          sender: "agent",
          text: "¡Perfecto, procedamos con tu validación! Por favor escribe tu **Nombre Completo** tal como aparece en tu registro:",
          timestamp: new Date().toISOString()
        };
        setChatHistory((prev) => [...prev, botMsg]);
        setIsGenerating(false);
      }, 600);
      return;
    }

    // 2. Set parallel multi-agent activity indicators
    setIsGenerating(true);
    setAgentSteps([
      { agentName: "Atención al Cliente", status: "thinking", output: "Escuchando intenciones..." },
      { agentName: "Generador de Pedido", status: "idle", output: "Buscando referencias..." },
      { agentName: "Supervisor Explicador", status: "idle", output: "Tratando compatibilidad..." }
    ]);

    try {
      // 3. POST and wait server response
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          clientProfile: activeProfile
        })
      });

      if (!response.ok) {
        throw new Error("Agentes devolvieron un error de ejecución.");
      }

      const result = await response.json();
      const results = result.agentResults;
      setIsLocalFallback(!!result.isLocalFallback);

      // Stagger steps animation sequence
      setTimeout(() => {
        setAgentSteps([
          {
            agentName: "Atención al Cliente",
            status: "completed",
            output: `Mapeado. Intento: "${results.agent1?.intent || 'Cotización Componentes'}"`
          },
          {
            agentName: "Generador de Pedido",
            status: "thinking",
            output: `Efectuando consulta referencial web y aplicando descuentos...`
          },
          { agentName: "Supervisor Explicador", status: "idle", output: "" }
        ]);

        setTimeout(() => {
          setAgentSteps([
            {
              agentName: "Atención al Cliente",
              status: "completed",
              output: `Intención: "${results.agent1?.intent || 'Cotización Componentes'}"`
            },
            {
              agentName: "Generador de Pedido",
              status: "completed",
              output: `Mapeo completado. ${results.agent2?.proposedItems?.length || 0} items verificados en la web.`
            },
            {
              agentName: "Supervisor Explicador",
              status: "thinking",
              output: `Compilando informe y cargando reglas expertas...`
            }
          ]);

          setTimeout(() => {
            setAgentSteps([
              { agentName: "Atención al Cliente", status: "completed", output: "Mapeo de intención: OK" },
              { agentName: "Generador de Pedido", status: "completed", output: "Validado en mouser.com / pololu.com" },
              { agentName: "Supervisor Explicador", status: "completed", output: "Propuesta de cotización generada." }
            ]);

            // Append final agent reply
            const finalReplyText = results.agent1.clientResponse || "Procesado correctamente.";
            setChatHistory((prev) => [
              ...prev,
              {
                id: `msg-agn-${Date.now()}`,
                sender: "agent",
                text: `${finalReplyText}\n\n**${results.agent3.salesSummary}**\n\n*Nota del sistema:* Cotización registrada bajo el ID **${result.orderCreated?.id || 'ORD-NEW'}** en estatus pendiente de autorización.`,
                timestamp: new Date().toISOString(),
                extractedInfo: {
                  intent: results.agent1.intent,
                  items: results.agent2.proposedItems.map((p: any) => ({
                    product: p.productName,
                    quantity: p.quantity
                  })),
                  requirements: results.agent2.suggestions
                }
              }
            ]);

            if (result.orders) setOrders(result.orders);
            setIsGenerating(false);

          }, 1000);
        }, 1000);
      }, 800);

    } catch (error) {
      console.error(error);
      setIsGenerating(false);
      setAgentSteps([
        { agentName: "Atención al Cliente", status: "error", output: "Falla de red." },
        { agentName: "Generador de Pedido", status: "error", output: "Invocación truncada." },
        { agentName: "Supervisor Explicador", status: "error", output: "Error." }
      ]);
      setChatHistory((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: "agent",
          text: "⚠️ Encontramos una interrupción en el servidor de agentes. Asegúrese de reactivar el servidor o intente nuevamente.",
          timestamp: new Date().toISOString()
        }
      ]);
    }
  };

  // Predefined suggestion buttons as exact requested by the user
  const quickQuestions = [
    {
      title: "👤 Soy cliente registrado",
      text: "Soy cliente registrado"
    },
    {
      title: "🔌 ¿Qué servicios ofrecen?",
      text: "¿Qué servicios de electrónica, robótica inteligente, manufactura rápida PCB Express y asesoría técnica de software ofrecen?"
    },
    {
      title: "💰 Quiero cotizar un proyecto",
      text: "Quiero cotizar un proyecto de robótica: Requiero comprar 4 Motores Paso a Paso NEMA 17, 2 módulos ESP32 NodeMCU y 2 horas de Asesoría de software y diseño robótico."
    },
    {
      title: "📈 Consultar estatus del proyecto",
      text: "Quiero consultar el estatus de aprobación de mi proyecto, así como de mis últimas cotizaciones registradas."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* Primary Header block with clickable Easter Egg brand logo */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs transition-colors duration-300">
        
        {/* Branding block (Click area for opening Admin view) */}
        <div 
          onClick={() => {
            setActiveRole(activeRole === "client" ? "admin" : "client");
          }}
          className="flex items-center gap-3 cursor-pointer select-none group border border-transparent hover:border-slate-250 dark:hover:border-slate-800 p-2 rounded-2xl transition-all hover:bg-slate-50 dark:hover:bg-slate-950"
          title="Haga clic aquí en el logotipo de FIUNVA para acceder a la zona técnica de administrador"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-650 flex items-center justify-center text-white font-black text-xl shadow-md font-mono tracking-tighter ring-2 ring-blue-500/10 group-hover:scale-105 transition-all">
            F
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-950 dark:text-slate-100 flex items-center gap-1.5 leading-none">
              FIUNVA
              <span className={`text-[9px] font-bold tracking-wider font-sans uppercase px-2 py-0.5 rounded-md transition-colors ${activeRole === "admin" ? "bg-amber-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                {activeRole === "admin" ? "CONSOLA ADMINISTRADOR" : "SISTEMA EXPERTO"}
              </span>
            </h1>
          </div>
        </div>

        {/* Header Right elements */}
        <div className="flex items-center gap-4 select-none">
          {/* Simulated current credential card */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 text-xs">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span className="font-semibold flex items-center gap-1">
              <span>Rol:</span>
              {activeRole === "admin" ? (
                <strong className="text-slate-900 dark:text-slate-200 font-bold">Consultor Administrador</strong>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-900 dark:text-slate-200">
                  {clientType === "registrado" ? (
                    <span className="flex items-center gap-1.5">
                      <strong className="text-slate-900 dark:text-slate-200 font-extrabold bg-blue-500/10 px-1.5 py-0.5 rounded text-[11px] border border-blue-500/20">
                        Cliente: {registeredName}
                      </strong>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClientType("nuevo");
                          setRegisteredName("");
                          setClientCode("");
                        }}
                        className="text-[10px] text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold ml-1 hover:underline cursor-pointer"
                        title="Salir del modo cliente registrado"
                      >
                        Salir
                      </button>
                    </span>
                  ) : (
                    <select
                      value={clientType}
                      onChange={(e) => setClientType(e.target.value as "nuevo" | "integrado")}
                      className="bg-transparent border-none font-bold text-slate-950 dark:text-slate-100 focus:ring-0 focus:outline-none cursor-pointer pr-1 py-0 text-xs"
                    >
                      <option className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" value="nuevo">Cliente nuevo</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" value="integrado">Cliente integrado</option>
                    </select>
                  )}
                </span>
              )}
            </span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
            aria-label="Toggle visual theme selection"
          >
            {theme === "dark" ? <Sun className="w-4.5 h-4.5 text-amber-500" /> : <Moon className="w-4.5 h-4.5 text-blue-600" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className={`max-w-7xl mx-auto w-full flex flex-col ${activeRole === "client" ? "px-0 sm:px-6 py-1 sm:py-6 gap-3 sm:gap-6" : "px-4 sm:px-6 py-6 gap-6"}`}>
        
        {/* Multi-Agent status line shown only for administrators */}
        {activeRole === "admin" && (
          <AgentStatusFlow steps={agentSteps} />
        )}

        {/* 1. VIEW CURRENT CLIENT INTERFACE (Chatbot entrance) */}
        {activeRole === "client" && (
          <div className="max-w-4xl mx-auto w-full flex flex-col sm:rounded-2xl bg-white dark:bg-slate-900 border-y sm:border border-slate-200 dark:border-slate-800 shadow-sm h-[calc(100vh-140px)] sm:h-[620px] min-h-[460px] overflow-hidden transition-all duration-300">
            
            {/* Chat Title panel */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                    Buzón del Chat de Consultas
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono">
                  MONEDA: {currentCurrency}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-400 font-mono font-semibold select-none">
                {clientType === "registrado" ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Cliente Registrado: {registeredName} (Código: {clientCode} • 15% Desc. VIP)
                  </span>
                ) : clientType === "integrado" ? (
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold bg-blue-500/5 px-2 py-1 rounded-md border border-blue-500/10">
                    Cliente Integrado (5% Desc. Frecuente)
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-850 px-2 py-1 rounded-md border border-slate-200/50 dark:border-slate-800">
                    Cliente Nuevo (Estándar)
                  </span>
                )}
              </div>
            </div>

            {/* Chat scroll workspace */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3.5 sm:gap-4 bg-slate-50/20 dark:bg-slate-950/20">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === "client" ? "self-end items-end" : "self-start items-start"
                  }`}
                >
                  {/* Speech Bubble */}
                  <div
                    className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      msg.sender === "client"
                        ? "bg-blue-600 text-white rounded-br-none shadow-sm font-sans"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200/50 dark:border-slate-700"
                    }`}
                  >
                    <div className="whitespace-pre-line leading-relaxed font-sans">{msg.text}</div>
                  </div>

                  {/* Metadata line info */}
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-1 font-medium select-none">
                    {msg.sender === "client" ? "Tú (Cliente)" : "FIUNVA AI Core"} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  {/* Tag highlights parsed from backend agent */}
                  {msg.extractedInfo && msg.extractedInfo.items.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 self-start">
                      {msg.extractedInfo.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-200 dark:bg-slate-800 border border-slate-300/30 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono"
                        >
                          Mapeado: {it.quantity}x {it.product}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && (
                <div className="flex items-center gap-2 self-start p-3 bg-slate-100 dark:bg-slate-800/45 rounded-2xl border border-slate-200/20 dark:border-slate-700 rounded-bl-none text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span>Los agentes están deliberando en paralelo...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions Panel matching the user's specific text choices! */}
            <div className="p-2.5 sm:p-3 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-150 dark:border-slate-800">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-550 mb-1.5 pl-1 select-none">
                Preguntas rápidas disponibles de un clic:
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 select-none whitespace-nowrap">
                {quickQuestions.map((p, i) => (
                  <button
                    key={i}
                    disabled={isGenerating}
                    onClick={() => handleSendChat(p.text)}
                    className="px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] font-bold shrink-0 cursor-pointer text-blue-700 dark:text-blue-400 hover:text-white dark:hover:text-amber-50 hover:bg-blue-600 dark:hover:bg-blue-900 bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/10 dark:border-blue-900/50 rounded-xl transition-all"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Input panel */}
            <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border-t border-slate-150 dark:border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={isGenerating}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Escribe tu consulta o pide cotizar..."
                  className="flex-1 text-xs sm:text-sm p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleSendChat()}
                  disabled={isGenerating || !inputText.trim()}
                  className="p-3 sm:p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md hover:shadow-lg transition flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        )}

        {/* 2. VIEW DETAILED UNIFIED ADMINISTRATOR CONSOLE */}
        {activeRole === "admin" && (
          <div className="flex flex-col gap-6">
            
            {/* Admin subtab navigation bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-sm select-none transition-all duration-300 gap-3">
              <div className="flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-slate-400 animate-spin-slow" />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Consola Administrador:</span>
              </div>

              {/* Real-time currency selector */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-505 uppercase">Moneda de Operación:</span>
                <select
                  value={currentCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value as "USD" | "MXN" | "EUR")}
                  disabled={isFetchingRates}
                  className="bg-transparent border-none text-xs font-extrabold font-mono text-blue-600 dark:text-blue-400 focus:ring-0 focus:outline-none cursor-pointer pr-1"
                >
                  <option className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" value="USD">USD (Dólares)</option>
                  <option className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" value="MXN">MXN (Pesos Mex.)</option>
                  <option className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" value="EUR">EUR (Euros)</option>
                </select>
                {isFetchingRates && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-550 ml-1 shrink-0" />}
              </div>
              
              <div className="flex bg-slate-50 dark:bg-slate-955 p-1 rounded-lg border border-slate-150 dark:border-slate-850 gap-1 font-semibold">
                {([
                  { id: "quotes", label: "📥 Bandeja de Cotizaciones" },
                  { id: "catalog", label: "⚙️ Directorio & Tarifas" },
                  { id: "collections", label: "🖥️ Servidor Colecciones FI" }
                ] as const).map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setAdminSubTab(sub.id)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer font-bold ${
                      adminSubTab === sub.id
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-450 shadow-xs border border-slate-200/40 dark:border-slate-700"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live rates look-up confirmation banner */}
            {ratesMessage && (
              <div className="text-xs font-semibold p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-750 dark:text-blue-400 rounded-xl flex items-center gap-2 animate-pulse">
                <Sliders className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{ratesMessage}</span>
              </div>
            )}

            {/* Render selected admin view tab */}
            {adminSubTab === "quotes" && (
              <OrderQueue
                orders={orders}
                products={products}
                onApproveOrder={handleApproveOrder}
                onRejectOrder={handleRejectOrder}
                currentCurrency={currentCurrency}
                exchangeRates={exchangeRates}
                formatBasePrice={formatBasePrice}
              />
            )}

            {adminSubTab === "catalog" && (
              <CatalogManager
                products={products}
                onRefreshCatalog={async () => {
                  await fetchCatalog();
                }}
                currentCurrency={currentCurrency}
                exchangeRates={exchangeRates}
                formatBasePrice={formatBasePrice}
              />
            )}

            {adminSubTab === "collections" && (
              <DatabaseVisualizer
                products={products}
                orders={orders}
                users={[
                  activeProfile,
                  { uid: "usr_admin", name: "Ing. Ana Reyes (Administrador)", email: "admin@fiunva.com", role: "admin", clientTier: "standard" }
                ]}
                onResetDatabase={handleResetDatabase}
                isResetting={isResetting}
              />
            )}
            
          </div>
        )}

      </main>

      {/* Humble status footer */}
      <footer className="mt-20 border-t border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 py-8 px-4 sm:px-6 select-none transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs text-slate-505 dark:text-slate-400 font-medium">
            © 2026 FIUNVA Consultores Tecnológicos S.A. de C.V. Todos los derechos reservados.
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-blue-500" />
            <span>Consola Segura Encriptada en Cloud Run</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
