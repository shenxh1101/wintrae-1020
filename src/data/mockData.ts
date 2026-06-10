import {
  Product, Supplier, PurchaseOrder, SupplierQuote, WarehouseReceipt,
  StockRecord, StockMovement, SalesOrder, Shipment, Payable, StockRisk
} from '../types';

export const mockProducts: Product[] = [
  { id: 'P001', name: '不锈钢法兰 DN50', sku: 'FLG-SS-001', category: '管道配件', unit: '件', safetyStock: 100, spec: 'DN50, 304不锈钢' },
  { id: 'P002', name: '不锈钢法兰 DN80', sku: 'FLG-SS-002', category: '管道配件', unit: '件', safetyStock: 80, spec: 'DN80, 304不锈钢' },
  { id: 'P003', name: '球阀 DN25', sku: 'VL-BV-001', category: '阀门', unit: '只', safetyStock: 50, spec: 'DN25, 丝扣连接' },
  { id: 'P004', name: '球阀 DN50', sku: 'VL-BV-002', category: '阀门', unit: '只', safetyStock: 30, spec: 'DN50, 法兰连接' },
  { id: 'P005', name: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', category: '管材', unit: '米', safetyStock: 200, spec: '304不锈钢, 6m/根' },
  { id: 'P006', name: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', category: '管材', unit: '米', safetyStock: 150, spec: '304不锈钢, 6m/根' },
  { id: 'P007', name: '压力表 0-1.6MPa', sku: 'INS-PG-001', category: '仪器仪表', unit: '只', safetyStock: 20, spec: 'Y-100, 径向' },
  { id: 'P008', name: '温度传感器 PT100', sku: 'INS-TS-001', category: '仪器仪表', unit: '只', safetyStock: 25, spec: 'WZP-230, L=150mm' },
  { id: 'P009', name: '电机 1.5kW', sku: 'MOT-001', category: '机电设备', unit: '台', safetyStock: 10, spec: 'YE3-90S-4, B3安装' },
  { id: 'P010', name: '减速机 RV50', sku: 'RD-001', category: '机电设备', unit: '台', safetyStock: 8, spec: '速比1:30, 输入孔14mm' },
];

export const mockSuppliers: Supplier[] = [
  { id: 'S001', name: '上海华晨管件有限公司', contact: '张经理', phone: '13800138001', email: 'zhang@huacheng.com', address: '上海市嘉定区工业园88号', rating: 5, paymentTerms: '月结30天' },
  { id: 'S002', name: '浙江精工阀门制造有限公司', contact: '李总监', phone: '13800138002', email: 'li@jinggong.com', address: '浙江省温州市瓯海区阀门基地A栋', rating: 4, paymentTerms: '月结45天' },
  { id: 'S003', name: '江苏恒通不锈钢制品厂', contact: '王厂长', phone: '13800138003', email: 'wang@hengtong.com', address: '江苏省泰州市姜堰区不锈钢产业园', rating: 4, paymentTerms: '月结30天' },
  { id: 'S004', name: '深圳市精密仪器有限公司', contact: '陈工程师', phone: '13800138004', email: 'chen@jingmi.com', address: '深圳市南山区科技园北区15栋', rating: 5, paymentTerms: '款到发货' },
  { id: 'S005', name: '苏州德创机电设备有限公司', contact: '刘总', phone: '13800138005', email: 'liu@dechuang.com', address: '苏州市工业园区金鸡湖大道268号', rating: 4, paymentTerms: '月结60天' },
];

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO001', orderNo: 'PO-2026-06-001', title: '六月份管道配件采购', requester: '赵采购', department: '采购部',
    createTime: '2026-06-01 09:00:00', requiredDate: '2026-06-15',
    items: [
      { productId: 'P001', productName: '不锈钢法兰 DN50', sku: 'FLG-SS-001', quantity: 200, unitPrice: 45, receivedQty: 200, acceptedQty: 195, rejectedQty: 5 },
      { productId: 'P002', productName: '不锈钢法兰 DN80', sku: 'FLG-SS-002', quantity: 150, unitPrice: 78, receivedQty: 150, acceptedQty: 150, rejectedQty: 0 },
    ],
    supplierId: 'S001', supplierName: '上海华晨管件有限公司',
    totalAmount: 20700, status: 'completed', confirmedDate: '2026-06-02',
    remark: '用于客户订单SO-2026-06-001'
  },
  {
    id: 'PO002', orderNo: 'PO-2026-06-002', title: '阀门紧急采购', requester: '钱采购', department: '采购部',
    createTime: '2026-06-03 14:30:00', requiredDate: '2026-06-10',
    items: [
      { productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', quantity: 100, unitPrice: 65, receivedQty: 100, acceptedQty: 100, rejectedQty: 0 },
      { productId: 'P004', productName: '球阀 DN50', sku: 'VL-BV-002', quantity: 60, unitPrice: 180, receivedQty: 60, acceptedQty: 58, rejectedQty: 2 },
    ],
    supplierId: 'S002', supplierName: '浙江精工阀门制造有限公司',
    totalAmount: 17300, status: 'partial_received', confirmedDate: '2026-06-04',
    remark: '生产线急缺，需要优先处理'
  },
  {
    id: 'PO003', orderNo: 'PO-2026-06-003', title: '不锈钢管月度采购', requester: '赵采购', department: '采购部',
    createTime: '2026-06-05 10:00:00', requiredDate: '2026-06-20',
    items: [
      { productId: 'P005', productName: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', quantity: 500, unitPrice: 95 },
      { productId: 'P006', productName: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', quantity: 400, unitPrice: 145 },
    ],
    status: 'quoted',
    remark: '月度常规采购计划'
  },
  {
    id: 'PO004', orderNo: 'PO-2026-06-004', title: '仪器仪表采购需求', requester: '孙采购', department: '采购部',
    createTime: '2026-06-08 11:00:00', requiredDate: '2026-06-25',
    items: [
      { productId: 'P007', productName: '压力表 0-1.6MPa', sku: 'INS-PG-001', quantity: 30 },
      { productId: 'P008', productName: '温度传感器 PT100', sku: 'INS-TS-001', quantity: 40 },
    ],
    status: 'pending_quote',
    remark: '新项目配套仪表'
  },
  {
    id: 'PO005', orderNo: 'PO-2026-06-005', title: '电机减速机采购', requester: '钱采购', department: '采购部',
    createTime: '2026-06-10 09:00:00', requiredDate: '2026-07-05',
    items: [
      { productId: 'P009', productName: '电机 1.5kW', sku: 'MOT-001', quantity: 15 },
      { productId: 'P010', productName: '减速机 RV50', sku: 'RD-001', quantity: 12 },
    ],
    status: 'draft',
    remark: '三季度生产设备备件'
  },
];

export const mockQuotes: SupplierQuote[] = [
  {
    id: 'Q001', purchaseOrderId: 'PO003', purchaseOrderNo: 'PO-2026-06-003',
    supplierId: 'S001', supplierName: '上海华晨管件有限公司',
    items: [
      { productId: 'P005', productName: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', quantity: 500, unitPrice: 95, subtotal: 47500, leadTime: 8 },
      { productId: 'P006', productName: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', quantity: 400, unitPrice: 145, subtotal: 58000, leadTime: 10 },
    ],
    totalAmount: 105500, taxAmount: 13715, shippingFee: 800, validUntil: '2026-06-20', submitTime: '2026-06-06 09:30:00',
    status: 'submitted', remark: '含13%增值税，运费另计'
  },
  {
    id: 'Q002', purchaseOrderId: 'PO003', purchaseOrderNo: 'PO-2026-06-003',
    supplierId: 'S003', supplierName: '江苏恒通不锈钢制品厂',
    items: [
      { productId: 'P005', productName: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', quantity: 500, unitPrice: 92, subtotal: 46000, leadTime: 7 },
      { productId: 'P006', productName: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', quantity: 400, unitPrice: 140, subtotal: 56000, leadTime: 9 },
    ],
    totalAmount: 102000, taxAmount: 13260, shippingFee: 0, validUntil: '2026-06-18', submitTime: '2026-06-06 11:00:00',
    status: 'submitted', remark: '含运费含13%增值税，500米以上可优惠'
  },
  {
    id: 'Q003', purchaseOrderId: 'PO004', purchaseOrderNo: 'PO-2026-06-004',
    supplierId: 'S004', supplierName: '深圳市精密仪器有限公司',
    items: [
      { productId: 'P007', productName: '压力表 0-1.6MPa', sku: 'INS-PG-001', quantity: 30, unitPrice: 180, subtotal: 5400, leadTime: 5 },
      { productId: 'P008', productName: '温度传感器 PT100', sku: 'INS-TS-001', quantity: 40, unitPrice: 220, subtotal: 8800, leadTime: 7 },
    ],
    totalAmount: 14200, taxAmount: 1846, shippingFee: 200, validUntil: '2026-06-22', submitTime: '2026-06-09 10:00:00',
    status: 'submitted', remark: '款到发货，顺丰包邮'
  },
];

export const mockReceipts: WarehouseReceipt[] = [
  {
    id: 'R001', receiptNo: 'RCV-2026-06-001', purchaseOrderId: 'PO001', purchaseOrderNo: 'PO-2026-06-001',
    supplierId: 'S001', supplierName: '上海华晨管件有限公司',
    items: [
      { productId: 'P001', productName: '不锈钢法兰 DN50', sku: 'FLG-SS-001', expectedQty: 200, actualQty: 200, acceptedQty: 195, rejectedQty: 5, qcResult: 'partial', qcRemark: '5件有划痕，作退货处理', unitPrice: 45, subtotal: 8775 },
      { productId: 'P002', productName: '不锈钢法兰 DN80', sku: 'FLG-SS-002', expectedQty: 150, actualQty: 150, acceptedQty: 150, rejectedQty: 0, qcResult: 'pass', unitPrice: 78, subtotal: 11700 },
    ],
    totalAmount: 20475, receivedDate: '2026-06-12', warehouse: 'A区一号仓', receiver: '周仓管', inspector: '吴质检',
    remark: '送货单编号：HC20260612001'
  },
  {
    id: 'R002', receiptNo: 'RCV-2026-06-002', purchaseOrderId: 'PO002', purchaseOrderNo: 'PO-2026-06-002',
    supplierId: 'S002', supplierName: '浙江精工阀门制造有限公司',
    items: [
      { productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', expectedQty: 100, actualQty: 100, acceptedQty: 100, rejectedQty: 0, qcResult: 'pass', unitPrice: 65, subtotal: 6500 },
      { productId: 'P004', productName: '球阀 DN50', sku: 'VL-BV-002', expectedQty: 60, actualQty: 60, acceptedQty: 58, rejectedQty: 2, qcResult: 'partial', qcRemark: '2件阀杆有问题', unitPrice: 180, subtotal: 10440 },
    ],
    totalAmount: 16940, receivedDate: '2026-06-09', warehouse: 'A区二号仓', receiver: '周仓管', inspector: '郑质检',
    remark: '送货及时'
  },
];

export const mockStockRecords: StockRecord[] = [
  { id: 'ST001', productId: 'P001', productName: '不锈钢法兰 DN50', sku: 'FLG-SS-001', category: '管道配件', warehouse: 'A区一号仓', location: 'A1-02-03', quantity: 245, unit: '件', unitPrice: 45, totalValue: 11025, lastUpdated: '2026-06-12', allocatedQty: 50, reservedQty: 0 },
  { id: 'ST002', productId: 'P002', productName: '不锈钢法兰 DN80', sku: 'FLG-SS-002', category: '管道配件', warehouse: 'A区一号仓', location: 'A1-02-05', quantity: 200, unit: '件', unitPrice: 78, totalValue: 15600, lastUpdated: '2026-06-12', allocatedQty: 30, reservedQty: 0 },
  { id: 'ST003', productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', category: '阀门', warehouse: 'A区二号仓', location: 'A2-01-01', quantity: 130, unit: '只', unitPrice: 65, totalValue: 8450, lastUpdated: '2026-06-09', allocatedQty: 80, reservedQty: 0 },
  { id: 'ST004', productId: 'P004', productName: '球阀 DN50', sku: 'VL-BV-002', category: '阀门', warehouse: 'A区二号仓', location: 'A2-01-02', quantity: 68, unit: '只', unitPrice: 180, totalValue: 12240, lastUpdated: '2026-06-09', allocatedQty: 40, reservedQty: 0 },
  { id: 'ST005', productId: 'P005', productName: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', category: '管材', warehouse: 'B区露天场', location: 'B1-05', quantity: 80, unit: '米', unitPrice: 95, totalValue: 7600, lastUpdated: '2026-06-05', allocatedQty: 80, reservedQty: 0 },
  { id: 'ST006', productId: 'P006', productName: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', category: '管材', warehouse: 'B区露天场', location: 'B1-06', quantity: 15, unit: '米', unitPrice: 145, totalValue: 2175, lastUpdated: '2026-06-05', allocatedQty: 15, reservedQty: 0 },
  { id: 'ST007', productId: 'P007', productName: '压力表 0-1.6MPa', sku: 'INS-PG-001', category: '仪器仪表', warehouse: 'C区备品仓', location: 'C1-03', quantity: 12, unit: '只', unitPrice: 180, totalValue: 2160, lastUpdated: '2026-05-28', allocatedQty: 0, reservedQty: 0 },
  { id: 'ST008', productId: 'P008', productName: '温度传感器 PT100', sku: 'INS-TS-001', category: '仪器仪表', warehouse: 'C区备品仓', location: 'C1-04', quantity: 8, unit: '只', unitPrice: 220, totalValue: 1760, lastUpdated: '2026-05-28', allocatedQty: 0, reservedQty: 0 },
  { id: 'ST009', productId: 'P009', productName: '电机 1.5kW', sku: 'MOT-001', category: '机电设备', warehouse: 'D区设备仓', location: 'D1-01', quantity: 6, unit: '台', unitPrice: 850, totalValue: 5100, lastUpdated: '2026-05-20', allocatedQty: 0, reservedQty: 0 },
  { id: 'ST010', productId: 'P010', productName: '减速机 RV50', sku: 'RD-001', category: '机电设备', warehouse: 'D区设备仓', location: 'D1-02', quantity: 3, unit: '台', unitPrice: 1200, totalValue: 3600, lastUpdated: '2026-05-20', allocatedQty: 0, reservedQty: 0 },
];

export const mockStockMovements: StockMovement[] = [
  { id: 'M001', date: '2026-06-12', productId: 'P001', productName: '不锈钢法兰 DN50', sku: 'FLG-SS-001', type: 'in', quantity: 195, beforeQty: 50, afterQty: 245, unitPrice: 45, referenceType: '入库单', referenceNo: 'RCV-2026-06-001', warehouse: 'A区一号仓', operator: '周仓管', remark: '采购入库' },
  { id: 'M002', date: '2026-06-12', productId: 'P002', productName: '不锈钢法兰 DN80', sku: 'FLG-SS-002', type: 'in', quantity: 150, beforeQty: 50, afterQty: 200, unitPrice: 78, referenceType: '入库单', referenceNo: 'RCV-2026-06-001', warehouse: 'A区一号仓', operator: '周仓管', remark: '采购入库' },
  { id: 'M003', date: '2026-06-09', productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', type: 'in', quantity: 100, beforeQty: 30, afterQty: 130, unitPrice: 65, referenceType: '入库单', referenceNo: 'RCV-2026-06-002', warehouse: 'A区二号仓', operator: '周仓管', remark: '采购入库' },
  { id: 'M004', date: '2026-06-09', productId: 'P004', productName: '球阀 DN50', sku: 'VL-BV-002', type: 'in', quantity: 58, beforeQty: 10, afterQty: 68, unitPrice: 180, referenceType: '入库单', referenceNo: 'RCV-2026-06-002', warehouse: 'A区二号仓', operator: '周仓管', remark: '采购入库' },
  { id: 'M005', date: '2026-06-11', productId: 'P005', productName: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', type: 'allocate', quantity: 80, beforeQty: 160, afterQty: 160, unitPrice: 95, referenceType: '销售订单', referenceNo: 'SO-2026-06-001', warehouse: 'B区露天场', operator: '周仓管', remark: '分配库存' },
  { id: 'M006', date: '2026-06-11', productId: 'P006', productName: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', type: 'allocate', quantity: 15, beforeQty: 30, afterQty: 30, unitPrice: 145, referenceType: '销售订单', referenceNo: 'SO-2026-06-001', warehouse: 'B区露天场', operator: '周仓管', remark: '分配库存' },
  { id: 'M007', date: '2026-06-10', productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', type: 'out', quantity: 40, beforeQty: 170, afterQty: 130, unitPrice: 65, referenceType: '发货单', referenceNo: 'SHP-2026-06-001', warehouse: 'A区二号仓', operator: '周仓管', remark: '销售发货' },
];

export const mockSalesOrders: SalesOrder[] = [
  {
    id: 'SO001', orderNo: 'SO-2026-06-001', customerName: '杭州恒业化工设备有限公司', customerContact: '马经理', customerPhone: '13900139001',
    shippingAddress: '杭州市余杭区塘栖工业园恒业路1号',
    createTime: '2026-06-08 10:00:00', requiredDate: '2026-06-20',
    items: [
      { productId: 'P001', productName: '不锈钢法兰 DN50', sku: 'FLG-SS-001', quantity: 50, unitPrice: 68, subtotal: 3400, allocatedQty: 50, shippedQty: 0 },
      { productId: 'P002', productName: '不锈钢法兰 DN80', sku: 'FLG-SS-002', quantity: 30, unitPrice: 118, subtotal: 3540, allocatedQty: 30, shippedQty: 0 },
      { productId: 'P005', productName: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', quantity: 80, unitPrice: 138, subtotal: 11040, allocatedQty: 80, shippedQty: 0 },
      { productId: 'P006', productName: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', quantity: 50, unitPrice: 210, subtotal: 10500, allocatedQty: 15, shippedQty: 0 },
    ],
    totalAmount: 28480, status: 'partially_allocated', remark: '加急订单'
  },
  {
    id: 'SO002', orderNo: 'SO-2026-06-002', customerName: '宁波海天食品机械有限公司', customerContact: '王工', customerPhone: '13900139002',
    shippingAddress: '宁波市北仑区小港街道海天路88号',
    createTime: '2026-06-02 14:00:00', requiredDate: '2026-06-15',
    items: [
      { productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', quantity: 40, unitPrice: 95, subtotal: 3800, allocatedQty: 40, shippedQty: 40 },
      { productId: 'P004', productName: '球阀 DN50', sku: 'VL-BV-002', quantity: 20, unitPrice: 260, subtotal: 5200, allocatedQty: 20, shippedQty: 20 },
    ],
    totalAmount: 9000, status: 'shipped', remark: ''
  },
  {
    id: 'SO003', orderNo: 'SO-2026-06-003', customerName: '南京制药设备股份有限公司', customerContact: '朱主任', customerPhone: '13900139003',
    shippingAddress: '南京市江宁区科学园天元路168号',
    createTime: '2026-06-07 09:00:00', requiredDate: '2026-06-28',
    items: [
      { productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', quantity: 60, unitPrice: 95, subtotal: 5700, allocatedQty: 40, shippedQty: 0 },
      { productId: 'P007', productName: '压力表 0-1.6MPa', sku: 'INS-PG-001', quantity: 10, unitPrice: 260, subtotal: 2600, allocatedQty: 0, shippedQty: 0 },
      { productId: 'P008', productName: '温度传感器 PT100', sku: 'INS-TS-001', quantity: 15, unitPrice: 320, subtotal: 4800, allocatedQty: 0, shippedQty: 0 },
    ],
    totalAmount: 13100, status: 'partially_allocated', remark: '需要配套仪表'
  },
];

export const mockShipments: Shipment[] = [
  {
    id: 'SH001', shipmentNo: 'SHP-2026-06-001', salesOrderId: 'SO002', salesOrderNo: 'SO-2026-06-002',
    items: [
      { productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', quantity: 40, unit: '只', unitPrice: 95, subtotal: 3800, warehouse: 'A区二号仓' },
      { productId: 'P004', productName: '球阀 DN50', sku: 'VL-BV-002', quantity: 20, unit: '只', unitPrice: 260, subtotal: 5200, warehouse: 'A区二号仓' },
    ],
    totalAmount: 9000, customerName: '宁波海天食品机械有限公司', shippingAddress: '宁波市北仑区小港街道海天路88号',
    receiverContact: '王工', receiverPhone: '13900139002',
    carrier: '德邦物流', trackingNo: 'DB886655223311',
    createTime: '2026-06-09 15:00:00', shipTime: '2026-06-09 18:30:00', estimatedArrival: '2026-06-11', actualArrival: '2026-06-11 10:00:00',
    status: 'delivered', warehouse: 'A区二号仓', operator: '周仓管',
    logistics: [
      { time: '2026-06-09 15:00:00', status: '已创建', location: '公司仓库', description: '创建发货单，准备拣货', operator: '周仓管' },
      { time: '2026-06-09 16:00:00', status: '拣货中', location: 'A区二号仓', description: '仓管人员正在拣货', operator: '周仓管' },
      { time: '2026-06-09 17:30:00', status: '已打包', location: '发货区', description: '货物已打包完毕，等待揽收', operator: '周仓管' },
      { time: '2026-06-09 18:30:00', status: '已发货', location: '公司发货区', description: '德邦物流已揽收', operator: '德邦快递员' },
      { time: '2026-06-10 08:00:00', status: '运输中', location: '杭州转运中心', description: '货物到达杭州转运中心' },
      { time: '2026-06-10 22:00:00', status: '运输中', location: '宁波分拨中心', description: '货物到达宁波分拨中心' },
      { time: '2026-06-11 08:30:00', status: '派送中', location: '宁波北仑区营业点', description: '快递员正在派送' },
      { time: '2026-06-11 10:00:00', status: '已签收', location: '收货地址', description: '本人签收', operator: '王工' },
    ],
    remark: '客户已确认收货'
  },
  {
    id: 'SH002', shipmentNo: 'SHP-2026-06-002', salesOrderId: 'SO001', salesOrderNo: 'SO-2026-06-001',
    items: [
      { productId: 'P001', productName: '不锈钢法兰 DN50', sku: 'FLG-SS-001', quantity: 50, unit: '件', unitPrice: 68, subtotal: 3400, warehouse: 'A区一号仓' },
      { productId: 'P002', productName: '不锈钢法兰 DN80', sku: 'FLG-SS-002', quantity: 30, unit: '件', unitPrice: 118, subtotal: 3540, warehouse: 'A区一号仓' },
    ],
    totalAmount: 6940, customerName: '杭州恒业化工设备有限公司', shippingAddress: '杭州市余杭区塘栖工业园恒业路1号',
    receiverContact: '马经理', receiverPhone: '13900139001',
    carrier: '顺丰速运', trackingNo: 'SF1234567890999',
    createTime: '2026-06-11 10:00:00', shipTime: '2026-06-11 16:00:00', estimatedArrival: '2026-06-12',
    status: 'in_transit', warehouse: 'A区一号仓', operator: '周仓管',
    logistics: [
      { time: '2026-06-11 10:00:00', status: '已创建', location: '公司仓库', description: '创建发货单，准备拣货', operator: '周仓管' },
      { time: '2026-06-11 11:30:00', status: '拣货中', location: 'A区一号仓', description: '仓管人员正在拣货', operator: '周仓管' },
      { time: '2026-06-11 14:00:00', status: '已打包', location: '发货区', description: '货物已打包完毕，等待揽收', operator: '周仓管' },
      { time: '2026-06-11 16:00:00', status: '已发货', location: '公司发货区', description: '顺丰速运已揽收', operator: '顺丰快递员' },
      { time: '2026-06-11 23:59:00', status: '运输中', location: '杭州萧山转运中心', description: '快件正在运输中' },
    ],
    remark: '加急发货'
  },
];

export const mockPayables: Payable[] = [
  {
    id: 'AP001', billNo: 'AP-2026-06-001', purchaseOrderId: 'PO001', purchaseOrderNo: 'PO-2026-06-001', receiptId: 'R001', receiptNo: 'RCV-2026-06-001',
    supplierId: 'S001', supplierName: '上海华晨管件有限公司',
    billDate: '2026-06-13', dueDate: '2026-07-13',
    totalAmount: 20475, paidAmount: 0, unpaidAmount: 20475, status: 'unpaid',
    items: [
      { productId: 'P001', productName: '不锈钢法兰 DN50', sku: 'FLG-SS-001', quantity: 195, unitPrice: 45, subtotal: 8775 },
      { productId: 'P002', productName: '不锈钢法兰 DN80', sku: 'FLG-SS-002', quantity: 150, unitPrice: 78, subtotal: 11700 },
    ],
    payments: [],
    remark: '发票已收到'
  },
  {
    id: 'AP002', billNo: 'AP-2026-06-002', purchaseOrderId: 'PO002', purchaseOrderNo: 'PO-2026-06-002', receiptId: 'R002', receiptNo: 'RCV-2026-06-002',
    supplierId: 'S002', supplierName: '浙江精工阀门制造有限公司',
    billDate: '2026-06-10', dueDate: '2026-07-25',
    totalAmount: 16940, paidAmount: 5000, unpaidAmount: 11940, status: 'partial',
    items: [
      { productId: 'P003', productName: '球阀 DN25', sku: 'VL-BV-001', quantity: 100, unitPrice: 65, subtotal: 6500 },
      { productId: 'P004', productName: '球阀 DN50', sku: 'VL-BV-002', quantity: 58, unitPrice: 180, subtotal: 10440 },
    ],
    payments: [
      { date: '2026-06-11', amount: 5000, method: '银行转账', reference: 'TR20260611001', remark: '预付款' }
    ],
    remark: ''
  },
  {
    id: 'AP003', billNo: 'AP-2026-05-008', purchaseOrderId: 'PO000', purchaseOrderNo: 'PO-2026-05-008',
    supplierId: 'S003', supplierName: '江苏恒通不锈钢制品厂',
    billDate: '2026-05-28', dueDate: '2026-06-28',
    totalAmount: 58600, paidAmount: 58600, unpaidAmount: 0, status: 'paid',
    items: [
      { productId: 'P005', productName: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', quantity: 300, unitPrice: 95, subtotal: 28500 },
      { productId: 'P006', productName: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', quantity: 200, unitPrice: 145, subtotal: 29000 },
    ],
    payments: [
      { date: '2026-06-05', amount: 58600, method: '银行承兑', reference: 'CD20260605002', remark: '全额结清' }
    ],
    remark: ''
  },
];

export const mockStockRisks: StockRisk[] = [
  { productId: 'P006', productName: '无缝钢管 Φ76×4', sku: 'PIPE-SS-002', category: '管材', currentStock: 30, safetyStock: 150, allocatedQty: 15, availableQty: 15, pendingPurchaseQty: 400, riskLevel: 'critical', last30DaysConsumption: 200, estimatedDaysLeft: 2, affectedOrders: ['SO-2026-06-001'] },
  { productId: 'P008', productName: '温度传感器 PT100', sku: 'INS-TS-001', category: '仪器仪表', currentStock: 8, safetyStock: 25, allocatedQty: 0, availableQty: 8, pendingPurchaseQty: 40, riskLevel: 'warning', last30DaysConsumption: 20, estimatedDaysLeft: 12, affectedOrders: ['SO-2026-06-003'] },
  { productId: 'P007', productName: '压力表 0-1.6MPa', sku: 'INS-PG-001', category: '仪器仪表', currentStock: 12, safetyStock: 20, allocatedQty: 0, availableQty: 12, pendingPurchaseQty: 30, riskLevel: 'warning', last30DaysConsumption: 15, estimatedDaysLeft: 24, affectedOrders: ['SO-2026-06-003'] },
  { productId: 'P010', productName: '减速机 RV50', sku: 'RD-001', category: '机电设备', currentStock: 3, safetyStock: 8, allocatedQty: 0, availableQty: 3, pendingPurchaseQty: 12, riskLevel: 'warning', last30DaysConsumption: 5, estimatedDaysLeft: 18, affectedOrders: [] },
  { productId: 'P005', productName: '无缝钢管 Φ57×3.5', sku: 'PIPE-SS-001', category: '管材', currentStock: 160, safetyStock: 200, allocatedQty: 80, availableQty: 80, pendingPurchaseQty: 500, riskLevel: 'normal', last30DaysConsumption: 280, estimatedDaysLeft: 9, affectedOrders: ['SO-2026-06-001'] },
];
