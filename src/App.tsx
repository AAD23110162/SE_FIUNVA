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
  FolderOpen,
  User,
  Layers,
  DollarSign,
  Search
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
  const [currentCurrency, setCurrentCurrency] = useState<"USD" | "MXN" | "EUR">("MXN");
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
      text: "¡Hola! ¿En qué podemos ayudarte el día de hoy?",
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

  const [quotePendingQuery, setQuotePendingQuery] = useState<string | null>(null);

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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  const handleSelectCurrency = async (curr: "USD" | "MXN" | "EUR") => {
    if (!quotePendingQuery) return;
    const targetQ = quotePendingQuery;
    setQuotePendingQuery(null);

    // Append user selection bubble
    const userMsg: Message = {
      id: `msg-usr-curr-${Date.now()}`,
      sender: "client",
      text: `Quiero mi cotización en ${curr === "MXN" ? "Pesos Mexicanos (MXN)" : curr === "USD" ? "Dólares (USD)" : "Euros (EUR)"}`,
      timestamp: new Date().toISOString()
    };
    setChatHistory((prev) => [...prev, userMsg]);

    // Change current app currency and reload live rates if needed
    await handleCurrencyChange(curr);

    // Now execute the actual quotation with selected currency passed to backend
    await executeQuoteChat(targetQ, curr);
  };

  const executeQuoteChat = async (queryText: string, quoteCurrency: "USD" | "MXN" | "EUR") => {
    setIsGenerating(true);
    setAgentSteps([
      { agentName: "Atención al Cliente", status: "thinking", output: "Escuchando intenciones..." },
      { agentName: "Generador de Pedido", status: "idle", output: "Buscando referencias..." },
      { agentName: "Supervisor Explicador", status: "idle", output: "Tratando compatibilidad..." }
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: queryText,
          clientProfile: activeProfile,
          currency: quoteCurrency
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

    // Intercept quote pending currency selection if user is replying as text
    if (quotePendingQuery) {
      const lower = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let detectedCurr: "USD" | "MXN" | "EUR" | null = null;
      if (lower.includes("mxn") || lower.includes("peso") || lower.includes("mexicanos")) {
        detectedCurr = "MXN";
      } else if (lower.includes("usd") || lower.includes("dolar") || lower.includes("dólar") || lower.includes("americanos")) {
        detectedCurr = "USD";
      } else if (lower.includes("eur") || lower.includes("euro") || lower.includes("euros")) {
        detectedCurr = "EUR";
      }

      if (detectedCurr) {
        await handleSelectCurrency(detectedCurr);
      } else {
        setIsGenerating(true);
        setTimeout(() => {
          const repromptMsg: Message = {
            id: `msg-curr-reprompt-${Date.now()}`,
            sender: "agent",
            text: "⚠️ No pude identificar tu divisa seleccionada. Por favor escribe **MXN**, **USD**, o **EUR** (o haz clic en los botones de selección que ves abajo) para continuar con tu cotización.",
            timestamp: new Date().toISOString()
          };
          setChatHistory((prev) => [...prev, repromptMsg]);
          setIsGenerating(false);
        }, 600);
      }
      return;
    }

    // Identify if this query wants to make a quotation request
    const isQuoteIntent = (text: string) => {
      const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return (
        lower.includes("cotizar") ||
        lower.includes("cotizacion") ||
        lower.includes("presupuesto") ||
        lower.includes("quiero comprar") ||
        lower.includes("proyecto de robotica") ||
        lower.includes("comprar") ||
        lower.includes("precio") ||
        lower.includes("adquirir") ||
        lower.includes("cuanto cuesta")
      );
    };

    if (isQuoteIntent(query)) {
      setQuotePendingQuery(query);
      setIsGenerating(true);
      setTimeout(() => {
        const botMsg: Message = {
          id: `msg-curr-select-${Date.now()}`,
          sender: "agent",
          text: `¡Excelente iniciativa! Con gusto realizaré la cotización de tus componentes y servicios mediante nuestro sistema experto de agentes en tiempo real.

Para proceder, **por favor selecciona o indica en cuál de las 3 monedas deseas que sea procesada tu cotización**:`,
          timestamp: new Date().toISOString()
        };
        setChatHistory((prev) => [...prev, botMsg]);
        setIsGenerating(false);
      }, 700);
      return;
    }

    // 2. Set parallel multi-agent activity indicators for general queries
    setIsGenerating(true);
    setAgentSteps([
      { agentName: "Atención al Cliente", status: "thinking", output: "Escuchando intenciones..." },
      { agentName: "Generador de Pedido", status: "idle", output: "Buscando referencias..." },
      { agentName: "Supervisor Explicador", status: "idle", output: "Tratando compatibilidad..." }
    ]);

    try {
      // 3. POST and wait server response (general chat route without hard currency locks)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          clientProfile: activeProfile,
          currency: currentCurrency
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
            output: `Mapeado. Intento: "${results.agent1?.intent || 'Pregunta General'}"`
          },
          {
            agentName: "Generador de Pedido",
            status: "thinking",
            output: `Efectuando consulta técnica y aplicando reglas de negocio...`
          },
          { agentName: "Supervisor Explicador", status: "idle", output: "" }
        ]);

        setTimeout(() => {
          setAgentSteps([
            {
              agentName: "Atención al Cliente",
              status: "completed",
              output: `Intención: "${results.agent1?.intent || 'Pregunta General'}"`
            },
            {
              agentName: "Generador de Pedido",
              status: "completed",
              output: `Verificaciones completadas.`
            },
            {
              agentName: "Supervisor Explicador",
              status: "thinking",
              output: `Generando síntesis explicativa...`
            }
          ]);

          setTimeout(() => {
            setAgentSteps([
              { agentName: "Atención al Cliente", status: "completed", output: "Consulta clasificada" },
              { agentName: "Generador de Pedido", status: "completed", output: "Análisis experto exitoso" },
              { agentName: "Supervisor Explicador", status: "completed", output: "Respuesta compilada." }
            ]);

            // Append final agent reply
            const finalReplyText = results.agent1.clientResponse || "Procesado correctamente.";
            const salesBlock = results.agent3.salesSummary ? `\n\n**${results.agent3.salesSummary}**` : "";
            const ordMessage = result.orderCreated ? `\n\n*Nota del sistema:* Cotización registrada bajo el ID **${result.orderCreated.id}** en estatus pendiente.` : "";
            
            setChatHistory((prev) => [
              ...prev,
              {
                id: `msg-agn-${Date.now()}`,
                sender: "agent",
                text: `${finalReplyText}${salesBlock}${ordMessage}`,
                timestamp: new Date().toISOString()
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#030712] text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* Primary Header block styled identically to the mockup */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#070c19]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-3 sm:px-6 py-3 sm:py-4 flex flex-row items-center justify-between gap-4 shadow-sm transition-colors duration-300">
        
        {/* Branding block matching the image */}
        <div 
          onClick={() => {
            setActiveRole(activeRole === "client" ? "admin" : "client");
          }}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none group transition-all"
          title="Haga clic para alternar con el modo Administrador/Técnico"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#070c19] flex items-center justify-center shadow-md ring-4 ring-blue-500/10 group-hover:scale-105 transition-all overflow-hidden bg-white p-1">
            <img 
              src="https://lh3.googleusercontent.com/d/1hqq7ZuYIxJoHfSsY4J-FVHkG_wY283mI" 
              alt="FIUNVA" 
              className="max-w-[85%] max-h-[85%] object-contain" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none italic">
              FIUNVA
            </h1>
            <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 mt-1 sm:mt-1.5 italic">
              SISTEMA EXPERTO
            </p>
          </div>
        </div>

        {/* Header Right elements */}
        <div className="flex items-center gap-2 sm:gap-4 select-none">
          
          {/* Simulated current credential card */}
          {activeRole === "client" && (
            <div className="relative inline-block select-none text-[11px] sm:text-xs">
              {clientType === "registrado" ? (
                <div className="flex items-center gap-1 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold">
                  <span className="truncate max-w-[80px] sm:max-w-[150px]">Rol: <strong>{registeredName}</strong></span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientType("nuevo");
                      setRegisteredName("");
                      setClientCode("");
                    }}
                    className="text-[10px] text-red-500 hover:text-red-700 font-bold ml-1 hover:underline cursor-pointer shrink-0"
                    title="Salir del modo registrado"
                  >
                    (Salir)
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-900/80 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-slate-200/60 dark:border-slate-800 transition shadow-xs text-slate-650 dark:text-slate-300 font-bold">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase shrink-0">Rol:</span>
                  <select
                    value={clientType}
                    onChange={(e) => setClientType(e.target.value as "nuevo" | "integrado")}
                    className="bg-transparent border-none font-bold text-slate-905 dark:text-slate-100 focus:ring-0 focus:outline-none cursor-pointer p-0 text-[11px] sm:text-xs pr-1"
                  >
                    <option className="bg-white dark:bg-[#070c19] text-slate-800 dark:text-slate-200" value="nuevo">Cliente nuevo</option>
                    <option className="bg-white dark:bg-[#070c19] text-slate-800 dark:text-slate-200" value="integrado">Cliente integrado</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {activeRole === "admin" && (
            <div className="flex items-center gap-1 sm:gap-1.5 bg-amber-500/10 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-amber-500/20 text-[10px] sm:text-xs text-amber-700 dark:text-amber-400 font-extrabold shadow-xs">
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[100px] sm:max-w-none">ZONA TÉCNICA</span>
            </div>
          )}

          {/* Theme Toggle Button - Rounded-full Circle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all flex items-center justify-center cursor-pointer shadow-xs shrink-0"
            aria-label="Alternar modo visual"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-500" /> : <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-600" />}
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
          <div className="max-w-4xl mx-auto w-full flex flex-col sm:rounded-3xl bg-white dark:bg-[#070c19]/35 border border-slate-200/80 dark:border-slate-800/80 shadow-md transition-all duration-300 backdrop-blur-xs">
            
            {/* Real-time Subheader status line matching the mockup */}
            <div className="px-4 py-3 sm:px-6 border-b border-slate-100 dark:border-slate-800/70 bg-white/50 dark:bg-[#080d19]/40 flex items-center justify-between sm:rounded-t-3xl">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs sm:text-[13px] font-bold text-slate-600 dark:text-slate-400">
                  Sistema Experto Activo
                </span>
              </div>
              <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-blue-50 dark:bg-blue-955/20 border border-blue-100 dark:border-blue-900/40 text-[9px] sm:text-[10px] font-black text-blue-600 dark:text-blue-400 tracking-wider font-mono uppercase">
                MONEDA {currentCurrency}
              </div>
            </div>

            {/* Chat scroll workspace - integrated naturally into the page scroll */}
            <div className="p-3 sm:p-5 flex flex-col gap-3.5 sm:gap-4 bg-slate-50/10 dark:bg-slate-950/10">
              {chatHistory.map((msg) => {
                const isClient = msg.sender === "client";
                if (isClient) {
                  return (
                    <div key={msg.id} className="flex flex-col max-w-[90%] sm:max-w-[85%] self-end items-end gap-1 my-0.5">
                      <div className="p-3 sm:p-4 rounded-xl rounded-tr-none bg-blue-600 text-white text-xs sm:text-sm leading-relaxed shadow-sm font-sans font-semibold">
                        {msg.text}
                      </div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono select-none mr-2 font-bold uppercase tracking-wide">
                        Tú • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={msg.id}
                      className="flex gap-2.5 sm:gap-4 items-start p-3 sm:p-4 bg-white/85 dark:bg-[#0c1425]/70 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl w-full my-0.5 shadow-xs transition-all animate-fade-in"
                    >
                      {/* Avatar container */}
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm ring-4 ring-blue-500/10 overflow-hidden p-1">
                        <img 
                          src="https://lh3.googleusercontent.com/d/1hqq7ZuYIxJoHfSsY4J-FVHkG_wY283mI" 
                          alt="FIUNVA Agente" 
                          className="max-w-[85%] max-h-[85%] object-contain" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      {/* Text body and info */}
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium font-sans">
                          {msg.text}
                        </div>
                        
                        {/* Timestamp */}
                        <div className="text-[9px] text-slate-450 dark:text-slate-500 font-bold font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }
              })}

              {isGenerating && (
                <div className="flex items-center gap-2.5 self-start p-3 sm:p-4 bg-slate-100/60 dark:bg-[#0c1425]/40 rounded-2xl border border-slate-200/40 dark:border-slate-850 rounded-bl-none text-xs text-slate-500 dark:text-slate-400 font-semibold shadow-2xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                  <span className="text-[11px] sm:text-xs">Los agentes están deliberando en paralelo...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input panel */}
            <div className="p-3 sm:p-5 bg-white dark:bg-[#070c19] border-t border-slate-100 dark:border-slate-800/80">
              <div className="relative flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#f8fafc]/40 dark:bg-[#030712]/40 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/40 transition-all p-3 sm:p-4 min-h-[90px] sm:min-h-[105px]">
                <textarea
                  disabled={isGenerating}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="Escribe tu consulta aquí..."
                  className="w-full flex-grow text-xs sm:text-sm bg-transparent border-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-0 resize-none min-h-[40px] sm:min-h-[50px] font-medium"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-550 select-none font-bold font-sans uppercase">
                    Sistema Multi-Agente Activo
                  </span>
                  <button
                    onClick={() => handleSendChat()}
                    disabled={isGenerating || !inputText.trim()}
                    className="p-2 sm:p-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center cursor-pointer shrink-0"
                    title="Enviar consulta"
                  >
                    <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Suggestions Panel is now located under the Input Area, replacing the connected agents footer */}
            <div className="p-4 sm:p-5 bg-[#f8fafc] dark:bg-[#040813] border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col gap-2.5 sm:rounded-b-3xl">
              {quotePendingQuery ? (
                <>
                  <div className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 select-none pl-1 animate-pulse">
                    ⚠️ SELECCIONA LA DIVISA PARA TU COTIZACIÓN:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                    <button
                      onClick={() => handleSelectCurrency("MXN")}
                      className="flex items-center justify-center gap-2 px-3 py-3 text-xs sm:text-[13px] font-black transition-all rounded-xl select-none cursor-pointer border text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-500/20 hover:scale-[1.01] hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 shadow-2xs"
                    >
                      <span className="text-lg">🇲🇽</span>
                      <span>Pesos Mexicanos (MXN)</span>
                    </button>
                    <button
                      onClick={() => handleSelectCurrency("USD")}
                      className="flex items-center justify-center gap-2 px-3 py-3 text-xs sm:text-[13px] font-black transition-all rounded-xl select-none cursor-pointer border text-blue-700 bg-blue-500/10 border-blue-500/20 dark:text-blue-400 dark:bg-blue-955/20 dark:border-blue-500/20 hover:scale-[1.01] hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 shadow-2xs"
                    >
                      <span className="text-lg">🇺🇸</span>
                      <span>Dólares (USD)</span>
                    </button>
                    <button
                      onClick={() => handleSelectCurrency("EUR")}
                      className="flex items-center justify-center gap-2 px-3 py-3 text-xs sm:text-[13px] font-black transition-all rounded-xl select-none cursor-pointer border text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-400 dark:bg-amber-955/20 dark:border-amber-500/20 hover:scale-[1.01] hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 shadow-2xs"
                    >
                      <span className="text-lg">🇪🇺</span>
                      <span>Euros (EUR)</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-[#64748b] dark:text-[#94a3b8]/70 select-none pl-1">
                    PREGUNTAS RÁPIDAS
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {quickQuestions.map((p, i) => {
                      let IconComponent = Cpu;
                      if (p.text.includes("Soy cliente registrado")) IconComponent = User;
                      else if (p.text.includes("ofrecen")) IconComponent = Layers;
                      else if (p.text.includes("cotizar")) IconComponent = DollarSign;
                      else if (p.text.includes("estatus")) IconComponent = Search;

                      return (
                        <button
                          key={i}
                          disabled={isGenerating}
                          onClick={() => handleSendChat(p.text)}
                          className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-[13px] font-bold text-left transition-all rounded-xl select-none cursor-pointer border text-blue-700 hover:text-white bg-slate-50 hover:bg-blue-600 border-slate-200 dark:bg-[#0e162d]/25 dark:text-blue-400 dark:hover:bg-blue-900 dark:border-blue-950/60 hover:scale-[1.01] hover:shadow-2xs disabled:opacity-50"
                        >
                          <IconComponent className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-500 dark:text-blue-400 shrink-0" />
                          <span className="truncate">{p.title.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim()}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
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
            © 2026 FIUNVA. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
