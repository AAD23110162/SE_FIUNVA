/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "client" | "operator" | "admin";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  clientTier: "standard" | "frequent" | "vip";
}

export interface Product {
  id: string;
  name: string;
  category: "electronics" | "robotics" | "software_service" | "bundles";
  description: string;
  price: number;
  stock: number;
  unit: string;
  webReference?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountApplied: number; // percentage (0 to 100)
  subtotal: number;
}

export interface Order {
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
    reasoningTrace: string; // Explanations from Agente 3
  };
}

export interface Message {
  id: string;
  sender: "client" | "agent";
  text: string;
  timestamp: string;
  extractedInfo?: {
    intent: string;
    items: { product: string; quantity: number }[];
    requirements?: string[];
  };
}

export interface AgentStep {
  agentName: "Atención al Cliente" | "Generador de Pedido" | "Supervisor Explicador";
  status: "idle" | "thinking" | "completed" | "error";
  output: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  totalOrders: number;
  approvedOrders: number;
  pendingValidation: number;
  totalCalculatedValue: number;
}
