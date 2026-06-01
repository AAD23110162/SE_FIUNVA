import React, { useState } from "react";
import { Database, Link, DollarSign, Globe, CheckCircle, Save, ExternalLink, Cog, Info, Package, Hammer } from "lucide-react";
import { Product } from "../types";

interface CatalogManagerProps {
  products: Product[];
  onRefreshCatalog: () => Promise<void>;
  currentCurrency?: "USD" | "MXN" | "EUR";
  exchangeRates?: Record<"USD" | "MXN" | "EUR", number>;
  formatBasePrice?: (priceInUSD: number) => string;
}

export default function CatalogManager({
  products,
  onRefreshCatalog,
  currentCurrency = "USD",
  exchangeRates = { USD: 1, MXN: 17.50, EUR: 0.92 },
  formatBasePrice = (price) => `$${price.toFixed(2)} USD`
}: CatalogManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editWebRef, setEditWebRef] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [editDesc, setEditDesc] = useState<string>("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditPrice(product.price);
    setEditWebRef(product.webReference || "");
    setEditName(product.name);
    setEditDesc(product.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSuccessMsg(null);
  };

  const handleSave = async (productId: string) => {
    setIsSaving(true);
    setSuccessMsg(null);
    try {
      const original = products.find(p => p.id === productId);
      if (!original) return;

      const response = await fetch("/api/products/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          name: editName,
          price: Number(editPrice),
          stock: original.stock, // keep stock unchanged
          description: editDesc,
          webReference: editWebRef
        })
      });

      if (response.ok) {
        setSuccessMsg(`Registro "${editName}" actualizado con éxito.`);
        setEditingId(null);
        await onRefreshCatalog();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert("Ocurrió un error al actualizar los datos en el servidor.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const components = products.filter(p => p.category !== "software_service");
  const services = products.filter(p => p.category === "software_service");

  return (
    <div id="catalog-manager-container" className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md transition-colors duration-300">
      
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
        <div>
          <h3 className="font-bold text-slate-950 dark:text-slate-50 flex items-center gap-2 text-md sm:text-lg tracking-tight font-sans">
            <Cog className="w-5 h-5 text-blue-500 animate-spin-slow" />
            Directorio Técnico del Catálogo Maestro (FIUNVA)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Administra bases de datos de componentes electrónicos, links de consulta web y tarifas fijas de servicios técnicos de ingeniería.
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-55 pointer-events-none select-none text-[10px] sm:text-xs font-mono font-bold bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-850">
          CONSOLE_PORT: 3000
        </div>
      </div>

      {successMsg && (
        <div id="catalog-success-alert" className="mb-4 text-xs font-semibold p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-550" />
          {successMsg}
        </div>
      )}

      {/* Grid of components vs services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left Column: Component Registry with Web Links */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2 mb-2">
            <Package className="w-4.5 h-4.5 text-blue-550" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Base de Componentes y URLs de Referencia
            </h4>
          </div>

          <div className="flex flex-col gap-3.5">
            {components.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <div 
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isEditing 
                      ? "ring-2 ring-blue-500 bg-white dark:bg-slate-950 border-blue-500" 
                      : "bg-slate-50/40 dark:bg-slate-950/20 border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950/40"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-800 font-mono font-bold text-slate-600 dark:text-slate-400 select-all">
                        {p.id}
                      </span>
                      <h5 className="font-bold text-xs sm:text-sm text-slate-850 dark:text-slate-100 mt-1.5">
                        {p.name}
                      </h5>
                    </div>
                    
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(p)}
                        className="text-xs px-2.5 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 dark:hover:bg-blue-400/15 rounded-lg font-bold border border-blue-500/10 cursor-pointer"
                      >
                        Editar Ref
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-3.5 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Nombre</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full text-xs font-semibold p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Precio Unitario Base (USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-full text-xs font-mono p-2 rounded bg-white dark:bg-slate-800 text-slate-100 border border-slate-250 dark:border-slate-700 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Unidad</label>
                          <div className="text-xs p-2 bg-slate-100 dark:bg-slate-950 text-slate-500 rounded border border-slate-200 dark:border-slate-800 font-mono select-none">
                            {p.unit}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">URL Referencia Web (Mouser / DigiKey / Pololu)</label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editWebRef}
                            onChange={(e) => setEditWebRef(e.target.value)}
                            className="flex-1 text-xs font-mono p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-250 dark:border-slate-705 outline-none focus:border-blue-500"
                            placeholder="https://www.example.com"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 mt-2 select-none">
                        <button
                          onClick={cancelEdit}
                          className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-semibold border border-slate-200 dark:border-slate-700 font-mono"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSave(p.id)}
                          disabled={isSaving}
                          className="px-3.5 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-850/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-[10px] block uppercase font-bold tracking-wider text-slate-400 dark:text-slate-505 select-none">Precio Unitario ({currentCurrency})</span>
                        <span className="font-mono font-bold text-slate-850 dark:text-slate-200">
                          {formatBasePrice(p.price)}
                        </span>
                      </div>
                      
                      {p.webReference ? (
                        <a
                          href={p.webReference}
                          target="_blank"
                          rel="noreferrer"
                          referrerPolicy="no-referrer"
                          className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 py-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-950 rounded transition-colors text-[10.5px] font-mono border border-slate-200/50 dark:border-slate-800"
                        >
                          <Globe className="w-3.5 h-3.5 text-blue-500" />
                          <span>Ver enlace de consulta web</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      ) : (
                        <span className="text-[10.5px] text-slate-400 dark:text-slate-550 italic font-mono">
                          Sin URL vinculada
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Services Pricing & Configurations */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2 mb-2">
            <Hammer className="w-4.5 h-4.5 text-indigo-550" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Catálogo de Servicios de Ingeniería (Tarifas)
            </h4>
          </div>

          <div className="flex flex-col gap-3.5">
            {services.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <div 
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isEditing 
                      ? "ring-2 ring-indigo-500 bg-white dark:bg-slate-950 border-indigo-500" 
                      : "bg-slate-50/40 dark:bg-slate-950/20 border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950/40"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-205 dark:bg-indigo-950/40 font-mono font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-200/20">
                        {p.id}
                      </span>
                      <h5 className="font-bold text-xs sm:text-sm text-slate-850 dark:text-slate-100 mt-1.5">
                        {p.name}
                      </h5>
                      <p className="text-xs text-slate-400 dark:text-slate-400 mt-1 lines-2 leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                    
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(p)}
                        className="text-xs px-2.5 py-1 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-400/15 rounded-lg font-bold border border-indigo-500/10 cursor-pointer"
                      >
                        Ajustar Tarifa
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-3.5 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Tarifa del Servicio Base (USD)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="number"
                            step="1"
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-full text-xs font-mono pl-8 p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Descripción del Servicio</label>
                        <textarea
                          rows={2}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full text-xs p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-250 dark:border-slate-705 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 mt-1">
                        <button
                          onClick={cancelEdit}
                          className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-semibold border border-slate-200 dark:border-slate-750 font-mono"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSave(p.id)}
                          disabled={isSaving}
                          className="px-3.5 py-1.5 text-xs text-white bg-indigo-650 hover:bg-indigo-700 rounded font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Actualizar Tarifa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-850/60 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="text-[10px] block uppercase font-bold tracking-wider text-slate-400 dark:text-slate-505">Tarifa Profesional ({currentCurrency})</span>
                        <span className="font-mono font-bold text-sm text-indigo-700 dark:text-indigo-400">
                          {formatBasePrice(p.price)} <span className="text-[10px] font-normal text-slate-400 uppercase">/ {p.unit}</span>
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 font-sans px-2.5 py-1 bg-slate-100 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded">
                        <Info className="w-3 h-3 text-slate-400" />
                        <span>Tarifa ajustable</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
