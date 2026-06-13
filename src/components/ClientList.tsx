import React, { useState } from "react";
import { UserProfile, Order } from "../types";
import { 
  Users, 
  Mail, 
  TrendingUp, 
  Key, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Save, 
  AlertCircle, 
  FolderOpen, 
  ExternalLink, 
  ShieldAlert,
  Search,
  Check,
  Phone
} from "lucide-react";

interface ClientListProps {
  users: UserProfile[];
  orders: Order[];
  currentCurrency?: "USD" | "MXN" | "EUR";
  formatBasePrice?: (priceInUSD: number) => string;
  onSaveUser: (user: UserProfile) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onSelectOrderExternal: (orderId: string) => void;
}

export default function ClientList({
  users,
  orders,
  currentCurrency = "MXN",
  formatBasePrice = (price) => `$${price.toFixed(2)} MXN`,
  onSaveUser,
  onDeleteUser,
  onSelectOrderExternal
}: ClientListProps) {
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal/Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  
  // Draft Form State
  const [formUid, setFormUid] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"client" | "operator" | "admin">("client");
  const [formClientTier, setFormClientTier] = useState<"standard" | "frequent" | "vip">("standard");
  const [formPhone, setFormPhone] = useState("");
  const [formPreferredContact, setFormPreferredContact] = useState<"celular" | "correo">("correo");
  
  // Alert message
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiSuccess, setUiSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client project view states
  const [activeProjectClient, setActiveProjectClient] = useState<UserProfile | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<"clients" | "staff">("clients");

  // Delete confirmation modals
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const roleColors = {
    client: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20",
    operator: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20",
    admin: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20",
  };

  const tierColors = {
    standard: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/30",
    frequent: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    vip: "bg-indigo-500/15 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 font-bold",
  };

  const orderStatusBadges = {
    pending_approval: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    approved: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    rejected: "text-rose-600 dark:text-rose-400 bg-rose-500/10"
  };

  // Filter users based on search and roles mapping to files/tabs
  const clientsOnly = users.filter(usr => usr.role === "client");
  const staffOnly = users.filter(usr => usr.role === "admin" || usr.role === "operator");

  const listToFilter = activeViewTab === "clients" ? clientsOnly : staffOnly;

  const filteredUsers = listToFilter.filter(usr => 
    usr.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    usr.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usr.uid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Open Form for Adding User
  const handleAddClick = () => {
    // Auto-generate random ID like usr-389
    const randomId = "usr-" + Math.floor(100 + Math.random() * 900);
    setFormUid(randomId);
    setFormName("");
    setFormEmail("");
    setFormRole(activeViewTab === "clients" ? "client" : "operator");
    setFormClientTier("standard");
    setFormPhone("");
    setFormPreferredContact("correo");
    setEditingUser(null);
    setUiError(null);
    setIsFormOpen(true);
  };

  // Open Form for Editing User
  const handleEditClick = (user: UserProfile) => {
    setFormUid(user.uid);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormClientTier(user.clientTier);
    setFormPhone(user.phone || "");
    setFormPreferredContact(user.preferredContact || "correo");
    setEditingUser(user);
    setUiError(null);
    setIsFormOpen(true);
  };

  // Submit User form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !formUid.trim()) {
      setUiError("Todos los campos con (*) son requeridos.");
      return;
    }

    // Check if ID is clean
    if (!/^[a-zA-Z0-9_\-]+$/.test(formUid)) {
      setUiError("El ID de usuario solo puede contener letras, números, guiones y guiones bajos.");
      return;
    }

    // Check if adding and ID already exists
    if (!editingUser && users.some(u => u.uid.toLowerCase() === formUid.toLowerCase())) {
      setUiError(`El identificador de usuario "${formUid}" ya se encuentra registrado.`);
      return;
    }

    setIsSubmitting(true);
    setUiError(null);

    const userPayload: UserProfile = {
      uid: formUid.trim(),
      name: formName.trim(),
      email: formEmail.trim(),
      role: formRole,
      clientTier: formClientTier,
      phone: formPhone.trim() || undefined,
      preferredContact: formPreferredContact
    };

    try {
      await onSaveUser(userPayload);
      setUiSuccess(`Perfil de "${userPayload.name}" guardado exitosamente.`);
      setIsFormOpen(false);
      setTimeout(() => setUiSuccess(null), 4000);
    } catch (err: any) {
      setUiError(err.message || "Falla al guardar el perfil en Firestore.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deletion
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      setIsSubmitting(true);
      await onDeleteUser(deleteConfirmId);
      setUiSuccess("El cliente fue removido de la base de datos.");
      setDeleteConfirmId(null);
      setTimeout(() => setUiSuccess(null), 4000);
    } catch (err: any) {
      setUiError(err.message || "Ocurrió un error al intentar eliminar el cliente.");
      setDeleteConfirmId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="clients-master-container" className="flex flex-col gap-6">
      
      {/* Top action cards & Messages */}
      {uiSuccess && (
        <div id="ui-success-banner" className="text-xs font-semibold p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-450 rounded-xl flex items-center gap-2 animate-scale-up">
          <Check className="w-4 h-4 text-emerald-500" />
          {uiSuccess}
        </div>
      )}

      {uiError && !isFormOpen && (
        <div id="ui-error-banner" className="text-xs font-semibold p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-450 rounded-xl flex items-center gap-2 animate-scale-up">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          {uiError}
        </div>
      )}

      {/* Main Control Panel */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        
        {/* Header Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 mb-5 select-none">
          <div>
            <h3 className="font-bold text-slate-950 dark:text-slate-50 flex items-center gap-2 text-sm sm:text-base tracking-tight font-sans">
              <Users className="w-5 h-5 text-indigo-500" />
              Catálogo Maestro de Clientes & Perfiles de Ingeniería
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Gestione perfiles de clientes, asigne políticas de beneficios (Tiers) automatizadas e inspeccione sus proyectos generados mediante orquestación de agentes.
            </p>
          </div>

          <button
            onClick={handleAddClick}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs gap-1.5 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-md transition-all self-start sm:self-center shrink-0"
          >
            <Plus className="w-4 h-4" />
            {activeViewTab === "clients" ? "Nuevo Cliente" : "Nuevo Staff/Admin"}
          </button>
        </div>

        {/* Tab Selection */}
        <div id="user-sub-tabs" className="flex border-b border-slate-100 dark:border-slate-800 mb-6 gap-6 select-none">
          <button
            onClick={() => setActiveViewTab("clients")}
            className={`pb-3 font-bold text-xs sm:text-sm tracking-tight cursor-pointer transition-all ${
              activeViewTab === "clients"
                ? "border-b-2 border-indigo-600 text-indigo-605 dark:text-indigo-400 font-extrabold"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            👥 Clientes Registrados ({clientsOnly.length})
          </button>
          <button
            onClick={() => setActiveViewTab("staff")}
            className={`pb-3 font-bold text-xs sm:text-sm tracking-tight cursor-pointer transition-all ${
              activeViewTab === "staff"
                ? "border-b-2 border-indigo-600 text-indigo-605 dark:text-indigo-400 font-extrabold"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            🛡️ Administradores y Operadores ({staffOnly.length})
          </button>
        </div>

        {/* Searching Filters */}
        <div className="mb-6 flex max-w-md w-full relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, correo electrónico o UID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all dark:text-white"
          />
        </div>

        {/* Clients Directory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUsers.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
              No se encontraron usuarios o perfiles registrados que coincidan con la búsqueda.
            </div>
          ) : (
            filteredUsers.map((user) => {
              // Calculate specific client's projects
              const clientOrders = orders.filter((o) => o?.clientId === user.uid);
              const approvedOrdersCount = clientOrders.filter((o) => o.status === "approved").length;
              const pendingOrdersCount = clientOrders.filter((o) => o.status === "pending_approval").length;
              const totalSpent = clientOrders
                .filter((o) => o.status === "approved")
                .reduce((sum, o) => sum + o.total, 0);

              return (
                <div
                  key={user.uid}
                  className="p-5 rounded-2xl border border-slate-150 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-950/10 hover:border-indigo-500/25 hover:bg-slate-50/60 dark:hover:bg-slate-950/20 transition-all flex flex-col gap-4 justify-between"
                >
                  <div>
                    {/* Top title bar */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="truncate">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate" title={user.name}>
                          {user.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold inline-block border ${roleColors[user.role] || ""}`}>
                            {user.role}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons list */}
                      <div className="flex items-center gap-1 shrink-0 select-none">
                        <button
                          onClick={() => handleEditClick(user)}
                          title="Modificar perfil"
                          className="p-1 px-1.5 rounded-lg border border-slate-150 dark:border-slate-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-500/20 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-indigo-500/5 transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteConfirmId(user.uid);
                            setDeleteConfirmName(user.name);
                          }}
                          disabled={user.uid === "usr_admin"} // Avoid deleting default main admin
                          title={user.uid === "usr_admin" ? "Inmune a eliminación" : "Eliminar cliente definitivamente"}
                          className={`p-1 px-1.5 rounded-lg border border-slate-150 dark:border-slate-800 transition cursor-pointer ${
                            user.uid === "usr_admin" 
                              ? "opacity-30 cursor-not-allowed" 
                              : "text-slate-500 hover:text-rose-600 hover:border-rose-500/20 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-500/5"
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Meta items */}
                    <div className="flex flex-col gap-1 mt-3.5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                          <span className="truncate">{user.phone} ({user.preferredContact === "celular" ? "Celular" : "Correo"})</span>
                        </div>
                      )}
                      {!user.phone && user.preferredContact && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                          <span className="truncate text-slate-400">Contacto: por {user.preferredContact}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-400 shrink-1">{user.uid}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary of statistics & metrics */}
                  <div className="border-t border-slate-100 dark:border-slate-850 pt-3.5 flex flex-col gap-2 mt-1">
                    <div className="flex items-center justify-between gap-1 w-full text-xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold font-mono">Tasa de Beneficio (Tier)</span>
                      <span className={`inline-block text-[10px] uppercase font-bold text-center px-2 py-0.5 rounded-full ${tierColors[user.clientTier] || ""}`}>
                        {user.clientTier}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 w-full text-xs pt-1 border-t border-dashed border-slate-100 dark:border-slate-850/50">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold font-mono">Total Capital Invertido</span>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-450 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{formatBasePrice(totalSpent)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Access user's projects */}
                  <div className="border-t border-slate-100 dark:border-slate-850 pt-3">
                    <button
                      onClick={() => setActiveProjectClient(user)}
                      className="w-full py-1.5 px-3 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-transparent"
                    >
                      <FolderOpen className="w-4 h-4 shrink-0" />
                      <span>Ver Proyectos ({clientOrders.length})</span>
                      {pendingOrdersCount > 0 && (
                        <span className="bg-amber-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full flex items-center justify-center h-4 min-w-4 select-none shrink-0 animate-pulse animate-duration-1000">
                          {pendingOrdersCount} pend.
                        </span>
                      )}
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL FORM */}
      {isFormOpen && (() => {
        const isStaff = formRole === "operator" || formRole === "admin";
        return (
          <div id="client-form-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-xl flex flex-col gap-4 animate-scale-up">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 select-none">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <h4 className="font-bold text-slate-950 dark:text-slate-50 text-sm sm:text-base font-sans leading-none">
                    {editingUser 
                      ? (isStaff ? "Modificar Perfil de Staff/Ingeniería" : "Modificar Datos de Cliente") 
                      : (isStaff ? "Registrar Nuevo Staff/Ingeniería" : "Registrar Nuevo Cliente")}
                  </h4>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-650 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error inside Form */}
              {uiError && (
                <div className="text-xs p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-450 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{uiError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 text-xs font-sans">
                
                {/* UID Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-350 select-none">
                    Identificador de Usuario (UID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingUser !== null} // Read-only on edit
                    value={formUid}
                    onChange={(e) => setFormUid(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    placeholder={isStaff ? "ej: op-305" : "ej: usr-923"}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed uppercase font-mono transition-all"
                  />
                  {!editingUser && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                      Este valor representa la clave de persistencia en Firestore. No se puede modificar después.
                    </p>
                  )}
                </div>

                {/* Name Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-350 select-none">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Juan Jose"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-350 select-none">
                    Correo Electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="juanjose@fiunva.com"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Phone & Preferred Contact Dual Field */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-350 select-none">
                      Celular de Contacto
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="ej: 3312345678"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-350 select-none">
                      Medio de Contacto
                    </label>
                    <select
                      value={formPreferredContact}
                      onChange={(e) => setFormPreferredContact(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all"
                    >
                      <option value="correo">Correo</option>
                      <option value="celular">Celular</option>
                    </select>
                  </div>
                </div>

                {/* Dual Column dropdown selectors */}
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Role */}
                  <div className={`flex flex-col gap-1.5 ${formRole === "client" ? "col-span-1" : "col-span-2"}`}>
                    <label className="font-bold text-slate-700 dark:text-slate-350 select-none">
                      Rol en Sistema
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all"
                    >
                      <option value="client">Client (Cliente Externo)</option>
                      <option value="operator">Operator (Operador - Ingeniería)</option>
                      <option value="admin">Admin (Administrador - Supervisor)</option>
                    </select>
                  </div>

                  {/* Tier benefits / Staff details dynamically rendered instead */}
                  {formRole === "client" ? (
                    <div className="flex flex-col gap-1.5 col-span-1">
                      <label className="font-bold text-slate-700 dark:text-slate-350 select-none">
                        Nivel de Descuento (Tier)
                      </label>
                      <select
                        value={formClientTier}
                        onChange={(e) => setFormClientTier(e.target.value as any)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all"
                      >
                        <option value="standard">Tier Standard (0% Desc.)</option>
                        <option value="frequent">Tier Frequent (5% Desc.)</option>
                        <option value="vip">Tier VIP (15% Desc.)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="col-span-2 p-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/25 rounded-xl text-[11px] text-indigo-700 dark:text-indigo-300">
                      <p className="font-bold mb-1 flex items-center gap-1 text-indigo-805 dark:text-indigo-400 select-none">
                        🛡️ Privilegios del Personal ({formRole === "admin" ? "Administrativo" : "Operador"}):
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 leading-normal text-slate-505 dark:text-slate-400">
                        {formRole === "admin" ? (
                          <>
                            <li>Control total del catálogo e inventarios.</li>
                            <li>Aprobación final de cotizaciones estimadas.</li>
                            <li>Restablecer o cargar snapshots en formato JSON de Firestore.</li>
                          </>
                        ) : (
                          <>
                            <li>Supervisión de la cola de pedidos de ingeniería.</li>
                            <li>Inspección técnica detallada del razonamiento experto.</li>
                            <li>Soporte al cliente y ajustes manuales a cotizaciones.</li>
                          </>
                        )}
                      </ul>
                    </div>
                  )}

                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 select-none">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 rounded-xl hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span>Guardando...</span>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{isStaff ? "Guardar Miembro Staff" : "Guardar Cliente"}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        );
      })()}

      {/* VER CLIENT PROJECTS / COTIZACIONES MODAL */}
      {activeProjectClient && (() => {
        const clientOrders = orders.filter((o) => o?.clientId === activeProjectClient.uid);
        return (
          <div id="client-orders-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col gap-4 animate-scale-up">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/35 rounded-xl text-indigo-500">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-950 dark:text-slate-50 text-sm sm:text-base leading-none">
                      Proyectos y Propuestas de Ingeniería
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase mt-1 leading-none">
                      Ficha de cliente: <span className="text-slate-700 dark:text-slate-350 font-bold">{activeProjectClient.name}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveProjectClient(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-650 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Projects body list */}
              <div className="max-h-96 overflow-y-auto pr-1 flex flex-col gap-3 py-1">
                {clientOrders.length === 0 ? (
                  <div className="py-16 text-center flex flex-col gap-2 items-center justify-center border border-dashed border-slate-150 dark:border-slate-800 rounded-2xl p-6 bg-slate-50/10">
                    <ShieldAlert className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Este cliente aún no ha enviado mensajes para orquestación de cotizaciones.
                    </p>
                    <p className="text-[11px] text-slate-400/80 leading-normal max-w-xs text-center">
                      Solicite al cliente que escriba su requerimiento en el menú de atención de FIUNVA para cotizarlos en tiempo real.
                    </p>
                  </div>
                ) : (
                  clientOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 rounded-xl border border-slate-150 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-950/20 hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: General Order Detail */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 select-none flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-white truncate">
                            {ord.id}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full select-none capitalize ${orderStatusBadges[ord.status] || ""}`}>
                            {ord.status === "pending_approval" ? "pendiente" : ord.status === "approved" ? "aprobado" : "rechazado"}
                          </span>
                        </div>
                        
                        {/* Summary of items */}
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 font-sans leading-relaxed">
                          <span className="font-bold text-indigo-500">{ord.items.length} componentes/servicios: </span>
                          <span className="truncate inline-block max-w-xs align-bottom">
                            {ord.items.map(item => `${item.quantity}x ${item.productName}`).join(", ")}
                          </span>
                        </p>

                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Generado el {new Date(ord.createdAt).toLocaleDateString()} a las {new Date(ord.createdAt).toLocaleTimeString()}
                        </p>
                      </div>

                      {/* Right: pricing & direct access */}
                      <div className="flex items-center md:items-end justify-between md:flex-col gap-2 md:text-right shrink-0">
                        <div>
                          <span className="block text-[8.5px] font-bold font-mono text-slate-400 uppercase tracking-wider">Total Cotizado</span>
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                            {formatBasePrice(ord.total)}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            // Switch subtab to quotes & set the selected order ID!
                            onSelectOrderExternal(ord.id);
                            setActiveProjectClient(null);
                          }}
                          className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 hover:shadow-sm text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Acceder</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom footer */}
              <div className="flex items-center justify-end select-none pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setActiveProjectClient(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        );
      })()}


      {/* ELIMINAR CLIENT CONFIRMATION DIALOG MODAL */}
      {deleteConfirmId && (
        <div id="delete-client-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-xl flex flex-col gap-4 animate-scale-up">
            
            <div className="flex items-center gap-3 pb-2 border-b border-rose-100 dark:border-rose-950">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h4 className="font-bold text-slate-950 dark:text-slate-50 text-sm sm:text-base tracking-tight font-sans">
                  ¿Eliminar Cliente permanentemente?
                </h4>
                <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">
                  Acción del Administrador de Estructura
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              ¿Está completamente de acuerdo en borrar al usuario <span className="font-bold text-slate-950 dark:text-white">"{deleteConfirmName}"</span> de los registros generales? Al realizar esto, ya no podrá procesar cotizaciones con su Identificador exclusivo (<span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">{deleteConfirmId}</span>). Esta acción no se puede deshacer.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 select-none font-sans">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmName("");
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>Removiendo...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Aceptar y Eliminar</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
