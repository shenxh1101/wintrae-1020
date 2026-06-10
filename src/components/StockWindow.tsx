import { useState, useMemo, useEffect } from 'react';
import {
  Table, Tag, Button, Modal, Form, Input, Select, InputNumber,
  Card, Row, Col, Divider, message, Tabs, Progress, Badge,
  Tooltip, Popover, Space,
} from 'antd';
import {
  SearchOutlined, WarningOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, AlertOutlined, GiftOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store/appStore';
import { StockRecord, StockMovement, StockRisk, SalesOrder } from '../types';

export default function StockWindow() {
  const {
    stockRecords, stockMovements, stockRisks, salesOrders, products,
    allocateStock, releaseAllocation, recalculateStockRisks,
  } = useAppStore();
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>();
  const [riskFilter, setRiskFilter] = useState<string | undefined>();
  const [allocateModal, setAllocateModal] = useState<SalesOrder | null>(null);
  const [movementModal, setMovementModal] = useState<string | null>(null);
  const [allocForm] = Form.useForm();

  useEffect(() => {
    recalculateStockRisks();
  }, [stockRecords, salesOrders]);

  const stats = useMemo(() => {
    const totalSKU = stockRecords.length;
    const totalQty = stockRecords.reduce((s, r) => s + r.quantity, 0);
    const totalValue = stockRecords.reduce((s, r) => s + r.totalValue, 0);
    const criticalCount = stockRisks.filter(r => r.riskLevel === 'critical').length;
    const warningCount = stockRisks.filter(r => r.riskLevel === 'warning').length;
    return { totalSKU, totalQty, totalValue, criticalCount, warningCount };
  }, [stockRecords, stockRisks]);

  const categories = useMemo(() => {
    return Array.from(new Set(stockRecords.map(r => r.category))).filter(Boolean);
  }, [stockRecords]);

  const warehouses = useMemo(() => {
    return Array.from(new Set(stockRecords.map(r => r.warehouse))).filter(Boolean);
  }, [stockRecords]);

  const enrichedStockRecords = useMemo(() => {
    return stockRecords.map(r => {
      const product = products.find(p => p.id === r.productId);
      const availableQty = r.quantity - (r.allocatedQty || 0);
      const safetyStock = product?.safetyStock || 0;
      let risk = 'normal';
      if (availableQty < safetyStock * 0.3) risk = 'critical';
      else if (availableQty < safetyStock) risk = 'warning';
      const availabilityRate = safetyStock > 0 ? Math.min(100, Math.round((availableQty / safetyStock) * 100)) : 100;

      return {
        ...r,
        availableQty,
        safetyStock,
        riskLevel: risk as 'normal' | 'warning' | 'critical',
        availabilityRate,
        spec: product?.spec,
      };
    });
  }, [stockRecords, products]);

  const filteredStock = useMemo(() => {
    return enrichedStockRecords.filter(r => {
      if (keyword && !r.productName.includes(keyword) && !r.sku.includes(keyword)) return false;
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (warehouseFilter && r.warehouse !== warehouseFilter) return false;
      if (riskFilter && r.riskLevel !== riskFilter) return false;
      return true;
    });
  }, [enrichedStockRecords, keyword, categoryFilter, warehouseFilter, riskFilter]);

  const filteredMovements = useMemo(() => {
    if (!movementModal) return stockMovements;
    return stockMovements.filter(m => m.productId === movementModal);
  }, [stockMovements, movementModal]);

  const pendingAllocationOrders = useMemo(() => {
    return salesOrders.filter(s =>
      ['pending_allocation', 'partially_allocated'].includes(s.status)
    );
  }, [salesOrders]);

  const typeColorMap: Record<string, string> = {
    in: 'green', out: 'red', adjust: 'orange', transfer: 'blue', allocate: 'purple', release: 'cyan',
  };

  const typeTextMap: Record<string, string> = {
    in: '入库', out: '出库', adjust: '调整', transfer: '调拨', allocate: '分配', release: '释放',
  };

  const stockColumns: ColumnsType<typeof enrichedStockRecords[0]> = [
    {
      title: '物料名称',
      dataIndex: 'productName',
      width: 200,
      fixed: 'left',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      ),
    },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '仓库', dataIndex: 'warehouse', width: 120 },
    { title: '库位', dataIndex: 'location', width: 90 },
    {
      title: '库存数量',
      width: 120,
      align: 'right',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{r.quantity} <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>{r.unit}</span></div>
        </div>
      ),
    },
    {
      title: '已分配',
      width: 100,
      align: 'right',
      render: (v, r) => (r.allocatedQty || 0) > 0
        ? <Tag color="purple">{r.allocatedQty} {r.unit}</Tag>
        : <span style={{ color: '#bfbfbf' }}>-</span>,
    },
    {
      title: '可用库存',
      width: 120,
      align: 'right',
      render: (_, r) => {
        const color = r.riskLevel === 'critical' ? '#cf1322' : r.riskLevel === 'warning' ? '#d48806' : '#389e0d';
        return <div style={{ color, fontWeight: 600, fontSize: 15 }}>{r.availableQty} {r.unit}</div>;
      },
    },
    {
      title: '安全库存',
      width: 100,
      align: 'right',
      render: (_, r) => <span style={{ color: '#8c8c8c' }}>{r.safetyStock}</span>,
    },
    {
      title: '库存健康度',
      width: 160,
      render: (_, r) => {
        const status = r.availabilityRate < 30 ? 'exception' : r.availabilityRate < 100 ? 'normal' : 'success';
        const cls = r.availabilityRate < 30 ? 'critical' : r.availabilityRate < 100 ? 'low' : '';
        return (
          <div>
            <Progress
              percent={r.availabilityRate}
              status={status as any}
              size="small"
              showInfo={false}
              style={{ marginBottom: 4 }}
            />
            <div className="stock-available-bar" style={{ display: 'none' }}>
              <div className={`fill ${cls}`} style={{ width: `${r.availabilityRate}%` }}></div>
            </div>
          </div>
        );
      },
    },
    {
      title: '风险等级',
      width: 110,
      align: 'center',
      render: (_, r) => {
        if (r.riskLevel === 'critical') {
          return <Tag color="red" icon={<ExclamationCircleOutlined />}>紧急缺货</Tag>;
        } else if (r.riskLevel === 'warning') {
          return <Tag color="orange" icon={<WarningOutlined />}>库存预警</Tag>;
        }
        return <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>;
      },
    },
    {
      title: '单位成本',
      width: 110,
      align: 'right',
      render: (_, r) => `¥${r.unitPrice.toFixed(2)}`,
    },
    {
      title: '库存总值',
      width: 130,
      align: 'right',
      render: (_, r) => <span style={{ fontWeight: 500 }}>¥{r.totalValue.toLocaleString()}</span>,
    },
    { title: '最近更新', dataIndex: 'lastUpdated', width: 110 },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, r) => (
        <div className="table-action-col">
          <Button type="link" size="small" onClick={() => setMovementModal(r.productId)}>
            流水
          </Button>
        </div>
      ),
    },
  ];

  const riskColumns: ColumnsType<StockRisk> = [
    {
      title: '物料名称',
      dataIndex: 'productName',
      width: 200,
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      ),
    },
    { title: '分类', dataIndex: 'category', width: 100 },
    {
      title: '风险等级',
      width: 110,
      align: 'center',
      render: (_, r) => {
        if (r.riskLevel === 'critical') return <Tag color="red" icon={<ExclamationCircleOutlined />}>紧急</Tag>;
        return <Tag color="orange" icon={<WarningOutlined />}>预警</Tag>;
      },
    },
    { title: '当前库存', dataIndex: 'currentStock', width: 90, align: 'right' },
    { title: '已分配', dataIndex: 'allocatedQty', width: 90, align: 'right' },
    {
      title: '可用库存',
      dataIndex: 'availableQty',
      width: 100,
      align: 'right',
      render: (v, r) => <span style={{ color: r.riskLevel === 'critical' ? '#cf1322' : '#d48806', fontWeight: 600 }}>{v}</span>,
    },
    { title: '安全库存', dataIndex: 'safetyStock', width: 90, align: 'right' },
    {
      title: '预计可用天数',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Tooltip title={`最近30天消耗 ${r.last30DaysConsumption} 件`}>
          <Tag color={r.estimatedDaysLeft < 3 ? 'red' : r.estimatedDaysLeft < 7 ? 'orange' : 'blue'}>
            {r.estimatedDaysLeft === 999 ? '充足' : `${r.estimatedDaysLeft} 天`}
          </Tag>
        </Tooltip>
      ),
    },
    { title: '在途采购', dataIndex: 'pendingPurchaseQty', width: 90, align: 'right', render: v => v > 0 ? v : '-' },
    {
      title: '影响订单',
      dataIndex: 'affectedOrders',
      width: 200,
      render: (v) => v && v.length > 0
        ? v.map((o: string) => <Tag key={o} color="blue">{o}</Tag>)
        : <span style={{ color: '#bfbfbf' }}>暂无</span>,
    },
  ];

  const allocColumns: ColumnsType<any> = [
    {
      title: '物料',
      dataIndex: 'productName',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      ),
    },
    { title: '需求数量', dataIndex: 'quantity', width: 90, align: 'right' },
    { title: '已分配', dataIndex: 'allocatedQty', width: 90, align: 'right' },
    {
      title: '待分配',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const diff = r.quantity - (r.allocatedQty || 0);
        return <span style={{ color: diff > 0 ? '#cf1322' : '#52c41a', fontWeight: 600 }}>{diff}</span>;
      },
    },
    {
      title: '可用库存',
      width: 130,
      align: 'right',
      render: (_, r) => {
        const stock = stockRecords.find(s => s.productId === r.productId);
        if (!stock) return <span style={{ color: '#cf1322' }}>0（缺货）</span>;
        const available = stock.quantity - (stock.allocatedQty || 0);
        const color = available <= 0 ? '#cf1322' : available < (r.quantity - (r.allocatedQty || 0)) ? '#d48806' : '#389e0d';
        return <span style={{ color, fontWeight: 600 }}>{available} {stock.unit}</span>;
      },
    },
    {
      title: '本次分配数量',
      width: 180,
      render: (_, r, idx) => {
        const stock = stockRecords.find(s => s.productId === r.productId);
        const available = stock ? stock.quantity - (stock.allocatedQty || 0) : 0;
        const pending = r.quantity - (r.allocatedQty || 0);
        const max = Math.min(available, pending);
        return (
          <Form.Item name={['items', idx, 'qty']} style={{ marginBottom: 0 }} initialValue={max}>
            <InputNumber min={0} max={max} style={{ width: '100%' }} placeholder={max > 0 ? `最多可分配 ${max}` : '无可用库存'} />
          </Form.Item>
        );
      },
    },
  ];

  const handleAllocate = async () => {
    if (!allocateModal) return;
    try {
      const values = await allocForm.validateFields();
      const allocations = (values.items || [])
        .filter((it: any) => it.qty > 0)
        .map((it: any, idx: number) => ({
          productId: allocateModal.items[idx].productId,
          qty: it.qty,
        }));

      if (allocations.length === 0) {
        message.warning('请至少分配一项');
        return;
      }

      allocateStock(allocateModal.id, allocations);
      message.success('库存分配成功');
      setAllocateModal(null);
      allocForm.resetFields();
    } catch (e) {
      //
    }
  };

  return (
    <div>
      <div className="stat-cards">
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">物料 SKU 数</div>
          <div className="stat-value">{stats.totalSKU}</div>
          <div className="stat-trend">覆盖 {categories.length} 个分类</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">库存总件数</div>
          <div className="stat-value">{stats.totalQty.toLocaleString()}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>
            <ArrowUpOutlined /> 较月初 +8.6%
          </div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">库存总价值</div>
          <div className="stat-value">¥{stats.totalValue.toLocaleString()}</div>
          <div className="stat-trend">占压资金</div>
        </Card>
        <Card className="stat-card" bordered={false} style={{ border: '1px solid #ffccc7', background: '#fff1f0' }}>
          <div className="stat-label" style={{ color: '#a8071a' }}>
            <AlertOutlined /> 缺货预警 SKU
          </div>
          <div className="stat-value" style={{ color: '#cf1322' }}>
            {stats.criticalCount + stats.warningCount}
          </div>
          <div className="stat-trend" style={{ color: '#cf1322' }}>
            <span style={{ background: '#fff1f0', border: '1px solid #ffa39e', padding: '1px 6px', borderRadius: 10 }}>
              紧急 {stats.criticalCount}
            </span>
            <span style={{ marginLeft: 6, background: '#fffbe6', border: '1px solid #ffe58f', padding: '1px 6px', borderRadius: 10, color: '#d48806' }}>
              预警 {stats.warningCount}
            </span>
          </div>
        </Card>
      </div>

      <div className="page-container">
        <div className="page-header">
          <div>
            <div className="page-title">库存台账管理</div>
            <div className="page-subtitle">实时查询库存、监控缺货风险、为销售订单分配库存</div>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { recalculateStockRisks(); message.success('风险数据已刷新'); }}>
              刷新风险
            </Button>
            <Button
              type="primary"
              icon={<GiftOutlined />}
              onClick={() => {
                if (pendingAllocationOrders.length === 0) {
                  message.info('暂无待分配的销售订单');
                  return;
                }
                setAllocateModal(pendingAllocationOrders[0]);
              }}
            >
              订单库存分配（{pendingAllocationOrders.length}）
            </Button>
          </Space>
        </div>

        <Tabs
          defaultActiveKey="risk"
          items={[
            {
              key: 'risk',
              label: <span><Badge dot status="error" offset={[2, 0]} />缺货风险看板</span>,
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button.Group>
                      <Select
                        placeholder="全部订单"
                        style={{ width: 200, marginRight: 8 }}
                        allowClear
                        options={pendingAllocationOrders.map(s => ({ value: s.id, label: `${s.orderNo} - ${s.customerName}` }))}
                        onChange={(v) => {
                          const so = pendingAllocationOrders.find(o => o.id === v);
                          if (so) setAllocateModal(so);
                        }}
                      />
                      {pendingAllocationOrders.map(so => (
                        <Button key={so.id} onClick={() => setAllocateModal(so)}>
                          {so.orderNo} 待分配
                          <Tag color="red" style={{ marginLeft: 4 }}>
                            {so.items.reduce((s, i) => s + (i.quantity - (i.allocatedQty || 0)), 0)} 件
                          </Tag>
                        </Button>
                      ))}
                    </Button.Group>
                  </div>

                  {stockRisks.length === 0 ? (
                    <div className="empty-tip">
                      <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
                      <p style={{ fontSize: 16, color: '#389e0d' }}>所有物料库存充足，暂无缺货风险 🎉</p>
                    </div>
                  ) : (
                    <Table
                      columns={riskColumns}
                      dataSource={stockRisks}
                      rowKey="productId"
                      scroll={{ x: 1300 }}
                      pagination={{ pageSize: 10 }}
                    />
                  )}
                </>
              ),
            },
            {
              key: 'all',
              label: '全部库存',
              children: (
                <>
                  <div className="filter-bar">
                    <Input
                      placeholder="搜索物料名称/SKU"
                      prefix={<SearchOutlined />}
                      value={keyword}
                      onChange={e => setKeyword(e.target.value)}
                      style={{ width: 260 }}
                      allowClear
                    />
                    <Select
                      placeholder="分类"
                      allowClear
                      style={{ width: 140 }}
                      value={categoryFilter}
                      onChange={setCategoryFilter}
                      options={categories.map(c => ({ value: c, label: c }))}
                    />
                    <Select
                      placeholder="仓库"
                      allowClear
                      style={{ width: 150 }}
                      value={warehouseFilter}
                      onChange={setWarehouseFilter}
                      options={warehouses.map(w => ({ value: w, label: w }))}
                    />
                    <Select
                      placeholder="风险等级"
                      allowClear
                      style={{ width: 140 }}
                      value={riskFilter}
                      onChange={setRiskFilter}
                      options={[
                        { value: 'critical', label: <Tag color="red">紧急缺货</Tag> },
                        { value: 'warning', label: <Tag color="orange">库存预警</Tag> },
                        { value: 'normal', label: <Tag color="green">正常</Tag> },
                      ]}
                    />
                    <Button type="primary" ghost onClick={() => { setKeyword(''); setCategoryFilter(undefined); setWarehouseFilter(undefined); setRiskFilter(undefined); }}>
                      重置
                    </Button>
                  </div>
                  <Table
                    columns={stockColumns}
                    dataSource={filteredStock}
                    rowKey="id"
                    scroll={{ x: 1700 }}
                    pagination={{ pageSize: 10, showTotal: t => `共 ${t} 个 SKU` }}
                  />
                </>
              ),
            },
            {
              key: 'movement',
              label: '库存流水',
              children: (
                <Table
                  size="small"
                  dataSource={stockMovements}
                  rowKey="id"
                  scroll={{ x: 1400 }}
                  pagination={{ pageSize: 15, showTotal: t => `共 ${t} 条变动记录` }}
                  columns={[
                    { title: '日期', dataIndex: 'date', width: 110 },
                    {
                      title: '类型',
                      dataIndex: 'type',
                      width: 80,
                      render: (t: string) => <Tag color={typeColorMap[t]}>{typeTextMap[t]}</Tag>,
                    },
                    { title: '物料', dataIndex: 'productName', width: 180 },
                    { title: 'SKU', dataIndex: 'sku', width: 110 },
                    {
                      title: '变动数量',
                      width: 100,
                      align: 'right',
                      render: (_, r: StockMovement) => {
                        const add = ['in'].includes(r.type);
                        const color = add ? '#389e0d' : ['out'].includes(r.type) ? '#cf1322' : '#1677ff';
                        const icon = add ? <ArrowUpOutlined /> : ['out'].includes(r.type) ? <ArrowDownOutlined /> : null;
                        return (
                          <span style={{ color, fontWeight: 600 }}>
                            {icon} {add ? '+' : ['out'].includes(r.type) ? '-' : ''}{r.quantity}
                          </span>
                        );
                      },
                    },
                    { title: '变动前', dataIndex: 'beforeQty', width: 90, align: 'right' },
                    { title: '变动后', dataIndex: 'afterQty', width: 90, align: 'right' },
                    { title: '仓库', dataIndex: 'warehouse', width: 120 },
                    {
                      title: '关联单据',
                      width: 220,
                      render: (_, r: StockMovement) => (
                        <div>
                          <Tag color="blue">{r.referenceType}</Tag>
                          <span style={{ fontWeight: 500 }}>{r.referenceNo}</span>
                        </div>
                      ),
                    },
                    { title: '操作人', dataIndex: 'operator', width: 90 },
                    { title: '备注', dataIndex: 'remark', ellipsis: true },
                  ]}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={
          <div>
            销售订单库存分配
            <Tag color="blue" style={{ marginLeft: 8 }}>{allocateModal?.orderNo}</Tag>
          </div>
        }
        open={!!allocateModal}
        onCancel={() => { setAllocateModal(null); allocForm.resetFields(); }}
        onOk={handleAllocate}
        width={860}
        okText="确认分配"
        cancelText="取消"
      >
        {allocateModal && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
              <Col span={8}>
                <strong>客户：</strong>{allocateModal.customerName}
              </Col>
              <Col span={8}>
                <strong>要求发货：</strong>{allocateModal.requiredDate}
              </Col>
              <Col span={8}>
                <strong>订单状态：</strong>
                <Tag color="orange">需分配库存</Tag>
              </Col>
            </Row>
            <Form form={allocForm} layout="vertical">
              <Table
                size="small"
                pagination={false}
                dataSource={allocateModal.items}
                rowKey="productId"
                columns={allocColumns}
              />
              <div style={{ marginTop: 12, padding: 12, background: '#e6f4ff', borderRadius: 6, border: '1px solid #91caff', fontSize: 13 }}>
                <strong style={{ color: '#1677ff' }}>提示：</strong>
                <span style={{ color: '#0958d9' }}>
                  分配成功后将锁定对应库存，其他订单将无法再次分配。如分配有误可点击"释放分配"重新操作。
                </span>
                <Button
                  type="link"
                  size="small"
                  danger
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    Modal.confirm({
                      title: '确认释放全部已分配库存？',
                      content: '释放后该订单的库存分配记录将被清除',
                      onOk: () => {
                        releaseAllocation(allocateModal.id);
                        message.success('已释放全部库存分配');
                        setAllocateModal(null);
                      },
                    });
                  }}
                >
                  释放本订单全部已分配库存
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="库存流水明细"
        open={!!movementModal}
        onCancel={() => setMovementModal(null)}
        footer={[<Button key="close" onClick={() => setMovementModal(null)}>关闭</Button>]}
        width={800}
      >
        {movementModal && (
          <>
            <div style={{ marginBottom: 12 }}>
              <strong>物料：</strong>
              {products.find(p => p.id === movementModal)?.name || movementModal}
              <Tag style={{ marginLeft: 8 }}>{products.find(p => p.id === movementModal)?.sku}</Tag>
            </div>
            <Table
              size="small"
              dataSource={filteredMovements}
              rowKey="id"
              pagination={{ pageSize: 8 }}
              columns={[
                { title: '日期', dataIndex: 'date', width: 110 },
                {
                  title: '类型',
                  dataIndex: 'type',
                  width: 80,
                  render: (t: string) => <Tag color={typeColorMap[t]}>{typeTextMap[t]}</Tag>,
                },
                {
                  title: '数量',
                  width: 100,
                  align: 'right',
                  render: (_, r: StockMovement) => {
                    const add = ['in'].includes(r.type);
                    const color = add ? '#389e0d' : ['out'].includes(r.type) ? '#cf1322' : '#1677ff';
                    return (
                      <span style={{ color, fontWeight: 600 }}>
                        {add ? '+' : ['out'].includes(r.type) ? '-' : ''}{r.quantity}
                      </span>
                    );
                  },
                },
                { title: '变动前', dataIndex: 'beforeQty', width: 80, align: 'right' },
                { title: '变动后', dataIndex: 'afterQty', width: 80, align: 'right' },
                { title: '仓库', dataIndex: 'warehouse', width: 110 },
                {
                  title: '关联单据',
                  render: (_, r: StockMovement) => (
                    <div>
                      <Tag color="blue">{r.referenceType}</Tag>
                      {r.referenceNo}
                    </div>
                  ),
                },
                { title: '操作人', dataIndex: 'operator', width: 80 },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
