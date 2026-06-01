import React from "react";
import { UserCheck, Cpu, ShieldCheck, ArrowRight, Check, FlameKindling, Loader2 } from "lucide-react";
import { AgentStep } from "../types";

interface AgentStatusFlowProps {
  steps: AgentStep[];
}

export default function AgentStatusFlow({ steps }: AgentStatusFlowProps) {
  const agentDetails = {
    "Atención al Cliente": {
      icon: UserCheck,
      color: "from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/30",
      description: "Recibe e interpreta lenguaje natural, extrae intenciones de compra y clasifica solicitudes de hardware/software.",
    },
    "Generador de Pedido": {
      icon: Cpu,
      color: "from-amber-500/20 to-orange-550/20 text-amber-400 border border-amber-500/30",
      description: "Ejecuta algoritmos del sistema experto: valida stock físico, calcula descuentos por volumen y tier, e infiere sugerencias técnicas.",
    },
    "Supervisor Explicador": {
      icon: ShieldCheck,
      color: "from-emerald-500/20 to-teal-555/20 text-emerald-400 border border-emerald-500/30",
      description: "Verifica integridades lógico-técnicas del pedido y redacta la bitácora de razonamiento experto para validación humana.",
    },
  };

  return (
    <div id="agent-status-flow-container" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-700/40 gap-3">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 tracking-tight text-sm sm:text-base">
            <FlameKindling className="w-5 h-5 text-blue-500 animate-pulse" />
            Flujo de Orquestación Multi-Agente FIUNVA
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Los agentes de IA deliberan colaborativamente para formular cada propuesta técnica.
          </p>
        </div>
        <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 self-start sm:self-center">
          Base de Conocimientos Activa
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
        {steps.map((step, idx) => {
          const detail = agentDetails[step.agentName];
          const Icon = detail.icon;

          return (
            <div
              key={step.agentName}
              id={`agent-step-${idx}`}
              className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 ${
                step.status === "thinking"
                  ? "bg-blue-500/5 dark:bg-blue-500/5 border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-550/5"
                  : step.status === "completed"
                  ? "bg-slate-50/80 dark:bg-slate-900/40 border-emerald-500/40 dark:border-emerald-800/60 shadow-xs"
                  : "bg-slate-50/30 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800/80 opacity-60"
              }`}
            >
              <div>
                {/* Header Agent */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg bg-gradient-to-tr ${detail.color} shadow-xs`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {step.status === "thinking" && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Deliberando...
                      </span>
                    )}
                    {step.status === "completed" && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        Guardado
                      </span>
                    )}
                    {step.status === "idle" && (
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                        En Espera
                      </span>
                    )}
                  </div>
                </div>

                <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-250">
                  Agente {idx + 1}: {step.agentName}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {detail.description}
                </p>
              </div>

              {/* Step Output Box */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                <div className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                  Salida de Agente:
                </div>
                <div className="max-h-24 overflow-y-auto mt-1.5 pr-1 text-[11px] font-mono leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200/55 dark:border-slate-950">
                  {step.output || "Esperando inicialización técnica..."}
                </div>
              </div>

              {/* Connecting arrow for screens md: and up */}
              {idx < 2 && (
                <div className="hidden md:flex absolute top-1/2 -right-3.5 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 shadow-sm">
                  <ArrowRight className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
