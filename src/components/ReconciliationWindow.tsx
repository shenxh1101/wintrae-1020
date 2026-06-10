import { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Modal, Form, InputNumber, Select, Input,
  Card, Row, Col, Divider, message, Tabs, DatePicker, Statistic,
  Tooltip, Space, Progress, Collapse, Empty, Radio,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, EyeOutlined,
  FileExcelOutlined, CalendarOutlined, PayCircleOutlined,
  WarningOutlined, CheckCircleOutlined, BarChartOutlined,
  FileDoneOutlined, DollarOutlined, FundOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  ComposedChart, Area,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);
import { useAppStore } from '../store/appStore';
import { Payable, PaymentStatus, MonthlyPurchaseStat, StockTurnoverStat, Receivable } from '../types';

const { RangePicker } = DatePicker;

const paymentStatusMap: Record<PaymentStatus, { color: string; text: string }> = {
  unpaid: { color: 'red', text: '未付款' },
  partial: { color: 'orange', text: '部分付款' },
  paid: { color: 'green', text: '已结清' },
};

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'];

export default function ReconciliationWindow() {
  const { payables, suppliers, addPayment, receipts, stockRecords, stockMovements, purchaseOrders, products, receivables, addReceivablePayment, salesOrders, shipments } = useAppStore();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | undefined>();
  const [supplierFilter, setSupplierFilter] = useState<string | undefined>();
  const [paymentModal, setPaymentModal] = useState<Payable | null>(null);
  const [detailModal, setDetailModal] = useState<Payable | null>(null);
  const [reportMonth, setReportMonth] = useState<dayjs.Dayjs>(dayjs());
  const [purchaseReportPeriod, setPurchaseReportPeriod] = useState<'month' | 'quarter'>('month');
  const [purchaseReportDate, setPurchaseReportDate] = useState<dayjs.Dayjs>(dayjs());
  const [turnoverCategoryFilter, setTurnoverCategoryFilter] = useState<string | undefined>();
  const [turnoverWarehouseFilter, setTurnoverWarehouseFilter] = useState<string | undefined>();
  const [form] = Form.useForm();

  const [arKeyword, setArKeyword] = useState('');
  const [arStatusFilter, setArStatusFilter] = useState<PaymentStatus | undefined>();
  const [arCustomerFilter, setArCustomerFilter] = useState<string | undefined>();
  const [receivablePaymentModal, setReceivablePaymentModal] = useState<Receivable | null>(null);
  const [receivableDetailModal, setReceivableDetailModal] = useState<Receivable | null>(null);
  const [receivableForm] = Form.useForm();

  const [profitPeriod, setProfitPeriod] = useState<'month' | 'quarter'>('month');
  const [profitBaseDate, setProfitBaseDate] = useState<dayjs.Dayjs>(dayjs());
  const [profitCustomerFilter, setProfitCustomerFilter] = useState<string | undefined>();
  const [profitCategoryFilter, setProfitCategoryFilter] = useState<string | undefined>();

  const categories = useMemo(() => {
    return [...new Set(products.map(p => p.category))];
  }, [products]);

  const warehouses = useMemo(() => {
    return [...new Set(stockRecords.map(s => s.warehouse))];
  }, [stockRecords]);

  const stats = useMemo(() => {
    const totalPayable = payables.reduce((s, p) => s + p.totalAmount, 0);
    const totalPaid = payables.reduce((s, p) => s + p.paidAmount, 0);
    const totalUnpaid = payables.reduce((s, p) => s + p.unpaidAmount, 0);
    const overdue = payables.filter(p =>
      p.status !== 'paid' && dayjs(p.dueDate).isBefore(dayjs())
    ).reduce((s, p) => s + p.unpaidAmount, 0);
    return { totalPayable, totalPaid, totalUnpaid, overdue, count: payables.length };
  }, [payables]);

  // Supplier summary
  const supplierSummary = useMemo(() => {
    const map: Record<string, {
      supplierId: string; supplierName: string;
      billCount: number; totalAmount: number; paidAmount: number; unpaidAmount: number;
      overdueAmount: number;
    }> = {};

    payables.forEach(p => {
      if (!map[p.supplierId]) {
        map[p.supplierId] = {
          supplierId: p.supplierId,
          supplierName: p.supplierName,
          billCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          overdueAmount: 0,
        };
      }
      const s = map[p.supplierId];
      s.billCount++;
      s.totalAmount += p.totalAmount;
      s.paidAmount += p.paidAmount;
      s.unpaidAmount += p.unpaidAmount;
      if (p.status !== 'paid' && dayjs(p.dueDate).isBefore(dayjs())) {
        s.overdueAmount += p.unpaidAmount;
      }
    });

    return Object.values(map).sort((a, b) => b.unpaidAmount - a.unpaidAmount);
  }, [payables]);

  const filteredData = useMemo(() => {
    return payables.filter(p => {
      if (keyword && !p.billNo.includes(keyword) && !p.purchaseOrderNo.includes(keyword)
        && !p.supplierName.includes(keyword)) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (supplierFilter && p.supplierId !== supplierFilter) return false;
      return true;
    }).sort((a, b) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf());
  }, [payables, keyword, statusFilter, supplierFilter]);

  // Monthly purchase report - supports month/quarter selection
  const monthlyPurchaseData: MonthlyPurchaseStat[] = useMemo(() => {
    const data: MonthlyPurchaseStat[] = [];
    const periods = purchaseReportPeriod === 'month' ? 6 : 4;
    const step = purchaseReportPeriod === 'month' ? 1 : 3;

    for (let p = periods - 1; p >= 0; p--) {
      let periodStart: dayjs.Dayjs;
      let periodEnd: dayjs.Dayjs;
      let key: string;

      if (purchaseReportPeriod === 'month') {
        const d = purchaseReportDate.subtract(p, 'month').clone();
        periodStart = d.clone().startOf('month');
        periodEnd = d.clone().endOf('month');
        key = d.format('YYYY-MM');
      } else {
        const baseQuarter = Math.floor((purchaseReportDate.month()) / 3);
        const targetQuarter = baseQuarter - p;
        const yearAdjust = targetQuarter < 0 ? Math.floor(targetQuarter / 4) : 0;
        const quarter = ((targetQuarter % 4) + 4) % 4;
        const year = purchaseReportDate.year() + yearAdjust;

        periodStart = dayjs(`${year}-${quarter * 3 + 1}-01`).startOf('month');
        periodEnd = dayjs(`${year}-${quarter * 3 + 3}-01`).endOf('month');
        key = `${year}Q${quarter + 1}`;
      }

      const periodPOs = purchaseOrders.filter(po => dayjs(po.createTime).isBetween(periodStart, periodEnd, null, '[]'));
      const periodReceipts = receipts.filter(r => dayjs(r.receivedDate).isBetween(periodStart, periodEnd, null, '[]'));
      const suppliersSet = new Set(periodPOs.map(po => po.supplierId).filter(Boolean));

      data.push({
        month: key,
        orderCount: periodPOs.length,
        totalAmount: periodPOs.reduce((s, po) => s + (po.totalAmount || 0), 0),
        itemCount: periodPOs.reduce((s, po) => s + po.items.length, 0),
        supplierCount: suppliersSet.size,
        receiptCount: periodReceipts.length,
        receiptAmount: periodReceipts.reduce((s, r) => s + r.totalAmount, 0),
        onTimeRate: periodReceipts.length > 0 ? Math.round(periodReceipts.filter(r => {
          const po = purchaseOrders.find(po => po.id === r.purchaseOrderId);
          return po && dayjs(r.receivedDate).isBefore(dayjs(po.requiredDate).endOf('day'));
        }).length / periodReceipts.length * 100) : 0,
      });
    }
    return data;
  }, [purchaseOrders, receipts, purchaseReportPeriod, purchaseReportDate]);

  // Stock turnover report - supports category and warehouse filtering
  const turnoverData: StockTurnoverStat[] = useMemo(() => {
    const reportStart = reportMonth.clone().startOf('month');
    const reportEnd = reportMonth.clone().endOf('month');

    const filteredStockRecords = stockRecords.filter(sr => {
      if (turnoverCategoryFilter && sr.category !== turnoverCategoryFilter) return false;
      if (turnoverWarehouseFilter && sr.warehouse !== turnoverWarehouseFilter) return false;
      return true;
    });

    return filteredStockRecords.map(sr => {
      const inMoves = stockMovements.filter(m =>
        m.productId === sr.productId && m.type === 'in'
        && dayjs(m.date).isBetween(reportStart, reportEnd, null, '[]')
        && (!turnoverWarehouseFilter || m.warehouse === turnoverWarehouseFilter)
      );
      const outMoves = stockMovements.filter(m =>
        m.productId === sr.productId && m.type === 'out'
        && dayjs(m.date).isBetween(reportStart, reportEnd, null, '[]')
        && (!turnoverWarehouseFilter || m.warehouse === turnoverWarehouseFilter)
      );

      const inQty = inMoves.reduce((s, m) => s + m.quantity, 0);
      const outQty = outMoves.reduce((s, m) => s + m.quantity, 0);
      const inAmount = inMoves.reduce((s, m) => s + m.quantity * m.unitPrice, 0);
      const outAmount = outMoves.reduce((s, m) => s + m.quantity * m.unitPrice, 0);

      const monthChanges = stockMovements.filter(m =>
        m.productId === sr.productId
        && (m.type === 'in' || m.type === 'out')
        && dayjs(m.date).isBetween(reportStart, reportEnd, null, '[]')
        && (!turnoverWarehouseFilter || m.warehouse === turnoverWarehouseFilter)
      );
      const netChange = monthChanges.reduce((s, m) =>
        s + (m.type === 'in' ? m.quantity : -m.quantity), 0);
      const beginningStock = Math.max(0, sr.quantity - netChange);

      const endingStock = sr.quantity;
      const avgStock = (beginningStock + endingStock) / 2;
      const turnoverRate = avgStock > 0 ? +(outQty / avgStock).toFixed(2) : 0;
      const turnoverDays = turnoverRate > 0 ? Math.round(30 / turnoverRate) : 999;

      return {
        productId: sr.productId,
        productName: sr.productName,
        sku: sr.sku,
        category: sr.category,
        beginningStock,
        endingStock,
        avgStock,
        inQty,
        outQty,
        turnoverRate,
        turnoverDays,
        inAmount,
        outAmount,
      };
    }).sort((a, b) => b.turnoverRate - a.turnoverRate);
  }, [stockRecords, stockMovements, reportMonth, turnoverCategoryFilter, turnoverWarehouseFilter]);

  const arCustomers = useMemo(() => {
    return [...new Set(receivables.map(r => r.customerName))];
  }, [receivables]);

  const arStats = useMemo(() => {
    const totalReceivable = receivables.reduce((s, r) => s + r.totalAmount, 0);
    const totalReceived = receivables.reduce((s, r) => s + r.receivedAmount, 0);
    const totalUnreceived = receivables.reduce((s, r) => s + r.unreceivedAmount, 0);
    const overdue = receivables.filter(r =>
      r.status !== 'paid' && dayjs(r.dueDate).isBefore(dayjs())
    ).reduce((s, r) => s + r.unreceivedAmount, 0);
    return { totalReceivable, totalReceived, totalUnreceived, overdue, count: receivables.length };
  }, [receivables]);

  const customerSummary = useMemo(() => {
    const map: Record<string, {
      customerName: string;
      billCount: number; totalAmount: number; receivedAmount: number; unreceivedAmount: number;
      overdueAmount: number;
    }> = {};
    receivables.forEach(r => {
      if (!map[r.customerName]) {
        map[r.customerName] = {
          customerName: r.customerName,
          billCount: 0, totalAmount: 0, receivedAmount: 0, unreceivedAmount: 0, overdueAmount: 0,
        };
      }
      const s = map[r.customerName];
      s.billCount++;
      s.totalAmount += r.totalAmount;
      s.receivedAmount += r.receivedAmount;
      s.unreceivedAmount += r.unreceivedAmount;
      if (r.status !== 'paid' && dayjs(r.dueDate).isBefore(dayjs())) {
        s.overdueAmount += r.unreceivedAmount;
      }
    });
    return Object.values(map).sort((a, b) => b.unreceivedAmount - a.unreceivedAmount);
  }, [receivables]);

  const filteredReceivables = useMemo(() => {
    return receivables.filter(r => {
      if (arKeyword && !r.billNo.includes(arKeyword) && !r.salesOrderNo.includes(arKeyword)
        && !r.customerName.includes(arKeyword) && !r.shipmentNo.includes(arKeyword)) return false;
      if (arStatusFilter && r.status !== arStatusFilter) return false;
      if (arCustomerFilter && r.customerName !== arCustomerFilter) return false;
      return true;
    }).sort((a, b) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf());
  }, [receivables, arKeyword, arStatusFilter, arCustomerFilter]);

  const profitStats = useMemo(() => {
    let filteredShipments = shipments;
    if (profitCustomerFilter) {
      filteredShipments = filteredShipments.filter(s => s.customerName === profitCustomerFilter);
    }
    if (profitCategoryFilter) {
      filteredShipments = filteredShipments.filter(s =>
        s.items.some(item => {
          const product = products.find(p => p.id === item.productId);
          return product?.category === profitCategoryFilter;
        })
      );
    }
    const revenue = filteredShipments.reduce((s, sh) => s + sh.totalAmount, 0);
    const cost = filteredShipments.reduce((s, sh) => s + (sh.costAmount || 0), 0);
    const profit = revenue - cost;
    const rate = revenue > 0 ? +(profit / revenue * 100).toFixed(2) : 0;
    return { revenue, cost, profit, rate };
  }, [shipments, products, profitCustomerFilter, profitCategoryFilter]);

  const profitChartData = useMemo(() => {
    const periods = profitPeriod === 'month' ? 6 : 4;
    const data: { period: string; revenue: number; cost: number; profit: number; rate: number }[] = [];
    for (let p = periods - 1; p >= 0; p--) {
      let periodStart: dayjs.Dayjs;
      let periodEnd: dayjs.Dayjs;
      let key: string;
      if (profitPeriod === 'month') {
        const d = profitBaseDate.subtract(p, 'month').clone();
        periodStart = d.clone().startOf('month');
        periodEnd = d.clone().endOf('month');
        key = d.format('YYYY-MM');
      } else {
        const baseQuarter = Math.floor(profitBaseDate.month() / 3);
        const targetQuarter = baseQuarter - p;
        const yearAdjust = targetQuarter < 0 ? Math.floor(targetQuarter / 4) : 0;
        const quarter = ((targetQuarter % 4) + 4) % 4;
        const year = profitBaseDate.year() + yearAdjust;
        periodStart = dayjs(`${year}-${quarter * 3 + 1}-01`).startOf('month');
        periodEnd = dayjs(`${year}-${quarter * 3 + 3}-01`).endOf('month');
        key = `${year}Q${quarter + 1}`;
      }
      let periodShipments = shipments.filter(sh => dayjs(sh.createTime).isBetween(periodStart, periodEnd, null, '[]'));
      if (profitCustomerFilter) {
        periodShipments = periodShipments.filter(s => s.customerName === profitCustomerFilter);
      }
      if (profitCategoryFilter) {
        periodShipments = periodShipments.filter(s =>
          s.items.some(item => {
            const product = products.find(pr => pr.id === item.productId);
            return product?.category === profitCategoryFilter;
          })
        );
      }
      const revenue = periodShipments.reduce((s, sh) => s + sh.totalAmount, 0);
      const cost = periodShipments.reduce((s, sh) => s + (sh.costAmount || 0), 0);
      const profit = revenue - cost;
      const rate = revenue > 0 ? +(profit / revenue * 100).toFixed(2) : 0;
      data.push({ period: key, revenue, cost, profit, rate });
    }
    return data;
  }, [shipments, products, profitPeriod, profitBaseDate, profitCustomerFilter, profitCategoryFilter]);

  const profitTableData = useMemo(() => {
    let filtered = shipments;
    if (profitCustomerFilter) {
      filtered = filtered.filter(s => s.customerName === profitCustomerFilter);
    }
    if (profitCategoryFilter) {
      filtered = filtered.filter(s =>
        s.items.some(item => {
          const product = products.find(p => p.id === item.productId);
          return product?.category === profitCategoryFilter;
        })
      );
    }
    return filtered.map(sh => {
      const cost = sh.costAmount || 0;
      const profit = sh.totalAmount - cost;
      const rate = sh.totalAmount > 0 ? +(profit / sh.totalAmount * 100).toFixed(2) : 0;
      return {
        id: sh.id,
        shipmentNo: sh.shipmentNo,
        salesOrderNo: sh.salesOrderNo,
        customerName: sh.customerName,
        createTime: sh.createTime,
        totalAmount: sh.totalAmount,
        costAmount: cost,
        profit,
        profitRate: rate,
      };
    });
  }, [shipments, products, profitCustomerFilter, profitCategoryFilter]);

  const shipmentCustomers = useMemo(() => {
    return [...new Set(shipments.map(s => s.customerName))];
  }, [shipments]);

  const handlePayment = async () => {
    if (!paymentModal) return;
    try {
      const values = await form.validateFields();
      addPayment(paymentModal.id, values);
      message.success('付款记录已添加');
      setPaymentModal(null);
      form.resetFields();
    } catch (e) {
      //
    }
  };

  const handleReceivablePayment = async () => {
    if (!receivablePaymentModal) return;
    try {
      const values = await receivableForm.validateFields();
      addReceivablePayment(receivablePaymentModal.id, values);
      message.success('收款记录已添加');
      setReceivablePaymentModal(null);
      receivableForm.resetFields();
    } catch (e) {
      //
    }
  };

  const receivableColumns: ColumnsType<Receivable> = [
    { title: '账单号', dataIndex: 'billNo', width: 150, fixed: 'left' },
    { title: '销售订单号', dataIndex: 'salesOrderNo', width: 150 },
    { title: '发货单号', dataIndex: 'shipmentNo', width: 150 },
    { title: '客户名称', dataIndex: 'customerName', width: 180 },
    {
      title: '账单金额',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: v => <span style={{ fontWeight: 500 }}>¥{v.toLocaleString()}</span>,
    },
    {
      title: '已收款',
      width: 120,
      align: 'right',
      render: (_, r) => <span style={{ color: '#52c41a', fontWeight: 500 }}>¥{r.receivedAmount.toLocaleString()}</span>,
    },
    {
      title: '未收款',
      width: 120,
      align: 'right',
      render: (_, r) => r.unreceivedAmount > 0
        ? <span style={{ color: '#cf1322', fontWeight: 600 }}>¥{r.unreceivedAmount.toLocaleString()}</span>
        : <span style={{ color: '#8c8c8c' }}>¥0</span>,
    },
    {
      title: '收款进度',
      width: 160,
      render: (_, r) => {
        const pct = r.totalAmount > 0 ? Math.round(r.receivedAmount / r.totalAmount * 100) : 0;
        return (
          <Tooltip title={`${r.receivedAmount} / ${r.totalAmount} (${pct}%)`}>
            <Progress
              percent={pct}
              size="small"
              status={pct === 100 ? 'success' : pct > 0 ? 'active' : 'exception'}
              showInfo={true}
            />
          </Tooltip>
        );
      },
    },
    { title: '账单日期', dataIndex: 'billDate', width: 110 },
    {
      title: '到期日期',
      dataIndex: 'dueDate',
      width: 110,
      render: (v, r) => {
        const overdue = r.status !== 'paid' && dayjs(v).isBefore(dayjs());
        return (
          <span style={{ color: overdue ? '#cf1322' : undefined, fontWeight: overdue ? 600 : undefined }}>
            {overdue && <WarningOutlined style={{ marginRight: 4 }} />}{v}
          </span>
        );
      },
    },
    {
      title: '状态',
      width: 100,
      render: (_, r) => <Tag color={paymentStatusMap[r.status].color}>{paymentStatusMap[r.status].text}</Tag>,
    },
    {
      title: '操作',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-col">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setReceivableDetailModal(record)}>
            明细
          </Button>
          {record.status !== 'paid' && (
            <Button
              type="primary"
              size="small"
              ghost
              icon={<PlusOutlined />}
              onClick={() => { setReceivablePaymentModal(record); receivableForm.resetFields(); }}
            >
              登记收款
            </Button>
          )}
        </div>
      ),
    },
  ];

  const payableColumns: ColumnsType<Payable> = [
    { title: '账单号', dataIndex: 'billNo', width: 150, fixed: 'left' },
    { title: '采购单号', dataIndex: 'purchaseOrderNo', width: 150 },
    { title: '入库单号', dataIndex: 'receiptNo', width: 150, render: v => v || '-' },
    { title: '供应商', dataIndex: 'supplierName', width: 200 },
    {
      title: '账单金额',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: v => <span style={{ fontWeight: 500 }}>¥{v.toLocaleString()}</span>,
    },
    {
      title: '已付款',
      width: 120,
      align: 'right',
      render: (_, r) => <span style={{ color: '#52c41a', fontWeight: 500 }}>¥{r.paidAmount.toLocaleString()}</span>,
    },
    {
      title: '未付款',
      width: 120,
      align: 'right',
      render: (_, r) => r.unpaidAmount > 0
        ? <span style={{ color: '#cf1322', fontWeight: 600 }}>¥{r.unpaidAmount.toLocaleString()}</span>
        : <span style={{ color: '#8c8c8c' }}>¥0</span>,
    },
    {
      title: '付款进度',
      width: 160,
      render: (_, r) => {
        const pct = r.totalAmount > 0 ? Math.round(r.paidAmount / r.totalAmount * 100) : 0;
        return (
          <Tooltip title={`${r.paidAmount} / ${r.totalAmount} (${pct}%)`}>
            <Progress
              percent={pct}
              size="small"
              status={pct === 100 ? 'success' : pct > 0 ? 'active' : 'exception'}
              showInfo={true}
            />
          </Tooltip>
        );
      },
    },
    { title: '账单日期', dataIndex: 'billDate', width: 110 },
    {
      title: '到期日期',
      dataIndex: 'dueDate',
      width: 110,
      render: (v, r) => {
        const overdue = r.status !== 'paid' && dayjs(v).isBefore(dayjs());
        return (
          <span style={{ color: overdue ? '#cf1322' : undefined, fontWeight: overdue ? 600 : undefined }}>
            {overdue && <WarningOutlined style={{ marginRight: 4 }} />}{v}
          </span>
        );
      },
    },
    {
      title: '状态',
      width: 100,
      render: (_, r) => <Tag color={paymentStatusMap[r.status].color}>{paymentStatusMap[r.status].text}</Tag>,
    },
    {
      title: '操作',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-col">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(record)}>
            明细
          </Button>
          {record.status !== 'paid' && (
            <Button
              type="primary"
              size="small"
              ghost
              icon={<PlusOutlined />}
              onClick={() => { setPaymentModal(record); form.resetFields(); }}
            >
              登记付款
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="stat-cards">
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">应付账单总数</div>
          <div className="stat-value">{stats.count}</div>
          <div className="stat-trend">覆盖 {supplierSummary.length} 家供应商</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">应付总金额</div>
          <div className="stat-value">¥{stats.totalPayable.toLocaleString()}</div>
          <div className="stat-trend">
            已付 ¥{stats.totalPaid.toLocaleString()}
          </div>
        </Card>
        <Card className="stat-card" bordered={false} style={{ border: '1px solid #ffccc7' }}>
          <div className="stat-label" style={{ color: '#a8071a' }}><WarningOutlined /> 未结款项</div>
          <div className="stat-value" style={{ color: '#cf1322' }}>¥{stats.totalUnpaid.toLocaleString()}</div>
          <div className="stat-trend" style={{ color: '#cf1322' }}>
            待支付 {payables.filter(p => p.status !== 'paid').length} 笔
          </div>
        </Card>
        <Card className="stat-card" bordered={false} style={{ border: '1px solid #ffa39e', background: '#fff1f0' }}>
          <div className="stat-label" style={{ color: '#a8071a' }}>逾期款项</div>
          <div className="stat-value" style={{ color: '#cf1322' }}>¥{stats.overdue.toLocaleString()}</div>
          <div className="stat-trend" style={{ color: '#cf1322', fontWeight: 500 }}>请及时安排付款！</div>
        </Card>
      </div>

      <div className="page-container">
        <Tabs
          defaultActiveKey="payable"
          items={[
            {
              key: 'payable',
              label: <span><PayCircleOutlined />应付款管理</span>,
              children: (
                <>
                  <div className="page-header" style={{ marginTop: -16 }}>
                    <div>
                      <div className="page-title">应付款账单列表</div>
                      <div className="page-subtitle">按供应商汇总未结款项，登记付款记录</div>
                    </div>
                    <Button icon={<FileExcelOutlined />} onClick={() => message.success('报表已导出（模拟）')}>
                      导出对账单
                    </Button>
                  </div>

                  <Collapse
                    style={{ marginBottom: 16 }}
                    items={[{
                      key: '1',
                      label: <strong><BarChartOutlined /> 按供应商汇总</strong>,
                      children: (
                        <Table
                          size="small"
                          pagination={false}
                          dataSource={supplierSummary}
                          rowKey="supplierId"
                          columns={[
                            { title: '供应商', dataIndex: 'supplierName', width: 220 },
                            { title: '账单数', dataIndex: 'billCount', width: 80, align: 'right' },
                            {
                              title: '累计金额', dataIndex: 'totalAmount', width: 130, align: 'right',
                              render: v => <span style={{ fontWeight: 500 }}>¥{v.toLocaleString()}</span>
                            },
                            {
                              title: '已付款', dataIndex: 'paidAmount', width: 130, align: 'right',
                              render: v => <span style={{ color: '#52c41a' }}>¥{v.toLocaleString()}</span>
                            },
                            {
                              title: '未结金额',
                              dataIndex: 'unpaidAmount',
                              width: 140,
                              align: 'right',
                              render: (v, r) => {
                                const pct = r.totalAmount > 0 ? Math.round(r.paidAmount / r.totalAmount * 100) : 0;
                                return (
                                  <div>
                                    <div style={{ color: '#cf1322', fontWeight: 600 }}>¥{v.toLocaleString()}</div>
                                    <Progress percent={pct} size="small" showInfo={false} style={{ marginTop: 4, width: 100 }} />
                                  </div>
                                );
                              },
                            },
                            {
                              title: '逾期金额',
                              dataIndex: 'overdueAmount',
                              width: 130,
                              align: 'right',
                              render: v => v > 0
                                ? <Tag color="red">¥{v.toLocaleString()}</Tag>
                                : <span style={{ color: '#52c41a' }}>无逾期</span>,
                            },
                          ]}
                        />
                      ),
                    }]}
                  />

                  <div className="filter-bar">
                    <Input
                      placeholder="搜索账单号/采购单/供应商"
                      prefix={<SearchOutlined />}
                      value={keyword}
                      onChange={e => setKeyword(e.target.value)}
                      style={{ width: 280 }}
                      allowClear
                    />
                    <Select
                      placeholder="选择供应商"
                      allowClear
                      style={{ width: 220 }}
                      showSearch
                      value={supplierFilter}
                      onChange={setSupplierFilter}
                      options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                    />
                    <Select
                      placeholder="付款状态"
                      allowClear
                      style={{ width: 140 }}
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={Object.entries(paymentStatusMap).map(([k, v]) => ({ value: k, label: v.text }))}
                    />
                    <Button type="primary" ghost onClick={() => { setKeyword(''); setStatusFilter(undefined); setSupplierFilter(undefined); }}>
                      重置
                    </Button>
                  </div>

                  <Table
                    columns={payableColumns}
                    dataSource={filteredData}
                    rowKey="id"
                    scroll={{ x: 1700 }}
                    pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条账单` }}
                  />
                </>
              ),
            },
            {
              key: 'purchase-report',
              label: <span><CalendarOutlined />月度采购报表</span>,
              children: (
                <div>
                  <div className="page-header" style={{ marginTop: -16 }}>
                    <div>
                      <div className="page-title">月度采购分析报表</div>
                      <div className="page-subtitle">展示采购订单、入库金额、准时交付率等核心指标</div>
                    </div>
                    <Space>
                      <Radio.Group value={purchaseReportPeriod} onChange={(e) => setPurchaseReportPeriod(e.target.value)}>
                        <Radio.Button value="month">按月度</Radio.Button>
                        <Radio.Button value="quarter">按季度</Radio.Button>
                      </Radio.Group>
                      {purchaseReportPeriod === 'month' ? (
                        <DatePicker
                          picker="month"
                          value={purchaseReportDate}
                          onChange={(v) => v && setPurchaseReportDate(v)}
                          format="YYYY年MM月"
                        />
                      ) : (
                        <DatePicker
                          picker="quarter"
                          value={purchaseReportDate}
                          onChange={(v) => v && setPurchaseReportDate(v)}
                          format="YYYY年Q季度"
                        />
                      )}
                      <Button icon={<FileExcelOutlined />} onClick={() => {
                        const csvContent = [
                          ['周期', '采购单数量', '采购总金额', '物料条目数', '供应商数', '入库单数', '入库金额', '准时交付率(%)'],
                          ...monthlyPurchaseData.map(d => [
                            d.month, d.orderCount, d.totalAmount, d.itemCount, d.supplierCount,
                            d.receiptCount, d.receiptAmount, d.onTimeRate
                          ])
                        ].map(row => row.join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `采购报表_${dayjs().format('YYYYMMDD')}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                        message.success('报表已导出');
                      }}>
                        导出Excel
                      </Button>
                    </Space>
                  </div>

                  <Row gutter={16} style={{ marginBottom: 24 }}>
                    {(() => {
                      const current = monthlyPurchaseData[monthlyPurchaseData.length - 1];
                      const last = monthlyPurchaseData[monthlyPurchaseData.length - 2];
                      if (!current) return null;
                      return (
                        <>
                          <Col span={6}>
                            <Card>
                              <Statistic
                                title="当月采购单"
                                value={current.orderCount}
                                suffix="单"
                                valueStyle={{ color: '#1677ff' }}
                              />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card>
                              <Statistic
                                title="当月采购金额"
                                value={current.totalAmount}
                                prefix="¥"
                                precision={0}
                                valueStyle={{ color: '#cf1322' }}
                              />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card>
                              <Statistic
                                title="当月入库金额"
                                value={current.receiptAmount}
                                prefix="¥"
                                precision={0}
                                valueStyle={{ color: '#52c41a' }}
                              />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card>
                              <Statistic
                                title="准时交付率"
                                value={current.onTimeRate}
                                suffix="%"
                                valueStyle={{ color: current.onTimeRate >= 95 ? '#52c41a' : '#faad14' }}
                              />
                            </Card>
                          </Col>
                        </>
                      );
                    })()}
                  </Row>

                  <Card title="📈 采购金额与入库金额趋势" style={{ marginBottom: 24 }}>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={monthlyPurchaseData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RTooltip formatter={(val: any, name: string) => {
                          const map: Record<string, string> = {
                            totalAmount: '采购金额', receiptAmount: '入库金额', onTimeRate: '准时交付率(%)'
                          };
                          return [typeof val === 'number' ? `¥${val.toLocaleString()}` : val, map[name] || name];
                        }} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalAmount" name="采购金额" fill="#1677ff" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="receiptAmount" name="入库金额" fill="#52c41a" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="onTimeRate" name="准时交付率" stroke="#faad14" strokeWidth={3} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Card>

                  <Row gutter={16}>
                    <Col span={14}>
                      <Card title="🛒 采购单数量与物料条目数">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={monthlyPurchaseData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <RTooltip />
                            <Legend />
                            <Bar dataKey="orderCount" name="采购单数" fill="#722ed1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="itemCount" name="物料条目数" fill="#13c2c2" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>
                    <Col span={10}>
                      <Card title={`🏢 供应商采购占比（${purchaseReportPeriod === 'month' ? '当月' : '当季'}）`}>
                        {(() => {
                          let periodStart, periodEnd;
                          if (purchaseReportPeriod === 'month') {
                            periodStart = purchaseReportDate.clone().startOf('month');
                            periodEnd = purchaseReportDate.clone().endOf('month');
                          } else {
                            const quarter = Math.floor(purchaseReportDate.month() / 3);
                            const year = purchaseReportDate.year();
                            periodStart = dayjs(`${year}-${quarter * 3 + 1}-01`).startOf('month');
                            periodEnd = dayjs(`${year}-${quarter * 3 + 3}-01`).endOf('month');
                          }

                          const currentPOs = purchaseOrders.filter(p =>
                            dayjs(p.createTime).isBetween(periodStart, periodEnd, null, '[]') && p.supplierId
                          );
                          const supplierPOAmounts: Record<string, number> = {};
                          currentPOs.forEach(p => {
                            const key = p.supplierName || '未知';
                            supplierPOAmounts[key] = (supplierPOAmounts[key] || 0) + (p.totalAmount || 0);
                          });
                          const pieData = Object.entries(supplierPOAmounts).map(([name, value]) => ({ name, value }));
                          if (pieData.length === 0) return <Empty description="本期暂无数据" />;
                          return (
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name.split('').slice(0, 4).join('')} ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={90}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <RTooltip formatter={(val: any) => `¥${Number(val).toLocaleString()}`} />
                              </PieChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </Card>
                    </Col>
                  </Row>

                  <Divider />
                  <div className="modal-section-title">📋 月度数据明细</div>
                  <Table
                    size="small"
                    dataSource={monthlyPurchaseData}
                    rowKey="month"
                    pagination={false}
                    columns={[
                      { title: '月份', dataIndex: 'month', width: 100, fixed: 'left' },
                      { title: '采购单数量', dataIndex: 'orderCount', width: 110, align: 'right' },
                      { title: '采购总金额', dataIndex: 'totalAmount', width: 130, align: 'right', render: v => `¥${v.toLocaleString()}` },
                      { title: '物料条目数', dataIndex: 'itemCount', width: 110, align: 'right' },
                      { title: '供应商数', dataIndex: 'supplierCount', width: 100, align: 'right' },
                      { title: '入库单数', dataIndex: 'receiptCount', width: 100, align: 'right' },
                      { title: '入库金额', dataIndex: 'receiptAmount', width: 130, align: 'right', render: v => `¥${v.toLocaleString()}` },
                      {
                        title: '准时交付率',
                        dataIndex: 'onTimeRate',
                        width: 140,
                        render: v => (
                          <Progress
                            percent={v}
                            size="small"
                            status={v >= 95 ? 'success' : v >= 85 ? 'active' : 'exception'}
                          />
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'turnover-report',
              label: <span><FileDoneOutlined />库存周转报表</span>,
              children: (
                <div>
                  <div className="page-header" style={{ marginTop: -16 }}>
                    <div>
                      <div className="page-title">库存周转率分析</div>
                      <div className="page-subtitle">
                        分析各物料的出入库情况，计算库存周转率和周转天数，识别呆滞物料
                      </div>
                    </div>
                    <Space>
                      <DatePicker
                        picker="month"
                        value={reportMonth}
                        onChange={(v) => v && setReportMonth(v)}
                        style={{ width: 180 }}
                      />
                      <Select
                        placeholder="选择分类"
                        allowClear
                        style={{ width: 150 }}
                        value={turnoverCategoryFilter}
                        onChange={setTurnoverCategoryFilter}
                        options={categories.map(c => ({ value: c, label: c }))}
                      />
                      <Select
                        placeholder="选择仓库"
                        allowClear
                        style={{ width: 150 }}
                        value={turnoverWarehouseFilter}
                        onChange={setTurnoverWarehouseFilter}
                        options={warehouses.map(w => ({ value: w, label: w }))}
                      />
                      <Button
                        ghost
                        onClick={() => {
                          setTurnoverCategoryFilter(undefined);
                          setTurnoverWarehouseFilter(undefined);
                        }}
                      >
                        重置筛选
                      </Button>
                      <Button icon={<FileExcelOutlined />} onClick={() => {
                        const csvContent = [
                          ['物料名称', 'SKU', '分类', '期初库存', '期末库存', '平均库存',
                           '入库数量', '出库数量', '周转率(次/月)', '周转天数(天)', '入库金额', '出库金额'],
                          ...turnoverData.map(d => [
                            d.productName, d.sku, d.category, d.beginningStock, d.endingStock, d.avgStock,
                            d.inQty, d.outQty, d.turnoverRate, d.turnoverDays, d.inAmount, d.outAmount
                          ])
                        ].map(row => row.join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `库存周转报表_${dayjs().format('YYYYMMDD')}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                        message.success('报表已导出');
                      }}>
                        导出Excel
                      </Button>
                    </Space>
                  </div>

                  {(() => {
                    const totalIn = turnoverData.reduce((s, t) => s + t.inAmount, 0);
                    const totalOut = turnoverData.reduce((s, t) => s + t.outAmount, 0);
                    const avgTurnover = turnoverData.filter(t => t.turnoverRate > 0).length > 0
                      ? +(turnoverData.filter(t => t.turnoverRate > 0).reduce((s, t) => s + t.turnoverRate, 0)
                        / turnoverData.filter(t => t.turnoverRate > 0).length).toFixed(2)
                      : 0;
                    const deadStock = turnoverData.filter(t => t.outQty === 0 && t.endingStock > 0).length;
                    return (
                      <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={6}>
                          <Card>
                            <Statistic title="入库总金额" value={totalIn} prefix="¥" precision={0} valueStyle={{ color: '#52c41a' }} />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card>
                            <Statistic title="出库总金额" value={totalOut} prefix="¥" precision={0} valueStyle={{ color: '#1677ff' }} />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="平均周转率"
                              value={avgTurnover}
                              suffix="次/月"
                              valueStyle={{ color: avgTurnover >= 2 ? '#52c41a' : avgTurnover >= 1 ? '#faad14' : '#cf1322' }}
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card style={{ border: deadStock > 0 ? '1px solid #ffccc7' : undefined }}>
                            <Statistic
                              title="呆滞物料"
                              value={deadStock}
                              suffix="个SKU"
                              valueStyle={{ color: deadStock > 0 ? '#cf1322' : '#52c41a' }}
                            />
                          </Card>
                        </Col>
                      </Row>
                    );
                  })()}

                  <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={14}>
                      <Card title="📊 TOP10 高周转物料">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            layout="vertical"
                            data={turnoverData.slice(0, 10)}
                            margin={{ left: 100 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="productName" type="category" width={100} tick={{ fontSize: 12 }} />
                            <RTooltip formatter={(val: any, name: string) => {
                              const map: Record<string, string> = {
                                turnoverRate: '周转率(次/月)', turnoverDays: '周转天数(天)'
                              };
                              return [val, map[name] || name];
                            }} />
                            <Legend />
                            <Bar dataKey="turnoverRate" name="周转率" fill="#1677ff" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>
                    <Col span={10}>
                      <Card title="⚠️ 低周转/呆滞物料 TOP10">
                        <Table
                          size="small"
                          pagination={false}
                          dataSource={[...turnoverData]
                            .sort((a, b) => a.turnoverRate - b.turnoverRate)
                            .filter(t => t.endingStock > 0)
                            .slice(0, 10)}
                          rowKey="productId"
                          columns={[
                            {
                              title: '物料', dataIndex: 'productName',
                              render: (v, r: any) => (
                                <Tooltip title={r.sku}>
                                  <div style={{ fontSize: 12 }}>{v}</div>
                                </Tooltip>
                              )
                            },
                            {
                              title: '周转',
                              width: 120,
                              render: (_, r: StockTurnoverStat) => {
                                if (r.turnoverRate === 0) return <Tag color="red">呆滞</Tag>;
                                return (
                                  <div>
                                    <div style={{ fontSize: 12 }}>{r.turnoverRate}次 / {r.turnoverDays === 999 ? '∞' : r.turnoverDays + '天'}</div>
                                  </div>
                                );
                              },
                            },
                            {
                              title: '库存',
                              width: 90,
                              align: 'right',
                              render: (_, r) => <span style={{ color: '#8c8c8c' }}>{r.endingStock}</span>,
                            },
                          ]}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Divider />
                  <div className="modal-section-title">📋 周转明细数据（{reportMonth.format('YYYY年MM月')}）</div>
                  <Table
                    size="small"
                    dataSource={turnoverData}
                    rowKey="productId"
                    scroll={{ x: 1500 }}
                    pagination={{ pageSize: 15, showTotal: t => `共 ${t} 个SKU` }}
                    columns={[
                      { title: '物料名称', dataIndex: 'productName', width: 200, fixed: 'left' },
                      { title: 'SKU', dataIndex: 'sku', width: 120 },
                      { title: '分类', dataIndex: 'category', width: 100 },
                      { title: '期初库存', dataIndex: 'beginningStock', width: 90, align: 'right' },
                      { title: '期末库存', dataIndex: 'endingStock', width: 90, align: 'right' },
                      { title: '平均库存', dataIndex: 'avgStock', width: 90, align: 'right', render: v => v.toFixed(1) },
                      {
                        title: '入库数量', dataIndex: 'inQty', width: 90, align: 'right',
                        render: v => v > 0 ? <span style={{ color: '#52c41a' }}>+{v}</span> : v
                      },
                      {
                        title: '出库数量', dataIndex: 'outQty', width: 90, align: 'right',
                        render: v => v > 0 ? <span style={{ color: '#cf1322' }}>{v}</span> : <span style={{ color: '#bfbfbf' }}>0</span>
                      },
                      {
                        title: '周转率',
                        dataIndex: 'turnoverRate',
                        width: 110,
                        align: 'center',
                        render: (v, r) => {
                          if (v === 0 && r.endingStock > 0) {
                            return <Tag color="red">呆滞（0次）</Tag>;
                          }
                          const color = v >= 3 ? 'green' : v >= 1.5 ? 'blue' : v >= 0.5 ? 'orange' : 'red';
                          return <Tag color={color}>{v} 次/月</Tag>;
                        },
                      },
                      {
                        title: '周转天数',
                        dataIndex: 'turnoverDays',
                        width: 110,
                        align: 'center',
                        render: (v, r) => {
                          if (r.turnoverRate === 0) return <span style={{ color: '#bfbfbf' }}>-</span>;
                          return (
                            <span style={{
                              color: v <= 10 ? '#52c41a' : v <= 20 ? '#1677ff' : v <= 30 ? '#faad14' : '#cf1322',
                              fontWeight: 600
                            }}>
                              {v === 999 ? '>365天' : `${v} 天`}
                            </span>
                          );
                        },
                      },
                      { title: '入库金额', width: 120, align: 'right', render: (_, r) => `¥${r.inAmount.toLocaleString()}` },
                      { title: '出库金额', width: 120, align: 'right', render: (_, r) => `¥${r.outAmount.toLocaleString()}` },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'receivable',
              label: <span><DollarOutlined />客户应收</span>,
              children: (
                <>
                  <div className="page-header" style={{ marginTop: -16 }}>
                    <div>
                      <div className="page-title">客户应收管理</div>
                      <div className="page-subtitle">管理客户应收账款，登记收款记录</div>
                    </div>
                  </div>

                  <div className="stat-cards">
                    <Card className="stat-card" bordered={false}>
                      <div className="stat-label">应收账单总数</div>
                      <div className="stat-value">{arStats.count}</div>
                      <div className="stat-trend">覆盖 {arCustomers.length} 家客户</div>
                    </Card>
                    <Card className="stat-card" bordered={false}>
                      <div className="stat-label">应收总额</div>
                      <div className="stat-value">¥{arStats.totalReceivable.toLocaleString()}</div>
                      <div className="stat-trend">已收 ¥{arStats.totalReceived.toLocaleString()}</div>
                    </Card>
                    <Card className="stat-card" bordered={false} style={{ border: '1px solid #ffccc7' }}>
                      <div className="stat-label" style={{ color: '#a8071a' }}><WarningOutlined /> 未收款项</div>
                      <div className="stat-value" style={{ color: '#cf1322' }}>¥{arStats.totalUnreceived.toLocaleString()}</div>
                      <div className="stat-trend" style={{ color: '#cf1322' }}>
                        待收款 {receivables.filter(r => r.status !== 'paid').length} 笔
                      </div>
                    </Card>
                    <Card className="stat-card" bordered={false} style={{ border: '1px solid #ffa39e', background: '#fff1f0' }}>
                      <div className="stat-label" style={{ color: '#a8071a' }}>逾期金额</div>
                      <div className="stat-value" style={{ color: '#cf1322' }}>¥{arStats.overdue.toLocaleString()}</div>
                      <div className="stat-trend" style={{ color: '#cf1322', fontWeight: 500 }}>请及时催收！</div>
                    </Card>
                  </div>

                  <Collapse
                    style={{ marginBottom: 16 }}
                    items={[{
                      key: '1',
                      label: <strong><BarChartOutlined /> 按客户汇总</strong>,
                      children: (
                        <Table
                          size="small"
                          pagination={false}
                          dataSource={customerSummary}
                          rowKey="customerName"
                          columns={[
                            { title: '客户名称', dataIndex: 'customerName', width: 220 },
                            { title: '账单数', dataIndex: 'billCount', width: 80, align: 'right' },
                            {
                              title: '累计金额', dataIndex: 'totalAmount', width: 130, align: 'right',
                              render: v => <span style={{ fontWeight: 500 }}>¥{v.toLocaleString()}</span>
                            },
                            {
                              title: '已收款', dataIndex: 'receivedAmount', width: 130, align: 'right',
                              render: v => <span style={{ color: '#52c41a' }}>¥{v.toLocaleString()}</span>
                            },
                            {
                              title: '未收金额',
                              dataIndex: 'unreceivedAmount',
                              width: 140,
                              align: 'right',
                              render: (v, r) => {
                                const pct = r.totalAmount > 0 ? Math.round(r.receivedAmount / r.totalAmount * 100) : 0;
                                return (
                                  <div>
                                    <div style={{ color: '#cf1322', fontWeight: 600 }}>¥{v.toLocaleString()}</div>
                                    <Progress percent={pct} size="small" showInfo={false} style={{ marginTop: 4, width: 100 }} />
                                  </div>
                                );
                              },
                            },
                            {
                              title: '逾期金额',
                              dataIndex: 'overdueAmount',
                              width: 130,
                              align: 'right',
                              render: v => v > 0
                                ? <Tag color="red">¥{v.toLocaleString()}</Tag>
                                : <span style={{ color: '#52c41a' }}>无逾期</span>,
                            },
                          ]}
                        />
                      ),
                    }]}
                  />

                  <div className="filter-bar">
                    <Input
                      placeholder="搜索账单号/订单号/客户/发货单"
                      prefix={<SearchOutlined />}
                      value={arKeyword}
                      onChange={e => setArKeyword(e.target.value)}
                      style={{ width: 300 }}
                      allowClear
                    />
                    <Select
                      placeholder="选择客户"
                      allowClear
                      style={{ width: 220 }}
                      showSearch
                      value={arCustomerFilter}
                      onChange={setArCustomerFilter}
                      options={arCustomers.map(c => ({ value: c, label: c }))}
                    />
                    <Select
                      placeholder="收款状态"
                      allowClear
                      style={{ width: 140 }}
                      value={arStatusFilter}
                      onChange={setArStatusFilter}
                      options={Object.entries(paymentStatusMap).map(([k, v]) => ({ value: k, label: v.text }))}
                    />
                    <Button type="primary" ghost onClick={() => { setArKeyword(''); setArStatusFilter(undefined); setArCustomerFilter(undefined); }}>
                      重置
                    </Button>
                    <Button icon={<FileExcelOutlined />} onClick={() => {
                      const csvContent = [
                        ['账单号', '销售订单号', '发货单号', '客户名称', '账单金额', '已收款', '未收款', '账单日期', '到期日期', '状态'],
                        ...filteredReceivables.map(r => [
                          r.billNo, r.salesOrderNo, r.shipmentNo, r.customerName,
                          r.totalAmount, r.receivedAmount, r.unreceivedAmount,
                          r.billDate, r.dueDate, paymentStatusMap[r.status].text
                        ])
                      ].map(row => row.join(',')).join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `客户应收报表_${dayjs().format('YYYYMMDD')}.csv`;
                      link.click();
                      URL.revokeObjectURL(url);
                      message.success('报表已导出');
                    }}>
                      导出Excel
                    </Button>
                  </div>

                  <Table
                    columns={receivableColumns}
                    dataSource={filteredReceivables}
                    rowKey="id"
                    scroll={{ x: 1700 }}
                    pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条账单` }}
                  />
                </>
              ),
            },
            {
              key: 'sales-profit',
              label: <span><FundOutlined />销售毛利</span>,
              children: (
                <div>
                  <div className="page-header" style={{ marginTop: -16 }}>
                    <div>
                      <div className="page-title">销售毛利报表</div>
                      <div className="page-subtitle">分析销售收入、成本和毛利趋势</div>
                    </div>
                    <Space>
                      <Radio.Group value={profitPeriod} onChange={(e) => setProfitPeriod(e.target.value)}>
                        <Radio.Button value="month">按月度</Radio.Button>
                        <Radio.Button value="quarter">按季度</Radio.Button>
                      </Radio.Group>
                      {profitPeriod === 'month' ? (
                        <DatePicker
                          picker="month"
                          value={profitBaseDate}
                          onChange={(v) => v && setProfitBaseDate(v)}
                          format="YYYY年MM月"
                        />
                      ) : (
                        <DatePicker
                          picker="quarter"
                          value={profitBaseDate}
                          onChange={(v) => v && setProfitBaseDate(v)}
                          format="YYYY年Q季度"
                        />
                      )}
                      <Select
                        placeholder="选择客户"
                        allowClear
                        style={{ width: 180 }}
                        showSearch
                        value={profitCustomerFilter}
                        onChange={setProfitCustomerFilter}
                        options={shipmentCustomers.map(c => ({ value: c, label: c }))}
                      />
                      <Select
                        placeholder="产品分类"
                        allowClear
                        style={{ width: 150 }}
                        value={profitCategoryFilter}
                        onChange={setProfitCategoryFilter}
                        options={categories.map(c => ({ value: c, label: c }))}
                      />
                      <Button ghost onClick={() => { setProfitCustomerFilter(undefined); setProfitCategoryFilter(undefined); }}>
                        重置筛选
                      </Button>
                      <Button icon={<FileExcelOutlined />} onClick={() => {
                        const csvContent = [
                          ['发货单号', '销售订单号', '客户名称', '创建时间', '销售收入', '销售成本', '毛利润', '毛利率(%)'],
                          ...profitTableData.map(d => [
                            d.shipmentNo, d.salesOrderNo, d.customerName, d.createTime,
                            d.totalAmount, d.costAmount, d.profit, d.profitRate
                          ])
                        ].map(row => row.join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `销售毛利报表_${dayjs().format('YYYYMMDD')}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                        message.success('报表已导出');
                      }}>
                        导出Excel
                      </Button>
                    </Space>
                  </div>

                  <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={6}>
                      <Card>
                        <Statistic title="销售收入" value={profitStats.revenue} prefix="¥" precision={0} valueStyle={{ color: '#1677ff' }} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic title="销售成本" value={profitStats.cost} prefix="¥" precision={0} valueStyle={{ color: '#faad14' }} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="毛利润"
                          value={profitStats.profit}
                          prefix="¥"
                          precision={0}
                          valueStyle={{ color: profitStats.profit >= 0 ? '#52c41a' : '#cf1322' }}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="毛利率"
                          value={profitStats.rate}
                          suffix="%"
                          precision={1}
                          valueStyle={{ color: profitStats.rate >= 20 ? '#52c41a' : profitStats.rate >= 10 ? '#faad14' : '#cf1322' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card title="📈 销售/成本/毛利趋势" style={{ marginBottom: 24 }}>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={profitChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RTooltip formatter={(val: any, name: string) => {
                          const map: Record<string, string> = {
                            revenue: '销售收入', cost: '销售成本', profit: '毛利润', rate: '毛利率(%)'
                          };
                          return [typeof val === 'number' ? (name === 'rate' ? `${val}%` : `¥${val.toLocaleString()}`) : val, map[name] || name];
                        }} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="revenue" name="销售收入" fill="#1677ff" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="cost" name="销售成本" fill="#faad14" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="profit" name="毛利润" fill="#52c41a" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="rate" name="毛利率" stroke="#722ed1" strokeWidth={3} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Card>

                  <Divider />
                  <div className="modal-section-title">📋 发货单毛利明细</div>
                  <Table
                    size="small"
                    dataSource={profitTableData}
                    rowKey="id"
                    scroll={{ x: 1200 }}
                    pagination={{ pageSize: 15, showTotal: t => `共 ${t} 条发货单` }}
                    columns={[
                      { title: '发货单号', dataIndex: 'shipmentNo', width: 150, fixed: 'left' },
                      { title: '销售订单号', dataIndex: 'salesOrderNo', width: 150 },
                      { title: '客户名称', dataIndex: 'customerName', width: 180 },
                      { title: '创建时间', dataIndex: 'createTime', width: 160 },
                      {
                        title: '销售收入', dataIndex: 'totalAmount', width: 130, align: 'right',
                        render: v => <span style={{ color: '#1677ff', fontWeight: 500 }}>¥{v.toLocaleString()}</span>
                      },
                      {
                        title: '销售成本', dataIndex: 'costAmount', width: 130, align: 'right',
                        render: v => <span style={{ color: '#faad14' }}>¥{v.toLocaleString()}</span>
                      },
                      {
                        title: '毛利润', dataIndex: 'profit', width: 130, align: 'right',
                        render: v => <span style={{ color: v >= 0 ? '#52c41a' : '#cf1322', fontWeight: 600 }}>¥{v.toLocaleString()}</span>
                      },
                      {
                        title: '毛利率', dataIndex: 'profitRate', width: 120, align: 'center',
                        render: v => {
                          const color = v >= 20 ? 'green' : v >= 10 ? 'orange' : 'red';
                          return <Tag color={color}>{v}%</Tag>;
                        }
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={
          <div>
            登记付款
            <Tag style={{ marginLeft: 8 }}>{paymentModal?.billNo}</Tag>
          </div>
        }
        open={!!paymentModal}
        onCancel={() => { setPaymentModal(null); form.resetFields(); }}
        onOk={handlePayment}
        width={520}
        okText="确认付款"
        cancelText="取消"
      >
        {paymentModal && (
          <div>
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>供应商：</strong>{paymentModal.supplierName}</p>
                  <p><strong>账单金额：</strong><span style={{ fontWeight: 600 }}>¥{paymentModal.totalAmount.toLocaleString()}</span></p>
                </Col>
                <Col span={12}>
                  <p><strong>已付款：</strong><span style={{ color: '#52c41a' }}>¥{paymentModal.paidAmount.toLocaleString()}</span></p>
                  <p><strong>未付款：</strong><span style={{ color: '#cf1322', fontWeight: 600 }}>¥{paymentModal.unpaidAmount.toLocaleString()}</span></p>
                </Col>
              </Row>
              <Progress
                percent={paymentModal.totalAmount > 0 ? Math.round(paymentModal.paidAmount / paymentModal.totalAmount * 100) : 0}
                showInfo={true}
              />
            </Card>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="amount"
                    label="付款金额 (元)"
                    rules={[
                      { required: true, message: '请输入付款金额' },
                      {
                        validator: (_, v) => v > paymentModal.unpaidAmount + 0.01
                          ? Promise.reject('付款金额不能超过未付款金额')
                          : Promise.resolve()
                      }
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0}
                      max={paymentModal.unpaidAmount}
                      prefix="¥"
                      style={{ width: '100%' }}
                      placeholder={`最多可付 ¥${paymentModal.unpaidAmount.toLocaleString()}`}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="method" label="付款方式" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                    <Select options={[
                      { value: '银行转账', label: '银行转账' },
                      { value: '银行承兑', label: '银行承兑汇票' },
                      { value: '商业承兑', label: '商业承兑汇票' },
                      { value: '现金', label: '现金' },
                      { value: '支付宝', label: '支付宝' },
                      { value: '微信', label: '微信支付' },
                    ]} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="reference" label="流水/凭证号" style={{ marginTop: 16, marginBottom: 0 }}>
                <Input placeholder="银行流水号、票据号等" />
              </Form.Item>
              <Form.Item name="remark" label="备注" style={{ marginTop: 16, marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="备注说明" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title={`账单详情 - ${detailModal?.billNo}`}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        width={780}
        footer={[<Button key="close" onClick={() => setDetailModal(null)}>关闭</Button>]}
      >
        {detailModal && (
          <div>
            <Row gutter={24}>
              <Col span={12}>
                <p><strong>供应商：</strong>{detailModal.supplierName}</p>
                <p><strong>采购单：</strong>{detailModal.purchaseOrderNo}</p>
                <p><strong>入库单：</strong>{detailModal.receiptNo || '-'}</p>
              </Col>
              <Col span={12}>
                <p><strong>账单日期：</strong>{detailModal.billDate}</p>
                <p><strong>到期日期：</strong>
                  <span style={{
                    color: detailModal.status !== 'paid' && dayjs(detailModal.dueDate).isBefore(dayjs())
                      ? '#cf1322' : undefined,
                    fontWeight: 600
                  }}>
                    {detailModal.dueDate}
                  </span>
                </p>
                <p><strong>状态：</strong>
                  <Tag color={paymentStatusMap[detailModal.status].color}>
                    {paymentStatusMap[detailModal.status].text}
                  </Tag>
                </p>
              </Col>
            </Row>
            <Divider />
            <div className="modal-section-title">物料明细</div>
            <Table
              size="small"
              pagination={false}
              dataSource={detailModal.items}
              rowKey="productId"
              columns={[
                { title: '物料', dataIndex: 'productName' },
                { title: 'SKU', dataIndex: 'sku', width: 120 },
                { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
                { title: '单价', width: 90, align: 'right', render: (_, r) => `¥${r.unitPrice}` },
                { title: '小计', width: 110, align: 'right', render: (_, r) => `¥${r.subtotal.toLocaleString()}` },
              ]}
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}><div style={{ textAlign: 'right', fontWeight: 600 }}>合计：</div></Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <div style={{ textAlign: 'right', color: '#cf1322', fontWeight: 700 }}>
                        ¥{detailModal.totalAmount.toLocaleString()}
                      </div>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
            <Divider />
            <div className="modal-section-title">
              付款记录（{detailModal.payments.length}笔）
            </div>
            {detailModal.payments.length === 0 ? (
              <div className="empty-tip" style={{ padding: 24 }}>暂无付款记录</div>
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={detailModal.payments}
                rowKey="date"
                columns={[
                  { title: '付款日期', dataIndex: 'date', width: 120 },
                  { title: '付款方式', dataIndex: 'method', width: 120 },
                  {
                    title: '付款金额', dataIndex: 'amount', width: 130, align: 'right',
                    render: v => <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{v.toLocaleString()}</span>
                  },
                  { title: '流水号', dataIndex: 'reference', width: 160, render: v => v || '-' },
                  { title: '备注', dataIndex: 'remark', render: v => v || '-' },
                ]}
              />
            )}
            <Divider />
            <Row gutter={24}>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="账单总额" value={detailModal.totalAmount} prefix="¥" precision={0} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="已付款" value={detailModal.paidAmount} prefix="¥" precision={0} valueStyle={{ color: '#52c41a' }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ border: detailModal.unpaidAmount > 0 ? '1px solid #ffccc7' : undefined }}>
                  <Statistic
                    title="未付款"
                    value={detailModal.unpaidAmount}
                    prefix="¥"
                    precision={0}
                    valueStyle={{ color: detailModal.unpaidAmount > 0 ? '#cf1322' : '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <div>
            登记收款
            <Tag style={{ marginLeft: 8 }}>{receivablePaymentModal?.billNo}</Tag>
          </div>
        }
        open={!!receivablePaymentModal}
        onCancel={() => { setReceivablePaymentModal(null); receivableForm.resetFields(); }}
        onOk={handleReceivablePayment}
        width={520}
        okText="确认收款"
        cancelText="取消"
      >
        {receivablePaymentModal && (
          <div>
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>客户：</strong>{receivablePaymentModal.customerName}</p>
                  <p><strong>账单金额：</strong><span style={{ fontWeight: 600 }}>¥{receivablePaymentModal.totalAmount.toLocaleString()}</span></p>
                </Col>
                <Col span={12}>
                  <p><strong>已收款：</strong><span style={{ color: '#52c41a' }}>¥{receivablePaymentModal.receivedAmount.toLocaleString()}</span></p>
                  <p><strong>未收款：</strong><span style={{ color: '#cf1322', fontWeight: 600 }}>¥{receivablePaymentModal.unreceivedAmount.toLocaleString()}</span></p>
                </Col>
              </Row>
              <Progress
                percent={receivablePaymentModal.totalAmount > 0 ? Math.round(receivablePaymentModal.receivedAmount / receivablePaymentModal.totalAmount * 100) : 0}
                showInfo={true}
              />
            </Card>
            <Form form={receivableForm} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="amount"
                    label="收款金额 (元)"
                    rules={[
                      { required: true, message: '请输入收款金额' },
                      {
                        validator: (_, v) => v > receivablePaymentModal.unreceivedAmount + 0.01
                          ? Promise.reject('收款金额不能超过未收款金额')
                          : Promise.resolve()
                      }
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0}
                      max={receivablePaymentModal.unreceivedAmount}
                      prefix="¥"
                      style={{ width: '100%' }}
                      placeholder={`最多可收 ¥${receivablePaymentModal.unreceivedAmount.toLocaleString()}`}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="method" label="收款方式" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                    <Select options={[
                      { value: '银行转账', label: '银行转账' },
                      { value: '银行承兑', label: '银行承兑汇票' },
                      { value: '商业承兑', label: '商业承兑汇票' },
                      { value: '现金', label: '现金' },
                      { value: '支付宝', label: '支付宝' },
                      { value: '微信', label: '微信支付' },
                    ]} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="reference" label="流水号" style={{ marginTop: 16, marginBottom: 0 }}>
                <Input placeholder="银行流水号、票据号等" />
              </Form.Item>
              <Form.Item name="remark" label="备注" style={{ marginTop: 16, marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="备注说明" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title={`应收详情 - ${receivableDetailModal?.billNo}`}
        open={!!receivableDetailModal}
        onCancel={() => setReceivableDetailModal(null)}
        width={780}
        footer={[<Button key="close" onClick={() => setReceivableDetailModal(null)}>关闭</Button>]}
      >
        {receivableDetailModal && (
          <div>
            <Row gutter={24}>
              <Col span={12}>
                <p><strong>客户：</strong>{receivableDetailModal.customerName}</p>
                <p><strong>销售订单：</strong>{receivableDetailModal.salesOrderNo}</p>
                <p><strong>发货单：</strong>{receivableDetailModal.shipmentNo}</p>
              </Col>
              <Col span={12}>
                <p><strong>账单日期：</strong>{receivableDetailModal.billDate}</p>
                <p><strong>到期日期：</strong>
                  <span style={{
                    color: receivableDetailModal.status !== 'paid' && dayjs(receivableDetailModal.dueDate).isBefore(dayjs())
                      ? '#cf1322' : undefined,
                    fontWeight: 600
                  }}>
                    {receivableDetailModal.dueDate}
                  </span>
                </p>
                <p><strong>状态：</strong>
                  <Tag color={paymentStatusMap[receivableDetailModal.status].color}>
                    {paymentStatusMap[receivableDetailModal.status].text}
                  </Tag>
                </p>
              </Col>
            </Row>
            <Divider />
            <div className="modal-section-title">物料明细</div>
            <Table
              size="small"
              pagination={false}
              dataSource={receivableDetailModal.items}
              rowKey="productId"
              columns={[
                { title: '物料', dataIndex: 'productName' },
                { title: 'SKU', dataIndex: 'sku', width: 120 },
                { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
                { title: '单价', width: 90, align: 'right', render: (_, r) => `¥${r.unitPrice}` },
                { title: '成本价', width: 90, align: 'right', render: (_, r) => `¥${r.costPrice}` },
                { title: '小计', width: 110, align: 'right', render: (_, r) => `¥${r.subtotal.toLocaleString()}` },
              ]}
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5}><div style={{ textAlign: 'right', fontWeight: 600 }}>合计：</div></Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>
                      <div style={{ textAlign: 'right', color: '#cf1322', fontWeight: 700 }}>
                        ¥{receivableDetailModal.totalAmount.toLocaleString()}
                      </div>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
            <Divider />
            <div className="modal-section-title">
              收款记录（{receivableDetailModal.receipts.length}笔）
            </div>
            {receivableDetailModal.receipts.length === 0 ? (
              <div className="empty-tip" style={{ padding: 24 }}>暂无收款记录</div>
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={receivableDetailModal.receipts}
                rowKey="date"
                columns={[
                  { title: '收款日期', dataIndex: 'date', width: 120 },
                  { title: '收款方式', dataIndex: 'method', width: 120 },
                  {
                    title: '收款金额', dataIndex: 'amount', width: 130, align: 'right',
                    render: v => <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{v.toLocaleString()}</span>
                  },
                  { title: '流水号', dataIndex: 'reference', width: 160, render: v => v || '-' },
                  { title: '备注', dataIndex: 'remark', render: v => v || '-' },
                ]}
              />
            )}
            <Divider />
            <Row gutter={24}>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="账单总额" value={receivableDetailModal.totalAmount} prefix="¥" precision={0} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="已收款" value={receivableDetailModal.receivedAmount} prefix="¥" precision={0} valueStyle={{ color: '#52c41a' }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ border: receivableDetailModal.unreceivedAmount > 0 ? '1px solid #ffccc7' : undefined }}>
                  <Statistic
                    title="未收款"
                    value={receivableDetailModal.unreceivedAmount}
                    prefix="¥"
                    precision={0}
                    valueStyle={{ color: receivableDetailModal.unreceivedAmount > 0 ? '#cf1322' : '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}
