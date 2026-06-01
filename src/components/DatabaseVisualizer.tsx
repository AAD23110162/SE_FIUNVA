import React, { useState } from "react";
import { Database, DatabaseBackup, Search, RefreshCw, Layers, CheckCircle2, FileJson } from "lucide-react";
import { Product, Order, UserProfile } from "../types";

interface DatabaseVisualizerProps {
  products: Product[];
  orders: Order[];
  users: UserProfile[];
  onResetDatabase: () => void;
  isResetting: boolean;
}

type CollectionType = "users" | "products" | "orders";

export default function DatabaseVisualizer({
  products,
  orders,
  users,
  onResetDatabase,
  isResetting,
}: DatabaseVisualizerProps) {
  const [activeCollection, setActiveCollection] = useState<CollectionType>("products");
  const [searchTerm, setSearchTerm] = useState("");

  const collections = {
    users: {
      path: "/users",
      data: users,
      description: "Perfiles de clientes y personal interno con roles y niveles de descuento de seguridad.",
    },
    products: {
      path: "/products",
      data: products,
      description: "Catálogo maestro físico en bodega de FIUNVA: motores, placas electrónicas y consultoría.",
    },
    orders: {
      path: "/orders",
      data: orders,
      description: "Registro de propuestas de venta pendientes, aprobadas y rechazadas para auditoría.",
    },
  };

  const activeData = collections[activeCollection].data;
  const filteredData = activeData.filter((item: any) => {
    const stringified = JSON.stringify(item).toLowerCase();
    return stringified.includes(searchTerm.toLowerCase());
  });

  return (
    <div id="database-visualizer-container" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-md flex flex-col h-full min-h-[500px]">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/40 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base tracking-tight">
              Explorador de Firestore Activo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspecciona de forma interactiva las colecciones y esquemas persistidos del sistema experto.
            </p>
          </div>
        </div>

        {/* Database Quick Actions */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Vínculo Conectado
          </div>
          <button
            onClick={onResetDatabase}
            disabled={isResetting}
            title="Resetear base de datos completa de FIUNVA"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-705 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 transition"
          >
            <RefreshCw className={`w-3 h-3 ${isResetting ? "animate-spin" : ""}`} />
            Restablecer DB
          </button>
        </div>
      </div>

      {/* Main Grid: Collections tabs vs Document Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Left Side: Collection Tabs */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 mb-1 select-none">
            Colecciones de Firestore
          </div>
          {(Object.keys(collections) as CollectionType[]).map((key) => {
            const col = collections[key];
            const isSelected = activeCollection === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveCollection(key);
                  setSearchTerm("");
                }}
                className={`w-full text-left p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                  isSelected
                    ? "bg-blue-500/10 dark:bg-blue-500/10 border-blue-500/40 text-blue-950 dark:text-blue-300"
                    : "bg-slate-50/50 hover:bg-slate-100/80 dark:bg-slate-900/30 dark:hover:bg-slate-900/60 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200/60 dark:bg-slate-805 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {col.path}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {col.data.length} docs
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-1">
                    {col.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Side: Document list & JSON viewer */}
        <div className="lg:col-span-8 flex flex-col bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-900 flex-1">
          {/* Document Filter Bar */}
          <div className="flex items-center gap-2 mb-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Búsqueda en ${collections[activeCollection].path}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-100 outline-hidden w-full placeholder-slate-400 dark:placeholder-slate-505"
            />
          </div>

          {/* JSON Document Viewer */}
          <div className="overflow-y-auto max-h-[350px] flex-1 pr-1 flex flex-col gap-3">
            {filteredData.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500 font-medium">
                Ningún documento coincide con el filtro de búsqueda.
              </div>
            ) : (
              filteredData.map((doc: any, index: number) => {
                const docId = doc.id || doc.uid || `doc-${index}`;
                return (
                  <div
                    key={docId}
                    className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-850"
                  >
                    {/* Document Header block */}
                    <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                        <FileJson className="w-3.5 h-3.5 text-slate-400" />
                        ID: <span className="text-blue-600 dark:text-blue-400">"{docId}"</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Documento Firestore
                      </span>
                    </div>

                    {/* Syntax highlight JSON block */}
                    <pre className="text-[10px] sm:text-xs font-mono text-slate-600 dark:text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(doc, null, 2)}
                    </pre>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
