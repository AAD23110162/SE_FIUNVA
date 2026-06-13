import React, { useState } from "react";
import { 
  ClipboardCheck, 
  Check, 
  X, 
  ShieldAlert, 
  FileText, 
  Globe, 
  Award, 
  Circle, 
  Server, 
  Terminal, 
  MessageSquare, 
  Cpu, 
  Activity, 
  ExternalLink,
  Trash2
} from "lucide-react";
import { Order, Product } from "../types";

interface OrderQueueProps {
  orders: Order[];
  products: Product[];
  onApproveOrder: (orderId: string) => Promise<void>;
  onRejectOrder: (orderId: string) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  currentCurrency?: "USD" | "MXN" | "EUR";
  exchangeRates?: Record<"USD" | "MXN" | "EUR", number>;
  formatBasePrice?: (priceInUSD: number) => string;
  externalSelectedOrderId?: string | null;
  onExternalSelectedOrderIdChange?: (orderId: string | null) => void;
}

type AgentTab = "agent1" | "agent2" | "agent3" | "full_trace";

export default function OrderQueue({
  orders,
  products,
  onApproveOrder,
  onRejectOrder,
  onDeleteOrder,
  currentCurrency = "USD",
  exchangeRates = { USD: 1, MXN: 17.50, EUR: 0.92 },
  formatBasePrice = (price) => `$${price.toFixed(2)} USD`,
  externalSelectedOrderId,
  onExternalSelectedOrderIdChange
}: OrderQueueProps) {
  const [localSelectedOrderId, setLocalSelectedOrderId] = useState<string | null>(orders[0]?.id || null);
  const [activeStatusTab, setActiveStatusTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [activeAgentTab, setActiveAgentTab] = useState<AgentTab>("agent2"); // Start on Agent 2 as they run the web search
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const selectedOrderId = externalSelectedOrderId !== undefined ? externalSelectedOrderId : localSelectedOrderId;
  const setSelectedOrderId = (id: string | null) => {
    if (onExternalSelectedOrderIdChange) {
      onExternalSelectedOrderIdChange(id);
    } else {
      setLocalSelectedOrderId(id);
    }
  };

  // Switch tab if external selection changes
  React.useEffect(() => {
    if (externalSelectedOrderId) {
      const order = orders.find(o => o.id === externalSelectedOrderId);
      if (order) {
        if (order.status === "pending_approval") {
          setActiveStatusTab("pending");
        } else if (order.status === "approved") {
          setActiveStatusTab("approved");
        } else {
          setActiveStatusTab("rejected");
        }
      }
    }
  }, [externalSelectedOrderId, orders]);

  // Filter orders by selected status tab
  const filteredOrders = orders.filter((o) => {
    if (activeStatusTab === "pending") return o.status === "pending_approval";
    if (activeStatusTab === "approved") return o.status === "approved";
    return o.status === "rejected";
  });

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Auto-select first order when status tab changes
  React.useEffect(() => {
    if (filteredOrders.length > 0) {
      const exists = filteredOrders.some((o) => o.id === selectedOrderId);
      if (!exists) {
        setSelectedOrderId(filteredOrders[0].id);
      }
    } else {
      setSelectedOrderId(null);
    }
    setErrorMessage(null);
  }, [activeStatusTab, orders]);

  const handleApprove = async (orderId: string) => {
    try {
      setErrorMessage(null);
      await onApproveOrder(orderId);
    } catch (err: any) {
      setErrorMessage(err.message || "Falla en la aprobación de la cotización.");
    }
  };

  const handleReject = async (orderId: string) => {
    try {
      setErrorMessage(null);
      await onRejectOrder(orderId);
    } catch (err: any) {
      setErrorMessage(err.message || "Falla al rechazar cotización.");
    }
  };

  const statusThemes = {
    pending_approval: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    approved: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rejected: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  const tierBadges = {
    standard: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/30",
    frequent: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    vip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold",
  };

  return (
    <div id="order-queue-container" className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 shadow-sm transition-colors duration-300">
      
      {/* Header Panel */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5 gap-3">
        <div>
          <h3 className="font-bold text-slate-950 dark:text-slate-50 flex items-center gap-2 text-sm sm:text-base tracking-tight select-none">
            <ClipboardCheck className="w-5 h-5 text-blue-500" />
            Consola de Cotizaciones & Auditoría de Agentes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Inspecciona las solicitudes recibidas y examina pormenorizadamente el hilo de inferencia y la consulta web generada por cada agente técnico autónomo.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-850 gap-1 select-none self-start lg:self-center">
          {([
            { id: "pending", label: "Pendientes", badge: orders.filter((o) => o.status === "pending_approval").length },
            { id: "approved", label: "Aprobados", badge: orders.filter((o) => o.status === "approved").length },
            { id: "rejected", label: "Declinados", badge: orders.filter((o) => o.status === "rejected").length },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStatusTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeStatusTab === tab.id
                  ? "bg-white dark:bg-slate-800 text-slate-950 dark:text-slate-50 shadow-xs border border-slate-200/50 dark:border-slate-700"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeStatusTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-805 text-slate-600 dark:text-slate-400"}`}>
                {tab.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div id="order-error-alert" className="mb-4 text-xs font-semibold p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-800 dark:text-rose-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
          {errorMessage}
        </div>
      )}

      {/* Main Double Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Side: Order list queue */}
        <div className="lg:col-span-4 border border-slate-150 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col gap-3 max-h-[550px] overflow-y-auto">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-24 text-xs text-slate-400 dark:text-slate-500 font-medium">
              No hay cotizaciones pendientes en esta vista de seguridad.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isSelected = order.id === selectedOrderId;
              return (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setErrorMessage(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 cursor-pointer ${
                    isSelected
                      ? "bg-white dark:bg-slate-900 border-blue-500 shadow-md ring-2 ring-blue-500/10 dark:ring-blue-400/10"
                      : "bg-white dark:bg-slate-950/40 border-slate-155 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950"
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {order.id}
                    </span>
                    <span className={`text-[9.5px] px-2 py-0.5 rounded-full uppercase font-bold border ${statusThemes[order.status]}`}>
                      {order.status === "pending_approval" ? "pendiente" : order.status === "approved" ? "aprobada" : "declinada"}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                    {order.clientName}
                  </div>

                  <div className="flex justify-between items-end w-full mt-1">
                    <div className="text-[10px] text-slate-400">
                      <div>{order.items.reduce((acc, c) => acc + c.quantity, 0)} items mapeados</div>
                      <div className="mt-0.5 font-mono">{new Date(order.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                        {formatBasePrice(order.total)}
                      </div>
                      <span className={`inline-block text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded-full mt-1 ${tierBadges[order.clientTier]}`}>
                        Tier {order.clientTier}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Side: Agent-by-Agent Deep Inspector */}
        <div className="lg:col-span-8">
          {selectedOrder ? (
            <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between h-full bg-white dark:bg-slate-950/40 shadow-xs">
              
              <div>
                {/* Header Information Pane */}
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-850 pb-3 mb-4">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-slate-400">Consola de Auditoría Activa</span>
                    <h4 className="font-bold text-base sm:text-lg text-slate-950 dark:text-slate-50 mt-0.5 font-mono flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-slate-400" />
                      ID_PROPUESTA: {selectedOrder.id}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-slate-400">Perfil de Cliente</span>
                    <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                      <Award className="w-4 h-4 text-blue-500" />
                      {selectedOrder.clientName}
                    </div>
                  </div>
                </div>

                {/* Sub-table: Component Itemization on this Quote */}
                <div className="mb-5 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-850">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-0.5">
                    Especificación de Componentes y Tarifas de Cotización
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead>
                        <tr className="border-b border-slate-205 dark:border-slate-800 pb-2 text-slate-500 font-bold select-none text-[10.5px]">
                          <th className="py-2 pr-2">Componente Mapeado</th>
                          <th className="py-2 text-center">Cant.</th>
                          <th className="py-2 text-right">Precio Un.</th>
                          <th className="py-2 text-center">Desc. VIP/Vol</th>
                          <th className="py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                        {selectedOrder.items.map((item) => (
                          <tr key={item.productId} className="text-slate-800 dark:text-slate-350">
                            <td className="py-2 font-semibold">
                              {item.productName}
                              <span className="block text-[9.5px] text-slate-400 font-mono font-normal">ID: {item.productId}</span>
                            </td>
                            <td className="py-2 text-center font-mono font-medium">{item.quantity}</td>
                            <td className="py-2 text-right font-mono">{formatBasePrice(item.unitPrice)}</td>
                            <td className="py-2 text-center font-mono text-amber-600 dark:text-amber-400 font-bold select-none">
                              {item.discountApplied > 0 ? `${item.discountApplied}%` : "-"}
                            </td>
                            <td className="py-2 text-right font-mono font-bold pr-0.5 text-slate-900 dark:text-slate-150">{formatBasePrice(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pricing summaries block */}
                  <div className="mt-3.5 border-t border-slate-100 dark:border-slate-850 pt-2 flex flex-col gap-1 items-end text-xs font-mono">
                    <div className="flex gap-4 text-slate-500">
                      <span>Suma Parcial:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-350">{formatBasePrice(selectedOrder.subtotal)}</span>
                    </div>
                    {selectedOrder.discountTotal > 0 && (
                      <div className="flex gap-4 text-emerald-600 dark:text-emerald-450 font-semibold">
                        <span>Descuentos Aplicados:</span>
                        <span>-{formatBasePrice(selectedOrder.discountTotal)}</span>
                      </div>
                    )}
                    <div className="flex gap-4 text-slate-500">
                      <span>Impuesto (16% IVA):</span>
                      <span className="font-bold text-slate-700 dark:text-slate-350">{formatBasePrice(selectedOrder.tax)}</span>
                    </div>
                    <div className="flex gap-4 text-sm font-bold text-blue-600 dark:text-blue-400 mt-1 border-t border-dashed border-slate-200 dark:border-slate-800 pt-1.5">
                      <span>MONTO TOTAL INTEGRADO:</span>
                      <span>{formatBasePrice(selectedOrder.total)}</span>
                    </div>
                  </div>

                  {selectedOrder.notes && (
                    <div className="mt-3 bg-amber-500/5 text-amber-900 dark:text-amber-305 dark:bg-amber-500/10 p-3 rounded-lg border border-amber-500/15 text-xs text-left">
                      <span className="font-bold uppercase text-[9px] tracking-wider block text-amber-600 dark:text-amber-400 mb-1 select-none">📝 Observación Extra de la Solicitud:</span>
                      <p className="italic font-sans">"{selectedOrder.notes}"</p>
                    </div>
                  )}
                </div>

                {/* Sub-Header: Active Agent steps display */}
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-501 pl-0.5 mb-2.5">
                    Detalle de Tareas Ejecutadas por Cada Agente Experto:
                  </div>

                  {/* Horizontal Agent Selector Tabs */}
                  <div className="grid grid-cols-4 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/60 dark:border-slate-850 gap-1 select-none text-center">
                    <button
                      onClick={() => setActiveAgentTab("agent1")}
                      className={`py-2 text-[11px] font-bold rounded-lg flex flex-col md:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                        activeAgentTab === "agent1"
                          ? "bg-white dark:bg-slate-800 text-blue-650 dark:text-blue-400 shadow-xs border border-slate-200/40 dark:border-slate-700"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Agente 1</span>
                    </button>
                    <button
                      onClick={() => setActiveAgentTab("agent2")}
                      className={`py-2 text-[11px] font-bold rounded-lg flex flex-col md:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                        activeAgentTab === "agent2"
                          ? "bg-white dark:bg-slate-800 text-blue-650 dark:text-blue-400 shadow-xs border border-slate-200/40 dark:border-slate-700"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Agente 2 Web</span>
                    </button>
                    <button
                      onClick={() => setActiveAgentTab("agent3")}
                      className={`py-2 text-[11px] font-bold rounded-lg flex flex-col md:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                        activeAgentTab === "agent3"
                          ? "bg-white dark:bg-slate-800 text-blue-650 dark:text-blue-400 shadow-xs border border-slate-200/40 dark:border-slate-700"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Agente 3</span>
                    </button>
                    <button
                      onClick={() => setActiveAgentTab("full_trace")}
                      className={`py-2 text-[11px] font-bold rounded-lg flex flex-col md:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                        activeAgentTab === "full_trace"
                          ? "bg-white dark:bg-slate-800 text-blue-650 dark:text-blue-400 shadow-xs border border-slate-200/40 dark:border-slate-700"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Bitácora</span>
                    </button>
                  </div>
                </div>

                {/* Main Dynamic View: Agent specific deliberations */}
                <div className="bg-slate-100/30 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-850 p-4 rounded-xl min-h-[160px]">
                  
                  {/* AGENT 1 PANEL */}
                  {activeAgentTab === "agent1" && (
                    <div className="flex flex-col gap-3 font-mono text-xs text-slate-850 dark:text-slate-350">
                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold select-none text-[11px] uppercase tracking-wider font-sans">
                        <MessageSquare className="w-4 h-4" />
                        Agente 1: Atención interactiva y Detección de Intenciones
                      </div>
                      <p className="leading-relaxed bg-white/40 dark:bg-slate-950/20 p-2.5 rounded border border-slate-200/40 dark:border-slate-800">
                        <strong>Intención Identificada:</strong> "Adquisición de componentes electrónicos y consultoría de diseño de ingeniería"
                      </p>
                      <p className="leading-relaxed whitespace-pre-wrap bg-white/40 dark:bg-slate-950/20 p-2.5 rounded border border-slate-200/40 dark:border-slate-800">
                        <strong>Mensaje Inicial Enviado al Cliente:</strong><br />
                        "¡Hola! Soy el Agente 1 (Atención al Cliente). He registrado tu solicitud. Paso el procesamiento de las reglas de cálculo en el catálogo técnico al Agente 2..."
                      </p>
                    </div>
                  )}

                  {/* AGENT 2 PANEL (Web Verification emphasize) */}
                  {activeAgentTab === "agent2" && (
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="flex items-center justify-between text-blue-750 dark:text-blue-400 font-bold select-none text-[11px] uppercase tracking-wider font-sans">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-blue-500" />
                          Agente 2: Consulta de Precios en la WEB & Verificación de Reglas
                        </div>
                        <span className="text-[10px] py-0.5 px-2 font-mono bg-blue-500/10 text-blue-500 rounded border border-blue-500/20">LIVE_WEB_LOOKUP</span>
                      </div>

                      {/* Displaying the exact web component reference lookups */}
                      <div className="bg-white/50 dark:bg-slate-950/30 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2 select-none">Bitácora de Monitoreo de Referencias Web:</span>
                        <div className="flex flex-col gap-2 font-mono text-[11px] leading-relaxed">
                          {selectedOrder.items.map((item) => {
                            const p = products.find(prod => prod.id === item.productId);
                            return (
                              <div key={item.productId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-1.5 last:border-0 last:pb-0">
                                <span className="text-slate-800 dark:text-slate-250 font-bold">
                                  🌐 {item.productName}:
                                </span>
                                {p?.webReference ? (
                                  <a 
                                    href={p.webReference} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    referrerPolicy="no-referrer"
                                    className="text-blue-650 dark:text-blue-400 hover:underline flex items-center gap-1 truncate max-w-xs md:max-w-sm"
                                  >
                                    <span className="truncate">{p.webReference}</span>
                                    <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
                                  </a>
                                ) : (
                                  <span className="text-slate-400 italic">No hay URL configurada en DB</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Applied rules traces info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
                        <div className="bg-emerald-500/5 p-2.5 border border-emerald-500/15 rounded-lg text-slate-700 dark:text-slate-400">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block select-none mb-1">REGLAS DE PRECIO APLICADAS</span>
                          <ul className="list-disc pl-3 text-[10.5px] leading-relaxed flex flex-col gap-1">
                            {selectedOrder.agentInferences.discountsApplied.length > 0 ? (
                              selectedOrder.agentInferences.discountsApplied.map((d, i) => <li key={i}>{d}</li>)
                            ) : (
                              <li>No se aplicaron descuentos especiales de volumen o nivel (VIP/Frecuente).</li>
                            )}
                          </ul>
                        </div>
                        <div className="bg-amber-500/5 p-2.5 border border-amber-500/15 rounded-lg text-slate-705 dark:text-slate-400">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block select-none mb-1">RECOMENDACIONES COMPATIBILIDAD</span>
                          <ul className="list-disc pl-3 text-[10.5px] leading-relaxed flex flex-col gap-1">
                            {selectedOrder.agentInferences.suggestions.length > 0 ? (
                              selectedOrder.agentInferences.suggestions.map((s, i) => <li key={i}>{s}</li>)
                            ) : (
                              <li>Kit balanceado de ingeniería detectado. Sin sugerencias de cables o drivers de soporte adicionales.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AGENT 3 PANEL */}
                  {activeAgentTab === "agent3" && (
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold select-none text-[11px] uppercase tracking-wider font-sans mb-1 pb-1">
                        <Cpu className="w-4 h-4 text-indigo-500" />
                        Agente 3: Supervisor de Inferencia & Redacción en Formato Comercial
                      </div>
                      <div className="font-mono text-[11px] leading-relaxed p-3 bg-white/40 dark:bg-slate-950/20 rounded border border-slate-250/50 dark:border-slate-800/80">
                        <p className="font-bold text-slate-800 dark:text-slate-200">Tareas del Supervisor:</p>
                        <ul className="list-decimal pl-4 space-y-1 mt-1 font-sans text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          <li>Auditar de forma determinista la suma matemática calculada por el Agente 2.</li>
                          <li>Controlar políticas fiscales (Añadir IVA 16% mexicano reglamentario).</li>
                          <li>Generar la cotización final formateada en tablas estructuradas Markdown para impresión.</li>
                          <li>Notificar por canales internos sobre la propuesta pendiente {selectedOrder.id}.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* FULL Collaborative TRACE LOG */}
                  {activeAgentTab === "full_trace" && (
                    <div className="font-mono text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-56 overflow-y-auto pr-1 whitespace-pre-line bg-white/40 dark:bg-slate-950/20 p-2.5 rounded border border-slate-200/40 dark:border-slate-800/80">
                      {selectedOrder.agentInferences.reasoningTrace || "No se registró bitácora textual de orquestación."}
                    </div>
                  )}
                </div>
              </div>

              {/* Transactions actions controls */}
              {selectedOrder.status === "pending_approval" && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-850 pt-4 mt-4 select-none">
                  <button
                    onClick={() => setDeleteConfirmId(selectedOrder.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-650 dark:text-red-400 hover:text-white hover:bg-red-600 rounded-xl border border-red-300 dark:border-red-900 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleReject(selectedOrder.id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 hover:text-white hover:bg-rose-600 rounded-xl border border-rose-300 dark:border-rose-900 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Rechazar
                    </button>
                    <button
                      onClick={() => handleApprove(selectedOrder.id)}
                      className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Autorizar y Despachar
                    </button>
                  </div>
                </div>
              )}

              {selectedOrder.status === "approved" && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-850 pt-3 mt-4 select-none">
                  <div className="text-left text-xs text-emerald-600 dark:text-emerald-450 font-bold">
                    ✓ Venta autorizada y despachada. Bodega central disminuyó las existencias físicas de componentes.
                  </div>
                  <button
                    onClick={() => setDeleteConfirmId(selectedOrder.id)}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-red-600 hover:text-white text-xs font-bold text-red-550 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    Eliminar
                  </button>
                </div>
              )}

              {selectedOrder.status === "rejected" && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-850 pt-3 mt-4 select-none">
                  <div className="text-left text-xs text-rose-600 dark:text-rose-450 font-bold">
                    ✗ Esta propuesta técnica de cotización fue rechazada y archivada.
                  </div>
                  <button
                    onClick={() => setDeleteConfirmId(selectedOrder.id)}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-red-600 hover:text-white text-xs font-bold text-red-550 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    Eliminar
                  </button>
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border border-slate-150 dark:border-slate-800 rounded-xl p-10 bg-slate-50 dark:bg-slate-950/20 text-slate-400 text-xs py-28 text-center select-none">
              <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2 animate-pulse" />
              Selecciona una cotización de la bandeja de entrada para auditar el flujo de orquestación.
            </div>
          )}
        </div>

      </div>

      {/* CONFIRMATION MODAL FOR DELETIONS */}
      {deleteConfirmId && (
        <div id="delete-order-confirmation-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-950 dark:text-slate-50 text-base">¿Estás seguro de eliminar este pedido?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{deleteConfirmId}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-450 leading-relaxed mb-6">
              Esta acción es **irreversible**. El pedido e histórico de orquestación serán eliminados definitivamente de la base de datos central de Firestore y de la cola del servidor.
            </p>

            <div className="flex items-center justify-end gap-3 select-none">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!deleteConfirmId) return;
                  try {
                    setErrorMessage(null);
                    await onDeleteOrder(deleteConfirmId);
                    const remainingFiltered = filteredOrders.filter(o => o.id !== deleteConfirmId);
                    if (remainingFiltered.length > 0) {
                      setSelectedOrderId(remainingFiltered[0].id);
                    } else {
                      setSelectedOrderId(null);
                    }
                    setDeleteConfirmId(null);
                  } catch (err: any) {
                    setErrorMessage(err.message || "Error al eliminar el pedido.");
                    setDeleteConfirmId(null);
                  }
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
