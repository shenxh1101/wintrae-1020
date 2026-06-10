export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  safetyStock: number;
  spec?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  rating: number;
  paymentTerms: string;
}

export type PurchaseStatus = 'draft' | 'pending_quote' | 'quoted' | 'confirmed' | 'partial_received' | 'completed' | 'cancelled';

export interface PurchaseItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice?: number;
  receivedQty?: number;
  acceptedQty?: number;
  rejectedQty?: number;
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  title: string;
  requester: string;
  department: string;
  createTime: string;
  requiredDate: string;
  confirmedDate?: string;
  supplierId?: string;
  supplierName?: string;
  items: PurchaseItem[];
  totalAmount?: number;
  status: PurchaseStatus;
  remark?: string;
}

export interface QuoteItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  leadTime: number;
}

export type QuoteStatus = 'pending' | 'submitted' | 'accepted' | 'rejected';

export interface SupplierQuote {
  id: string;
  purchaseOrderId: string;
  purchaseOrderNo: string;
  supplierId: string;
  supplierName: string;
  items: QuoteItem[];
  totalAmount: number;
  taxAmount?: number;
  shippingFee?: number;
  validUntil: string;
  submitTime: string;
  status: QuoteStatus;
  remark?: string;
}

export type QCResult = 'pass' | 'fail' | 'partial';

export interface ReceiptItem {
  productId: string;
  productName: string;
  sku: string;
  expectedQty: number;
  actualQty: number;
  acceptedQty: number;
  rejectedQty: number;
  qcResult: QCResult;
  qcRemark?: string;
  unitPrice: number;
  subtotal: number;
}

export interface WarehouseReceipt {
  id: string;
  receiptNo: string;
  purchaseOrderId: string;
  purchaseOrderNo: string;
  supplierId: string;
  supplierName: string;
  items: ReceiptItem[];
  totalAmount: number;
  receivedDate: string;
  warehouse: string;
  receiver: string;
  inspector: string;
  remark?: string;
}

export interface StockRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  warehouse: string;
  location?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  lastUpdated: string;
  allocatedQty?: number;
  reservedQty?: number;
}

export type StockMovementType = 'in' | 'out' | 'adjust' | 'transfer' | 'allocate' | 'release';

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  unitPrice: number;
  referenceType: string;
  referenceNo: string;
  warehouse: string;
  operator: string;
  remark?: string;
}

export type SalesOrderStatus = 'pending_allocation' | 'partially_allocated' | 'allocated' | 'partial_shipped' | 'shipped' | 'completed' | 'cancelled';

export interface SalesOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  allocatedQty?: number;
  shippedQty?: number;
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  customerName: string;
  customerContact: string;
  customerPhone: string;
  shippingAddress: string;
  createTime: string;
  requiredDate: string;
  items: SalesOrderItem[];
  totalAmount: number;
  status: SalesOrderStatus;
  remark?: string;
}

export type ShippingStatus = 'created' | 'picking' | 'packed' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';

export interface ShipmentItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  warehouse: string;
}

export interface LogisticsNode {
  time: string;
  status: string;
  location: string;
  description: string;
  operator?: string;
}

export interface Shipment {
  id: string;
  shipmentNo: string;
  salesOrderId: string;
  salesOrderNo: string;
  items: ShipmentItem[];
  totalAmount: number;
  customerName: string;
  shippingAddress: string;
  receiverContact: string;
  receiverPhone: string;
  carrier: string;
  trackingNo?: string;
  createTime: string;
  shipTime?: string;
  estimatedArrival?: string;
  actualArrival?: string;
  status: ShippingStatus;
  logistics: LogisticsNode[];
  warehouse: string;
  operator: string;
  remark?: string;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Payable {
  id: string;
  billNo: string;
  purchaseOrderId: string;
  purchaseOrderNo: string;
  receiptId?: string;
  receiptNo?: string;
  supplierId: string;
  supplierName: string;
  billDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  status: PaymentStatus;
  items: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  payments: {
    date: string;
    amount: number;
    method: string;
    reference?: string;
    remark?: string;
  }[];
  remark?: string;
}

export interface StockRisk {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  currentStock: number;
  safetyStock: number;
  allocatedQty: number;
  availableQty: number;
  pendingPurchaseQty: number;
  riskLevel: 'normal' | 'warning' | 'critical';
  last30DaysConsumption: number;
  estimatedDaysLeft: number;
  affectedOrders: string[];
}

export interface MonthlyPurchaseStat {
  month: string;
  orderCount: number;
  totalAmount: number;
  itemCount: number;
  supplierCount: number;
  receiptCount: number;
  receiptAmount: number;
  onTimeRate: number;
}

export interface StockTurnoverStat {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  beginningStock: number;
  endingStock: number;
  avgStock: number;
  inQty: number;
  outQty: number;
  turnoverRate: number;
  turnoverDays: number;
  inAmount: number;
  outAmount: number;
}

export type WindowKey = 'purchase' | 'quote' | 'receipt' | 'stock' | 'shipping' | 'reconciliation';
