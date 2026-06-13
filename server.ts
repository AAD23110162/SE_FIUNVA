import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dns from "dns";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";

dotenv.config();

// Standard port setup
const PORT = 3000;
const app = express();
app.use(express.json());

// Set up ESM/CJS relative path helpers safely
let resolvedFilename = "";
try {
  if (typeof import.meta !== "undefined" && import.meta.url) {
    resolvedFilename = fileURLToPath(import.meta.url);
  } else if (typeof __filename !== "undefined") {
    resolvedFilename = __filename;
  }
} catch (e) {
  if (typeof __filename !== "undefined") {
    resolvedFilename = __filename;
  }
}
const resolvedDirname = resolvedFilename ? path.dirname(resolvedFilename) : (typeof __dirname !== "undefined" ? __dirname : process.cwd());

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
  webReferences?: string[];
  originalPrice?: number;
  originalCurrency?: "USD" | "MXN" | "EUR";
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
  notes?: string;
  agentInferences: {
    stockWarnings: string[];
    discountsApplied: string[];
    suggestions: string[];
    reasoningTrace: string;
  };
}

interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  updatedAt: string;
}

const DEFAULT_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: "kn_fiunva",
    question: "¿Qué es FIUNVA?",
    answer: `FIUNVA es una consultoría tecnológica especializada en electrónica, software, robótica y desarrollo de soluciones de ingeniería. Nuestra misión es convertir ideas en proyectos reales, acompañando a nuestros clientes desde la conceptualización hasta el diseño, desarrollo, validación e implementación de sus soluciones.

Trabajamos tanto con personas sin experiencia técnica como con estudiantes, emprendedores, investigadores, profesionales, equipos de desarrollo, instituciones y organizaciones que buscan llevar sus proyectos al siguiente nivel. Nuestro enfoque permite que cualquier persona pueda materializar una idea tecnológica, independientemente de sus conocimientos previos.

A diferencia de las consultorías tradicionales, que suelen enfocarse exclusivamente en grandes empresas o corporativos tecnológicos, en FIUNVA creemos que la innovación debe estar al alcance de todos. Por ello, ofrecemos acompañamiento técnico especializado para proyectos de cualquier escala, desde iniciativas académicas y prototipos de investigación hasta desarrollos profesionales y soluciones para la industria.

Nuestro compromiso es brindar asesoría experta, soluciones innovadoras y un acompañamiento cercano, combinando ingeniería, precisión e innovación para transformar desafíos tecnológicos en resultados tangibles.`,
    category: "general",
    updatedAt: "2026-06-12T13:36:53-07:00"
  }
];

// Initialized Database Seed Data
let products: Product[] = [];

let orders: Order[] = [];

let knowledgeBase: KnowledgeEntry[] = [];

// Seed user sessions mapping to profiles (simulating Firebase authentication layout)
const CLIENTS_FILE = path.join(process.cwd(), "server_clients.json");
const STAFF_FILE = path.join(process.cwd(), "server_staff.json");

const DEFAULT_CLIENTS: any[] = []; // Currently no registered clients, as requested
const DEFAULT_STAFF = [
  { 
    uid: "usr_admin", 
    name: "Administrador Principal", 
    email: "a23110162@ceti.mx", 
    role: "admin", 
    clientTier: "standard" 
  }
]; // Currently no operator, only the principal administrator as requested

let activeClients: any[] = [];
let activeStaff: any[] = [...DEFAULT_STAFF];

function loadUsersFromFiles() {
  try {
    if (!fs.existsSync(CLIENTS_FILE)) {
      fs.writeFileSync(CLIENTS_FILE, JSON.stringify(DEFAULT_CLIENTS, null, 2));
      activeClients = [...DEFAULT_CLIENTS];
    } else {
      activeClients = JSON.parse(fs.readFileSync(CLIENTS_FILE, "utf-8"));
    }

    if (!fs.existsSync(STAFF_FILE)) {
      fs.writeFileSync(STAFF_FILE, JSON.stringify(DEFAULT_STAFF, null, 2));
      activeStaff = [...DEFAULT_STAFF];
    } else {
      activeStaff = JSON.parse(fs.readFileSync(STAFF_FILE, "utf-8"));
    }
    console.log(`Successfully loaded ${activeClients.length} clients and ${activeStaff.length} staff from segregated files.`);
  } catch (err) {
    console.error("Error loading segregated users/clients from disk files:", err);
    activeClients = [];
    activeStaff = [...DEFAULT_STAFF];
  }
}

function saveUsersToFiles() {
  try {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(activeClients, null, 2));
    fs.writeFileSync(STAFF_FILE, JSON.stringify(activeStaff, null, 2));
    console.log(`Saved segregated databases: ${CLIENTS_FILE} (${activeClients.length} clients) and ${STAFF_FILE} (${activeStaff.length} staff).`);
  } catch (err) {
    console.error("Error saving segregated users/clients files to disk:", err);
  }
}

// ==========================================
// FIRESTORE DATABASE BACKEND INTEGRATION
// ==========================================

let db: any = null;
let firestoreEnabled = false;

// Default initial catalog seed data
const DEFAULT_PRODUCTS: Product[] = [
  { id: "motor_nema17", name: "Motor Paso a Paso NEMA 17", category: "robotics", description: "Motor paso a paso de gran precisión (1.8° por paso) ideal para robótica e impresoras 3D. Torque de 4.2 kg-cm.", price: 18.50, stock: 12, unit: "pza", webReference: "https://www.mouser.com/ProductDetail/Adafruit/324" },
  { id: "driver_drv8825", name: "Controlador de Motor DRV8825", category: "electronics", description: "Módulo de interfaz controlador de motor paso a paso con microstepping y protección térmica de sobrecorriente.", price: 4.20, stock: 8, unit: "pza", webReference: "https://www.pololu.com/product/2133" },
  { id: "arduino_uno", name: "Placa Microcontrolador Arduino Uno R3", category: "electronics", description: "Placa de desarrollo open-source basada en el chip ATmega328P para prototipaje rápido.", price: 22.00, stock: 15, unit: "pza", webReference: "https://store.arduino.cc/products/arduino-uno-rev3" },
  { id: "esp32_nodemcu", name: "Módulo IoT ESP32 NodeMCU", category: "electronics", description: "Placa de desarrollo integrada de Wi-Fi + Bluetooth 4.2, idónea para conectividad e Internet de las Cosas.", price: 12.00, stock: 20, unit: "pza", webReference: "https://www.espressif.com/en/products/socs/esp32" },
  { id: "servo_sg90", name: "Micro Servo Motor TowerPro SG90", category: "robotics", description: "Micro servo ligero con giro de 180 grados, óptimo para robótica móvil rápida de pequeño peso.", price: 3.50, stock: 4, unit: "pza", webReference: "https://www.towerpro.com.tw/product/sg90-7/" },
  { id: "pcb_express", name: "Servicio de Prototipado PCB Express", category: "software_service", description: "Diseño, enrutamiento y manufactura rápida de placas de circuito impreso (PCB) de hasta 4 capas.", price: 45.00, stock: 100, unit: "servicio", webReference: "https://www.fiunva.com/servicios/pcb-pcbway-partner" },
  { id: "consultoria_tecnica", name: "Desarrollo Integral de Software y Firmware", category: "software_service", description: "Desarrollo de firmware embebido, integraciones y plataforma web/móvil por todo el trabajo del proyecto (tarifa fija, no por hora).", price: 750.00, stock: 100, unit: "proyecto", webReference: "https://www.fiunva.com/servicios/consulting-embedded-software" }
];

const DEFAULT_ORDERS: Order[] = [];

async function initializeFirestore() {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const firebaseApp = initializeApp(config);
      db = getFirestore(firebaseApp, config.firestoreDatabaseId);
      firestoreEnabled = true;
      console.log("Firestore successfully connected on the server-side.");

      // Sync/seed products collection if empty
      const prodColRef = collection(db, "products");
      const prodSnapshot = await getDocs(prodColRef);
      if (prodSnapshot.empty) {
        console.log("Firestore products collection is empty. Seeding catalog items...");
        for (const item of DEFAULT_PRODUCTS) {
          await setDoc(doc(db, "products", item.id), sanitizeForFirestore(item));
        }
        console.log("Catalog seeding completed successfully.");
      }

      // Sync/seed orders collection if empty
      const orderColRef = collection(db, "orders");
      const orderSnapshot = await getDocs(orderColRef);
      if (orderSnapshot.empty) {
        console.log("Firestore orders collection is empty. Seeding mock orders history...");
        for (const ord of DEFAULT_ORDERS) {
          await setDoc(doc(db, "orders", ord.id), sanitizeForFirestore(ord));
        }
        console.log("Orders seeding completed successfully.");
      }

      // Sync/seed users collection if empty
      const userColRef = collection(db, "users");
      const userSnapshot = await getDocs(userColRef);
      if (userSnapshot.empty) {
        console.log("Firestore users collection is empty. Seeding simulated user/client profiles...");
        for (const usr of [...DEFAULT_CLIENTS, ...DEFAULT_STAFF]) {
          await setDoc(doc(db, "users", usr.uid), sanitizeForFirestore(usr));
        }
        console.log("Users seeding completed successfully.");
      }

      // Sync/seed knowledge_base collection and ensure defaults are clean
      const kbColRef = collection(db, "knowledge_base");
      console.log("Ensuring clean knowledge base defaults in Firestore...");
      for (const item of DEFAULT_KNOWLEDGE_BASE) {
        await setDoc(doc(db, "knowledge_base", item.id), sanitizeForFirestore(item));
      }
      console.log("Knowledge Base defaults synchronized successfully.");

      // Load items from Firestore to memory
      await pullFromFirestore();
    } else {
      console.warn("firebase-applet-config.json not found. Operating with temporary in-memory database fallback.");
      knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
    }
  } catch (err) {
    console.error("Failed to initialize or seed Firestore:", err);
    console.warn("Operating with in-memory database fallback.");
  }
}

async function pullFromFirestore() {
  if (!db || !firestoreEnabled) return;
  try {
    console.log("Syncing database tables in memory from Firestore collections...");
    
    // Pull products
    const prodColRef = collection(db, "products");
    const prodSnapshot = await getDocs(prodColRef);
    const loadedProducts: Product[] = [];
    prodSnapshot.forEach(docSnap => {
      const data = docSnap.data() as Product;
      loadedProducts.push({
        ...data,
        webReferences: data.webReferences || (data.webReference ? [data.webReference] : []),
        originalPrice: data.originalPrice !== undefined ? data.originalPrice : data.price,
        originalCurrency: data.originalCurrency || "USD"
      });
    });
    // Update in-memory database reference if loaded anything
    if (loadedProducts.length > 0) {
      products = loadedProducts;
    }

    // Pull orders
    const orderColRef = collection(db, "orders");
    const orderSnapshot = await getDocs(orderColRef);
    const loadedOrders: Order[] = [];
    orderSnapshot.forEach(docSnap => {
      loadedOrders.push(docSnap.data() as Order);
    });
    // Sort orders by createdAt descending
    loadedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    orders = loadedOrders;

    // Pull users
    const userColRef = collection(db, "users");
    const userSnapshot = await getDocs(userColRef);
    const loadedUsers: any[] = [];
    userSnapshot.forEach(docSnap => {
      loadedUsers.push(docSnap.data());
    });
    if (loadedUsers.length > 0) {
      activeClients = loadedUsers.filter(u => u.role === "client");
      activeStaff = loadedUsers.filter(u => u.role === "operator" || u.role === "admin");
      
      // Safety: always ensure the main owner email exists as staff
      if (!activeStaff.some(u => u.email === "a23110162@ceti.mx")) {
        activeStaff.push(DEFAULT_STAFF[0]);
      }
      
      saveUsersToFiles();
    }

    // Pull knowledge_base
    const kbColRef = collection(db, "knowledge_base");
    const kbSnapshot = await getDocs(kbColRef);
    const loadedKb: KnowledgeEntry[] = [];
    kbSnapshot.forEach(docSnap => {
      loadedKb.push(docSnap.data() as KnowledgeEntry);
    });
    if (loadedKb.length > 0) {
      knowledgeBase = loadedKb;
    } else {
      knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
    }

    console.log(`Successfully loaded ${products.length} products, ${orders.length} orders, ${activeClients.length} clients, ${activeStaff.length} staff, and ${knowledgeBase.length} knowledge base entries from Firestore.`);
  } catch (err) {
    console.error("Error pulling data from Firestore:", err);
  }
}

// Push/save helpers
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as any;
  }
  if (typeof obj === "object") {
    const clean: any = {};
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  }
  return obj;
}

async function saveProductToFirestore(product: Product) {
  if (!db || !firestoreEnabled) return;
  try {
    const sanitizedProduct = sanitizeForFirestore(product);
    await setDoc(doc(db, "products", product.id), sanitizedProduct);
    console.log(`Saved product [${product.id}] successfully to Firestore.`);
  } catch (err) {
    console.error(`Error saving product [${product.id}] to Firestore:`, err);
  }
}

async function deleteProductFromFirestore(productId: string) {
  if (!db || !firestoreEnabled) return;
  try {
    await deleteDoc(doc(db, "products", productId));
    console.log(`Deleted product [${productId}] successfully from Firestore.`);
  } catch (err) {
    console.error(`Error deleting product [${productId}] from Firestore:`, err);
  }
}

async function saveOrderToFirestore(order: Order) {
  if (!db || !firestoreEnabled) return;
  try {
    const sanitizedOrder = sanitizeForFirestore(order);
    await setDoc(doc(db, "orders", order.id), sanitizedOrder);
    console.log(`Saved order [${order.id}] successfully to Firestore.`);
  } catch (err) {
    console.error(`Error saving order [${order.id}] to Firestore:`, err);
  }
}

async function deleteOrderFromFirestore(orderId: string) {
  if (!db || !firestoreEnabled) return;
  try {
    await deleteDoc(doc(db, "orders", orderId));
    console.log(`Deleted order [${orderId}] successfully from Firestore.`);
  } catch (err) {
    console.error(`Error deleting order [${orderId}] from Firestore:`, err);
  }
}

async function saveUserToFirestore(user: any) {
  if (!db || !firestoreEnabled) return;
  try {
    const sanitizedUser = sanitizeForFirestore(user);
    await setDoc(doc(db, "users", user.uid), sanitizedUser);
    console.log(`Saved user [${user.uid}] successfully to Firestore.`);
  } catch (err) {
    console.error(`Error saving user [${user.uid}] to Firestore:`, err);
  }
}

async function deleteUserFromFirestore(userId: string) {
  if (!db || !firestoreEnabled) return;
  try {
    await deleteDoc(doc(db, "users", userId));
    console.log(`Deleted user [${userId}] successfully from Firestore.`);
  } catch (err) {
    console.error(`Error deleting user [${userId}] from Firestore:`, err);
  }
}

// ==========================================
// BUSINESS INFERENCE RULES (EXPERT SYSTEM)
// ===============// This function holds our local expert fallback engine. It replicates identical logical checks
// to showcase robust behavior instantly if the Gemini API key is missing.
function simulateExpertSystem(
  message: string, 
  clientTier: "standard" | "frequent" | "vip",
  currency: string = "MXN",
  rates: Record<string, number> = { USD: 1.0, MXN: 17.50, EUR: 0.92 },
  history: any[] = []
): {
  agent1: { intent: string; extractedItems: { productQuery: string; quantity: number }[]; clientResponse: string };
  agent2: { proposedItems: any[]; stockWarnings: string[]; discountsApplied: string[]; suggestions: string[] };
  agent3: { salesSummary: string; reasoningTrace: string };
} {
  const norm = message.toLowerCase().trim();
  const lastAgentMsg = history && history.length > 0
    ? [...history].reverse().find(m => m.sender === "agent")?.text || ""
    : "";

  const clientMessagesInHistory = history
    ? history.filter((m: any) => m.sender === "client").map((m: any) => m.text.toLowerCase())
    : [];
  const allUserText = [message.toLowerCase(), ...clientMessagesInHistory].join(" ");

  const hasElectronicaInfo = allUserText.includes("volt") || allUserText.includes(" v ") || allUserText.includes("5v") || allUserText.includes("12v") || allUserText.includes("arduino") || allUserText.includes("esp32") || allUserText.includes("stm32") || allUserText.includes("wifi") || allUserText.includes("bluetooth") || allUserText.includes("lora") || allUserText.includes("microcontrolador") || allUserText.includes("comunicac") || allUserText.includes("chip") || allUserText.includes("alimentac");

  const hasSoftwareInfo = allUserText.includes("app") || allUserText.includes("móvil") || allUserText.includes("movil") || allUserText.includes("web") || allUserText.includes("plataforma") || allUserText.includes("escritorio") || allUserText.includes("pantalla") || allUserText.includes("interfaz") || allUserText.includes("base de datos") || allUserText.includes("lenguaje") || allUserText.includes("python") || allUserText.includes("javascript") || allUserText.includes("react") || allUserText.includes("c++") || allUserText.includes("sql") || allUserText.includes("firebase") || allUserText.includes("postgresql") || allUserText.includes("visualiz");

  const hasRoboticaInfo = allUserText.includes("motor") || allUserText.includes("servomotor") || allUserText.includes("paso a paso") || allUserText.includes("nema") || allUserText.includes("actuador") || allUserText.includes("peso") || allUserText.includes("tamaño") || allUserText.includes("dimension") || allUserText.includes("cm") || allUserText.includes("kg") || allUserText.includes("gramo") || allUserText.includes("torque") || allUserText.includes("mecánic") || allUserText.includes("mecanic") || allUserText.includes("físic") || allUserText.includes("fisic") || allUserText.includes("carcasa") || allUserText.includes("estructura");

  const qElectronica = `* 🎛️ **Electrónica:** ¿Qué voltaje de alimentación tienes pensado emplear? ¿Tienes preferencia por algún microcontrolador (Arduino, ESP32, STM32) y qué tipo de comunicación requieres (WiFi, Bluetooth, LoRa)?`;
  const qSoftware = `* 💻 **Software:** ¿Dónde se visualizará el sistema (App móvil, plataforma web, software de escritorio)? ¿Tienes preferencia por algún lenguaje de programación o base de datos?`;
  const qRobotica = `* 🤖 **Robótica/Mecánica (Si aplica):** ¿Qué tipo de actuadores o motores necesitas? ¿Hay restricciones de tamaño o peso?`;

  const getNextB2Question = () => {
    if (!hasElectronicaInfo) {
      return {
        text: qElectronica,
        intent: "Rama B.2: Preguntas de Electrónica"
      };
    }
    if (!hasSoftwareInfo) {
      return {
        text: qSoftware,
        intent: "Rama B.2: Preguntas de Software"
      };
    }
    if (!hasRoboticaInfo) {
      return {
        text: qRobotica,
        intent: "Rama B.2: Preguntas de Robótica y Mecánica"
      };
    }
    return null;
  };

  const getSkipReport = () => {
    let lines: string[] = [];
    if (hasElectronicaInfo) lines.push("• *Electrónica* (detectado o respondido)");
    if (hasSoftwareInfo) lines.push("• *Software* (detectado o respondido)");
    if (hasRoboticaInfo) lines.push("• *Robótica/Mecánica* (detectado o respondido)");
    if (lines.length > 0) {
      return `\n*(Registrado automáticamente para optimizar tiempo:)*\n${lines.join("\n")}\n`;
    }
    return "";
  };

  let intent = "Inicio y Detección de Intención";
  let clientResponse = "";
  let proposedItems: any[] = [];
  let stockWarnings: string[] = [];
  let discountsApplied: string[] = [];
  let suggestions: string[] = [];
  let salesSummary = "";
  let reasoningTrace = "";

  // 1. Scan history to find the most recently mentioned product/service to resolve pronoun references
  let lastReferredProductFromHistory: any = null;
  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const msgText = history[i].text.toLowerCase();
      // Try to match a product mentioned by name/id in this past message
      const match = products.find(p => {
        const nameNorm = p.name.toLowerCase().trim();
        const idNorm = p.id.toLowerCase().trim();
        if (nameNorm.length < 4) return false;
        return msgText.includes(nameNorm) || msgText.includes(idNorm);
      });
      if (match) {
        lastReferredProductFromHistory = match;
        break;
      }
    }
  }

  // Check if current user message refers back to the previously mentioned product/service
  const isReferringBack = !!lastReferredProductFromHistory && (
    norm.includes("dicho") ||
    norm.includes("este") ||
    norm.includes("ese") ||
    norm.includes("esa") ||
    norm.includes("él") ||
    norm.includes("ella") ||
    norm.includes("referido") ||
    norm.includes("anterior") ||
    norm.includes("recomienda") ||
    norm.includes("proyectos recomiendas") ||
    norm.includes("consiste") ||
    norm.includes("para qué") ||
    norm.includes("para que") ||
    norm.includes("sirve") ||
    norm.includes("de qué") ||
    norm.includes("de que") ||
    norm.includes("cuánto cuesta") ||
    norm.includes("cuanto cuesta") ||
    norm.includes("el de") ||
    norm.includes("la de") ||
    norm.includes("opción") ||
    norm.includes("opcion") ||
    (norm.length < 65 && (norm.includes("recomienda") || norm.includes("para qué") || norm.includes("por qué") || norm.includes("cómo") || norm.includes("cuándo") || norm.includes("donde")))
  );

  let foundProduct = products.find(p => {
    const nameNorm = p.name.toLowerCase().trim();
    const idNorm = p.id.toLowerCase().trim();
    if (nameNorm.length < 4) return false;
    return norm.includes(nameNorm) || nameNorm.includes(norm) || norm.includes(idNorm);
  });

  if (!foundProduct && isReferringBack) {
    foundProduct = lastReferredProductFromHistory;
  }

  const isAskingSpecificProduct = !!foundProduct && (
    isReferringBack ||
    norm.includes("consiste") || 
    norm.includes("recomienda") || 
    norm.includes("sirve") || 
    norm.includes("para qué") || 
    norm.includes("para que") || 
    norm.includes("qué es") || 
    norm.includes("que es") || 
    norm.includes("cuál es") || 
    norm.includes("como funciona") || 
    norm.includes("cómo funciona") || 
    norm.includes("más información") || 
    norm.includes("mas informacion") || 
    norm.includes("información sobre") || 
    norm.includes("informacion sobre") || 
    norm.includes("indagar") ||
    norm.includes("detalles") ||
    norm.includes("saber de") ||
    norm.includes("saber más") ||
    norm.includes("saber mas") ||
    norm.includes("cuéntame") ||
    norm.includes("cuentame") ||
    norm.includes("háblame") ||
    norm.includes("hablame") ||
    norm.includes("explic") ||
    norm === foundProduct.name.toLowerCase().trim() ||
    norm === foundProduct.id.toLowerCase().trim() ||
    norm.includes(foundProduct.name.toLowerCase().trim())
  );

  // General service catalog request (Only if NOT looking up a specific service/product)
  const asksAboutServices = !isAskingSpecificProduct && (
    norm.includes("servicio") || norm.includes("ofrecen") || norm.includes("qué hacen") || norm.includes("que hacen") || norm.includes("catalog") || norm.includes("portafolio") || norm.includes("ofrece")
  );

  // 1. Check if first response or greetings
  if (!lastAgentMsg || norm === "hola" || norm === "buen día" || norm === "buen dia" || norm === "saludos" || norm === "buenas") {
    intent = "Inicio y Detección de Intención";
    clientResponse = `¡Hola! Bienvenido a FIUNVA, tu consultoría de ingeniería especializada en electrónica, robótica y software. ¿En qué te puedo ayudar hoy?`;
    
    reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1: Atención al Cliente**: Saludo inicial y bienvenida.
2. **Agente 2 & 3**: En espera de intenciones del cliente.`;
  }
  // 1.2 Pre-emptive check for specific product / service inquiry (Rama A: Consulta Específica, show description)
  // CHECK THIS FIRST before general service catalogs, to prevent general keywords (like "servicio") from trapping specific service lookups!
  else if (isAskingSpecificProduct && foundProduct) {
    intent = `Rama A: Consulta Específica (${foundProduct.name})`;
    
    // Complement and naturalize description matching user's likely intent or questions (e.g. recommend projects, tech)
    let complement = "";
    const pName = foundProduct.name;
    
    if (pName.includes("Python")) {
      complement = `\n\n**¿Para qué proyectos se recomienda este servicio?**
• **Sistemas de Monitoreo Industrial**: Interfaces SCADA simplificadas para adquisición de datos y control de relevadores/actuadores.
• **Proyectos de Visión Artificial**: Visualización en tiempo real de cámaras con procesamiento OpenCV, ideal para control de calidad.
• **Herramientas de Laboratorio**: Software de calibración de sensores o graficadores de señales biomédicas/físicas conectadas por USB/WiFi.
• **Sistemas de Control Dedicado**: Aplicaciones de escritorio para configurar parámetros de placas de hardware FIUNVA de forma local.

**Beneficios Clave**: Compatibilidad multiplataforma nativa (Windows, Linux, macOS), alto rendimiento gráfico y excelente integración con librerías de Inteligencia Artificial y hardware serial.`;
    } else if (pName.includes("AppWeb") || pName.includes("Sitio Web") || pName.includes("Web")) {
      complement = `\n\n**¿Para qué proyectos se recomienda este servicio?**
• **Paneles de Monitoreo IoT (Dashboards)**: Visualización en tiempo real del estado de sensores o actuadores desde cualquier parte del mundo.
• **Sistemas Administrativos de Inventario**: Administración centralizada de existencias, histórico de consumos e integraciones con bases de datos en la nube.
• **Páginas de Configuración Integradas**: Interfaces de configuración de red o calibración de dispositivos embebidos directamente en el navegador.

**Beneficios Clave**: Accesibilidad universal desde teléfonos, tablets y computadoras sin instalar nada, reportes descargables y actualizaciones inmediatas en la nube.`;
    } else if (pName.includes("Android") || pName.includes("APK")) {
      complement = `\n\n**¿Para qué proyectos se recomienda este servicio?**
• **Control Remoto Móvil vía Bluetooth/WiFi**: Mandos inalámbricos integrados para plataformas robóticas, domótica u operaciones industriales de campo.
• **Notificaciones en Tiempo Real**: Envío de alertas críticas, alarmas de sensores e interfaces visuales táctiles portátiles.
• **Adquisición en Ruta**: Terminales móviles para tomar lecturas técnicas en sitio que luego se sincronizan con bases de datos.

**Beneficios Clave**: Diseño responsivo táctil nativo, uso del hardware interno del celular (cámara, acelerómetro) y portabilidad absoluta.`;
    } else if (pName.includes("PCB") || pName.includes("Prototipado")) {
      complement = `\n\n**¿Para qué proyectos se recomienda este servicio?**
• **Prototipos Rápidos de Ingeniería**: Validación rápida de circuitos preliminares, asegurando que las pistas de alimentación y señales sean correctas.
• **Sustitución de Protoboards Proclives a Fugas**: Tarjetas soldadas robustas de hasta 4 capas perfectas para pruebas en entornos reales.
• **Integración de Sensores y Actuadores**: Placas adaptadoras compactas para encapsular módulos estándar de mercado de forma segura.

**Beneficios Clave**: Reducción de ruido electromagnético, mayor confiabilidad mecánica en vibraciones, y un acabado profesional listo para presentación o ensayos técnicos.`;
    } else if (pName.includes("Software y Firmware") || pName.includes("Firmware") || pName.includes("Integral")) {
      complement = `\n\n**¿Para qué proyectos se recomienda este servicio?**
• **Dispositivos Embebidos Autónomos**: Controladores lógicos a nivel de chip (Microchip, ESP32, STM32) para gestionar ciclos de trabajo sin interrupción.
• **Protocolos de Comunicación Seguros**: Implementación de enlaces WiFi, Bluetooth de bajo consumo (BLE), LoRa o puertos Ethernet con reconexión automática.
• **Lógica en Tiempo Real**: Sistemas críticos de seguridad, control PID de temperatura/motores y procesamiento de señales en el microcontrolador.

**Beneficios Clave**: Eficiencia de consumo energético a milivatios, ejecución inmediata al encendido sin sistemas operativos pesados y estabilidad industrial de largo plazo.`;
    } else if (pName.includes("PLC") || pName.includes("CODESYS") || pName.includes("Industrial")) {
      complement = `\n\n**¿Para qué proyectos se recomienda este servicio?**
• **Automatización de Maquinaria Industrial**: Programación robusta en lenguajes estandarizados (Ladder, Bloques, Texto Estructurado) para líneas de producción.
• **Integración de Sensores de Campo y Actuadores Neumáticos**: Control preciso de pistones, estaciones de llenado y bandas transportadoras.
• **Seguridad Crítica**: Rutinas de parada de emergencia redundantes e interbloqueos para resguardo de operadores y maquinaria.

**Beneficios Clave**: Cumplimiento de normas industriales IEC 61131-3, estabilidad 24/7 y compatibilidad con marcas de PLCs industriales avanzadas como Beckhoff, Wago o Schneider.`;
    } else if (pName.includes("MATLAB") || pName.includes("Simulink") || pName.includes("Matlab")) {
      complement = `\n\n**¿Para qué proyectos se recomienda este servicio?**
• **Simulación de Sistemas Dinámicos**: Pruebas previas virtuales de controladores PID, sistemas mecánicos o térmicos complejos antes de fabricar hardware físico.
• **Modelado y Análisis Matemático de Datos**: Ajuste de curvas, filtrado digital de señales analógicas ruidosas y optimización de variables críticas.
• **Validación Teórica de Algoritmos**: Comprobación matemática rigurosa para papers de investigación o prototipos de patentes.

**Beneficios Clave**: Reducción drástica de costos por daño en pruebas reales, precisión numérica garantizada y modelos dinámicos predictivos exportables.`;
    } else {
      // Default general complement for components or other catalog items
      complement = `\n\n**Ventajas de Adquisición en FIUNVA**:
• **Calibración y Prueba Previa de Integridad**: Cada artículo o servicio cuenta con acompañamiento técnico en su puesta en marcha.
• **Compatibilidad Verificada**: Nuestros ingenieros se encargan de revisar que este componente se adapte eléctricamente a tus prototipos actuales antes de ser despachado.`;
    }

    clientResponse = `Hola. Respecto a **${foundProduct.name}**, este servicio ofrece lo siguiente:

${foundProduct.description}${complement}

¿Te interesaría iniciar una cotización para un proyecto de diseño o fabricación que involucre este servicio/producto en específico o te gustaría consultar sobre otro tema técnico?`;
    
    reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1**: Identificó consulta sobre el producto/servicio específico [${foundProduct.name}].
2. **Agente 3**: Naturalizó la respuesta y complementó dinámicamente con escenarios de recomendación de proyectos y tecnologías.`;
  }
  // 1.3 Pre-emptive check for catalog services (Rama A: Consulta General de Servicios, names list ONLY, no descriptions)
  else if (asksAboutServices) {
    const serviceItems = products.filter(p => 
      p.category === "software_service" || 
      p.unit === "servicio" || 
      p.unit === "proyecto" ||
      /servicio|desarrollo|diagnóstico|diagnostico|fabricación|fabricacion|diseño|diseno|programación|programacion|ensamble|modelado|registro/i.test(p.name)
    );
    intent = "Rama A: Consulta General de Servicios";
    if (serviceItems.length > 0) {
      const uniqueNames = Array.from(new Set(serviceItems.map(p => p.name)));
      const listStr = uniqueNames.map(name => `• **${name}**`).join("\n");
      clientResponse = `En **FIUNVA** contamos con servicios especializados de ingeniería de alta precisión. Actualmente ofrecemos los siguientes servicios en nuestro catálogo:

${listStr}

¿Te interesaría iniciar una cotización o indagar más sobre alguno de ellos en particular?`;
    } else {
      clientResponse = `En **FIUNVA** nos especializamos en transformar ideas de tecnología en soluciones concretas. Ofrecemos desarrollo de software personalizado, automatización de sistemas, diseño rápido de tarjetas de circuito impreso (PCBs) y robótica de precisión.

¿Te gustaría iniciar una cotización o explorar algún servicio en específico?`;
    }
    
    reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1**: Identificó consulta general sobre el catálogo de servicios. Se listaron únicamente los nombres de los servicios sin descripciones.`;
  }
  // 2. State: waiting bifurcation selection
  else if (lastAgentMsg.includes("¿Tu requerimiento es para un proyecto de Diseño y Prototipado desde cero, o se trata de una Reparación/Modificación")) {
    const isRepair = norm.includes("repara") || norm.includes("dañ") || norm.includes("falla") || norm.includes("modific") || norm.includes("dañado") || norm.includes("daño") || norm.includes("romp") || norm.includes("existente");
    if (isRepair) {
      intent = "Rama B.1: Reparación (Vía Corta)";
      clientResponse = `Entendido perfectamente. Procedemos por la vía de **Reparación y Modificación** de un componente o dispositivo existente.
      
Por favor, apóyanos describiendo:
1. ¿Cuál es el síntoma de la falla o qué anomalía presenta el equipo?
2. ¿Cuál es la marca y modelo del dispositivo, o tipo de entorno de software dañado?
3. ¿Dispones de fotografías o registros de error (logs) de la falla? No te preocupes si no los tienes a la mano, puedes describirlos.`;

      reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1 (Atención)**: Detectó bifurcación hacia **Reparación (Rama B.1)**.
2. **Agente 2**: Transfirió el canal técnico al área de soporte post-venta.`;
    } else {
      intent = "Rama B.2: Diseño y Prototipado (Vía Larga)";
      clientResponse = `¡Excelente elección! Nos entusiasma trabajar en tu idea y consolidar un **Diseño y Prototipado desde cero (Vía Principal)**.
      
Para iniciar con la recopilación interactiva de requerimientos:
**¿Cuál es la idea principal y el objetivo general de tu proyecto?** Cuéntame detalladamente.`;

      reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1 (Atención)**: Detectó bifurcación hacia **Diseño y Prototipado (Rama B.2)**.
2. **Agente 2**: Preparando matriz de servicios de ingeniería correspondientes.`;
    }
  }
  // 3. State: Waiting failure details for Repair (B.1)
  else if (lastAgentMsg.includes("¿Cuál es el síntoma de la falla") || lastAgentMsg.includes("Procedemos por la vía de Reparación y Modificación")) {
    intent = "Rama B.1: Borrador de Reparación";
    
    const rateMultiplier = rates[currency] || 1.0;
    const baseDiagPrice = 35.0 * rateMultiplier;
    const baseRepPrice = 120.0 * rateMultiplier;
    
    let discountApplied = 0;
    if (clientTier === "vip") discountApplied = 15;
    else if (clientTier === "frequent") discountApplied = 5;

    const subtotalDiag = Number((baseDiagPrice * (1 - discountApplied / 100)).toFixed(2));
    const subtotalRep = Number((baseRepPrice * (1 - discountApplied / 100)).toFixed(2));
    const orderSubtotal = subtotalDiag + subtotalRep;
    const currencySymbol = currency === "EUR" ? "€" : "$";

    clientResponse = `¡Entendido! He procesado los detalles técnicos de la falla. El **Agente 2 (Planificador y Cotizador)** ha estructurado en tiempo real la siguiente cotización preliminar para tu reparación en la divisa **${currency}**:

### 📋 Borrador de Reparación / Modificación - Cotización Preliminar

| Cant. | Concepto de Servicio Técnico | Tarifa Base | Desc. Perfil | Subtotal |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Servicio de Diagnóstico Predictivo de Laboratorio** | ${currencySymbol}${baseDiagPrice.toFixed(2)} | ${discountApplied}% | ${currencySymbol}${subtotalDiag.toFixed(2)} |
| 1 | **Servicio de Reparación y Ajuste de Dispositivo** *(Horas de Ingeniería)* | ${currencySymbol}${baseRepPrice.toFixed(2)} | ${discountApplied}% | ${currencySymbol}${subtotalRep.toFixed(2)} |

---
* **Subtotal Neto:** ${currencySymbol}${orderSubtotal.toFixed(2)} ${currency}
* **IVA e Integración Técnica (16%):** ${currencySymbol}${(orderSubtotal * 0.16).toFixed(2)} ${currency}
* **Total Estimado Provisional:** ${currencySymbol}${(orderSubtotal * 1.16).toFixed(2)} ${currency}

* **Tipo de Proyecto:** Reparación de dispositivo técnico.
* **Descripción de Falla:** ${message}
- **Servicios Técnicos Asignados:** Consultoría Técnica y Diagnóstico de Laboratorio.
- **Ubicación:** Laboratorio FIUNVA de Ensayos.

¿Nos das tu **Visto Bueno** para registrar este borrador y pasar a la revisión técnica? (Responde con **"sí"** o **"visto bueno"**).`;

    reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1**: Compiló los síntomas de falla ingresados preliminarmente.
2. **Agente 2**: Asignó servicio de diagnóstico predictivo básico.
3. **Agente 3**: Aprobó viabilidad para recepción física.`;
  }
  // 4. State: Waiting general concept for Design & Prototyping (B.2.1)
  else if (lastAgentMsg.includes("¿Cuál es la idea principal y el objetivo general de tu proyecto?")) {
    const nextQ = getNextB2Question();
    if (nextQ) {
      intent = nextQ.intent;
      clientResponse = `¡Inspiradora idea! Basado en el concepto que describes, para dimensionar con precisión la ingeniería de tu prototipo, procederemos por partes.
      ${getSkipReport()}
Por favor, responde la siguiente pregunta:

${nextQ.text}`;
    } else {
      intent = "Rama B.2: Selección de Servicios de Ingeniería";
      clientResponse = `¡Excelente! He analizado tu idea y he detectado que ya nos has proporcionado toda la información técnica necesaria (electrónica, software y robótica).
      ${getSkipReport()}
Nuestro sistema de ingeniería recomienda incluir los siguientes servicios de nuestro catálogo para la cotización de este proyecto:

1. 🎛️ **Servicio de Prototipado PCB Express** (Id: pcb_express - Para la integración de tu microcontrolador y sensores de forma profesional).
2. 💻 **Desarrollo Integral de Software y Firmware** (Id: consultoria_tecnica - Cotizado por todo el trabajo del proyecto con tarifa fija, no por hora).

**¿Estás de acuerdo con incluir estos servicios de ingeniería en tu cotización provisional?** (Responde "sí" o "no").`;
    }

    reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1**: Recibió el concepto y objetivo del prototipo del cliente.
2. **Agente 2**: Segmentó el proyecto analizando la matriz electrónica-software-robótica secuencialmente.`;
  }
  // 5. State: Waiting area-specific questions answers (B.2.2)
  else if (
    (lastAgentMsg.includes("Electrónica:") && (lastAgentMsg.includes("voltaje") || lastAgentMsg.includes("microcontrolador"))) ||
    (lastAgentMsg.includes("Software:") && (lastAgentMsg.includes("visualizará") || lastAgentMsg.includes("lenguaje"))) ||
    (lastAgentMsg.includes("Robótica/Mecánica") && (lastAgentMsg.includes("actuadores") || lastAgentMsg.includes("motores")))
  ) {
    const nextQ = getNextB2Question();
    if (nextQ) {
      intent = nextQ.intent;
      clientResponse = `¡Entendido! He registrado estos nuevos detalles técnicos de tu propuesta. Sigamos con el siguiente paso interactivo.
      ${getSkipReport()}
Por favor, responde la siguiente pregunta:

${nextQ.text}`;
    } else {
      intent = "Rama B.2: Selección de Servicios de Ingeniería";
      clientResponse = `Excelente información técnica de hardware y software recopilada.
      ${getSkipReport()}
Nuestro sistema de ingeniería recomienda incluir los siguientes servicios de nuestro catálogo para la cotización de este proyecto:

1. 🎛️ **Servicio de Prototipado PCB Express** (Id: pcb_express - Para la integración de tu microcontrolador y sensores de forma profesional).
2. 💻 **Desarrollo Integral de Software y Firmware** (Id: consultoria_tecnica - Cotizado por todo el trabajo del proyecto con tarifa fija, no por hora).

**¿Estás de acuerdo con incluir estos servicios de ingeniería en tu cotización provisional?** (Responde "sí" o "no").`;
    }

    reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1**: Consolidó y registró respuestas para la matriz de ingeniería omitiendo redundancias.
2. **Agente 2**: Realizó el mapeo automático de servicios según compatibilidad de hardware/software.`;
  }
  // 6. State: Waiting agreement on services (B.2.3)
  else if (lastAgentMsg.includes("recomienda incluir los siguientes servicios de nuestro catálogo") || lastAgentMsg.includes("¿Estás de acuerdo con incluir estos servicios")) {
    intent = "Rama B.2: Inventario de Materiales";
    clientResponse = `Perfecto. Con los servicios de ingeniería del catálogo ya acordados, pasemos a la adquisición del hardware físico:

**¿Cómo se adquirirá el inventario de componentes mecánicos y electrónicos?** Escoge una opción:
1. Yo (el cliente) ya tengo todos los componentes y los entregaré para el ensamble.
2. Yo tengo algunos componentes y FIUNVA debe conseguir el resto (por favor indica qué componentes tienes).
3. FIUNVA debe encargarse de conseguir el 100% de los insumos y materiales del catálogo.`;

    reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1**: Verificó aceptación del cliente de los servicios de ingeniería del catálogo.
2. **Agente 2**: Iniciando preparación de la estructura lógica de materiales (BOM).`;
  }
  // 7. State: Waiting materials sourcing choice (B.2.4)
  else if (lastAgentMsg.includes("¿Cómo se adquirirá el inventario de componentes") || lastAgentMsg.includes("adquisición del hardware físico")) {
    intent = "Rama B.2: Generación de Borrador de Cotización";
    
    const rateMultiplier = rates[currency] || 1.0;
    const currencySymbol = currency === "EUR" ? "€" : "$";
    
    // 1. Resolve dynamic services from products database
    const pcbDbItem = products.find(p => p.id === "pcb_express") || { id: "pcb_express", name: "Servicio de Prototipado PCB Express", price: 45.0, unit: "servicio" };
    const projectDbItem = products.find(p => p.id === "consultoria_tecnica") || { id: "consultoria_tecnica", name: "Desarrollo Integral de Software y Firmware", price: 750.0, unit: "proyecto" };
    const selectedServices = [pcbDbItem, projectDbItem];
    
    let discountApplied = 0;
    if (clientTier === "vip") discountApplied = 15;
    else if (clientTier === "frequent") discountApplied = 5;

    // 2. Identify materials (physical items) based on conversation history
    const allUserText = (history || [])
      .filter((m: any) => m.sender === "client")
      .map((m: any) => m.text)
      .concat([message])
      .join(" ")
      .toLowerCase();

    // Sourcing Mode Detection
    const normMsg = message.toLowerCase();
    let sourcingMode = 3; // Default to Option 3
    let sourcingText = "FIUNVA se encarga de conseguir el 100% de los insumos y materiales del catálogo";
    if (normMsg.includes("1") || normMsg.includes("yo tengo") || normMsg.includes("entregar") || normMsg.includes("entregare") || normMsg.includes("entregaré")) {
      sourcingMode = 1;
      sourcingText = "El cliente aporta el 100% de los componentes físicos; FIUNVA realiza solo el ensamble técnico";
    } else if (normMsg.includes("2") || normMsg.includes("algunos") || normMsg.includes("resto")) {
      sourcingMode = 2;
      sourcingText = "El cliente aporta algunos componentes y FIUNVA suministra el resto";
    }

    // Detect matching materials from products database or use logical defaults
    const physicalItems = products.filter(p => p.category !== "software_service" && p.unit !== "servicio" && p.unit !== "proyecto");
    const detectedMaterials: { product: Product; quantity: number }[] = [];
    physicalItems.forEach(p => {
      const idParts = p.id.split("_");
      const nameLower = p.name.toLowerCase();
      
      const matchesId = idParts.some(part => part.length > 2 && allUserText.includes(part));
      const matchesName = nameLower.split(" ").some(word => word.length > 3 && allUserText.includes(word));
      
      if (matchesId || matchesName) {
        if (!detectedMaterials.some(item => item.product.id === p.id)) {
          detectedMaterials.push({ product: p, quantity: 1 });
        }
      }
    });

    // Logical defaults if none explicitly detected in conversation
    if (detectedMaterials.length === 0) {
      const r1 = products.find(p => p.id === "esp32_nodemcu");
      const r2 = products.find(p => p.id === "servo_sg90");
      if (r1) detectedMaterials.push({ product: r1, quantity: 1 });
      if (r2) detectedMaterials.push({ product: r2, quantity: 1 });
    }

    // Compile proposed table rows and calculate dynamic subtotals
    const proposedRows: any[] = [];
    let orderSubtotal = 0;

    // Add Services
    selectedServices.forEach(srv => {
      const unitPrice = srv.price * rateMultiplier;
      const subtotal = unitPrice * (1 - discountApplied / 100);
      orderSubtotal += subtotal;
      proposedRows.push({
        name: srv.name,
        quantity: 1,
        unit: srv.unit || "servicio",
        unitPrice,
        subtotal
      });
    });

    // Add Materials
    detectedMaterials.forEach(mat => {
      // If client brings all (Option 1), price is $0
      const unitPrice = sourcingMode === 1 ? 0 : mat.product.price * rateMultiplier;
      const subtotal = unitPrice * mat.quantity * (1 - discountApplied / 100);
      orderSubtotal += subtotal;
      proposedRows.push({
        name: `${mat.product.name} (Material)`,
        quantity: mat.quantity,
        unit: mat.product.unit || "pza",
        unitPrice,
        subtotal
      });
    });

    const tableRows = proposedRows.map(row => {
      return `| ${row.quantity} | **${row.name}** *(${row.unit})* | ${currencySymbol}${row.unitPrice.toFixed(2)} | ${discountApplied}% | ${currencySymbol}${row.subtotal.toFixed(2)} |`;
    }).join("\n");

    clientResponse = `¡Formidable! El **Agente 1** ha compilado los requerimientos y el **Agente 2 (Planificador y Cotizador)** ha generado la estructura del borrador de tu proyecto con cotización preliminar calculada en la divisa **${currency}**:
 
### 📋 Borrador de Propuesta Especializada (FIUNVA) - Cotización Preliminar

| Cant. | Concepto / Recurso de Ingeniería | Tarifa Base | Desc. Perfil | Subtotal |
| :---: | :--- | :--- | :---: | :--- |
${tableRows}

---
* **Subtotal Neto:** ${currencySymbol}${orderSubtotal.toFixed(2)} ${currency}
* **IVA e Integración Técnica (16%):** ${currencySymbol}${(orderSubtotal * 0.16).toFixed(2)} ${currency}
* **Total Estimado Provisional:** ${currencySymbol}${(orderSubtotal * 1.16).toFixed(2)} ${currency}

* **Concepto de Diseño:** Proyecto personalizado desde cero de ingeniería de hardware/software.
* **Gestión de Inventario (BOM):** ${sourcingText} (${message}).
 
*(Nota: Esta es una cotización preliminar por la totalidad del proyecto. No se cobra por horas, garantizándote un precio cerrado de inicio a fin).*
 
**¿Estás de acuerdo con dar tu Visto Bueno a este borrador para enviarlo a revisión de ingeniería comercial?** (Responde **"sí"** o **"visto bueno"**).`;
 
  }
  // 8. State: Waiting seen good / visto bueno of the draft (closure)
  else if (lastAgentMsg.includes("¿Estás de acuerdo con dar tu Visto Bueno") || lastAgentMsg.includes("¿Estás de acuerdo con este borrador para pasarlo a validación") || lastAgentMsg.includes("Borrador de Propuesta Especializada") || lastAgentMsg.includes("visto bueno") || lastAgentMsg.includes("Visto Bueno")) {
    const code = `PROY-2026-${Math.floor(100 + Math.random() * 900)}`;
    intent = "Clausura y Seguimiento de Proyecto";
    clientResponse = `¡Excelente! El sistema experto de FIUNVA ha procesado tu **Visto Bueno** y se ha ejecutado exitosamente el protocolo de cierre comercial:
 
- 🆔 **Código de Seguimiento Único:** \`${code}\`
- 🛠️ **Envío a Validación:** El borrador técnico ha sido transferido en tiempo real al **Agente 3 (Soporte Técnico y Validación)** para auditar e integrar la bitácora física de viabilidad.
- 📧 **Correo al Cliente:** Se ha disparado un correo de confirmación de estatus a tu dirección registrada con el PDF de la minuta técnica.
- 🚦 **Estatus de la Cotización:** \`Pendiente de Cotización Final / En Revisión Técnica\`
 
Agradecemos profundamente tu confianza. El operador de ingeniería se pondrá en contacto contigo a la brevedad.`;
 
    // To record the physical order/quote in the Firestore DB, populate proposedItems!
    let isRepairHistory = false;
    if (history && history.length > 0) {
      isRepairHistory = history.some((m: any) => m.text && (m.text.includes("Borrador de Reparación") || m.text.includes("Reparación / Modificación")));
    }

    const rateMultiplier = rates[currency] || 1.0;
    let discountApplied = 0;
    if (clientTier === "vip") discountApplied = 15;
    else if (clientTier === "frequent") discountApplied = 5;

    if (isRepairHistory) {
      const baseDiagPrice = (products.find(p => p.id === "diagnostico_lab")?.price || 35.0) * rateMultiplier;
      const baseRepPrice = (products.find(p => p.id === "reparacion_ajuste")?.price || 120.0) * rateMultiplier;
      proposedItems = [
        {
          productId: "diagnostico_lab",
          productName: `Servicio Diagnóstico Predictivo de Laboratorio (${code})`,
          quantity: 1,
          unitPrice: Number(baseDiagPrice.toFixed(2)),
          discountApplied,
          subtotal: Number((baseDiagPrice * (1 - discountApplied / 100)).toFixed(2))
        },
        {
          productId: "consultoria_tecnica",
          productName: `Servicio de Reparación y Ajuste de Dispositivo (${code})`,
          quantity: 1,
          unitPrice: Number(baseRepPrice.toFixed(2)),
          discountApplied,
          subtotal: Number((baseRepPrice * (1 - discountApplied / 100)).toFixed(2))
        }
      ];
    } else {
      // Detect sourcing mode choice from conversation history
      let sourcingMode = 3;
      const sourcingMsg = (history || []).find((m: any, idx: number) => {
        if (m.sender === "client" && idx > 0) {
          const prevAgentMsg = history[idx - 1];
          return prevAgentMsg && prevAgentMsg.sender === "agent" && (
            prevAgentMsg.text.includes("¿Cómo se adquirirá el inventario de componentes") ||
            prevAgentMsg.text.includes("adquisición del hardware físico")
          );
        }
        return false;
      });

      if (sourcingMsg) {
        const normSourcing = sourcingMsg.text.toLowerCase();
        if (normSourcing.includes("1") || normSourcing.includes("yo tengo") || normSourcing.includes("entregare") || normSourcing.includes("entregaré")) {
          sourcingMode = 1;
        } else if (normSourcing.includes("2") || normSourcing.includes("algunos") || normSourcing.includes("resto")) {
          sourcingMode = 2;
        }
      }

      // Query dynamic services
      const pcbDbItem = products.find(p => p.id === "pcb_express") || { id: "pcb_express", name: "Servicio de Prototipado PCB Express", price: 45.0 };
      const projectDbItem = products.find(p => p.id === "consultoria_tecnica") || { id: "consultoria_tecnica", name: "Desarrollo Integral de Software y Firmware", price: 750.0 };
      
      proposedItems = [
        {
          productId: pcbDbItem.id,
          productName: `${pcbDbItem.name} (${code})`,
          quantity: 1,
          unitPrice: Number((pcbDbItem.price * rateMultiplier).toFixed(2)),
          discountApplied,
          subtotal: Number((pcbDbItem.price * rateMultiplier * (1 - discountApplied / 100)).toFixed(2))
        },
        {
          productId: projectDbItem.id,
          productName: `Desarrollo Integral de Software y Firmware (Proyecto completo: ${code})`,
          quantity: 1,
          unitPrice: Number((projectDbItem.price * rateMultiplier).toFixed(2)),
          discountApplied,
          subtotal: Number((projectDbItem.price * rateMultiplier * (1 - discountApplied / 100)).toFixed(2))
        }
      ];

      // Query dynamic components/materials from conversation text
      const allUserText = (history || [])
        .filter((m: any) => m.sender === "client")
        .map((m: any) => m.text)
        .join(" ")
        .toLowerCase();

      const physicalItems = products.filter(p => p.category !== "software_service" && p.unit !== "servicio" && p.unit !== "proyecto");
      const detectedMats: { product: Product; quantity: number }[] = [];
      physicalItems.forEach(p => {
        const idParts = p.id.split("_");
        const nameLower = p.name.toLowerCase();
        
        const matchesId = idParts.some(part => part.length > 2 && allUserText.includes(part));
        const matchesName = nameLower.split(" ").some(word => word.length > 3 && allUserText.includes(word));
        
        if (matchesId || matchesName) {
          if (!detectedMats.some(item => item.product.id === p.id)) {
            detectedMats.push({ product: p, quantity: 1 });
          }
        }
      });

      if (detectedMats.length === 0) {
        const r1 = products.find(p => p.id === "esp32_nodemcu");
        const r2 = products.find(p => p.id === "servo_sg90");
        if (r1) detectedMats.push({ product: r1, quantity: 1 });
        if (r2) detectedMats.push({ product: r2, quantity: 1 });
      }

      detectedMats.forEach(mat => {
        const unitPrice = sourcingMode === 1 ? 0 : mat.product.price * rateMultiplier;
        proposedItems.push({
          productId: mat.product.id,
          productName: `${mat.product.name} (Material - ${code})`,
          quantity: mat.quantity,
          unitPrice: Number(unitPrice.toFixed(2)),
          discountApplied,
          subtotal: Number((unitPrice * mat.quantity * (1 - discountApplied / 100)).toFixed(2))
        });
      });
    }

    const orderSubtotal = proposedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
    const currencySymbol = currency === "EUR" ? "€" : "$";

    salesSummary = `### Resumen de Propuesta Preliminar Especializada: ${code}
 
| Cant. | Concepto de Ingeniería / Material | Tarifa (${currency}) | Desc. | Subtotal (${currency}) |
|---|---|---|---|---|
${proposedItems.map((item: any) => `| ${item.quantity} | ${item.productName} | ${currencySymbol}${item.unitPrice.toFixed(2)} | ${item.discountApplied}% | ${currencySymbol}${item.subtotal.toFixed(2)} |`).join("\n")}
 
**Subtotal:** ${currencySymbol}${orderSubtotal.toFixed(2)} ${currency}
*Impuesto al Valor Agregado e Integración (16%):* ${currencySymbol}${(orderSubtotal * 0.16).toFixed(2)} ${currency}
**Total Estimado Provisional:** ${currencySymbol}${(orderSubtotal * 1.16).toFixed(2)} ${currency}
`;

    reasoningTrace = `### Rastreo del Sistema Experto y Colaboración de Agentes
1. **Agente 1: Atención al Cliente**:
   - Clausuró el ciclo de conversación interactiva con Visto Bueno del cliente.
2. **Agente 2: Planificador y Cotizador**:
   - Consultó dinámicamente la base de servicios y base de componentes para estructurar el Bill of Materials (BOM) y el acuerdo comercial correspondiente.
   - Aplicó descuentos por volumen y Tier de Cuenta (${discountApplied}%).
3. **Agente 3: Soporte Técnico y Validación**:
   - Generó bitácora técnica de integridad y emitió código único ${code}.`;
  }
  // 9. Default / Fallback matching if we are in general conversation or user wants to quote but hasn't received bifurcation:
  else {
    const wantsQuote = norm.includes("cotiz") || norm.includes("presupuesto") || norm.includes("precio") || norm.includes("comprar") || norm.includes("adquirir") || norm.includes("pedir") || norm.includes("iniciar") || 
      (norm.includes("proyecto") && !norm.includes("tipo de") && !norm.includes("consiste") && !norm.includes("que proyec") && !norm.includes("qué proyec"));

    if (wantsQuote) {
      intent = "Rama B: Cotización - Bifurcación";
      clientResponse = `¡Excelente! Veo que deseas iniciar una cotización para tu proyecto. Para dirigir el diseño conforme a la naturaleza del requerimiento, por favor indícame:
      
**¿Tu requerimiento es para un proyecto de Diseño y Prototipado desde cero, o se trata de una Reparación/Modificación de un dispositivo o software ya existente o dañado?**`;

      reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1**: Identificó intención de cotizar proyecto. Disparó la pregunta de bifurcación de entrada.`;
    } else {
      if (foundProduct) {
        intent = `Rama A: Consulta Específica (${foundProduct.name})`;
        clientResponse = `${foundProduct.description}

¿Te interesaría iniciar una cotización para un proyecto de diseño o fabricación que involucre este servicio/producto en específico?`;
      } else {
        intent = "Rama A: Consulta General de Servicios";
        clientResponse = `En **FIUNVA** nos especializamos en transformar ideas de tecnología en soluciones concretas. Ofrecemos desarrollo de software personalizado, automatización de sistemas, diseño rápido de tarjetas de circuito impreso (PCBs) y robótica de precisión.

¿Te gustaría iniciar una cotización o explorar algún servicio en específico?`;
      }
      
      reasoningTrace = `### Rastreo del Sistema Experto
1. **Agente 1**: Atendió consulta general o específica del catálogo con upselling de cotización.`;
    }
  }

  return {
    agent1: { intent, extractedItems: [], clientResponse },
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
    saveProductToFirestore(product); // Save updated stock to Firestore
    res.json({ success: true, message: `Reabastecido con éxito. Nuevo stock para ${product.name}: ${product.stock}`, products });
  } else {
    res.status(404).json({ success: false, error: "Producto no encontrado" });
  }
});

// Update single product details (Admin)
app.post("/api/products/edit", (req, res) => {
  const { id, name, price, stock, description, webReference, webReferences, originalPrice, originalCurrency } = req.body;
  const product = products.find(p => p.id === id);
  if (product) {
    product.name = name;
    product.price = Number(price);
    product.stock = Number(stock);
    product.description = description;
    product.webReferences = webReferences || (webReference ? [webReference] : []);
    product.webReference = product.webReferences[0] || "";
    product.originalPrice = originalPrice !== undefined ? Number(originalPrice) : Number(price);
    product.originalCurrency = originalCurrency || product.originalCurrency || "MXN";
    saveProductToFirestore(product); // Save updated product details to Firestore
    res.json({ success: true, product });
  } else {
    res.status(404).json({ success: false, error: "Producto no encontrado" });
  }
});

// Add new product/service (Admin)
app.post("/api/products/add", (req, res) => {
  const { id, name, category, price, stock, description, unit, webReference, webReferences, originalPrice, originalCurrency } = req.body;
  
  if (!id || !name || !category) {
    return res.status(400).json({ success: false, error: "Faltan campos requeridos (id, name, category)" });
  }

  const exists = products.some(p => p.id === id);
  if (exists) {
    return res.status(400).json({ success: false, error: "Ya existe un elemento con el ID proporcionado" });
  }

  const finalWebRefs = webReferences || (webReference ? [webReference] : []);
  const newProduct: Product = {
    id,
    name,
    category,
    price: Number(price) || 0,
    stock: Number(stock) || 0,
    description: description || "",
    unit: unit || "pza",
    webReferences: finalWebRefs,
    webReference: finalWebRefs[0] || "",
    originalPrice: originalPrice !== undefined ? Number(originalPrice) : (Number(price) || 0),
    originalCurrency: originalCurrency || "MXN"
  };

  products.push(newProduct);
  saveProductToFirestore(newProduct); // Add newly created product/service to Firestore
  res.json({ success: true, product: newProduct });
});

// Delete a product/service (Admin)
app.post("/api/products/delete", (req, res) => {
  const { id } = req.body;
  const index = products.findIndex(p => p.id === id);
  if (index !== -1) {
    const deleted = products.splice(index, 1);
    deleteProductFromFirestore(id); // Delete from Firestore as well
    res.json({ success: true, deleted: deleted[0] });
  } else {
    res.status(404).json({ success: false, error: "Elemento no encontrado" });
  }
});

// Get all orders queue
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

// Reset whole system (DB seed reload)
app.post("/api/system/reset", async (req, res) => {
  products = [
    { id: "motor_nema17", name: "Motor Paso a Paso NEMA 17", category: "robotics", description: "Motor paso a paso de gran precisión (1.8° por paso) ideal para robótica e impresoras 3D. Torque de 4.2 kg-cm.", price: 18.50, stock: 12, unit: "pza", webReference: "https://www.mouser.com/ProductDetail/Adafruit/324" },
    { id: "driver_drv8825", name: "Controlador de Motor DRV8825", category: "electronics", description: "Módulo de interfaz controlador de motor paso a paso con microstepping y protección térmica de sobrecorriente.", price: 4.20, stock: 8, unit: "pza", webReference: "https://www.pololu.com/product/2133" },
    { id: "arduino_uno", name: "Placa Microcontrolador Arduino Uno R3", category: "electronics", description: "Placa de desarrollo open-source basada en el chip ATmega328P para prototipaje rápido.", price: 22.00, stock: 15, unit: "pza", webReference: "https://store.arduino.cc/products/arduino-uno-rev3" },
    { id: "esp32_nodemcu", name: "Módulo IoT ESP32 NodeMCU", category: "electronics", description: "Placa de desarrollo integrada de Wi-Fi + Bluetooth 4.2, idónea para conectividad e Internet de las Cosas.", price: 12.00, stock: 20, unit: "pza", webReference: "https://www.espressif.com/en/products/socs/esp32" },
    { id: "servo_sg90", name: "Micro Servo Motor TowerPro SG90", category: "robotics", description: "Micro servo ligero con giro de 180 grados, óptimo para robótica móvil rápida de pequeño peso.", price: 3.50, stock: 4, unit: "pza", webReference: "https://www.towerpro.com.tw/product/sg90-7/" },
    { id: "pcb_express", name: "Servicio de Prototipado PCB Express", category: "software_service", description: "Diseño, enrutamiento y manufactura rápida de placas de circuito impreso (PCB) de hasta 4 capas.", price: 45.00, stock: 100, unit: "servicio", webReference: "https://www.fiunva.com/servicios/pcb-pcbway-partner" },
    { id: "consultoria_tecnica", name: "Desarrollo Integral de Software y Firmware", category: "software_service", description: "Desarrollo de firmware embebido, integraciones y plataforma web/móvil por todo el trabajo del proyecto (tarifa fija, no por hora).", price: 750.00, stock: 100, unit: "proyecto", webReference: "https://www.fiunva.com/servicios/consulting-embedded-software" }
  ];
  products.forEach(p => {
    if (!p.webReferences) {
      p.webReferences = p.webReference ? [p.webReference] : [];
    }
  });

  const seedOrder: Order = {
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
  };

  orders = [seedOrder];
  activeClients = [];
  activeStaff = [...DEFAULT_STAFF];
  knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
  saveUsersToFiles();

  if (db && firestoreEnabled) {
    try {
      console.log("Resetting Firestore collections: products, orders, users, and knowledge_base...");
      // Re-seed all products to Firestore
      for (const item of products) {
        await setDoc(doc(db, "products", item.id), sanitizeForFirestore(item));
      }
      // Re-seed order to Firestore
      await setDoc(doc(db, "orders", seedOrder.id), sanitizeForFirestore(seedOrder));
      // Re-seed default staff (admin only) to Firestore
      for (const usr of DEFAULT_STAFF) {
        await setDoc(doc(db, "users", usr.uid), sanitizeForFirestore(usr));
      }
      // Re-seed knowledge_base
      for (const item of DEFAULT_KNOWLEDGE_BASE) {
        await setDoc(doc(db, "knowledge_base", item.id), sanitizeForFirestore(item));
      }
    } catch (err) {
      console.error("Error resetting Firestore collections:", err);
    }
  }

  res.json({ success: true, message: "Sistema experto reiniciado a valores predefinidos de catálogo.", products, orders, users: [...activeClients, ...activeStaff], knowledgeBase });
});

// Import entire system state from a uploaded JSON file
app.post("/api/system/import", async (req, res) => {
  try {
    const { products: importedProducts, orders: importedOrders, users: importedUsers, knowledgeBase: importedKb } = req.body;

    if (!importedProducts && !importedOrders && !importedUsers && !importedKb) {
      return res.status(400).json({ success: false, error: "El archivo JSON debe contener al menos una colección válida (products, orders, users o knowledgeBase)." });
    }

    if (importedProducts && Array.isArray(importedProducts)) {
      products = importedProducts.map(p => ({
        ...p,
        webReferences: p.webReferences || (p.webReference ? [p.webReference] : []),
        originalPrice: p.originalPrice !== undefined ? Number(p.originalPrice) : Number(p.price || 0),
        originalCurrency: p.originalCurrency || "MXN"
      }));
    }

    if (importedOrders && Array.isArray(importedOrders)) {
      orders = importedOrders;
    }

    if (importedKb && Array.isArray(importedKb)) {
      knowledgeBase = importedKb;
    }

    if (importedUsers && Array.isArray(importedUsers)) {
      // Split into activeClients and activeStaff based on role
      activeClients = importedUsers.filter((u: any) => u.role === "client");
      activeStaff = importedUsers.filter((u: any) => u.role === "operator" || u.role === "admin");
      
      // Safety: always ensure the main administrative email exists as staff
      if (!activeStaff.some((u: any) => u.email === "a23110162@ceti.mx")) {
        const adminUser = DEFAULT_STAFF.find(u => u.email === "a23110162@ceti.mx") || DEFAULT_STAFF[0];
        activeStaff.push(adminUser);
      }
      saveUsersToFiles();
    }

    // Rewrite Firestore collections if enabled
    if (db && firestoreEnabled) {
      console.log("Saving imported data collections to Firestore...");
      
      if (importedProducts && Array.isArray(importedProducts)) {
        for (const item of products) {
          await setDoc(doc(db, "products", item.id), sanitizeForFirestore(item));
        }
      }
      
      if (importedOrders && Array.isArray(importedOrders)) {
        for (const ord of orders) {
          await setDoc(doc(db, "orders", ord.id), sanitizeForFirestore(ord));
        }
      }

      if (importedKb && Array.isArray(importedKb)) {
        for (const item of knowledgeBase) {
          await setDoc(doc(db, "knowledge_base", item.id), sanitizeForFirestore(item));
        }
      }
      
      if (importedUsers && Array.isArray(importedUsers)) {
        const allUsers = [...activeClients, ...activeStaff];
        for (const usr of allUsers) {
          await setDoc(doc(db, "users", usr.uid || usr.id), sanitizeForFirestore(usr));
        }
      }
    }

    res.json({
      success: true,
      message: "Base de datos importada, sincronizada e integrada con éxito.",
      products,
      orders,
      users: [...activeClients, ...activeStaff],
      knowledgeBase
    });
  } catch (error: any) {
    console.error("Error durando la importación de base de datos:", error);
    res.status(500).json({ success: false, error: `Error interno de importación: ${error.message || error}` });
  }
});

// Get Active Users / Clients List
app.get("/api/users", (req, res) => {
  res.json([...activeClients, ...activeStaff]);
});

// Save user/client (create or update)
app.post("/api/users/save", async (req, res) => {
  const user = req.body;
  if (!user || !user.uid) {
    return res.status(400).json({ success: false, error: "Identificador de usuario (uid) es requerido." });
  }

  // Ensure properties are valid
  if (!user.clientTier || !["standard", "frequent", "vip"].includes(user.clientTier)) {
    user.clientTier = "standard";
  }
  if (!user.role || !["client", "operator", "admin"].includes(user.role)) {
    user.role = "client";
  }

  if (user.role === "client") {
    const existingIndex = activeClients.findIndex(u => u.uid === user.uid);
    if (existingIndex !== -1) {
      activeClients[existingIndex] = { ...activeClients[existingIndex], ...user };
    } else {
      activeClients.push(user);
    }
    // Remove from staff if it was previously there
    const staffIndex = activeStaff.findIndex(u => u.uid === user.uid);
    if (staffIndex !== -1) {
      activeStaff.splice(staffIndex, 1);
    }
  } else {
    const existingIndex = activeStaff.findIndex(u => u.uid === user.uid);
    if (existingIndex !== -1) {
      activeStaff[existingIndex] = { ...activeStaff[existingIndex], ...user };
    } else {
      activeStaff.push(user);
    }
    // Remove from clients if it was previously there
    const clientIndex = activeClients.findIndex(u => u.uid === user.uid);
    if (clientIndex !== -1) {
      activeClients.splice(clientIndex, 1);
    }
  }

  saveUsersToFiles();
  await saveUserToFirestore(user);

  res.json({ success: true, message: `Usuario/cliente "${user.name}" guardado exitosamente.`, users: [...activeClients, ...activeStaff] });
});

// Delete user/client
app.post("/api/users/:id/delete", async (req, res) => {
  const userId = req.params.id;
  
  let userIndex = activeClients.findIndex(u => u.uid === userId);
  let userName = "";

  if (userIndex !== -1) {
    userName = activeClients[userIndex].name;
    activeClients.splice(userIndex, 1);
  } else {
    userIndex = activeStaff.findIndex(u => u.uid === userId);
    if (userIndex !== -1) {
      if (activeStaff[userIndex].email === "a23110162@ceti.mx") {
        return res.status(403).json({ success: false, error: "El Administrador Principal es inmune a la eliminación." });
      }
      userName = activeStaff[userIndex].name;
      activeStaff.splice(userIndex, 1);
    } else {
      return res.status(404).json({ success: false, error: "Usuario no encontrado en memoria." });
    }
  }

  saveUsersToFiles();
  await deleteUserFromFirestore(userId);

  res.json({ success: true, message: `El cliente/usuario "${userName}" fue eliminado con éxito.`, users: [...activeClients, ...activeStaff] });
});

// --- Knowledge Base Endpoints (CRUD) ---

// Get all knowledge base entries
app.get("/api/knowledge-base", (req, res) => {
  res.json(knowledgeBase);
});

// Save (create or update) knowledge base entry
app.post("/api/knowledge-base/save", async (req, res) => {
  const entry = req.body;
  if (!entry || !entry.id) {
    return res.status(400).json({ success: false, error: "El ID de la entrada es requerido." });
  }

  const existingIndex = knowledgeBase.findIndex(kb => kb.id === entry.id);
  if (existingIndex !== -1) {
    knowledgeBase[existingIndex] = { ...knowledgeBase[existingIndex], ...entry, updatedAt: new Date().toISOString() };
  } else {
    knowledgeBase.push({
      id: entry.id,
      question: entry.question || "",
      answer: entry.answer || "",
      category: entry.category || "general",
      updatedAt: new Date().toISOString()
    });
  }

  if (db && firestoreEnabled) {
    try {
      await setDoc(doc(db, "knowledge_base", entry.id), sanitizeForFirestore(entry));
    } catch (err) {
      console.error("Error saving knowledge entry to Firestore:", err);
    }
  }

  res.json({ success: true, message: `La entrada de conocimiento "${entry.question}" fue guardada exitosamente.`, knowledgeBase });
});

// Delete knowledge base entry
app.post("/api/knowledge-base/:id/delete", async (req, res) => {
  const entryId = req.params.id;
  const existingIndex = knowledgeBase.findIndex(kb => kb.id === entryId);
  if (existingIndex === -1) {
    return res.status(404).json({ success: false, error: "Entrada de conocimiento no encontrada." });
  }

  const entryName = knowledgeBase[existingIndex].question;
  knowledgeBase.splice(existingIndex, 1);

  if (db && firestoreEnabled) {
    try {
      await deleteDoc(doc(db, "knowledge_base", entryId));
    } catch (err) {
      console.error("Error deleting knowledge entry from Firestore:", err);
    }
  }

  res.json({ success: true, message: `La entrada "${entryName}" fue eliminada definitivamente de la base de conocimiento.`, knowledgeBase });
});

// Delete Order from BOTH memory and Firestore
app.post("/api/orders/:id/delete", async (req, res) => {
  const orderId = req.params.id;
  const orderIndex = orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return res.status(404).json({ success: false, error: "Pedido no encontrado en cola de memoria." });
  }

  orders.splice(orderIndex, 1);
  await deleteOrderFromFirestore(orderId);

  res.json({ success: true, message: `El pedido ${orderId} fue eliminado definitivamente del sistema experto e histórico de base de datos.`, orders });
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
        saveProductToFirestore(product); // Async save to Firestore
      } else {
        // Enforce physical rule even if warning occurred
        failureMessage = `No se puede validar aprobación física: stock de [${product.name}] se agotó antes del cierre de venta.`;
      }
    }
  });

  if (failureMessage) {
    order.status = "rejected";
    saveOrderToFirestore(order); // Save status change in Firestore
    return res.status(400).json({ success: false, error: failureMessage });
  }

  order.status = "approved";
  saveOrderToFirestore(order); // Save status change in Firestore
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
  saveOrderToFirestore(order); // Save status change in Firestore
  res.json({ success: true, message: "Pedido rechazado y archivado.", orders });
});

// Process Agent Orchestration over User Request (The Core Expert Flow!)
app.post("/api/chat", async (req, res) => {
  const { message, clientProfile, currency = "MXN", history = [], notes } = req.body;
  const tier = clientProfile?.clientTier || "standard";
  const clientName = clientProfile?.name || "Cliente Invitado";
  const clientId = clientProfile?.uid || "invitado_id";

  if (!message || message.trim() === "") {
    return res.status(400).json({ success: false, error: "Mensaje vacío" });
  }

  // Check if matches any entry in our knowledgeBase
  const norm = message.toLowerCase().trim();
  
  // Refine knowledge base exact matching to prevent aggressive short-circuit
  const isGreetingOrQuoting = norm === "hola" || norm.includes("cotiz") || norm.includes("visto bueno") || norm.includes("sí") || norm.includes("no") || norm.includes("si") || norm.includes("buenas") || norm.includes("saludos");
  const isQuotingFlowActive = history && history.length > 0 && 
    history.some((m: any) => m.sender === "agent" && (m.text.includes("¿Tu requerimiento es para un proyecto") || m.text.includes("¿Cómo se adquirirá el inventario") || m.text.includes("recomienda incluir los siguientes servicios") || m.text.includes("¿Estás de acuerdo con incluir estos servicios")));

  let kbEntry = null;

  // We only run static bypass if not in an active quoting flow and not just a greeting/quote request
  if (!isGreetingOrQuoting && !isQuotingFlowActive) {
    kbEntry = knowledgeBase.find(entry => {
      const qNorm = entry.question.toLowerCase().replace(/[¿?¡!]/g, "").trim();
      const mNorm = norm.replace(/[¿?¡!]/g, "").trim();
      // Match if identical or closely matched
      return mNorm === qNorm || mNorm.includes(qNorm) || (qNorm.length > 10 && mNorm.includes(qNorm));
    });
  }

  if (kbEntry) {
    const intent = `Consulta Base de Conocimiento (Local): ${kbEntry.question}`;
    const clientResponse = kbEntry.answer;
    const agentResults = {
      agent1: { intent, extractedItems: [], clientResponse },
      agent2: { proposedItems: [], stockWarnings: [], discountsApplied: [], suggestions: [] },
      agent3: { 
        salesSummary: "", 
        reasoningTrace: `### Rastreo de Base de Conocimiento
1. **Agente 1: Atención al Cliente (El "Front-Desk")**:
   - Identificó la consulta en la Base de Conocimiento (Entrada: ${kbEntry.id}).
   - Devolvió la respuesta autorizada directamente.
2. **Agente 2: Planificador y Cotizador**:
   - Omitido de la conversación: No se requiere cotizar hardware o estimar consultorías técnicas para respuestas corporativas predefinidas.
3. **Agente 3: Soporte Técnico y Validación**:
   - Omitido de la conversación: No requiere validación de ingeniería.`
      }
    };

    return res.json({
      success: true,
      agentResults,
      orderCreated: null,
      products,
      orders,
      isLocalFallback: false,
      onlyAgent1: true
    });
  }

  console.log(`Processing multi-agent request for Client: ${clientName} (${tier}) with target currency: ${currency}`);

  // Fetch exchange rates so calculations stay mathematically perfect
  const activeRates = { USD: 1.0, MXN: 17.50, EUR: 0.92 };
  try {
    const apiResponse = await fetch("https://open.er-api.com/v6/latest/USD");
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      if (data && data.rates) {
        activeRates.MXN = Number(data.rates.MXN || 17.50);
        activeRates.EUR = Number(data.rates.EUR || 0.94);
      }
    }
  } catch (err) {
    console.log("Using default fallback conversion rates for chat orchestrations on server.");
  }

  let agentResults;
  let isLocalFallback = false;

  if (ai) {
    try {
      const rateMultiplier = activeRates[currency as "USD" | "MXN" | "EUR"] || 1.0;
      const currencySymbol = currency === "EUR" ? "€" : "$";

      // 1. Prepare inventory description to feed AI Agent schema
      const inventoryContext = products.map(p => {
        const convertedPrice = p.price * rateMultiplier;
        return `ID: "${p.id}", Nombre: "${p.name}", Categoría: "${p.category}", Descripción: "${p.description}", Precio Unitario: ${currencySymbol}${convertedPrice.toFixed(2)} ${currency}, Stock actual en almacén: ${p.stock}, Unidad de medida: "${p.unit}"`;
      }).join("\n");

      // 1.2 Prepare knowledge base description to feed AI Agent schema
      const knowledgeContext = knowledgeBase && knowledgeBase.length > 0
        ? knowledgeBase.map(kb => `ID: "${kb.id}", Tema/Pregunta: "${kb.question}", Contenido/Respuesta: "${kb.answer}", Categoría: "${kb.category}"`).join("\n")
        : "No hay entradas guardadas adicionales en la base de conocimientos.";

      // 2. Draft the expert instruction prompt
      const systemInstruction = `Eres la suite inteligente de agentes de FIUNVA (electrónica, robótica y software). Debes procesar la entrada del cliente siguiendo un FLUJO DE CONVERSACIÓN INTERACTIVO Y SECUENCIAL de 4 etapas. Analiza detenidamente el HISTORIAL DE LA CONVERSACIÓN para determinar la etapa actual y responder consecuentemente.

**BASE DE CONOCIMIENTO Y CATÁLOGO DE FIUNVA** (Debe considerarse cargado y analizado completamente):
Puedes responder preguntas corporativas, técnicas y generales del cliente utilizando la siguiente información estructurada de la Base de Conocimiento de FIUNVA:
${knowledgeContext}

Y puedes realizar cotizaciones preliminares de componentes y servicios de ingeniería utilizando el siguiente Almacén de Inventario:
${inventoryContext}

**REGLAS IMPORTANTES DE LA BASE DE CONOCIMIENTO (CON ENFOQUE INTELIGENTE EN GEMINI)**:
- Cuando se inicie el chat o el cliente haga preguntas sobre FIUNVA o sus servicios, DEBES apoyarte en el contenido de la Base de Conocimiento arriba provista para responder de forma precisa en tu 'clientResponse'.
- Si el usuario está consultando para realizar una cotización de proyecto (Rama B), usa los componentes y servicios descritos tanto en el Almacén de Inventario como en la Base de Conocimiento adicional de FIUNVA para estimar su proyecto de manera correcta.
- Si el usuario interrumpe con preguntas de información de servicios, o quiere consultar qué servicios ofrecemos o en qué consiste uno en específico, DEBES detener de inmediato el flujo de cotización de la Rama B y responder su consulta (Rama A) directamente, sin asumir ninguna respuesta o avanzar en la cotización de proyecto.
- **PRIORIDAD ABSOLUTA DE CONSULTA ESPECÍFICA (NO BUCLE/LISTA GENERAL)**: Si el mensaje del usuario menciona, indaga o pregunta sobre un servicio o producto específico (ej: "Desarrollo de Interfaces Tipo AppWeb" o similar), debes tratarlo SIEMPRE como una "Consulta Específica" (Rama A). Está TERMINANTEMENTE PROHIBIDO responderle con el catálogo de todos los servicios o repetir el catálogo general de nuevo. Debes naturalizar la respuesta y complementar su inquietud de forma inmediata.
- **RESOLUCIÓN INTELIGENTE DE PRONOMBRES Y CONTEXTO HISTÓRICO**: Si el usuario no menciona explícitamente el nombre de un servicio, pero indica "dicho servicio", "este servicio", "ese desarrollo", "el anterior", o hace preguntas relativas de seguimiento (ej: "¿para qué proyectos lo recomiendas?", "¿en qué consiste?", "¿cuáles son sus beneficios?", "¿cuánto cuesta?"), DEBES revisar detalladamente el HISTORIAL DE LA CONVERSACIÓN para determinar cuál fue el último servicio o producto del catálogo del que se estuvo platicando. Úsalo como el sujeto de tu respuesta y responde específicamente sobre él. NUNCA respondas listando toda la gama de servicios ante estas consultas de seguimiento contextuales.

**FLUJO DE CONVERSACIÓN OBLIGATORIO**:
1. Inicio y Detección de Intención:
   - Saluda cordialmente y clasifica la intención: Rama A (Información) o Rama B (Cotización).

2. Rama A: Información de Productos y Servicios (CON RESPUESTAS INTELIGENTES NATURALIZADAS Y FALLBACK DINÁMICO COMPLETADOS POR GEMINI):
   - **Prioridad Máxima: Consulta Específica (Naturalizada y Complementada)**: Si el cliente menciona, indaga, pregunta o pide aclarar en qué consiste un servicio o producto en particular del catálogo (por ejemplo, "Desarrollo de Interfaces Tipo AppWeb" o similar):
     1. Identifica el servicio/producto correspondiente en el Almacén de Inventario.
     2. Toma la descripción provista en el catálogo como tu referencia técnica rígida.
     3. **NATURALIZA la respuesta**: No te limites a copiar y pegar textualmente de manera fría. Vierte la explicación de una forma sumamente fluida, conversacional y comprensible para el usuario.
     4. **COMPLEMENTA la respuesta**: Responde a fondo y amplía dinámicamente todo lo que el usuario esté consultando o que sea de interés para la inquietud descrita (por ejemplo, si pregunta en qué tipo de proyectos se recomendaría, infiere y detalla escenarios concretos de aplicación: paneles de administración de inventarios, interfaces para monitoreo IoT de sensores, visualizaciones en tiempo real en laboratorios, etc., así como sus beneficios clave y tecnologías ideales).
     5. Cierra preguntándole de forma amable e interactiva si le interesaría cotizar un proyecto que involucre este servicio en específico o resolver alguna duda adicional.
   - **Soporte de Investigación y Preguntas Fuera de Base de Datos**: Si el usuario realiza cualquier tipo de pregunta técnico-general (sobre ingeniería, robótica, electrónica, desarrollo de software, algoritmos, metodologías de diseño) o consultas de la marca cuyas respuestas exactas NO estén explícitamente escritas en la Base de Conocimiento o en el Almacén:
     1. **DEBES investigar, formular y responder la duda técnica utilizando tus capacidades nativas avanzadas de conocimiento técnico como Gemini**.
     2. Explica el concepto de forma clara, con un lenguaje asequible pero riguroso, y adáptalo para responder la consulta del cliente.
     3. Complementa la información explicando brevemente cómo la filosofía y servicios interdisciplinarios de FIUNVA pueden apoyarle para implementar esa tecnología práctica en la vida real.
     4. Brinda una respuesta de gran valor de consulta técnica libre de errores de persistencia, e invítalo amablemente a cotizar un desarrollo personalizado o realizar otra consulta.
   - **Consulta de Lista General de Servicios**: Si el cliente pregunta de manera estrictamente general qué servicios ofrecen, de qué trata su gama o solicita todo el catálogo de servicios de FIUNVA (y NO menciona ni indaga sobre ningún tema técnico o servicio específico del catálogo), proporciona una lista ordenada con viñetas que contenga ÚNICAMENTE los nombres de los servicios que se ofrecen actualmente del Almacén de Inventario (sin incluir ninguna descripción, explicación, detalles o precios junto a ellos) de forma limpia, y pregúntale amablemente si le gustaría saber más sobre alguno de ellos en particular o iniciar una cotización.

3. Rama B: Cotización de Proyecto (Sigue secuencialmente, haz una sola pregunta o grupo por turno de forma interactiva - no satures al usuario):
   - **Bifurcación Clave**: Haz la pregunta exactamente: "¿Tu requerimiento es para un proyecto de Diseño y Prototipado desde cero, o se trata de una Reparación/Modificación de un dispositivo o software ya existente o dañado?"
   - **Rama B.1: Reparación y Modificación (Vía Corta)**:
     1. Pide describir detalladamente la falla, la marca/modelo del equipo o tipo de software dañado, y si tiene fotos o logs del error.
     2. Muestra un Borrador preliminar estructurado con el concepto de reparación y servicios de ingeniería en una tabla detallada con precios fijos para Servicio de Diagnóstico (35.0 USD) y Reparación (120.0 USD) convertidos a la divisa activa con el descuento tier aplicable, subtotal, IVA 16% y total. Solicita su Visto Bueno.
   - **Rama B.2: Diseño y Prototipado desde Cero (Vía Larga y Detallada - Haz estas preguntas una por una en turnos separados)**:
     - *Paso B.2.1: Concepto General*: Pide describir el concepto principal y objetivo.
     - *Paso B.2.2: Filtro Secuencial por Áreas (Haz las preguntas individuales, una a la vez)*:
       * **REGLA DE EVITACIÓN DE ESTRÉS / SMART SKIPPING**: Evalúa minuciosamente si el cliente ya contestó implícita o explícitamente alguna categoría en turnos previos. De ser así, OMITE esa pregunta, confírmalo de forma entusiaste y avanza a la siguiente pregunta técnica que falte.
       * Pregunta 1 (Electrónica): "* 🎛️ **Electrónica:** ¿Qué voltaje de alimentación tienes pensado emplear? ¿Tienes preferencia por algún microcontrolador (Arduino, ESP32, STM32) y qué tipo de comunicación requieres (WiFi, Bluetooth, LoRa)?"
       * Pregunta 2 (Software): "* 💻 **Software:** ¿Dónde se visualizará el sistema (App móvil, plataforma web, software de escritorio)? ¿Tienes preferencia por algún lenguaje de programación o base de datos?"
       * Pregunta 3 (Robótica/Mecánica): "* 🤖 **Robótica/Mecánica (Si aplica):** ¿Qué tipo de actuadores o motores necesitas? ¿Hay restricciones de tamaño o peso?"
     - *Paso B.2.3: Selección de Servicios*: Query del catálogo y sugiere servicios afines (PCB Express, Desarrollo de firmware, Consultoría de software) preguntando si les gustaría incluirlos.
     - *Paso B.2.4: Inventario de Materiales*: Pregunta cómo conseguir componentes (si el cliente ya los tiene, si tiene algunos y FIUNVA aporta el resto -pidiendo la lista de lo que tiene-, o si FIUNVA aporta el 100%).
     - *Paso B.2.5: Generación del Borrador*: Muestra un borrador preliminar estructurado en el chat con Concepto Acordado, Materiales e insumos, y una tabla de cotización preliminar detallada consultando la base de servicios cargados y la base de componentes y precios en el Almacén de Inventario para incluir los servicios correspondientes y los componentes físicos detectados o solicitados (con sus precios correspondientes convertidos y con el descuento tier del perfil si FIUNVA aporta parte o el 100%). Incluye subtotal, IVA 16% y total. Solicita su Visto Bueno.

4. Cierre y Seguimiento (Cuando el usuario dé su Visto Bueno al borrador):
   - Genera un ID exclusivo que empiece con "PROY-2026-" de 3 dígitos (ej: PROY-2026-482).
   - Registra en proposedItems los servicios de ingeniería preliminares mapeados del catálogo junto con sus subtotales (por ejemplo, 'pcb_express' o 'consultoria_tecnica') indicando que se guarde como orden 'pending_approval' para validación comercial.
   - Informa al cliente que se le ha asignado el estatus "Pendiente de Cotización Final / En Revisión Técnica" y se generará un reporte de integridad técnica.

**DIVISA ACTIVA**: Opera rígidamente en la divisa **${currency}** (Símbolo: ${currencySymbol}).

Devuelve tu respuesta estructurada exactamente en formato JSON de acuerdo al esquema:`;

      // 3. Set Schema for structural JSON output
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          agent1: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, description: `Declaración limpia del propósito del cliente expresada en la moneda activa ${currency}` },
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
                    unitPrice: { type: Type.NUMBER, description: `Precio unitario convertido a la divisa activa: ${currency}` },
                    discountApplied: { type: Type.NUMBER, description: "Porcentaje exacto de descuento que aplica (del 0 al 15)." },
                    subtotal: { type: Type.NUMBER, description: `Cálculo exacto del subtotal con descuento en la divisa activa: ${currency}` }
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
              salesSummary: { type: Type.STRING, description: `Resumen pulido del pedido final formateado con tablas de Markdown y subtotales e impuestos expresados en ${currency}.` },
              reasoningTrace: { type: Type.STRING, description: `Explicación detallada de la inferencia, reglas de negocio y precios web expresados en la divisa activa: ${currency}.` }
            },
            required: ["salesSummary", "reasoningTrace"]
          }
        },
        required: ["agent1", "agent2", "agent3"]
      };

      const userContextPrompt = `HISTORIAL DE LA CONVERSACIÓN:
${history && history.length > 0 
  ? history.map((m: any) => `${m.sender === "client" ? "Cliente" : "Agente"}: ${m.text}`).join("\n") 
  : "No hay historial previo."}

ÚLTIMA RESPUESTA DEL CLIENTE: "${message}"

PROPIEDADES DE ENTRADA ADICIONALES:
- Perfil del Cliente: { Nombre: "${clientName}", Email: "${clientProfile?.email}", Tier: "${tier}" }
- Divisa Seleccionada: "${currency}"

ALMACÉN DE INVENTARIO CENTRAL (FIUNVA) CON PRECIOS YA CONVERTIDOS A ${currency}:
${inventoryContext}

Instrucción de Respuesta:
1. Lee minuciosamente el HISTORIAL DE LA CONVERSACIÓN para determinar la fase actual del flujo interactivo.
2. Genera la respuesta colaborativa en JSON según las reglas de negocio en la divisa ${currency}. Asegura cálculos matemáticos exactos en esta divisa.`;

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
      agentResults = simulateExpertSystem(message, tier, currency, activeRates, history);
      isLocalFallback = true;
    }
  } else {
    // Missing API key - Run high fidelity simulator locally
    agentResults = simulateExpertSystem(message, tier, currency, activeRates, history);
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
      notes: notes || undefined,
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
    saveOrderToFirestore(newOrder); // Persist order to Firestore
  }

  const onlyAgent1 = pItems.length === 0;
  if (onlyAgent1 && agentResults && agentResults.agent3) {
    agentResults.agent3.salesSummary = "";
  }

  res.json({
    success: true,
    agentResults,
    orderCreated: newOrder,
    products,
    orders,
    isLocalFallback,
    onlyAgent1
  });
});

// ==========================================
// VITE OR STATIC FRONTEND SERVING
// ==========================================

async function startServer() {
  loadUsersFromFiles();
  // Sync and seed with Firestore DB before starting the routes
  await initializeFirestore();

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
