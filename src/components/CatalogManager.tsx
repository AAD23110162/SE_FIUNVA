import React, { useState } from "react";
import { Database, Link, DollarSign, Globe, CheckCircle, Save, ExternalLink, Cog, Info, Package, Hammer, Trash2, Plus, X, AlertCircle } from "lucide-react";
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
  const [editWebRefs, setEditWebRefs] = useState<string[]>([""]);
  const [editName, setEditName] = useState<string>("");
  const [editDesc, setEditDesc] = useState<string>("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States for custom delete confirmation modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");

  // States for adding item
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showAddService, setShowAddService] = useState(false);

  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"electronics" | "robotics" | "bundles" | "software_service">("electronics");
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newStock, setNewStock] = useState<number>(0);
  const [newUnit, setNewUnit] = useState("pza");
  const [newDesc, setNewDesc] = useState("");
  const [newWebRefs, setNewWebRefs] = useState<string[]>([""]);
  const [newCurrency, setNewCurrency] = useState<"USD" | "MXN" | "EUR">("USD");

  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const formatProductPrice = (p: Product) => {
    // If the product has registered originalPrice and originalCurrency
    const origPrice = p.originalPrice !== undefined ? p.originalPrice : p.price;
    const origCurr = p.originalCurrency || "USD";

    // If current selected currency matches the entry currency, use original price verbatim
    if (currentCurrency === origCurr) {
      if (currentCurrency === "MXN") {
        return `$${origPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
      }
      if (currentCurrency === "EUR") {
        return `€${origPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
      }
      return `$${origPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    }

    // Otherwise, convert original price to USD, then from USD to currentCurrency
    const exchangeForOrig = exchangeRates[origCurr] || 1;
    const priceInUSD = origPrice / exchangeForOrig;
    const targetRate = exchangeRates[currentCurrency] || 1;
    const converted = priceInUSD * targetRate;

    if (currentCurrency === "MXN") {
      return `$${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
    }
    if (currentCurrency === "EUR") {
      return `€${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
    }
    return `$${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  };

  const handleAddNew = async (categoryType: "component" | "service") => {
    setAddError(null);
    setIsAdding(true);
    try {
      if (!newName.trim()) {
        setAddError("El nombre es obligatorio.");
        setIsAdding(false);
        return;
      }

      // Generate a clean, unique id based on Name + small random suffix
      const rawSlug = newName.toLowerCase().trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/(^_+|_+$)/g, "");
      const generatedId = (rawSlug || "item") + "_" + Math.floor(100 + Math.random() * 900);

      // Perform conversion to USD to feed back-end core calculation systems
      const rateToUse = exchangeRates[newCurrency] || 1;
      const finalUSDPrice = Number(newPrice) / rateToUse;

      // Establish preset categories and quantities
      const finalCategory = categoryType === "service" ? "software_service" : "electronics";
      const finalUnit = categoryType === "service" ? "hora" : "pza";
      const finalStock = categoryType === "service" ? 9999 : 10;
      const finalDesc = categoryType === "service" ? "Servicio profesional de ingeniería" : "Componente de base de datos";

      const response = await fetch("/api/products/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: generatedId,
          name: newName.trim(),
          category: finalCategory,
          price: finalUSDPrice,
          stock: finalStock,
          description: finalDesc,
          unit: finalUnit,
          webReferences: newWebRefs.filter(url => url.trim() !== ""),
          originalPrice: Number(newPrice),
          originalCurrency: newCurrency
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMsg(`Registro "${newName}" agregado con éxito.`);
        await onRefreshCatalog();
        // Reset states
        setNewId("");
        setNewName("");
        setNewPrice(0);
        setNewStock(0);
        setNewUnit("pza");
        setNewDesc("");
        setNewWebRefs([""]);
        setNewCurrency("USD");
        setShowAddComponent(false);
        setShowAddService(false);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setAddError(data.error || "Upps! No se pudo registrar en la base de datos.");
      }
    } catch (e) {
      console.error(e);
      setAddError("Error en la conexión con el servidor.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteClick = (productId: string, productName: string) => {
    setDeleteConfirmId(productId);
    setDeleteConfirmName(productName);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const productId = deleteConfirmId;
    const productName = deleteConfirmName;

    // Reset confirm dialog states
    setDeleteConfirmId(null);
    setDeleteConfirmName("");

    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMsg(`Registro "${productName}" eliminado con éxito.`);
        await onRefreshCatalog();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(data.error || "Ocurrió un error al intentar eliminar el registro.");
        setTimeout(() => setErrorMsg(null), 5000);
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Error de red al intentar eliminar el componente.");
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditPrice(product.price);
    const existingRefs = product.webReferences && product.webReferences.length > 0
      ? [...product.webReferences]
      : [product.webReference || ""];
    setEditWebRefs(existingRefs.length > 0 ? existingRefs : [""]);
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

      const filteredRefs = editWebRefs.filter(url => url.trim() !== "");
      const response = await fetch("/api/products/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          name: editName,
          price: Number(editPrice),
          stock: original.stock, // keep stock unchanged
          description: editDesc,
          webReferences: filteredRefs,
          webReference: filteredRefs[0] || ""
        })
      });

      if (response.ok) {
        setSuccessMsg(`Registro "${editName}" actualizado con éxito.`);
        setEditingId(null);
        await onRefreshCatalog();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg("Ocurrió un error al actualizar los datos en el servidor.");
        setTimeout(() => setErrorMsg(null), 4000);
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Error de red al actualizar.");
      setTimeout(() => setErrorMsg(null), 4000);
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

      {errorMsg && (
        <div id="catalog-error-alert" className="mb-4 text-xs font-semibold p-3.5 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-450 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          {errorMsg}
        </div>
      )}

      {/* Grid of components vs services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Component Registry with Web Links */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-4.5 h-4.5 text-blue-550" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Base de Componentes y URLs de Referencia
              </h4>
            </div>
            <button
              onClick={() => {
                setShowAddComponent(!showAddComponent);
                setAddError(null);
                setNewCategory("electronics");
                setNewUnit("pza");
                setNewId("");
                setNewName("");
                setNewPrice(0);
                setNewStock(0);
                setNewDesc("");
                setNewWebRefs([""]);
              }}
              className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs select-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddComponent ? "Cerrar" : "Agregar Nuevo"}</span>
            </button>
          </div>

          {showAddComponent && (
            <div className="p-4 rounded-xl border border-blue-500 bg-slate-50/60 dark:bg-slate-950/45 flex flex-col gap-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Nuevo Componente Electrónico</span>
                <button onClick={() => setShowAddComponent(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addError && (
                <div className="p-2.5 text-xs bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Micro Servo Motor"
                  className="w-full text-xs p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Precio</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice || ""}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full text-xs font-mono p-2 rounded bg-white dark:bg-slate-800 text-slate-850 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Moneda del Precio</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as "USD" | "MXN" | "EUR")}
                    className="w-full text-xs p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none font-semibold"
                  >
                    <option value="USD">Dólares (USD)</option>
                    <option value="MXN">Pesos Mexicanos (MXN)</option>
                    <option value="EUR">Euros (EUR)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-blue-500/10 bg-slate-50 dark:bg-slate-900/60 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block select-none">Enlaces de Referencia / Consulta Web</span>
                <div id="new-web-refs" className="flex flex-col gap-2">
                  {newWebRefs.map((ref, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <input
                          type="url"
                          value={ref}
                          onChange={(e) => {
                            const updated = [...newWebRefs];
                            updated[idx] = e.target.value;
                            setNewWebRefs(updated);
                          }}
                          placeholder={idx === 0 ? "https://www.mouser.com/... (Enlace Principal)" : "https://www.digikey.com/... (Enlace Secundario)"}
                          className="w-full text-xs font-mono p-2 rounded bg-white dark:bg-slate-800 text-slate-850 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none focus:border-blue-500"
                        />
                        <div className="flex items-center justify-between mt-0.5 px-0.5 select-none">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${
                            idx === 0 ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-400 dark:text-slate-500"
                          }`}>
                            {idx === 0 ? "★ Principal / Primario" : `Secundario #${idx}`}
                          </span>
                        </div>
                      </div>
                      {newWebRefs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewWebRefs(newWebRefs.filter((_, i) => i !== idx));
                          }}
                          className="p-2 text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent transition-all cursor-pointer"
                          title="Quitar este enlace"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setNewWebRefs([...newWebRefs, ""])}
                  className="mt-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer select-none self-start"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar otro enlace</span>
                </button>
              </div>

              <div className="flex justify-end gap-1.5 select-none">
                <button
                  type="button"
                  onClick={() => setShowAddComponent(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isAdding}
                  onClick={() => handleAddNew("component")}
                  className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  {isAdding ? "Registrando..." : "Registrar Componente"}
                </button>
              </div>
            </div>
          )}

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
                      <div className="flex items-center gap-1.5 select-none">
                        <button
                          onClick={() => startEdit(p)}
                          className="text-xs px-2.5 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 dark:hover:bg-blue-400/15 rounded-lg font-bold border border-blue-500/10 cursor-pointer"
                        >
                          Editar Ref
                        </button>
                        <button
                          onClick={() => handleDeleteClick(p.id, p.name)}
                          title="Eliminar del catálogo"
                          className="p-1 px-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/10 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Enlaces de Referencia (Mouser / DigiKey / Pololu)</label>
                        <div className="flex flex-col gap-2.5 bg-slate-100 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                          {editWebRefs.map((ref, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <div className="flex-1">
                                <input
                                  type="url"
                                  value={ref}
                                  onChange={(e) => {
                                    const updated = [...editWebRefs];
                                    updated[idx] = e.target.value;
                                    setEditWebRefs(updated);
                                  }}
                                  className="w-full text-xs font-mono p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-250 dark:border-slate-705 outline-none focus:border-blue-500"
                                  placeholder={idx === 0 ? "https://www.mouser.com/... (Enlace Principal)" : "https://www.digikey.com/... (Enlace Secundario)"}
                                />
                                <span className={`text-[9px] font-bold block mt-0.5 px-0.5 select-none ${
                                  idx === 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-505"
                                }`}>
                                  {idx === 0 ? "★ Enlace Principal (Primer Enlace)" : `Enlace Secundario #${idx}`}
                                </span>
                              </div>
                              {editWebRefs.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditWebRefs(editWebRefs.filter((_, i) => i !== idx));
                                  }}
                                  className="p-1 px-1.5 text-red-500 hover:text-red-750 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
                                  title="Quitar este enlace"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setEditWebRefs([...editWebRefs, ""])}
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1 cursor-pointer self-start select-none"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar otro enlace</span>
                          </button>
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
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-850/60 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                      <div>
                        <span className="text-[10px] block uppercase font-bold tracking-wider text-slate-400 dark:text-slate-505 select-none">Precio Unitario ({currentCurrency})</span>
                        <span className="font-mono font-bold text-slate-850 dark:text-slate-200">
                          {formatProductPrice(p)}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1.5 max-w-full sm:max-w-[65%]">
                        <span className="text-[10px] block uppercase font-bold tracking-wider text-slate-400 dark:text-slate-505 select-none mb-0.5">URLs de Referencia</span>
                        {p.webReferences && p.webReferences.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {p.webReferences.map((ref, idx) => (
                              <a
                                key={idx}
                                href={ref}
                                target="_blank"
                                rel="noreferrer"
                                referrerPolicy="no-referrer"
                                className={`flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 py-1.5 px-2.5 hover:bg-slate-100 dark:hover:bg-slate-950 rounded transition-colors text-[10.5px] font-mono border border-slate-200/50 dark:border-slate-800 ${
                                  idx === 0 
                                    ? "text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/5 border-blue-500/20" 
                                    : "text-slate-550 dark:text-slate-400"
                                }`}
                                title={ref}
                              >
                                <Globe className={`w-3.5 h-3.5 ${idx === 0 ? "text-blue-500" : "text-slate-450 dark:text-slate-500"}`} />
                                <span className="truncate max-w-[155px] sm:max-w-[210px]">
                                  {idx === 0 ? `⭐ Principal: ${ref.replace(/^https?:\/\/(www\.)?/, "")}` : `Secundario ${idx}: ${ref.replace(/^https?:\/\/(www\.)?/, "")}`}
                                </span>
                                <ExternalLink className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              </a>
                            ))}
                          </div>
                        ) : p.webReference ? (
                          <a
                            href={p.webReference}
                            target="_blank"
                            rel="noreferrer"
                            referrerPolicy="no-referrer"
                            className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/5 border-blue-500/20 hover:text-blue-750 py-1.5 px-2.5 hover:bg-slate-100 dark:hover:bg-slate-950 rounded transition-colors text-[10.5px] font-mono border border-slate-200/50"
                          >
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                            <span className="truncate max-w-[155px] sm:max-w-[210px]">⭐ Principal: {p.webReference.replace(/^https?:\/\/(www\.)?/, "")}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-[10.5px] text-slate-400 dark:text-slate-550 italic font-mono px-2 select-none">
                            Sin URLs vinculadas
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Services Pricing & Configurations */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <Hammer className="w-4.5 h-4.5 text-indigo-550" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Catálogo de Servicios de Ingeniería (Tarifas)
              </h4>
            </div>
            <button
              onClick={() => {
                setShowAddService(!showAddService);
                setAddError(null);
                setNewCategory("software_service");
                setNewUnit("hr");
                setNewId("");
                setNewName("");
                setNewPrice(0);
                setNewStock(9999); // services usually have abundant "stock"
                setNewDesc("");
                setNewWebRefs([""]);
              }}
              className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs select-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddService ? "Cerrar" : "Agregar Nuevo"}</span>
            </button>
          </div>

          {showAddService && (
            <div className="p-4 rounded-xl border border-indigo-500 bg-slate-50/60 dark:bg-slate-950/45 flex flex-col gap-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Nuevo Servicio de Ingeniería</span>
                <button onClick={() => setShowAddService(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addError && (
                <div className="p-2.5 text-xs bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nombre del Servicio</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Diseño de Esquemáticos PCB"
                  className="w-full text-xs p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tarifa Profesional</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice || ""}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full text-xs font-mono p-2 rounded bg-white dark:bg-slate-800 text-slate-850 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Moneda del Precio</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as "USD" | "MXN" | "EUR")}
                    className="w-full text-xs p-2 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 outline-none font-semibold"
                  >
                    <option value="USD">Dólares (USD)</option>
                    <option value="MXN">Pesos Mexicanos (MXN)</option>
                    <option value="EUR">Euros (EUR)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-1.5 select-none">
                <button
                  type="button"
                  onClick={() => setShowAddService(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isAdding}
                  onClick={() => handleAddNew("service")}
                  className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  {isAdding ? "Registrando..." : "Registrar Servicio"}
                </button>
              </div>
            </div>
          )}

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
                      <div className="flex items-center gap-1.5 select-none">
                        <button
                          onClick={() => startEdit(p)}
                          className="text-xs px-2.5 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-400/15 rounded-lg font-bold border border-indigo-500/10 cursor-pointer"
                        >
                          Ajustar Tarifa
                        </button>
                        <button
                          onClick={() => handleDeleteClick(p.id, p.name)}
                          title="Eliminar del catálogo"
                          className="p-1 px-1.5 text-red-550 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/10 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                          className="px-3.5 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded font-bold shadow-xs flex items-center gap-1 cursor-pointer"
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
                          {formatProductPrice(p)} <span className="text-[10px] font-normal text-slate-400 uppercase">/ {p.unit}</span>
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

      {/* CUSTOM CONFIRMATION DIALOG MODAL */}
      {deleteConfirmId && (
        <div id="delete-confirmation-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-xl flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h4 className="font-bold text-slate-950 dark:text-slate-50 text-sm sm:text-base tracking-tight font-sans">
                  ¿Confirmar eliminación?
                </h4>
                <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">
                  Acción de Catálogo Maestro
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              ¿Está seguro que desea eliminar <span className="font-bold text-slate-950 dark:text-white">"{deleteConfirmName}"</span> del catálogo? Esta acción es irreversible y removerá el registro permanentemente.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 select-none font-sans">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmName("");
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-red-650 hover:bg-red-700 bg-red-600 rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Aceptar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
