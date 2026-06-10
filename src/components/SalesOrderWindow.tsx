import { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Input, Select, DatePicker, Space, Modal, Form,
  InputNumber, Card, Row, Col, Divider, message, Popconfirm, Tabs,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, CheckCircleOutlined, ClockCircleOutlined,
  TruckOutlined, InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store/appStore';
import { SalesOrder, SalesOrderStatus, SalesOrderItem } from '../types';

const { RangePicker } = DatePicker;

const statusMap: Record<SalesOrderStatus, { color: string; text: string; icon: any }> = {
  pending_allocation: { color: 'magenta', text: '待分配库存', icon: ClockCircleOutlined },
  partially_allocated: { color: 'orange', text: '部分分配', icon: ClockCircleOutlined },
  allocated: { color: 'blue', text: '已分配', icon: InboxOutlined },
  partial_shipped: { color: 'cyan', text: '部分发货', icon: TruckOutlined },
  shipped: { color: 'geekblue', text: '已发货', icon: TruckOutlined },
  completed: { color: 'green', text: '已完成', icon: CheckCircleOutlined },
  cancelled: { color: 'red', text: '已取消', icon: DeleteOutlined },
};

export default function SalesOrderWindow() {
  const {
    salesOrders, products, shipments, receivables,
    addSalesOrder, updateSalesOrder, deleteSalesOrder,
  } = useAppStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [form] = Form.useForm();

  const stats = useMemo(() => {
    const thisMonth = dayjs().startOf('month');
    const monthOrders = salesOrders.filter(s => dayjs(s.createTime).isAfter(thisMonth));
    const pendingCount = salesOrders.filter(s => ['pending_allocation', 'partially_allocated'].includes(s.status)).length;
    const totalAmount = monthOrders.reduce((s, o) => s + o.totalAmount, 0);

    return {
      total: salesOrders.length,
      monthCount: monthOrders.length,
      pendingCount,
      monthAmount: totalAmount,
    };
  }, [salesOrders]);

  const filteredData = useMemo(() => {
    return salesOrders.filter(o => {
      if (keyword && !o.orderNo.includes(keyword) && !o.customerName.includes(keyword)
        && !o.customerContact.includes(keyword) && !o.customerPhone.includes(keyword)) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const t = dayjs(o.createTime);
        if (t.isBefore(dateRange[0]) || t.isAfter(dateRange[1].endOf('day'))) return false;
      }
      return true;
    });
  }, [salesOrders, keyword, statusFilter, dateRange]);

  const handleOpenModal = (order?: SalesOrder) => {
    setEditOrder(order || null);
    if (order) {
      form.setFieldsValue({
        customerName: order.customerName,
        customerContact: order.customerContact,
        customerPhone: order.customerPhone,
        shippingAddress: order.shippingAddress,
        requiredDate: dayjs(order.requiredDate),
        remark: order.remark,
        items: order.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        items: [{ productId: undefined, quantity: 1, unitPrice: 0 }],
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const items = (values.items || []).filter((it: any) => it.productId && it.quantity > 0);

      if (items.length === 0) {
        message.warning('请至少添加一项物料');
        return;
      }

      const orderItems: SalesOrderItem[] = items.map((it: any) => {
        const product = products.find(p => p.id === it.productId);
        return {
          productId: it.productId,
          productName: product?.name || '',
          sku: product?.sku || '',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.quantity * it.unitPrice,
        };
      });

      const totalAmount = orderItems.reduce((s, i) => s + i.subtotal, 0);

      if (editOrder) {
        const existingAlloc = editOrder.items.map(i => ({
          productId: i.productId,
          allocatedQty: i.allocatedQty || 0,
          shippedQty: i.shippedQty || 0,
        }));

        const updatedItems = orderItems.map(i => {
          const alloc = existingAlloc.find(a => a.productId === i.productId);
          return {
            ...i,
            allocatedQty: alloc?.allocatedQty || 0,
            shippedQty: alloc?.shippedQty || 0,
          };
        });

        updateSalesOrder(editOrder.id, {
          customerName: values.customerName,
          customerContact: values.customerContact,
          customerPhone: values.customerPhone,
          shippingAddress: values.shippingAddress,
          requiredDate: values.requiredDate.format('YYYY-MM-DD'),
          items: updatedItems,
          totalAmount,
          remark: values.remark,
        });
        message.success('销售订单已更新');
      } else {
        addSalesOrder({
          customerName: values.customerName,
          customerContact: values.customerContact,
          customerPhone: values.customerPhone,
          shippingAddress: values.shippingAddress,
          requiredDate: values.requiredDate.format('YYYY-MM-DD'),
          items: orderItems,
          totalAmount,
          remark: values.remark,
        });
        message.success('销售订单已创建');
      }

      setIsModalOpen(false);
      form.resetFields();
    } catch (e) {
      // validation error
    }
  };

  const handleDelete = (id: string) => {
    deleteSalesOrder(id);
    message.success('销售订单已删除');
  };

  const [planDetailOrder, setPlanDetailOrder] = useState<SalesOrder | null>(null);

  const orderShipments = useMemo(() => {
    if (!viewOrder) return [];
    return shipments.filter(s => s.salesOrderId === viewOrder.id);
  }, [viewOrder, shipments]);

  const shippingPlanData = useMemo(() => {
    return salesOrders.filter(o => o.status !== 'cancelled').map(order => {
      const relatedShipments = shipments.filter(s => s.salesOrderId === order.id);
      let pendingAllocateQty = 0;
      let pendingShipQty = 0;
      let inTransitQty = 0;
      let deliveredQty = 0;
      let pendingAllocateAmt = 0;
      let pendingShipAmt = 0;
      let inTransitAmt = 0;
      let deliveredAmt = 0;

      order.items.forEach(item => {
        const allocated = item.allocatedQty || 0;
        const shipped = item.shippedQty || 0;
        const toAllocate = item.quantity - allocated;
        const toShip = allocated - shipped;
        pendingAllocateQty += toAllocate;
        pendingShipQty += toShip;
        pendingAllocateAmt += toAllocate * item.unitPrice;
        pendingShipAmt += toShip * item.unitPrice;

        relatedShipments.forEach(sh => {
          const matchItem = sh.items.find(si => si.productId === item.productId);
          if (!matchItem) return;
          if (['shipped', 'in_transit', 'out_for_delivery'].includes(sh.status)) {
            inTransitQty += matchItem.quantity;
            inTransitAmt += matchItem.quantity * item.unitPrice;
          }
          if (sh.status === 'delivered') {
            deliveredQty += matchItem.quantity;
            deliveredAmt += matchItem.quantity * item.unitPrice;
          }
        });
      });

      return {
        ...order,
        pendingAllocateQty,
        pendingShipQty,
        inTransitQty,
        deliveredQty,
        pendingAllocateAmt,
        pendingShipAmt,
        inTransitAmt,
        deliveredAmt,
      };
    });
  }, [salesOrders, shipments]);

  const columns: ColumnsType<SalesOrder> = [
    { title: '订单号', dataIndex: 'orderNo', width: 160, fixed: 'left' },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      width: 220,
      ellipsis: { showTitle: false },
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.customerContact} / {r.customerPhone}</div>
        </div>
      ),
    },
    { title: '收货地址', dataIndex: 'shippingAddress', width: 250, ellipsis: true },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600, color: '#cf1322' }}>¥{v.toLocaleString()}</span>,
    },
    { title: '要求发货', dataIndex: 'requiredDate', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (s: SalesOrderStatus) => {
        const cfg = statusMap[s];
        const Icon = cfg.icon;
        return <Tag color={cfg.color} icon={<Icon />}>{cfg.text}</Tag>;
      },
    },
    {
      title: '发货状态',
      width: 120,
      render: (_, r) => {
        const totalQty = r.items.reduce((s, i) => s + i.quantity, 0);
        const shippedQty = r.items.reduce((s, i) => s + (i.shippedQty || 0), 0);
        const allocQty = r.items.reduce((s, i) => s + (i.allocatedQty || 0), 0);
        return (
          <div style={{ fontSize: 12 }}>
            <div>已分配: <span style={{ color: '#1677ff', fontWeight: 600 }}>{allocQty}</span>/{totalQty}</div>
            <div>已发货: <span style={{ color: '#52c41a', fontWeight: 600 }}>{shippedQty}</span>/{totalQty}</div>
          </div>
        );
      },
    },
    { title: '创建时间', dataIndex: 'createTime', width: 170 },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-col">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewOrder(record)}>
            详情
          </Button>
          {['pending_allocation', 'partially_allocated'].includes(record.status) && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>
              编辑
            </Button>
          )}
          {['pending_allocation'].includes(record.status) && (
            <Popconfirm
              title="确认删除该订单？"
              description="删除后将释放已分配的库存"
              onConfirm={() => handleDelete(record.id)}
              okText="确认删除"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  const shipmentStatusConfig: Record<string, { color: string; text: string }> = {
    created: { color: 'default', text: '已创建' },
    picking: { color: 'processing', text: '拣货中' },
    packed: { color: 'purple', text: '已打包' },
    shipped: { color: 'blue', text: '已发货' },
    in_transit: { color: 'cyan', text: '运输中' },
    out_for_delivery: { color: 'geekblue', text: '派送中' },
    delivered: { color: 'green', text: '已签收' },
    exception: { color: 'red', text: '异常' },
  };

  const planDetailShipments = useMemo(() => {
    if (!planDetailOrder) return [];
    return shipments.filter(s => s.salesOrderId === planDetailOrder.id);
  }, [planDetailOrder, shipments]);

  const planDetailReceivables = useMemo(() => {
    if (!planDetailOrder) return [];
    return receivables.filter(r => r.salesOrderId === planDetailOrder.id);
  }, [planDetailOrder, receivables]);

  const shippingPlanColumns: ColumnsType<any> = [
    { title: '订单号', dataIndex: 'orderNo', width: 140, fixed: 'left' },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    {
      title: '订单总额', dataIndex: 'totalAmount', width: 120, align: 'right',
      render: (v) => <span style={{ fontWeight: 600, color: '#cf1322' }}>¥{v.toLocaleString()}</span>,
    },
    {
      title: '待分配', width: 160, align: 'right',
      render: (_, r) => (
        <div>
          <div>{r.pendingAllocateQty} 件</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>¥{r.pendingAllocateAmt.toLocaleString()}</div>
        </div>
      ),
    },
    {
      title: '待发货', width: 160, align: 'right',
      render: (_, r) => (
        <div>
          <div>{r.pendingShipQty} 件</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>¥{r.pendingShipAmt.toLocaleString()}</div>
        </div>
      ),
    },
    {
      title: '在途', width: 160, align: 'right',
      render: (_, r) => (
        <div>
          <div style={{ color: '#1677ff' }}>{r.inTransitQty} 件</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>¥{r.inTransitAmt.toLocaleString()}</div>
        </div>
      ),
    },
    {
      title: '已签收', width: 160, align: 'right',
      render: (_, r) => (
        <div>
          <div style={{ color: '#52c41a' }}>{r.deliveredQty} 件</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>¥{r.deliveredAmt.toLocaleString()}</div>
        </div>
      ),
    },
    {
      title: '操作', width: 100, fixed: 'right',
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPlanDetailOrder(r)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="stat-cards">
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">销售订单总数</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>本月 {stats.monthCount} 单</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">待处理订单</div>
          <div className="stat-value" style={{ color: '#faad14' }}>{stats.pendingCount}</div>
          <div className="stat-trend" style={{ color: '#faad14' }}>等待分配库存</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">本月销售金额</div>
          <div className="stat-value">¥{stats.monthAmount.toLocaleString()}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>↑ 12.5% 同比增长</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">客户数量</div>
          <div className="stat-value">{new Set(salesOrders.map(s => s.customerName)).size}</div>
          <div className="stat-trend">活跃客户</div>
        </Card>
      </div>

      <div className="page-container">
        <div className="page-header">
          <div>
            <div className="page-title">销售订单管理</div>
            <div className="page-subtitle">客户订单录入、跟踪发货进度、管理订单生命周期</div>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            新建销售订单
          </Button>
        </div>

        <Tabs defaultActiveKey="orders" items={[
          {
            key: 'orders',
            label: '订单列表',
            children: (
              <>
                <div className="filter-bar">
                  <Input
                    placeholder="搜索订单号/客户名称/联系人/电话"
                    prefix={<SearchOutlined />}
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    style={{ width: 320 }}
                    allowClear
                  />
                  <Select
                    placeholder="订单状态"
                    allowClear
                    style={{ width: 150 }}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.text }))}
                  />
                  <RangePicker
                    value={dateRange}
                    onChange={setDateRange as any}
                    placeholder={['开始日期', '结束日期']}
                  />
                  <Button type="primary" ghost onClick={() => { setKeyword(''); setStatusFilter(undefined); setDateRange(null); }}>
                    重置
                  </Button>
                </div>

                <Table
                  columns={columns}
                  dataSource={filteredData}
                  rowKey="id"
                  scroll={{ x: 1500 }}
                  pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条订单` }}
                />
              </>
            ),
          },
          {
            key: 'shippingPlan',
            label: '发货计划',
            children: (
              <Table
                columns={shippingPlanColumns}
                dataSource={shippingPlanData}
                rowKey="id"
                scroll={{ x: 1160 }}
                pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条订单` }}
              />
            ),
          },
        ]} />
      </div>

      <Modal
        title={editOrder ? '编辑销售订单' : '新建销售订单'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        width={960}
        okText={editOrder ? '保存修改' : '创建订单'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>客户信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input placeholder="请输入客户名称" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="customerContact" label="联系人" rules={[{ required: true, message: '请输入联系人' }]}>
                <Input placeholder="请输入联系人" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="customerPhone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="shippingAddress" label="收货地址" rules={[{ required: true, message: '请输入收货地址' }]}>
                <Input placeholder="请输入详细收货地址" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="requiredDate" label="要求发货日期" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>订单明细</Divider>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ marginBottom: 10, borderLeft: '4px solid #1677ff' }}>
                    <Row gutter={12} align="middle">
                      <Col span={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'productId']}
                          label="物料名称"
                          rules={[{ required: true, message: '请选择物料' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            showSearch
                            placeholder="选择物料"
                            options={products.map(p => ({
                              value: p.id,
                              label: `${p.name} (${p.sku}) - 库存: ${
                                (() => {
                                  const stock = useAppStore.getState().stockRecords.find(s => s.productId === p.id);
                                  return stock ? stock.quantity : 0;
                                })()
                              } ${p.unit}`,
                            }))}
                            optionFilterProp="label"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item
                          {...restField}
                          name={[name, 'quantity']}
                          label="数量"
                          rules={[{ required: true, message: '请输入数量' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item
                          {...restField}
                          name={[name, 'unitPrice']}
                          label="单价 (元)"
                          rules={[{ required: true, message: '请输入单价' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber min={0} prefix="¥" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <div style={{ paddingTop: 24 }}>
                          <span style={{ fontSize: 12, color: '#8c8c8c' }}>小计</span>
                          <div style={{ fontWeight: 600, color: '#cf1322' }}>
                            ¥{((form.getFieldValue(['items', name, 'quantity']) || 0) * (form.getFieldValue(['items', name, 'unitPrice']) || 0)).toLocaleString()}
                          </div>
                        </div>
                      </Col>
                      <Col span={2}>
                        <Button type="text" danger onClick={() => remove(name)} disabled={fields.length === 1}>
                          <DeleteOutlined />
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" block onClick={() => add()} icon={<PlusOutlined />}>
                  添加物料
                </Button>
              </>
            )}
          </Form.List>

          <Divider />
          <Row justify="end">
            <Col span={8}>
              <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>订单总金额</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#389e0d' }}>
                    ¥{form.getFieldValue('items')?.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0)?.toLocaleString() || 0}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} placeholder="特殊要求、备注等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`销售订单详情 - ${viewOrder?.orderNo}`}
        open={!!viewOrder}
        onCancel={() => setViewOrder(null)}
        footer={[<Button key="close" onClick={() => setViewOrder(null)}>关闭</Button>]}
        width={960}
      >
        {viewOrder && (
          <div>
            <Row gutter={24}>
              <Col span={14}>
                <Card title="基本信息" size="small">
                  <p><strong>订单号：</strong>{viewOrder.orderNo}</p>
                  <p><strong>客户：</strong>{viewOrder.customerName}</p>
                  <p><strong>联系人：</strong>{viewOrder.customerContact} / {viewOrder.customerPhone}</p>
                  <p><strong>收货地址：</strong>{viewOrder.shippingAddress}</p>
                  <p><strong>创建时间：</strong>{viewOrder.createTime}</p>
                  <p><strong>要求发货：</strong>{viewOrder.requiredDate}</p>
                  <p>
                    <strong>状态：</strong>
                    <Tag color={statusMap[viewOrder.status].color}>{statusMap[viewOrder.status].text}</Tag>
                  </p>
                  {viewOrder.remark && <p><strong>备注：</strong>{viewOrder.remark}</p>}
                </Card>
              </Col>
              <Col span={10}>
                <Card title="订单汇总" size="small">
                  <Statistic title="订单总金额" value={viewOrder.totalAmount} prefix="¥" />
                  <Divider style={{ margin: '12px 0' }} />
                  <Row>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>物料种类</div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{viewOrder.items.length} 种</div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>总数量</div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{viewOrder.items.reduce((s, i) => s + i.quantity, 0)} 件</div>
                    </Col>
                  </Row>
                  <Divider style={{ margin: '12px 0' }} />
                  <Row>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>已分配</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#1677ff' }}>
                        {viewOrder.items.reduce((s, i) => s + (i.allocatedQty || 0), 0)} 件
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>已发货</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}>
                        {viewOrder.items.reduce((s, i) => s + (i.shippedQty || 0), 0)} 件
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            <Divider />
            <div className="modal-section-title">订单明细</div>
            <Table
              size="small"
              pagination={false}
              dataSource={viewOrder.items}
              rowKey="productId"
              columns={[
                { title: '物料名称', dataIndex: 'productName', width: 200 },
                { title: 'SKU', dataIndex: 'sku', width: 140 },
                { title: '需求数量', dataIndex: 'quantity', width: 80, align: 'right' },
                { title: '已分配', dataIndex: 'allocatedQty', width: 80, align: 'right', render: v => v || 0 },
                { title: '已发货', dataIndex: 'shippedQty', width: 80, align: 'right', render: v => v || 0 },
                {
                  title: '待发货',
                  width: 80,
                  align: 'right',
                  render: (_, r) => (r.quantity || 0) - (r.shippedQty || 0),
                },
                { title: '单价', width: 100, align: 'right', render: (_, r) => `¥${r.unitPrice}` },
                { title: '小计', width: 120, align: 'right', render: (_, r) => `¥${r.subtotal.toLocaleString()}` },
                {
                  title: '进度',
                  width: 150,
                  render: (_, r) => {
                    const percent = Math.round(((r.shippedQty || 0) / r.quantity) * 100);
                    return <Progress percent={percent} size="small" status={percent >= 100 ? 'success' : 'active'} />;
                  },
                },
              ]}
            />

            {orderShipments.length > 0 && (
              <>
                <Divider />
                <div className="modal-section-title">关联发货单</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={orderShipments}
                  rowKey="id"
                  columns={[
                    { title: '发货单号', dataIndex: 'shipmentNo', width: 160 },
                    { title: '承运商', dataIndex: 'carrier', width: 120 },
                    { title: '运单号', dataIndex: 'trackingNo', width: 160 },
                    {
                      title: '发货件数',
                      width: 100,
                      align: 'right',
                      render: (_, r) => r.items.reduce((s, i) => s + i.quantity, 0),
                    },
                    { title: '发货时间', dataIndex: 'shipTime', width: 160 },
                    {
                      title: '状态',
                      width: 100,
                      render: (_, r) => {
                        const cfg = shipmentStatusConfig[r.status] || { color: 'default', text: r.status };
                        return <Tag color={cfg.color}>{cfg.text}</Tag>;
                      },
                    },
                  ]}
                />
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={`发货计划详情 - ${planDetailOrder?.orderNo}`}
        open={!!planDetailOrder}
        onCancel={() => setPlanDetailOrder(null)}
        footer={[<Button key="close" onClick={() => setPlanDetailOrder(null)}>关闭</Button>]}
        width={960}
      >
        {planDetailOrder && (
          <div>
            <Row gutter={24}>
              <Col span={14}>
                <Card title="订单基本信息" size="small">
                  <p><strong>订单号：</strong>{planDetailOrder.orderNo}</p>
                  <p><strong>客户：</strong>{planDetailOrder.customerName}</p>
                  <p><strong>联系人：</strong>{planDetailOrder.customerContact} / {planDetailOrder.customerPhone}</p>
                  <p><strong>收货地址：</strong>{planDetailOrder.shippingAddress}</p>
                  <p><strong>要求发货：</strong>{planDetailOrder.requiredDate}</p>
                  <p>
                    <strong>状态：</strong>
                    <Tag color={statusMap[planDetailOrder.status].color}>{statusMap[planDetailOrder.status].text}</Tag>
                  </p>
                </Card>
              </Col>
              <Col span={10}>
                <Card title="金额汇总" size="small">
                  <Statistic title="订单总金额" value={planDetailOrder.totalAmount} prefix="¥" />
                </Card>
              </Col>
            </Row>

            <Divider />
            <div className="modal-section-title">库存分配状态</div>
            <Table
              size="small"
              pagination={false}
              dataSource={planDetailOrder.items}
              rowKey="productId"
              columns={[
                { title: '物料名称', dataIndex: 'productName', width: 160 },
                { title: 'SKU', dataIndex: 'sku', width: 120 },
                { title: '需求', dataIndex: 'quantity', width: 80, align: 'right' },
                { title: '已分配', dataIndex: 'allocatedQty', width: 80, align: 'right', render: v => v || 0 },
                {
                  title: '待分配', width: 80, align: 'right',
                  render: (_, r) => r.quantity - (r.allocatedQty || 0),
                },
                { title: '单价', width: 100, align: 'right', render: (_, r) => `¥${r.unitPrice}` },
                { title: '小计', width: 120, align: 'right', render: (_, r) => `¥${r.subtotal.toLocaleString()}` },
              ]}
            />

            {planDetailShipments.length > 0 && (
              <>
                <Divider />
                <div className="modal-section-title">关联发货单</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={planDetailShipments}
                  rowKey="id"
                  columns={[
                    { title: '发货单号', dataIndex: 'shipmentNo', width: 140 },
                    {
                      title: '状态', width: 100,
                      render: (_, r) => {
                        const cfg = shipmentStatusConfig[r.status] || { color: 'default', text: r.status };
                        return <Tag color={cfg.color}>{cfg.text}</Tag>;
                      },
                    },
                    {
                      title: '发货数量', width: 100, align: 'right',
                      render: (_, r) => r.items.reduce((s, i) => s + i.quantity, 0),
                    },
                    { title: '承运商', dataIndex: 'carrier', width: 100 },
                    { title: '运单号', dataIndex: 'trackingNo', width: 140 },
                    { title: '发货时间', dataIndex: 'shipTime', width: 140 },
                    {
                      title: '签收信息', width: 180,
                      render: (_, r) => r.signoffTime
                        ? <span>{r.signoffPerson} / {r.signoffTime}</span>
                        : <span style={{ color: '#8c8c8c' }}>未签收</span>,
                    },
                  ]}
                />
              </>
            )}

            {planDetailReceivables.length > 0 && (
              <>
                <Divider />
                <div className="modal-section-title">应收情况</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={planDetailReceivables}
                  rowKey="id"
                  columns={[
                    { title: '账单号', dataIndex: 'billNo', width: 140 },
                    { title: '关联发货单', dataIndex: 'shipmentNo', width: 140 },
                    { title: '账单日期', dataIndex: 'billDate', width: 120 },
                    { title: '到期日期', dataIndex: 'dueDate', width: 120 },
                    {
                      title: '应收金额', dataIndex: 'totalAmount', width: 120, align: 'right',
                      render: (v) => <span style={{ fontWeight: 600, color: '#cf1322' }}>¥{v.toLocaleString()}</span>,
                    },
                    {
                      title: '已收金额', dataIndex: 'receivedAmount', width: 120, align: 'right',
                      render: (v) => <span style={{ color: '#52c41a' }}>¥{v.toLocaleString()}</span>,
                    },
                    {
                      title: '未收金额', dataIndex: 'unreceivedAmount', width: 120, align: 'right',
                      render: (v) => <span style={{ color: '#faad14' }}>¥{v.toLocaleString()}</span>,
                    },
                    {
                      title: '状态', dataIndex: 'status', width: 100,
                      render: (v) => {
                        const cfg: Record<string, { color: string; text: string }> = {
                          unpaid: { color: 'red', text: '未收款' },
                          partial: { color: 'orange', text: '部分收款' },
                          paid: { color: 'green', text: '已收款' },
                        };
                        const c = cfg[v] || { color: 'default', text: v };
                        return <Tag color={c.color}>{c.text}</Tag>;
                      },
                    },
                  ]}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Statistic({ title, value, prefix }: { title: string; value: number; prefix: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#cf1322' }}>
        {prefix}{value.toLocaleString()}
      </div>
    </div>
  );
}

function Progress({ percent, size, status }: { percent: number; size: string; status: string }) {
  const color = status === 'success' ? '#52c41a' : '#1677ff';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{percent}%</span>
      </div>
    </div>
  );
}
