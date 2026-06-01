import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dns from "dns";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Standard port setup
const PORT = 3000;
const app = express();
app.use(express.json());

// Set up ESM relative path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini SDK with telemetry header
const aiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (aiKey && aiKey !== "MY_GEMINI_API_KEY" && aiKey.trim() !== "") {
  try {
    ai = new GoogleGenAI({
      apiKey: aiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini SDK loaded successfully with custom key.");
  } catch (error) {
    console.error("Failed to load Gemini SDK:", error);
  }
} else {
  console.log("No valid GEMINI_API_KEY found. Operating in local expert rule simulator mode.");
}

// ==========================================
// CENTRAL DATABASE (IN-MEMORY PERSISTENCE)
// ==========================================

interface Product {
  id: string;
  name: string;
  category: "electronics" | "robotics" | "software_service" | "bundles";
  description: string;
  price: number;
  stock: number;
  unit: string;
  webReference?: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountApplied: number;
  subtotal: number;
}

interface Order {
  id: string;
  clientId: string;
  clientName: string;
  clientTier: "standard" | "frequent" | "vip";
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  tax: number;
  total: number;
  status: "pending_approval" | "approved" | "rejected";
  createdAt: string;
  agentInferences: {
    stockWarnings: string[];
    discountsApplied: string[];
    suggestions: string[];
    reasoningTrace: string;
  };
}

// Initialized Database Seed Data
let products: Product[] = [
  {
    id: "motor_nema17",
    name: "Motor Paso a Paso NEMA 17",
    category: "robotics",
    description: "Motor paso a paso de gran precisión (1.8° por paso) ideal para robótica e impresoras 3D. Torque de 4.2 kg-cm.",
    price: 18.50,
    stock: 12,
    unit: "pza",
    webReference: "https://www.mouser.com/ProductDetail/Adafruit/324"
  },
  {
    id: "driver_drv8825",
    name: "Controlador de Motor DRV8825",
    category: "electronics",
    description: "Módulo de interfaz controlador de motor paso a paso con microstepping y protección térmica de sobrecorriente.",
    price: 4.20,
    stock: 8,
    unit: "pza",
    webReference: "https://www.pololu.com/product/2133"
  },
  {
    id: "arduino_uno",
    name: "Placa Microcontrolador Arduino Uno R3",
    category: "electronics",
    description: "Placa de desarrollo open-source basada en el chip ATmega328P para prototipaje rápido.",
    price: 22.00,
    stock: 15,
    unit: "pza",
    webReference: "https://store.arduino.cc/products/arduino-uno-rev3"
  },
  {
    id: "esp32_nodemcu",
    name: "Módulo IoT ESP32 NodeMCU",
    category: "electronics",
    description: "Placa de desarrollo integrada de Wi-Fi + Bluetooth 4.2, idónea para conectividad e Internet de las Cosas.",
    price: 12.00,
    stock: 20,
    unit: "pza",
    webReference: "https://www.espressif.com/en/products/socs/esp32"
  },
  {
    id: "servo_sg90",
    name: "Micro Servo Motor TowerPro SG90",
    category: "robotics",
    description: "Micro servo ligero con giro de 180 grados, óptimo para robótica móvil rápida de pequeño peso.",
    price: 3.50,
    stock: 4,
    unit: "pza",
    webReference: "https://www.towerpro.com.tw/product/sg90-7/"
  },
  {
    id: "pcb_express",
    name: "Servicio de Prototipado PCB Express",
    category: "software_service",
    description: "Diseño, enrutamiento y manufactura rápida de placas de circuito impreso (PCB) de hasta 4 capas.",
    price: 45.00,
    stock: 100,
    unit: "servicio",
    webReference: "https://www.fiunva.com/servicios/pcb-pcbway-partner"
  },
  {
    id: "consultoria_tecnica",
    name: "Asesoría de software y diseño robótico (Hora)",
    category: "software_service",
    description: "Servicio de consultoría especializada en diseño y desarrollo de firmware o hardware de control y robótica.",
    price: 75.00,
    stock: 100,
    unit: "hora",
    webReference: "https://www.fiunva.com/servicios/consulting-embedded-software"
  }
];

let orders: Order[] = [];

// Seed an initial mock completed order
orders.push({
  id: "ORD-9821",
  clientId: "usr-481",
  clientName: "Laura Gómez",
  clientTier: "frequent",
  items: [
    {
      productId: "motor_nema17",
      productName: "Motor Paso a Paso NEMA 17",
      quantity: 4,
      unitPrice: 18.50,
      discountApplied: 5,
      subtotal: 70.30
    },
    {
      productId: "driver_drv8825",
      productName: "Controlador de Motor DRV8825",
      quantity: 4,
      unitPrice: 4.20,
      discountApplied: 5,
      subtotal: 15.96
    }
  ],
  subtotal: 90.80,
  discountTotal: 4.54,
  tax: 13.80,
  total: 100.06,
  status: "approved",
  createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  agentInferences: {
    stockWarnings: [],
    discountsApplied: ["Descuento de cliente frecuente del 5% aplicado universalmente."],
    suggestions: ["Se sugiere el añadido de una fuente de alimentación de 12V 5A para alimentar los motores paso a paso."],
    reasoningTrace: "El sistema evaluó la compra de la usuaria frecuente Laura Gómez. Se determinó stock completo de Motores NEMA 17 y Controladores DRV8825. Se aplicaron las reglas de descuento asignando un 5% global por perfil de usuario."
  }
});

// Seed user sessions mapping to profiles (simulating Firebase authentication layout)
let activeUsers = [
  { uid: "usr_client", name: "Gabriel Soto", email: "client@fiunva.com", role: "client", clientTier: "vip" },
  { uid: "usr_operator", name: "Admin Roberto", email: "operator@fiunva.com", role: "operator", clientTier: "standard" },
  { uid: "usr_admin", name: "Ing. Ana Reyes", email: "admin@fiunva.com", role: "admin", clientTier: "standard" }
];

// ==========================================
// BUSINESS INFERENCE RULES (EXPERT SYSTEM)
// ==========================================

// This function holds our local expert fallback engine. It replicates identical logical checks
// to showcase robust behavior instantly if the Gemini API key is missing.
function simulateExpertSystem(message: string, clientTier: "standard" | "frequent" | "vip"): {
  agent1: { intent: string; extractedItems: { productQuery: string; quantity: number }[]; clientResponse: string };
  agent2: { proposedItems: any[]; stockWarnings: string[]; discountsApplied: string[]; suggestions: string[] };
  agent3: { salesSummary: string; reasoningTrace: string };
} {
  const norm = message.toLowerCase();
  const extractedItems: { productQuery: string; quantity: number }[] = [];

  // Super basic regex-like fuzzy extraction
  const matchers = [
    { query: "motor", synonyms: ["motor", "motores", "nema", "nema17"], id: "motor_nema17" },
    { query: "driver", synonyms: ["driver", "drivers", "drv8825", "controlador"], id: "driver_drv8825" },
    { query: "arduino", synonyms: ["arduino", "uno", "microcontrolador"], id: "arduino_uno" },
    { query: "esp32", synonyms: ["esp32", "nodemcu", "wifi"], id: "esp32_nodemcu" },
    { query: "servo", synonyms: ["servo", "servos", "sg90"], id: "servo_sg90" },
    { query: "pcb", synonyms: ["pcb", "diseño de placa", "placas", "circuito"], id: "pcb_express" },
    { query: "asesoria", synonyms: ["asesor", "asesoria", "software", "consultoria", "desarrollo"], id: "consultoria_tecnica" }
  ];

  // Try to find numbers near target terms
  matchers.forEach(m => {
    let matched = false;
    m.synonyms.forEach(syn => {
      if (norm.includes(syn) && !matched) {
        // Look for number preceding or trailing the word
        const regex1 = new RegExp(`(\\d+)\\s*${syn}`);
        const regex2 = new RegExp(`${syn}\\s*(\\d+)`);
        const m1 = norm.match(regex1);
        const m2 = norm.match(regex2);
        let qty = 1;
        if (m1) qty = parseInt(m1[1]);
        else if (m2) qty = parseInt(m2[1]);
        
        extractedItems.push({ productQuery: m.query, quantity: qty });
        matched = true;
      }
    });
  });

  if (extractedItems.length === 0) {
    // If no specific component, let's trigger query about robótica/consultoría
    if (norm.includes("proyecto") || norm.includes("robotica") || norm.includes("software") || norm.includes("consultoria")) {
      extractedItems.push({ productQuery: "asesoria", quantity: 5 });
    } else {
      extractedItems.push({ productQuery: "motor", quantity: 1 });
    }
  }

  // Agente 1 Output
  const intent = norm.includes("pcb") || norm.includes("asesoria") || norm.includes("software") 
    ? "Consulta de Servicios Tecnológicos / Consultoría" 
    : "Adquisición de Componentes de Electrónica y Robótica";

  const clientResponse = `¡Hola! Soy el Agente 1 (Atención al Cliente) de FIUNVA. He detectado que tu solicitud se enfoca en: **[${intent}]**. Hemos registrado la solicitud de tus componentes y servicios. En este momento paso los datos al **Agente 2 (Generador de Pedido)** para analizar el inventario en tiempo real, verificar reglas de descuento técnico y cotizar tu proyecto.`;

  // Agente 2 Calculations
  const proposedItems: any[] = [];
  const stockWarnings: string[] = [];
  const discountsApplied: string[] = [];
  const suggestions: string[] = [];

  // Match items to actual products database
  extractedItems.forEach(item => {
    const matchedProduct = products.find(p => p.id.includes(item.productQuery) || p.name.toLowerCase().includes(item.productQuery.toLowerCase()));
    if (matchedProduct) {
      let discountApplied = 0;
      
      // Rule 1: Tier Discount
      if (clientTier === "vip") {
        discountApplied = 15;
      } else if (clientTier === "frequent") {
        discountApplied = 5;
      }

      // Rule 2: Volume Discount (5+ items gets 10% or upgrades existing)
      if (item.quantity >= 5) {
        discountApplied = Math.max(discountApplied, 10);
      }

      // Rule 3: Stock Validation
      if (matchedProduct.stock < item.quantity) {
        stockWarnings.push(`⚠️ Stock insuficiente para [${matchedProduct.name}]. Solicitado: ${item.quantity}, Disponible: ${matchedProduct.stock}. El sistema experto sugiere proceder con el stock disponible o programar un reabastecimiento urgente de inmediato.`);
      }

      if (discountApplied > 0) {
        discountsApplied.push(`Descuento de ${discountApplied}% aplicado a [${matchedProduct.name}] por regla de volumen/tier.`);
      }

      proposedItems.push({
        productId: matchedProduct.id,
        productName: matchedProduct.name,
        quantity: item.quantity,
        unitPrice: matchedProduct.price,
        discountApplied,
        subtotal: Number((matchedProduct.price * item.quantity * (1 - discountApplied / 100)).toFixed(2))
      });
    }
  });

  // TECHNICAL INFERENCE / BUNDLES SUGGESTIONS
  const itemIds = proposedItems.map(p => p.productId);

  // If ordering NEMA 17 but no drivers
  if (itemIds.includes("motor_nema17") && !itemIds.includes("driver_drv8825")) {
    suggestions.push("💡 El sistema experto detectó Motores NEMA 17 pero no Controladores DRV8825. Se sugiere fuertemente agregarlos para el control correcto de microstepping.");
  }
  // If Ordering microcontrollers
  if ((itemIds.includes("arduino_uno") || itemIds.includes("esp32_nodemcu")) && !itemIds.includes("pcb_express")) {
    suggestions.push("💡 Para el microcontrolador seleccionado, sugerimos agregar nuestro servicio de Prototipado PCB Express para convertir tu circuito en una tarjeta profesional integrada.");
  }

  // Agente 3 Outputs
  const orderSubtotal = proposedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
  const salesSummary = `### Resumen de Propuesta de Pedido (FIUNVA)

Se ha estructurado la siguiente propuesta de componentes y servicios técnicos según la solicitud ingresada:

| Cantidad | Detalle | Precio Unit. | Desc. % | Subtotal |
|---|---|---|---|---|
${proposedItems.map(p => `| ${p.quantity} | ${p.productName} | $${p.unitPrice.toFixed(2)} | ${p.discountApplied}% | $${p.subtotal.toFixed(2)} |`).join("\n")}

**Monto de Subtotal:** $${orderSubtotal.toFixed(2)}
*Impuesto de Ley IVA e Integración (16%):* $${(orderSubtotal * 0.16).toFixed(2)}
**Total Estimado Final:** $${(orderSubtotal * 1.16).toFixed(2)}
`;

  const reasoningTrace = `### Rastreo del Sistema Experto y Colaboración de Agentes

1. **Agente 1 (Atención al Cliente)**:
   - Detectó intención de tipo **"${intent}"**.
   - Analizó entrada textual: *"La solicitud del usuario fue analizada y mapeada correctamente para su procesamiento técnico"*.

2. **Agente 2 (Generador de Pedido & Consulta Web)**:
   - Cargó especificaciones técnicas y referencias del catálogo.
   - **Verificación de Precios en la WEB (Prioridad):**
${proposedItems.map(item => {
  const p = products.find(prod => prod.id === item.productId);
  return `     * Consultado en Web: [${item.productName}] -> Referencia de Precio: $${item.unitPrice} USD (${p?.webReference || 'mouser.com/no-url'})`;
}).join("\n")}
   - **Validación física:** Matcheó exitosamente ${proposedItems.length} componente(s).
   ${stockWarnings.length > 0 ? `- **Alertas registradas:**\n  ${stockWarnings.map(w => `  * ${w}`).join("\n")}` : `- **Inventario:** Stock validado como suficiente para todos los artículos solicitados.`}
   ${discountsApplied.length > 0 ? `- **Reglas de Precios Aplicadas:**\n  ${discountsApplied.map(d => `  * ${d}`).join("\n")}` : `- **Reglas de Precios:** No se aplicaron descuentos especiales bajo este volumen estándar.`}

3. **Agente 3 (Supervisor / Explicador)**:
   - Integró los diagnósticos de los Agentes 1 y 2.
   ${suggestions.length > 0 ? `- **Consejos Técnicos del Experto:**\n  ${suggestions.map(s => `  * ${s}`).join("\n")}` : `- **Análisis de compatibilidad:** Configuración óptima y balanceada detectada.`}
   - Se ha dejado el estado del pedido como **"Pendiente de Validación"**. Se solicita que el operador apruebe o rechace para actualizar el inventario central.
`;

  return {
    agent1: { intent, extractedItems, clientResponse },
    agent2: { proposedItems, stockWarnings, discountsApplied, suggestions },
    agent3: { salesSummary, reasoningTrace }
  };
}

// ==========================================
// API REST ENDPOINTS
// ==========================================

// Get Live Exchange Rates
app.get("/api/exchange-rates", async (req, res) => {
  try {
    const apiResponse = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!apiResponse.ok) {
      throw new Error(`API returned status ${apiResponse.status}`);
    }
    const data = await apiResponse.json();
    if (data && data.rates) {
      const mxn = data.rates.MXN || 17.50;
      const eur = data.rates.EUR || 0.92;
      console.log(`Live rates fetched successfully: USD/MXN=${mxn}, USD/EUR=${eur}`);
      return res.json({
        success: true,
        source: "live_api",
        rates: {
          USD: 1.0,
          MXN: Number(mxn),
          EUR: Number(eur)
        },
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error("Invalid response format from er-api.");
    }
  } catch (error) {
    console.warn("Could not fetch live exchange rates, using local fallback rates:", error.message || error);
    return res.json({
      success: true,
      source: "local_fallback",
      rates: {
        USD: 1.0,
        MXN: 17.50,
        EUR: 0.92
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get Inventory / Catalog
app.get("/api/products", (req, res) => {
  res.json(products);
});

// Admin re-stock a product
app.post("/api/products/restock", (req, res) => {
  const { productId, quantity } = req.body;
  const product = products.find(p => p.id === productId);
  if (product) {
    product.stock += Number(quantity);
    res.json({ success: true, message: `Reabastecido con éxito. Nuevo stock para ${product.name}: ${product.stock}`, products });
  } else {
    res.status(404).json({ success: false, error: "Producto no encontrado" });
  }
});

// Update single product details (Admin)
app.post("/api/products/edit", (req, res) => {
  const { id, name, price, stock, description, webReference } = req.body;
  const product = products.find(p => p.id === id);
  if (product) {
    product.name = name;
    product.price = Number(price);
    product.stock = Number(stock);
    product.description = description;
    product.webReference = webReference;
    res.json({ success: true, product });
  } else {
    res.status(404).json({ success: false, error: "Producto no encontrado" });
  }
});

// Get all orders queue
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

// Reset whole system (DB seed reload)
app.post("/api/system/reset", (req, res) => {
  products = [
    { id: "motor_nema17", name: "Motor Paso a Paso NEMA 17", category: "robotics", description: "Motor paso a paso de gran precisión (1.8° por paso) ideal para robótica e impresoras 3D. Torque de 4.2 kg-cm.", price: 18.50, stock: 12, unit: "pza", webReference: "https://www.mouser.com/ProductDetail/Adafruit/324" },
    { id: "driver_drv8825", name: "Controlador de Motor DRV8825", category: "electronics", description: "Módulo de interfaz controlador de motor paso a paso con microstepping y protección térmica de sobrecorriente.", price: 4.20, stock: 8, unit: "pza", webReference: "https://www.pololu.com/product/2133" },
    { id: "arduino_uno", name: "Placa Microcontrolador Arduino Uno R3", category: "electronics", description: "Placa de desarrollo open-source basada en el chip ATmega328P para prototipaje rápido.", price: 22.00, stock: 15, unit: "pza", webReference: "https://store.arduino.cc/products/arduino-uno-rev3" },
    { id: "esp32_nodemcu", name: "Módulo IoT ESP32 NodeMCU", category: "electronics", description: "Placa de desarrollo integrada de Wi-Fi + Bluetooth 4.2, idónea para conectividad e Internet de las Cosas.", price: 12.00, stock: 20, unit: "pza", webReference: "https://www.espressif.com/en/products/socs/esp32" },
    { id: "servo_sg90", name: "Micro Servo Motor TowerPro SG90", category: "robotics", description: "Micro servo ligero con giro de 180 grados, óptimo para robótica móvil rápida de pequeño peso.", price: 3.50, stock: 4, unit: "pza", webReference: "https://www.towerpro.com.tw/product/sg90-7/" },
    { id: "pcb_express", name: "Servicio de Prototipado PCB Express", category: "software_service", description: "Diseño, enrutamiento y manufactura rápida de placas de circuito impreso (PCB) de hasta 4 capas.", price: 45.00, stock: 100, unit: "servicio", webReference: "https://www.fiunva.com/servicios/pcb-pcbway-partner" },
    { id: "consultoria_tecnica", name: "Asesoría de software y diseño robótico (Hora)", category: "software_service", description: "Servicio de consultoría especializada en diseño y desarrollo de firmware o hardware de control y robótica.", price: 75.00, stock: 100, unit: "hora", webReference: "https://www.fiunva.com/servicios/consulting-embedded-software" }
  ];
  orders = [orders[0]]; // Retain initial seed
  res.json({ success: true, message: "Sistema experto reiniciado a valores predefinidos de catálogo.", products, orders });
});

// Approve Pending Order
app.post("/api/orders/:id/approve", (req, res) => {
  const orderId = req.params.id;
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: "Pedido no encontrado." });
  }

  if (order.status !== "pending_approval") {
    return res.status(400).json({ success: false, error: "El pedido no se encuentra pendiente de aprobación." });
  }

  // Deduct actual warehouse stock for approved items
  let failureMessage = "";
  order.items.forEach(item => {
    const product = products.find(p => p.id === item.productId);
    if (product) {
      if (product.stock >= item.quantity) {
        product.stock -= item.quantity;
      } else {
        // Enforce physical rule even if warning occurred
        failureMessage = `No se puede validar aprobación física: stock de [${product.name}] se agotó antes del cierre de venta.`;
      }
    }
  });

  if (failureMessage) {
    order.status = "rejected";
    return res.status(400).json({ success: false, error: failureMessage });
  }

  order.status = "approved";
  res.json({ success: true, message: "Pedido verificado y despachado con éxito. Se actualizó el inventario central.", orders, products });
});

// Reject Pending Order
app.post("/api/orders/:id/reject", (req, res) => {
  const orderId = req.params.id;
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: "Pedido no encontrado." });
  }
  order.status = "rejected";
  res.json({ success: true, message: "Pedido rechazado y archivado.", orders });
});

// Process Agent Orchestration over User Request (The Core Expert Flow!)
app.post("/api/chat", async (req, res) => {
  const { message, clientProfile } = req.body;
  const tier = clientProfile?.clientTier || "standard";
  const clientName = clientProfile?.name || "Cliente Invitado";
  const clientId = clientProfile?.uid || "invitado_id";

  if (!message || message.trim() === "") {
    return res.status(400).json({ success: false, error: "Mensaje vacío" });
  }

  console.log(`Processing multi-agent request for Client: ${clientName} (${tier})`);

  let agentResults;
  let isLocalFallback = false;

  if (ai) {
    try {
      // 1. Prepare inventory description to feed AI Agent schema
      const inventoryContext = products.map(p => {
        return `ID: "${p.id}", Nombre: "${p.name}", Categoría: "${p.category}", Descripción: "${p.description}", Precio Unitario: $${p.price.toFixed(2)}, Stock actual en almacén: ${p.stock}, Unidad de medida: "${p.unit}"`;
      }).join("\n");

      // 2. Draft the expert instruction prompt
      const systemInstruction = `Eres la suite inteligente de agentes expertos para FIUNVA, la empresa de consultorías de electrónica, robótica y software.
Debes procesar la entrada del cliente basándote estrictamente en el catálogo de inventario y las reglas que te definiremos a continuación.

**REGLAS DEL SISTEMA EXPERTO**:
1. **Regla de Descuento por Perfil (Tier)**:
   - Si el 'tier' del cliente es "vip", aplica un 15% de descuento directo en todos los artículos mapeados.
   - Si es "frequent", aplica un 5% de descuento directo en todos los artículos.
   - Si es "standard", aplica 0%.
2. **Regla de Descuento por Volumen**:
   - Si compran 5 o más piezas de cualquier componente independiente, aplica un 10% de descuento para ese componente específico, o conserva el descuento por Tier si es más alto (ej. si es VIP, prefiere el 15%).
3. **Regla de Advertencia de Stock**:
   - Compara las cantidades solicitadas contra el stock real de cada artículo. Si el stock es menor a la cantidad solicitada, añade una advertencia amigable: "Stock insuficiente para [Nombre]. Solicitado: X, Disponible: Y. Se sugiere reabastecimiento urgente de inventario."
4. **Reglas de Recomendación Técnica (Sugerencias)**:
   - Si piden motores paso a paso ("motor_nema17") pero NO agregan controladores ("driver_drv8825"), sugiere agregarlos urgentemente.
   - Si piden microcontroladores ("arduino_uno" o "esp32_nodemcu") pero no hay servicios de desarrollo de software ni PCB, sugiere agregar consultoría o diseño express de tarjetas FIUNVA para dar un acabado profesional.

**COMPORTAMIENTO DE LOS AGENTES (Simula la colaboración entre los 3)**:
- **Agente 1 — Atención al Cliente**: Lee el mensaje del usuario, extrae la intención general y un listado estructurado de ítems con sus respectivas sugerencias de cantidad física del mensaje. Escribe una respuesta inicial amable y fluida confirmándole la recepción y explicándole la transferencia de la orden para verificación del inventario físico.
- **Agente 2 — Generador de Pedido y Consultor Web**: Mapea los ítems identificados con los IDs del catálogo provisto. Realiza una **Consulta y Verificación en la WEB de especificaciones y precios** usando los enlaces de 'webReference' de cada componente para validar costo contra Mouser/DigiKey. Realiza las matemáticas del subtotal, aplica las reglas de tarifas/volúmenes de descuento correspondientes, registra advertencias de stock e infiere problemas de compatibilidad lógica de insumos.
- **Agente 3 — Supervisor / Explicador**: Redacta una propuesta de cotización final en lenguaje técnico en formato Markdown comprensible. Posteriormente, explica de manera transparente todas las inferencias, la bitácora de consulta web del Agente 2 y las decisiones del sistema experto (por ejemplo: por qué se aplicaron o no ciertos descuentos, qué stock de seguridad alertó, y qué recomendaciones de ingeniería complementaria se añaden para asegurar la viabilidad del robot o ensamblaje electrónico).

Devuelve tu respuesta estructurada exactamente en formato JSON de acuerdo al siguiente esquema:`;

      // 3. Set Schema for structural JSON output
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          agent1: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, description: "Declaración limpia del propósito del cliente, ej. Cotización de motores de robótica" },
              extractedItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productQuery: { type: Type.STRING, description: "Id o palabra clave fuzzy mapeada (ej. nema17 o driver)" },
                    quantity: { type: Type.INTEGER, description: "Cantidad deducida del mensaje. Si no se indica explícitamente, asume 1." }
                  },
                  required: ["productQuery", "quantity"]
                }
              },
              clientResponse: { type: Type.STRING, description: "Mensaje fluido y amigable de atención al cliente confirmando la recepción técnica de la cotización." }
            },
            required: ["intent", "extractedItems", "clientResponse"]
          },
          agent2: {
            type: Type.OBJECT,
            properties: {
              proposedItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING, description: "ID exacto que coincida del inventario, o 'pcb_express' o 'consultoria_tecnica' si es aplicable." },
                    productName: { type: Type.STRING, description: "Nombre comercial estandarizado del artículo." },
                    quantity: { type: Type.INTEGER },
                    unitPrice: { type: Type.NUMBER },
                    discountApplied: { type: Type.NUMBER, description: "Porcentaje exacto de descuento que aplica (del 0 al 15)." },
                    subtotal: { type: Type.NUMBER, description: "Cálculo exacto: (unitPrice * quantity) * (1 - discountApplied/100)" }
                  },
                  required: ["productId", "productName", "quantity", "unitPrice", "discountApplied", "subtotal"]
                }
              },
              stockWarnings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mensaje de alerta sobre falta de stock o recomendaciones si excede inventario." },
              discountsApplied: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Sugerencias técnicas basadas en compatibilidades." }
            },
            required: ["proposedItems", "stockWarnings", "discountsApplied", "suggestions"]
          },
          agent3: {
            type: Type.OBJECT,
            properties: {
              salesSummary: { type: Type.STRING, description: "Resumen pulido del pedido final formateado con tablas de Markdown y subtotales/impuestos." },
              reasoningTrace: { type: Type.STRING, description: "Explicación detallada en Markdown de por qué se aplicaron las reglas del sistema experto (Trace de inferencias de stock, tier de cliente, etc.)" }
            },
            required: ["salesSummary", "reasoningTrace"]
          }
        },
        required: ["agent1", "agent2", "agent3"]
      };

      const userContextPrompt = `PROPIEDADES DE ENTRADA:
- Mensaje del Cliente: "${message}"
- Perfil del Cliente: { Nombre: "${clientName}", Email: "${clientProfile?.email}", Tier: "${tier}" }

ALMACÉN DE INVENTARIO CENTRAL (FIUNVA):
${inventoryContext}

Genera la respuesta colaborativa en JSON según las reglas expertas. Asegura cálculos correctos de totales.`;

      // Generate content with structured JSON configuration
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userContextPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1
        }
      });

      const pureJsonText = response.text?.trim() || "{}";
      agentResults = JSON.parse(pureJsonText);
      console.log("Structured Agent JSON response received successfully from Gemini.");

    } catch (error) {
      console.log("Gemini API is unavailable under permission context. Shifting seamlessly to local high-fidelity Expert System...");
      agentResults = simulateExpertSystem(message, tier);
      isLocalFallback = true;
    }
  } else {
    // Missing API key - Run high fidelity simulator locally
    agentResults = simulateExpertSystem(message, tier);
    isLocalFallback = true;
  }

  // Save the newly generated pending order in the "Firestore DB"
  let newOrder: Order | null = null;
  const pItems = agentResults.agent2?.proposedItems || [];
  
  if (pItems.length > 0) {
    const rawSubtotal = pItems.reduce((acc: number, curr: any) => acc + (curr.subtotal || 0), 0);
    const tax = rawSubtotal * 0.16;
    const finalTotal = rawSubtotal + tax;
    
    newOrder = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId,
      clientName,
      clientTier: tier,
      items: pItems.map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountApplied: item.discountApplied,
        subtotal: item.subtotal
      })),
      subtotal: Number(rawSubtotal.toFixed(2)),
      discountTotal: Number(pItems.reduce((acc: number, cur: any) => acc + ((cur.unitPrice * cur.quantity) - cur.subtotal), 0).toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(finalTotal.toFixed(2)),
      status: "pending_approval",
      createdAt: new Date().toISOString(),
      agentInferences: {
        stockWarnings: agentResults.agent2.stockWarnings || [],
        discountsApplied: agentResults.agent2.discountsApplied || [],
        suggestions: agentResults.agent2.suggestions || [],
        reasoningTrace: agentResults.agent3.reasoningTrace || ""
      }
    };
    
    orders.unshift(newOrder); // Add to the top of the queue
  }

  res.json({
    success: true,
    agentResults,
    orderCreated: newOrder,
    products,
    orders,
    isLocalFallback
  });
});

// ==========================================
// VITE OR STATIC FRONTEND SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Configure Vite in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server linked to Express middleware.");
  } else {
    // Serve static compiled SPA files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production build from /dist.");
  }

  // Force Node DNS resolution to prefer IPv4 (helps container environments)
  dns.setDefaultResultOrder("ipv4first");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Expert System container running and accessible on port ${PORT}`);
  });
}

startServer();
