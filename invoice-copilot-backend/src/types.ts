export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPct?: number;
}

export interface InvoiceDraft {
  id: string;
  issuer: {
    name: string;
    walletAddress?: string;
    gstin?: string;
  };
  payer: {
    name: string;
    walletAddress?: string;
    email?: string;
  };
  items: InvoiceLineItem[];
  currency: string;
  issuedAt: string;
  dueDate?: string;
  notes?: string;
  paymentRail?: 'x402' | 'mpp' | 'erc8004' | 'manual';
  milestones?: { label: string; amount: number; releaseCondition?: string }[];
  // derived
  subtotal?: number;
  tax?: number;
  total?: number;
}

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export interface StorageReceipt {
  provider: 'pinata' | 'lighthouse' | 'local';
  cid: string;
  size: number;
  dealId?: string;
  gatewayUrl: string;
}

export interface AnchorReceipt {
  invoiceId: string; // bytes32 hex
  chainId: number;
  txHash: string;
  blockNumber?: number;
  registry: string;
}

export interface PaymentRequest {
  invoiceId: string;
  rail: 'x402' | 'mpp' | 'erc8004';
  amount: number;
  currency: string;
  payer?: string;
  payee?: string;
  milestones?: { label: string; amount: number }[];
  metadata?: Record<string, unknown>;
}

export interface PaymentReceipt {
  rail: 'x402' | 'mpp' | 'erc8004';
  status: 'pending' | 'settled' | 'failed';
  txRef: string;
  explorerUrl?: string;
  createdAt: string;
  raw?: unknown;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentTurn {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}
