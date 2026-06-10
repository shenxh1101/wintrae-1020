import { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Input, Select, DatePicker, Space, Modal, Form,
  InputNumber, Card, Row, Col, Statistic, Divider, message, Popconfirm,
  Tabs, Timeline,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, CheckCircleOutlined, ClockCircleOutlined,
  FileSearchOutlined, InboxOutlined, DollarOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store/appStore';
import { PurchaseOrder, PurchaseStatus, SupplierQuote, WarehouseReceipt, Payable } from '../types';

const { RangePicker } = DatePicker;

const statusMap: Record<PurchaseStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  pending_quote: { color: 'magenta', text: '待报价' },
  quoted: { color: 'purple', text: '已报价' },
  confirmed: { color: 'blue', text: '已确认' },
  partial_received: { color: 'cyan', text: '部分入库' },
  completed: { color: 'green', text: '已完成' },
  cancelled: { color: 'red', text: '已取消' },
};

export default function PurchaseWindow() {
  const { purchaseOrders, suppliers, products, quotes, receipts, payables, addPurchaseOrder, updatePurchaseOrder } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [form] = Form.useForm();

  const stats = useMemo(() => {
    const thisMonth = dayjs().startOf('month');
    const thisMonthOrders = purchaseOrders.filter(p => dayjs(p.createTime).isAfter(thisMonth));
    return {
      total: purchaseOrders.length,
      pending: purchaseOrders.filter(p => ['draft', 'pending_quote', 'quoted'].includes(p.status)).length,
      confirmed: purchaseOrders.filter(p => ['confirmed', 'partial_received'].includes(p.status)).length,
      thisMonthAmount: thisMonthOrders.reduce((s, p) => s + (p.totalAmount || 0), 0),
    };
  }, [purchaseOrders]);

  const filteredData = useMemo(() => {
    return purchaseOrders.filter(p => {
      if (keyword && !p.orderNo.includes(keyword) && !p.title.includes(keyword) && !p.requester.includes(keyword)) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const t = dayjs(p.createTime);
        if (t.isBefore(dateRange[0]) || t.isAfter(dateRange[1].endOf('day'))) return false;
      }
      return true;
    });
  }, [purchaseOrders, keyword, statusFilter, dateRange]);

  const relatedQuotes = useMemo(() => {
    if (!viewOrder) return [];
    return quotes.filter(q => q.purchaseOrderId === viewOrder.id);
  }, [viewOrder, quotes]);

  const relatedReceipts = useMemo(() => {
    if (!viewOrder) return [];
    return receipts.filter(r => r.purchaseOrderId === viewOrder.id);
  }, [viewOrder, receipts]);

  const relatedPayables = useMemo(() => {
    if (!viewOrder) return [];
    return payables.filter(p => p.purchaseOrderId === viewOrder.id);
  }, [viewOrder, payables]);

  const timelineEvents = useMemo(() => {
    if (!viewOrder) return [];
    const events: { time: string; color: string; icon: any; title: string; description: string }[] = [];

    events.push({
      time: viewOrder.createTime,
      color: 'blue',
      icon: <ShoppingCartOutlined />,
      title: '创建采购需求',
      description: `${viewOrder.requester} 提交采购申请，共 ${viewOrder.items.length} 项物料`,
    });

    if (viewOrder.status !== 'draft') {
      const quoteSubmitted = relatedQuotes.length > 0;
      if (quoteSubmitted) {
        const firstQuote = relatedQuotes[0];
        events.push({
          time: firstQuote.submitTime,
          color: 'purple',
          icon: <FileSearchOutlined />,
          title: '收到供应商报价',
          description: `共收到 ${relatedQuotes.length} 家供应商报价，${firstQuote.supplierName} 报价 ¥${firstQuote.totalAmount.toLocaleString()}`,
        });
      }

      const acceptedQuote = relatedQuotes.find(q => q.status === 'accepted');
      if (acceptedQuote) {
        events.push({
          time: viewOrder.confirmedDate || viewOrder.createTime,
          color: 'green',
          icon: <CheckCircleOutlined />,
          title: '确认采购',
          description: `采纳 ${acceptedQuote.supplierName} 的报价，总金额 ¥${acceptedQuote.totalAmount.toLocaleString()}`,
        });
      }

      if (relatedReceipts.length > 0) {
        relatedReceipts.forEach(r => {
          events.push({
            time: r.receivedDate,
            color: 'cyan',
            icon: <InboxOutlined />,
            title: '入库验收',
            description: `入库单 ${r.receiptNo}，${r.items.length} 项物料，总金额 ¥${r.totalAmount.toLocaleString()}`,
          });
        });
      }

      if (relatedPayables.length > 0) {
        relatedPayables.forEach(p => {
          const statusText = p.status === 'paid' ? '已结清' : (p.status === 'partial' ? '部分付款' : '待付款');
          const statusColor = p.status === 'paid' ? 'green' : (p.status === 'partial' ? 'orange' : 'red');
          events.push({
            time: p.billDate,
            color: statusColor,
            icon: <DollarOutlined />,
            title: `应付账单 - ${statusText}`,
            description: `账单 ${p.billNo}，总金额 ¥${p.totalAmount.toLocaleString()}，已付 ¥${p.paidAmount.toLocaleString()}`,
          });

          p.payments.forEach(pay => {
            events.push({
              time: pay.date,
              color: 'green',
              icon: <DollarOutlined />,
              title: '登记付款',
              description: `支付 ¥${pay.amount.toLocaleString()}，${pay.method}${pay.reference ? `，单号：${pay.reference}` : ''}`,
            });
          });
        });
      }
    }

    if (viewOrder.status === 'completed') {
      const lastEvent = events[events.length - 1];
      events.push({
        time: lastEvent?.time || viewOrder.createTime,
        color: 'success',
        icon: <CheckCircleOutlined />,
        title: '订单完成',
        description: '采购单已全部完成',
      });
    }

    if (viewOrder.status === 'cancelled') {
      events.push({
        time: viewOrder.createTime,
        color: 'red',
        icon: <DeleteOutlined />,
        title: '订单取消',
        description: '采购单已取消',
      });
    }

    return events.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf());
  }, [viewOrder, relatedQuotes, relatedReceipts, relatedPayables]);

  const columns: ColumnsType<PurchaseOrder> = [
    { title: '订单号', dataIndex: 'orderNo', width: 160, fixed: 'left' },
    { title: '标题', dataIndex: 'title', width: 200 },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      width: 180,
      render: (v) => v || <Tag color="default">待确定</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (s: PurchaseStatus) => {
        const cfg = statusMap[s];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '总金额 (元)',
      dataIndex: 'totalAmount',
      width: 130,
      align: 'right',
      render: (v) => v ? `¥${v.toLocaleString()}` : '-',
    },
    { title: '申请人', dataIndex: 'requester', width: 100 },
    { title: '部门', dataIndex: 'department', width: 100 },
    { title: '需求日期', dataIndex: 'requiredDate', width: 120 },
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
          {(record.status === 'draft' || record.status === 'pending_quote') && (
            <Button type="link" size="small" icon={<EditOutlined />}>
              编辑
            </Button>
          )}
          {record.status === 'confirmed' && (
            <Popconfirm title="确认交期已达成？" onConfirm={() => message.success('交期已确认')}>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} danger={false}>
                确认交期
              </Button>
            </Popconfirm>
          )}
          {record.status === 'draft' && (
            <Popconfirm title="确定删除此采购单？" onConfirm={() => message.success('已删除')}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const items = values.items || [];
      const supplier = suppliers.find(s => s.id === values.supplierId);

      addPurchaseOrder({
        title: values.title,
        requester: values.requester,
        department: values.department,
        requiredDate: values.requiredDate?.format('YYYY-MM-DD'),
        supplierId: values.supplierId,
        supplierName: supplier?.name,
        items: items.map((it: any) => {
          const p = products.find(x => x.id === it.productId);
          return {
            productId: it.productId,
            productName: p?.name || '',
            sku: p?.sku || '',
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          };
        }),
        remark: values.remark,
      });

      message.success('采购需求创建成功');
      setIsModalOpen(false);
      form.resetFields();
    } catch (e) {
      // validation error
    }
  };

  return (
    <div>
      <div className="stat-cards">
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">采购单总数</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>本月新增 {stats.total > 0 ? Math.ceil(stats.total * 0.4) : 0} 单</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">待处理订单</div>
          <div className="stat-value" style={{ color: '#faad14' }}>{stats.pending}</div>
          <div className="stat-trend" style={{ color: '#faad14' }}>需要及时跟进</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">执行中订单</div>
          <div className="stat-value" style={{ color: '#1677ff' }}>{stats.confirmed}</div>
          <div className="stat-trend">等待入库验收</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">本月采购金额</div>
          <div className="stat-value">¥{stats.thisMonthAmount.toLocaleString()}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>↑ 较上月增长 12%</div>
        </Card>
      </div>

      <div className="page-container">
        <div className="page-header">
          <div>
            <div className="page-title">采购订单列表</div>
            <div className="page-subtitle">管理所有采购需求，从创建到完成全流程追踪</div>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            创建采购需求
          </Button>
        </div>

        <div className="filter-bar">
          <Input
            placeholder="搜索订单号/标题/申请人"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            style={{ width: 260 }}
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
            value={dateRange as any}
            onChange={(v) => setDateRange(v as any)}
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
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </div>

      <Modal
        title="创建采购需求"
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        width={880}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>基本信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="title" label="需求标题" rules={[{ required: true, message: '请输入需求标题' }]}>
                <Input placeholder="如：六月份管道配件采购" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="requiredDate" label="需求日期" rules={[{ required: true, message: '请选择需求日期' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="选择需要到货的日期" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="requester" label="申请人" rules={[{ required: true, message: '请输入申请人' }]} initialValue="赵采购">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="department" label="部门" rules={[{ required: true, message: '请输入部门' }]} initialValue="采购部">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="supplierId" label="指定供应商（可选）">
                <Select
                  allowClear
                  placeholder="已有意向供应商可选"
                  options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>采购物品</Divider>
          <Form.List
            name="items"
            rules={[{ validator: async (_, items) => { if (!items || items.length === 0) throw new Error('请至少添加一项采购物品'); } }]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} size="small">
                    添加采购物品
                  </Button>
                </div>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'productId']}
                      rules={[{ required: true, message: '选择物料' }]}
                      style={{ width: 240, marginBottom: 0 }}
                    >
                      <Select
                        placeholder="选择物料"
                        showSearch
                        optionFilterProp="label"
                        options={products.map(p => ({
                          value: p.id,
                          label: `${p.name} (${p.sku})`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'quantity']}
                      rules={[{ required: true, message: '数量' }]}
                      style={{ width: 120, marginBottom: 0 }}
                    >
                      <InputNumber min={1} placeholder="数量" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'unitPrice']}
                      style={{ width: 120, marginBottom: 0 }}
                    >
                      <InputNumber min={0} placeholder="单价(选填)" style={{ width: '100%' }} prefix="¥" />
                    </Form.Item>
                    <Button danger onClick={() => remove(name)} size="small" icon={<DeleteOutlined />} />
                  </Space>
                ))}
                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>

          <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
            <Input.TextArea rows={3} placeholder="补充说明信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`采购单详情 - ${viewOrder?.orderNo}`}
        open={!!viewOrder}
        onCancel={() => setViewOrder(null)}
        footer={[
          <Button key="close" onClick={() => setViewOrder(null)}>关闭</Button>,
        ]}
        width={900}
      >
        {viewOrder && (
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: '基本信息',
                children: (
                  <div>
                    <Row gutter={24}>
                      <Col span={12}>
                        <p><strong>标题：</strong>{viewOrder.title}</p>
                        <p><strong>状态：</strong>
                          <Tag color={statusMap[viewOrder.status].color}>{statusMap[viewOrder.status].text}</Tag>
                        </p>
                        <p><strong>供应商：</strong>{viewOrder.supplierName || '待确定'}</p>
                        <p><strong>总金额：</strong>
                          {viewOrder.totalAmount ? <span style={{ color: '#cf1322', fontWeight: 600 }}>¥{viewOrder.totalAmount.toLocaleString()}</span> : '待报价'}
                        </p>
                      </Col>
                      <Col span={12}>
                        <p><strong>申请人：</strong>{viewOrder.requester} / {viewOrder.department}</p>
                        <p><strong>创建时间：</strong>{viewOrder.createTime}</p>
                        <p><strong>需求日期：</strong>{viewOrder.requiredDate}</p>
                        {viewOrder.confirmedDate && <p><strong>确认日期：</strong>{viewOrder.confirmedDate}</p>}
                      </Col>
                    </Row>
                    <Divider />
                    <div className="modal-section-title">采购明细</div>
                    <Table
                      size="small"
                      dataSource={viewOrder.items}
                      rowKey="productId"
                      pagination={false}
                      columns={[
                        { title: '物料名称', dataIndex: 'productName' },
                        { title: 'SKU', dataIndex: 'sku', width: 120 },
                        { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
                        { title: '单价', dataIndex: 'unitPrice', width: 100, align: 'right', render: v => v ? `¥${v}` : '-' },
                        { title: '小计', width: 110, align: 'right', render: (_, r) => r.unitPrice ? `¥${(r.quantity * r.unitPrice).toLocaleString()}` : '-' },
                        { title: '已到货', width: 100, align: 'right', render: (_, r: any) => `${r.receivedQty || 0}/${r.quantity}` },
                        { title: '合格/不合格', width: 130, align: 'center', render: (_, r) => <span>{r.acceptedQty || 0} / {r.rejectedQty || 0}</span> },
                      ]}
                    />
                    {viewOrder.remark && (
                      <>
                        <Divider />
                        <p><strong>备注：</strong>{viewOrder.remark}</p>
                      </>
                    )}
                  </div>
                ),
              },
              {
                key: 'timeline',
                label: '流程时间线',
                children: (
                  <div style={{ padding: '10px 20px' }}>
                    <Timeline
                      mode="left"
                      items={timelineEvents.map((e, idx) => ({
                        key: idx,
                        color: e.color,
                        dot: e.icon,
                        children: (
                          <div>
                            <div style={{ fontWeight: 600 }}>{e.title}</div>
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{e.description}</div>
                            <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>{e.time}</div>
                          </div>
                        ),
                      }))}
                    />
                  </div>
                ),
              },
              {
                key: 'quotes',
                label: `关联报价 (${relatedQuotes.length})`,
                children: (
                  relatedQuotes.length > 0 ? (
                    <div>
                      {relatedQuotes.map((q: SupplierQuote) => (
                        <Card key={q.id} size="small" style={{ marginBottom: 12 }} title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{q.supplierName}</span>
                            <Tag color={
                              q.status === 'accepted' ? 'green' : q.status === 'rejected' ? 'red' : 'blue'
                            }>
                              {q.status === 'accepted' ? '已采纳' : q.status === 'rejected' ? '已拒绝' : '待确认'}
                            </Tag>
                          </div>
                        }>
                          <Row>
                            <Col span={8}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>报价单号</small><br /><strong>{q.id}</strong></p>
                            </Col>
                            <Col span={8}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>报价时间</small><br /><strong>{q.submitTime}</strong></p>
                            </Col>
                            <Col span={8}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>总金额</small><br /><strong style={{ color: '#cf1322' }}>¥{q.totalAmount.toLocaleString()}</strong></p>
                            </Col>
                          </Row>
                          <Table
                            size="small"
                            dataSource={q.items}
                            rowKey="productId"
                            pagination={false}
                            columns={[
                              { title: '物料名称', dataIndex: 'productName' },
                              { title: 'SKU', dataIndex: 'sku', width: 120 },
                              { title: '数量', dataIndex: 'quantity', width: 70, align: 'right' },
                              { title: '单价', dataIndex: 'unitPrice', width: 90, align: 'right', render: v => `¥${v}` },
                              { title: '小计', width: 100, align: 'right', render: (_, r) => `¥${r.subtotal.toLocaleString()}` },
                              { title: '交货期(天)', dataIndex: 'leadTime', width: 100, align: 'center' },
                            ]}
                          />
                          <Row style={{ marginTop: 8, fontSize: 12 }}>
                            <Col span={12}>有效期至: {q.validUntil}</Col>
                            <Col span={12} style={{ textAlign: 'right' }}>
                              {q.taxAmount !== undefined && <span style={{ marginRight: 16 }}>税额: ¥{q.taxAmount}</span>}
                              {q.shippingFee !== undefined && <span>运费: ¥{q.shippingFee}</span>}
                            </Col>
                          </Row>
                          {q.remark && <p style={{ marginTop: 8, fontSize: 12 }}><strong>备注: </strong>{q.remark}</p>}
                        </Card>
                      ))}
                    </div>
                  ) : <div style={{ padding: 40, textAlign: 'center', color: '#8c8c8c' }}>暂无关联报价</div>
                ),
              },
              {
                key: 'receipts',
                label: `关联入库 (${relatedReceipts.length})`,
                children: (
                  relatedReceipts.length > 0 ? (
                    <div>
                      {relatedReceipts.map((r: WarehouseReceipt) => (
                        <Card key={r.id} size="small" style={{ marginBottom: 12 }} title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>入库单 {r.receiptNo}</span>
                            <Tag color="green">已入库</Tag>
                          </div>
                        }>
                          <Row>
                            <Col span={6}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>供应商</small><br /><strong>{r.supplierName}</strong></p>
                            </Col>
                            <Col span={6}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>入库日期</small><br /><strong>{r.receivedDate}</strong></p>
                            </Col>
                            <Col span={6}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>仓库</small><br /><strong>{r.warehouse}</strong></p>
                            </Col>
                            <Col span={6}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>总金额</small><br /><strong style={{ color: '#cf1322' }}>¥{r.totalAmount.toLocaleString()}</strong></p>
                            </Col>
                          </Row>
                          <Table
                            size="small"
                            dataSource={r.items}
                            rowKey="productId"
                            pagination={false}
                            columns={[
                              { title: '物料名称', dataIndex: 'productName' },
                              { title: 'SKU', dataIndex: 'sku', width: 120 },
                              { title: '应收', dataIndex: 'expectedQty', width: 60, align: 'right' },
                              { title: '实收', dataIndex: 'actualQty', width: 60, align: 'right' },
                              { title: '合格', dataIndex: 'acceptedQty', width: 60, align: 'right' },
                              { title: '不合格', dataIndex: 'rejectedQty', width: 60, align: 'right' },
                              { title: '质检', width: 70, align: 'center', render: (_, ri) => (
                                <Tag color={ri.qcResult === 'pass' ? 'green' : ri.qcResult === 'fail' ? 'red' : 'orange'}>
                                  {ri.qcResult === 'pass' ? '合格' : ri.qcResult === 'fail' ? '不合格' : '部分'}
                                </Tag>
                              )},
                              { title: '单价', width: 80, align: 'right', render: v => `¥${v.unitPrice}` },
                              { title: '小计', width: 100, align: 'right', render: (_, ri) => `¥${ri.subtotal.toLocaleString()}` },
                            ]}
                          />
                          <Row style={{ marginTop: 8, fontSize: 12 }}>
                            <Col span={12}>收货人: {r.receiver} | 检验员: {r.inspector}</Col>
                          </Row>
                          {r.remark && <p style={{ marginTop: 8, fontSize: 12 }}><strong>备注: </strong>{r.remark}</p>}
                        </Card>
                      ))}
                    </div>
                  ) : <div style={{ padding: 40, textAlign: 'center', color: '#8c8c8c' }}>暂无关联入库单</div>
                ),
              },
              {
                key: 'payables',
                label: `应付账单 (${relatedPayables.length})`,
                children: (
                  relatedPayables.length > 0 ? (
                    <div>
                      {relatedPayables.map((p: Payable) => (
                        <Card key={p.id} size="small" style={{ marginBottom: 12 }} title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>应付账单 {p.billNo}</span>
                            <Tag color={
                              p.status === 'paid' ? 'green' : p.status === 'partial' ? 'orange' : 'red'
                            }>
                              {p.status === 'paid' ? '已结清' : p.status === 'partial' ? '部分付款' : '待付款'}
                            </Tag>
                          </div>
                        }>
                          <Row gutter={16}>
                            <Col span={6}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>供应商</small><br /><strong>{p.supplierName}</strong></p>
                            </Col>
                            <Col span={6}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>账单日期</small><br /><strong>{p.billDate}</strong></p>
                            </Col>
                            <Col span={6}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>到期日期</small><br /><strong>{p.dueDate}</strong></p>
                            </Col>
                            <Col span={6}>
                              <p style={{ margin: '4px 0' }}><small style={{ color: '#8c8c8c' }}>应付金额</small><br /><strong style={{ color: '#cf1322' }}>¥{p.totalAmount.toLocaleString()}</strong></p>
                            </Col>
                          </Row>
                          <Row gutter={16}>
                            <Col span={8}>
                              <Card size="small" style={{ background: '#fff2e8' }}>
                                <div style={{ fontSize: 12, color: '#8c8c8c' }}>已付金额</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>¥{p.paidAmount.toLocaleString()}</div>
                              </Card>
                            </Col>
                            <Col span={8}>
                              <Card size="small" style={{ background: '#fff1f0' }}>
                                <div style={{ fontSize: 12, color: '#8c8c8c' }}>未付金额</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#cf1322' }}>¥{p.unpaidAmount.toLocaleString()}</div>
                              </Card>
                            </Col>
                            <Col span={8}>
                              <Card size="small" style={{ background: '#f6ffed' }}>
                                <div style={{ fontSize: 12, color: '#8c8c8c' }}>付款进度</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#389e0d' }}>
                                  {Math.round((p.paidAmount / p.totalAmount) * 100)}%
                                </div>
                              </Card>
                            </Col>
                          </Row>
                          {p.payments.length > 0 && (
                            <>
                              <div className="modal-section-title" style={{ marginTop: 12 }}>付款记录</div>
                              <Table
                                size="small"
                                dataSource={p.payments}
                                rowKey="date"
                                pagination={false}
                                columns={[
                                  { title: '付款日期', dataIndex: 'date', width: 120 },
                                  { title: '付款方式', dataIndex: 'method', width: 120 },
                                  { title: '金额', dataIndex: 'amount', width: 120, align: 'right', render: v => `¥${v.toLocaleString()}` },
                                  { title: '凭证号', dataIndex: 'reference', width: 150 },
                                  { title: '备注', dataIndex: 'remark' },
                                ]}
                              />
                            </>
                          )}
                          {p.remark && <p style={{ marginTop: 12, fontSize: 12 }}><strong>备注: </strong>{p.remark}</p>}
                        </Card>
                      ))}
                    </div>
                  ) : <div style={{ padding: 40, textAlign: 'center', color: '#8c8c8c' }}>暂无应付账单</div>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
