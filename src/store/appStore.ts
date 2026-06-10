import { create } from 'zustand';
import {
  Product, Supplier, PurchaseOrder, SupplierQuote, WarehouseReceipt,
  StockRecord, StockMovement, SalesOrder, Shipment, Payable, StockRisk,
  PurchaseItem, ReceiptItem, QCResult, ShippingStatus, LogisticsNode,
  SalesOrderItem, ShipmentItem, QuoteItem
} from '../types';
import {
  mockProducts, mockSuppliers, mockPurchaseOrders, mockQuotes, mockReceipts,
  mockStockRecords, mockStockMovements, mockSalesOrders, mockShipments,
  mockPayables, mockStockRisks
} from '../data/mockData';

interface AppState {
  products: Product[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  quotes: SupplierQuote[];
  receipts: WarehouseReceipt[];
  stockRecords: StockRecord[];
  stockMovements: StockMovement[];
  salesOrders: SalesOrder[];
  shipments: Shipment[];
  payables: Payable[];
  stockRisks: StockRisk[];

  addPurchaseOrder: (order: Omit<PurchaseOrder, 'id' | 'orderNo' | 'createTime' | 'status'>) => void;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
  acceptQuote: (quoteId: string) => void;

  addQuote: (quote: Omit<SupplierQuote, 'id' | 'submitTime' | 'status'>) => void;

  addReceipt: (receipt: Omit<WarehouseReceipt, 'id' | 'receiptNo'>) => void;

  allocateStock: (salesOrderId: string, allocations: { productId: string; qty: number }[]) => void;
  releaseAllocation: (salesOrderId: string) => void;

  createShipment: (salesOrderId: string, shipmentData: {
    items: { productId: string; qty: number }[];
    carrier: string;
    trackingNo?: string;
  }) => void;
  updateShipmentStatus: (shipmentId: string, status: ShippingStatus, node: LogisticsNode) => void;

  addPayment: (payableId: string, payment: { amount: number; method: string; reference?: string; remark?: string }) => void;

  recalculateStockRisks: () => void;
}

const generateId = (prefix: string, length = 3) => {
  const num = Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
  return `${prefix}${num}`;
};

const generateOrderNo = (prefix: string, date: Date, seq: number) => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const s = seq.toString().padStart(3, '0');
  return `${prefix}-${y}-${m}-${s}`;
};

const today = () => {
  const d = new Date();
  return d.toISOString().split('T')[0] + ' ' + d.toTimeString().split(' ')[0];
};

export const useAppStore = create<AppState>((set, get) => ({
  products: mockProducts,
  suppliers: mockSuppliers,
  purchaseOrders: mockPurchaseOrders,
  quotes: mockQuotes,
  receipts: mockReceipts,
  stockRecords: mockStockRecords,
  stockMovements: mockStockMovements,
  salesOrders: mockSalesOrders,
  shipments: mockShipments,
  payables: mockPayables,
  stockRisks: mockStockRisks,

  addPurchaseOrder: (orderData) => set((state) => {
    const now = new Date();
    const seq = state.purchaseOrders.filter(p => {
      const d = new Date(p.createTime);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length + 1;
    const newOrder: PurchaseOrder = {
      ...orderData,
      id: generateId('PO'),
      orderNo: generateOrderNo('PO', now, seq),
      createTime: today(),
      status: orderData.items.some(i => i.unitPrice) ? 'confirmed' : (orderData.supplierId ? 'quoted' : 'draft'),
      items: orderData.items.map(i => ({ ...i, receivedQty: 0, acceptedQty: 0, rejectedQty: 0 })),
    };
    return { purchaseOrders: [newOrder, ...state.purchaseOrders] };
  }),

  updatePurchaseOrder: (id, updates) => set((state) => ({
    purchaseOrders: state.purchaseOrders.map(p =>
      p.id === id ? { ...p, ...updates } : p
    )
  })),

  acceptQuote: (quoteId) => set((state) => {
    const quote = state.quotes.find(q => q.id === quoteId);
    if (!quote) return state;

    const updatedQuotes = state.quotes.map(q =>
      q.purchaseOrderId === quote.purchaseOrderId
        ? { ...q, status: q.id === quoteId ? 'accepted' as const : 'rejected' as const }
        : q
    );

    const updatedPO = state.purchaseOrders.find(p => p.id === quote.purchaseOrderId);
    if (!updatedPO) return { quotes: updatedQuotes };

    const poItems: PurchaseItem[] = quote.items.map(qi => {
      const existing = updatedPO.items.find(i => i.productId === qi.productId);
      return {
        productId: qi.productId,
        productName: qi.productName,
        sku: qi.sku,
        quantity: qi.quantity,
        unitPrice: qi.unitPrice,
        receivedQty: existing?.receivedQty || 0,
        acceptedQty: existing?.acceptedQty || 0,
        rejectedQty: existing?.rejectedQty || 0,
      };
    });

    const totalAmount = quote.items.reduce((s, i) => s + i.subtotal, 0);

    return {
      quotes: updatedQuotes,
      purchaseOrders: state.purchaseOrders.map(p =>
        p.id === quote.purchaseOrderId
          ? {
              ...p,
              status: 'confirmed',
              supplierId: quote.supplierId,
              supplierName: quote.supplierName,
              items: poItems,
              totalAmount,
              confirmedDate: today().split(' ')[0],
            }
          : p
      )
    };
  }),

  addQuote: (quoteData) => set((state) => {
    const newQuote: SupplierQuote = {
      ...quoteData,
      id: generateId('Q'),
      submitTime: today(),
      status: 'submitted',
    };
    return { quotes: [...state.quotes, newQuote] };
  }),

  addReceipt: (receiptData) => set((state) => {
    const now = new Date();
    const seq = state.receipts.filter(r => {
      const d = new Date(r.receivedDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length + 1;

    const newReceipt: WarehouseReceipt = {
      ...receiptData,
      id: generateId('R'),
      receiptNo: generateOrderNo('RCV', now, seq),
    };

    let updatedStockRecords = [...state.stockRecords];
    const newMovements: StockMovement[] = [];

    newReceipt.items.forEach(item => {
      const idx = updatedStockRecords.findIndex(s => s.productId === item.productId);
      const beforeQty = idx >= 0 ? updatedStockRecords[idx].quantity : 0;
      const afterQty = beforeQty + item.acceptedQty;

      if (idx >= 0) {
        const old = updatedStockRecords[idx];
        const newTotalValue = old.totalValue + item.acceptedQty * item.unitPrice;
        const newAvgPrice = newTotalValue / afterQty;
        updatedStockRecords[idx] = {
          ...old,
          quantity: afterQty,
          unitPrice: newAvgPrice,
          totalValue: newTotalValue,
          lastUpdated: newReceipt.receivedDate,
        };
      } else {
        const product = state.products.find(p => p.id === item.productId);
        updatedStockRecords.push({
          id: generateId('ST'),
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          category: product?.category || '',
          warehouse: newReceipt.warehouse,
          quantity: item.acceptedQty,
          unit: product?.unit || '件',
          unitPrice: item.unitPrice,
          totalValue: item.acceptedQty * item.unitPrice,
          lastUpdated: newReceipt.receivedDate,
          allocatedQty: 0,
          reservedQty: 0,
        });
      }

      newMovements.push({
        id: generateId('M'),
        date: newReceipt.receivedDate,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        type: 'in',
        quantity: item.acceptedQty,
        beforeQty,
        afterQty,
        unitPrice: item.unitPrice,
        referenceType: '入库单',
        referenceNo: newReceipt.receiptNo,
        warehouse: newReceipt.warehouse,
        operator: newReceipt.receiver,
        remark: '采购入库',
      });
    });

    const po = state.purchaseOrders.find(p => p.id === newReceipt.purchaseOrderId);
    let updatedPOs = state.purchaseOrders;
    if (po) {
      const newItems = po.items.map(pi => {
        const ri = newReceipt.items.find(i => i.productId === pi.productId);
        if (ri) {
          return {
            ...pi,
            receivedQty: (pi.receivedQty || 0) + ri.actualQty,
            acceptedQty: (pi.acceptedQty || 0) + ri.acceptedQty,
            rejectedQty: (pi.rejectedQty || 0) + ri.rejectedQty,
          };
        }
        return pi;
      });
      const allReceived = newItems.every(i => (i.receivedQty || 0) >= i.quantity);
      const newStatus = allReceived ? 'completed' : 'partial_received';
      updatedPOs = state.purchaseOrders.map(p =>
        p.id === po.id ? { ...p, items: newItems, status: newStatus } : p
      );
    }

    const seqAP = state.payables.filter(ap => {
      const d = new Date(ap.billDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length + 1;

    const newPayable: Payable = {
      id: generateId('AP'),
      billNo: generateOrderNo('AP', now, seqAP),
      purchaseOrderId: newReceipt.purchaseOrderId,
      purchaseOrderNo: newReceipt.purchaseOrderNo,
      receiptId: newReceipt.id,
      receiptNo: newReceipt.receiptNo,
      supplierId: newReceipt.supplierId,
      supplierName: newReceipt.supplierName,
      billDate: newReceipt.receivedDate,
      dueDate: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      totalAmount: newReceipt.totalAmount,
      paidAmount: 0,
      unpaidAmount: newReceipt.totalAmount,
      status: 'unpaid',
      items: newReceipt.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        quantity: i.acceptedQty,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      payments: [],
    };

    return {
      receipts: [newReceipt, ...state.receipts],
      stockRecords: updatedStockRecords,
      stockMovements: [...newMovements, ...state.stockMovements],
      purchaseOrders: updatedPOs,
      payables: [newPayable, ...state.payables],
    };
  }),

  allocateStock: (salesOrderId, allocations) => set((state) => {
    const so = state.salesOrders.find(s => s.id === salesOrderId);
    if (!so) return state;

    let updatedStocks = [...state.stockRecords];
    const newMovements: StockMovement[] = [];

    const updatedItems = so.items.map(item => {
      const alloc = allocations.find(a => a.productId === item.productId);
      if (!alloc) return item;

      const stockIdx = updatedStocks.findIndex(s => s.productId === item.productId);
      if (stockIdx >= 0) {
        const stock = updatedStocks[stockIdx];
        const available = stock.quantity - (stock.allocatedQty || 0);
        const actualAlloc = Math.min(alloc.qty, available, item.quantity - (item.allocatedQty || 0));

        updatedStocks[stockIdx] = {
          ...stock,
          allocatedQty: (stock.allocatedQty || 0) + actualAlloc,
          lastUpdated: today().split(' ')[0],
        };

        newMovements.push({
          id: generateId('M'),
          date: today().split(' ')[0],
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          type: 'allocate',
          quantity: actualAlloc,
          beforeQty: stock.quantity,
          afterQty: stock.quantity,
          unitPrice: stock.unitPrice,
          referenceType: '销售订单',
          referenceNo: so.orderNo,
          warehouse: stock.warehouse,
          operator: '系统',
          remark: '库存分配',
        });

        return { ...item, allocatedQty: (item.allocatedQty || 0) + actualAlloc };
      }
      return item;
    });

    const allAllocated = updatedItems.every(i => (i.allocatedQty || 0) >= i.quantity);
    const anyAllocated = updatedItems.some(i => (i.allocatedQty || 0) > 0);
    const newStatus = allAllocated ? 'allocated' : (anyAllocated ? 'partially_allocated' : so.status);

    return {
      salesOrders: state.salesOrders.map(s =>
        s.id === salesOrderId ? { ...s, items: updatedItems, status: newStatus } : s
      ),
      stockRecords: updatedStocks,
      stockMovements: [...newMovements, ...state.stockMovements],
    };
  }),

  releaseAllocation: (salesOrderId) => set((state) => {
    const so = state.salesOrders.find(s => s.id === salesOrderId);
    if (!so) return state;

    let updatedStocks = [...state.stockRecords];

    so.items.forEach(item => {
      const allocQty = item.allocatedQty || 0;
      if (allocQty > 0) {
        const stockIdx = updatedStocks.findIndex(s => s.productId === item.productId);
        if (stockIdx >= 0) {
          updatedStocks[stockIdx] = {
            ...updatedStocks[stockIdx],
            allocatedQty: (updatedStocks[stockIdx].allocatedQty || 0) - allocQty,
          };
        }
      }
    });

    return {
      salesOrders: state.salesOrders.map(s =>
        s.id === salesOrderId
          ? { ...s, items: s.items.map(i => ({ ...i, allocatedQty: 0 })), status: 'pending_allocation' }
          : s
      ),
      stockRecords: updatedStocks,
    };
  }),

  createShipment: (salesOrderId, shipmentData) => set((state) => {
    const so = state.salesOrders.find(s => s.id === salesOrderId);
    if (!so) return state;

    const now = new Date();
    const seq = state.shipments.filter(sh => {
      const d = new Date(sh.createTime);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length + 1;

    const shipmentItems: ShipmentItem[] = shipmentData.items.map(si => {
      const soi = so.items.find(i => i.productId === si.productId);
      const stock = state.stockRecords.find(s => s.productId === si.productId);
      return {
        productId: si.productId,
        productName: soi?.productName || '',
        sku: soi?.sku || '',
        quantity: si.qty,
        unit: stock?.unit || '件',
        unitPrice: soi?.unitPrice || 0,
        subtotal: (soi?.unitPrice || 0) * si.qty,
        warehouse: stock?.warehouse || '',
      };
    });

    const totalAmount = shipmentItems.reduce((s, i) => s + i.subtotal, 0);

    const initialNode: LogisticsNode = {
      time: today(),
      status: '已创建',
      location: '公司仓库',
      description: '创建发货单，准备拣货',
      operator: '周仓管',
    };

    const newShipment: Shipment = {
      id: generateId('SH'),
      shipmentNo: generateOrderNo('SHP', now, seq),
      salesOrderId: so.id,
      salesOrderNo: so.orderNo,
      items: shipmentItems,
      totalAmount,
      customerName: so.customerName,
      shippingAddress: so.shippingAddress,
      receiverContact: so.customerContact,
      receiverPhone: so.customerPhone,
      carrier: shipmentData.carrier,
      trackingNo: shipmentData.trackingNo,
      createTime: today(),
      status: 'created',
      logistics: [initialNode],
      warehouse: shipmentItems[0]?.warehouse || '',
      operator: '周仓管',
    };

    let updatedStocks = [...state.stockRecords];
    const newMovements: StockMovement[] = [];

    const updatedSOItems = so.items.map(item => {
      const si = shipmentData.items.find(s => s.productId === item.productId);
      if (!si) return item;

      const stockIdx = updatedStocks.findIndex(s => s.productId === item.productId);
      if (stockIdx >= 0) {
        const stock = updatedStocks[stockIdx];
        const beforeQty = stock.quantity;
        const afterQty = beforeQty - si.qty;

        updatedStocks[stockIdx] = {
          ...stock,
          quantity: afterQty,
          allocatedQty: Math.max(0, (stock.allocatedQty || 0) - si.qty),
          totalValue: stock.unitPrice * afterQty,
          lastUpdated: today().split(' ')[0],
        };

        newMovements.push({
          id: generateId('M'),
          date: today().split(' ')[0],
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          type: 'out',
          quantity: si.qty,
          beforeQty,
          afterQty,
          unitPrice: stock.unitPrice,
          referenceType: '发货单',
          referenceNo: newShipment.shipmentNo,
          warehouse: stock.warehouse,
          operator: '周仓管',
          remark: '销售发货',
        });
      }

      return {
        ...item,
        allocatedQty: Math.max(0, (item.allocatedQty || 0) - si.qty),
        shippedQty: (item.shippedQty || 0) + si.qty,
      };
    });

    const allShipped = updatedSOItems.every(i => (i.shippedQty || 0) >= i.quantity);
    const partialShipped = updatedSOItems.some(i => (i.shippedQty || 0) > 0);
    let soStatus: typeof so.status = so.status;
    if (allShipped) soStatus = 'shipped';
    else if (partialShipped) soStatus = 'partial_shipped';
    else if (updatedSOItems.every(i => (i.allocatedQty || 0) >= i.quantity)) soStatus = 'allocated';
    else if (updatedSOItems.some(i => (i.allocatedQty || 0) > 0)) soStatus = 'partially_allocated';

    return {
      shipments: [newShipment, ...state.shipments],
      stockRecords: updatedStocks,
      stockMovements: [...newMovements, ...state.stockMovements],
      salesOrders: state.salesOrders.map(s =>
        s.id === salesOrderId ? { ...s, items: updatedSOItems, status: soStatus } : s
      ),
    };
  }),

  updateShipmentStatus: (shipmentId, status, node) => set((state) => ({
    shipments: state.shipments.map(sh =>
      sh.id === shipmentId
        ? {
            ...sh,
            status,
            logistics: [...sh.logistics, { ...node, time: today() }],
            shipTime: ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(status) && !sh.shipTime
              ? today() : sh.shipTime,
            actualArrival: status === 'delivered' ? today() : sh.actualArrival,
          }
        : sh
    )
  })),

  addPayment: (payableId, payment) => set((state) => {
    const ap = state.payables.find(p => p.id === payableId);
    if (!ap) return state;

    const paidAmount = ap.paidAmount + payment.amount;
    const unpaidAmount = ap.totalAmount - paidAmount;
    const status = unpaidAmount <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');

    return {
      payables: state.payables.map(p =>
        p.id === payableId
          ? {
              ...p,
              paidAmount,
              unpaidAmount,
              status,
              payments: [...p.payments, { ...payment, date: today().split(' ')[0] }],
            }
          : p
      )
    };
  }),

  recalculateStockRisks: () => set((state) => {
    const risks = state.products.map(p => {
      const stock = state.stockRecords.find(s => s.productId === p.id);
      const currentStock = stock?.quantity || 0;
      const allocatedQty = stock?.allocatedQty || 0;
      const availableQty = currentStock - allocatedQty;

      const pendingPOItems = state.purchaseOrders
        .filter(po => ['confirmed', 'partial_received'].includes(po.status))
        .flatMap(po => po.items)
        .filter(i => i.productId === p.id);
      const pendingPurchaseQty = pendingPOItems.reduce((s, i) => s + (i.quantity - (i.receivedQty || 0)), 0);

      const outMovements = state.stockMovements
        .filter(m => m.productId === p.id && m.type === 'out');
      const last30DaysConsumption = outMovements.reduce((s, m) => s + m.quantity, 0);
      const avgDailyConsumption = last30DaysConsumption / 30;
      const estimatedDaysLeft = avgDailyConsumption > 0 ? Math.floor(availableQty / avgDailyConsumption) : 999;

      const affectedOrders = state.salesOrders
        .filter(so => ['pending_allocation', 'partially_allocated'].includes(so.status))
        .filter(so => so.items.some(i => i.productId === p.id && (i.allocatedQty || 0) < i.quantity))
        .map(so => so.orderNo);

      let riskLevel: StockRisk['riskLevel'] = 'normal';
      if (availableQty < p.safetyStock * 0.3 || estimatedDaysLeft < 3) riskLevel = 'critical';
      else if (availableQty < p.safetyStock || estimatedDaysLeft < 7) riskLevel = 'warning';

      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        category: p.category,
        currentStock,
        safetyStock: p.safetyStock,
        allocatedQty,
        availableQty,
        pendingPurchaseQty,
        riskLevel,
        last30DaysConsumption,
        estimatedDaysLeft,
        affectedOrders,
      };
    }).filter(r => r.riskLevel !== 'normal' || r.affectedOrders.length > 0);

    return { stockRisks: risks.sort((a, b) => {
      const order = { critical: 0, warning: 1, normal: 2 };
      return order[a.riskLevel] - order[b.riskLevel];
    }) };
  }),
}));
