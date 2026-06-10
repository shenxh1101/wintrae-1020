import { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Select, Modal, Form, InputNumber, DatePicker,
  Card, Row, Col, Divider, message, Input, Tabs, Radio,
} from 'antd';
import {
  PlusOutlined, CheckOutlined, CloseOutlined,
  SearchOutlined, FileTextOutlined, TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store/appStore';
import { SupplierQuote, QuoteStatus } from '../types';

const statusMap: Record<QuoteStatus, { color: string; text: string }> = {
  pending: { color: 'default', text: '待提交' },
  submitted: { color: 'blue', text: '已提交' },
  accepted: { color: 'green', text: '已采纳' },
  rejected: { color: 'red', text: '已拒绝' },
};

export default function QuoteWindow() {
  const { quotes, purchaseOrders, suppliers, products, addQuote, acceptQuote } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailPO, setDetailPO] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | undefined>();
  const [form] = Form.useForm();

  const stats = useMemo(() => {
    const submitted = quotes.filter(q => q.status === 'submitted').length;
    const accepted = quotes.filter(q => q.status === 'accepted').length;
    const totalAmount = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.totalAmount, 0);
    return {
      total: quotes.length,
      submitted,
      accepted,
      acceptedAmount: totalAmount,
    };
  }, [quotes]);

  const filteredData = useMemo(() => {
    return quotes.filter(q => {
      if (keyword && !q.purchaseOrderNo.includes(keyword) && !q.supplierName.includes(keyword)) return false;
      if (statusFilter && q.status !== statusFilter) return false;
      return true;
    });
  }, [quotes, keyword, statusFilter]);

  // Group quotes by purchase order for comparison view
  const quotesByPO = useMemo(() => {
    const map: Record<string, SupplierQuote[]> = {};
    quotes.forEach(q => {
      if (!map[q.purchaseOrderId]) map[q.purchaseOrderId] = [];
      map[q.purchaseOrderId].push(q);
    });
    return map;
  }, [quotes]);

  const pendingPOs = useMemo(() => {
    return purchaseOrders.filter(p =>
      ['pending_quote', 'quoted'].includes(p.status)
    );
  }, [purchaseOrders]);

  const columns: ColumnsType<SupplierQuote> = [
    { title: '报价单号', dataIndex: 'id', width: 100 },
    { title: '关联采购单', dataIndex: 'purchaseOrderNo', width: 160 },
    { title: '供应商', dataIndex: 'supplierName', width: 220 },
    {
      title: '报价金额 (元)',
      dataIndex: 'totalAmount',
      width: 140,
      align: 'right',
      render: (v) => <span style={{ color: '#cf1322', fontWeight: 600 }}>¥{v.toLocaleString()}</span>,
    },
    { title: '运费 (元)', dataIndex: 'shippingFee', width: 110, align: 'right', render: v => v ? `¥${v}` : '包邮' },
    { title: '税 (元)', dataIndex: 'taxAmount', width: 110, align: 'right', render: v => v ? `¥${v}` : '-' },
    { title: '有效期至', dataIndex: 'validUntil', width: 120 },
    { title: '提交时间', dataIndex: 'submitTime', width: 170 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: QuoteStatus) => {
        const cfg = statusMap[s];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-col">
          {record.status === 'submitted' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => {
                  acceptQuote(record.id);
                  message.success('已采纳该供应商报价，采购单已确认');
                }}
              >
                采纳
              </Button>
              <Button size="small" danger icon={<CloseOutlined />}>
                拒绝
              </Button>
            </>
          )}
          <Button type="link" size="small" icon={<FileTextOutlined />}>
            明细
          </Button>
        </div>
      ),
    },
  ];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const supplier = suppliers.find(s => s.id === values.supplierId);
      const po = purchaseOrders.find(p => p.id === values.purchaseOrderId);
      if (!supplier || !po) return;

      const items = values.items.map((it: any) => {
        const p = products.find(x => x.id === it.productId);
        const poItem = po.items.find(i => i.productId === it.productId);
        const qty = poItem?.quantity || 0;
        return {
          productId: it.productId,
          productName: p?.name || '',
          sku: p?.sku || '',
          quantity: qty,
          unitPrice: it.unitPrice,
          subtotal: qty * it.unitPrice,
          leadTime: it.leadTime,
        };
      });

      const totalAmount = items.reduce((s: number, i: any) => s + i.subtotal, 0);

      addQuote({
        purchaseOrderId: values.purchaseOrderId,
        purchaseOrderNo: po.orderNo,
        supplierId: values.supplierId,
        supplierName: supplier.name,
        items,
        totalAmount,
        taxAmount: values.taxAmount,
        shippingFee: values.shippingFee,
        validUntil: values.validUntil.format('YYYY-MM-DD'),
        remark: values.remark,
      });

      message.success('报价已录入');
      setIsModalOpen(false);
      form.resetFields();
    } catch (e) {
      // validation
    }
  };

  const renderComparisonView = () => {
    const posWithQuotes = Object.entries(quotesByPO).filter(([_, qs]) => qs.length >= 1);
    if (posWithQuotes.length === 0) {
      return (
        <div className="empty-tip">
          <FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
          <p>暂无可比较的报价</p>
        </div>
      );
    }

    return (
      <div>
        {posWithQuotes.map(([poId, qs]) => {
          const po = purchaseOrders.find(p => p.id === poId);
          if (!po) return null;
          return (
            <Card
              key={poId}
              style={{ marginBottom: 16 }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{po.title}</span>
                    <Tag color="blue" style={{ marginLeft: 12 }}>{po.orderNo}</Tag>
                    <span style={{ marginLeft: 12, color: '#8c8c8c', fontSize: 13 }}>
                      共 {qs.length} 家供应商报价
                    </span>
                  </div>
                  <Button size="small" type="link" onClick={() => setDetailPO(poId)}>
                    查看比价详情 →
                  </Button>
                </div>
              }
            >
              <Row gutter={16}>
                {qs.map(q => {
                  const lowest = Math.min(...qs.map(x => x.totalAmount));
                  const isLowest = q.totalAmount === lowest;
                  return (
                    <Col span={Math.max(6, 24 / qs.length)} key={q.id}>
                      <Card
                        size="small"
                        style={{
                          borderColor: isLowest ? '#52c41a' : '#f0f0f0',
                          background: isLowest ? '#f6ffed' : 'white',
                        }}
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13 }}>{q.supplierName}</span>
                            {isLowest && <Tag color="green">最低价</Tag>}
                          </div>
                        }
                        extra={<Tag color={statusMap[q.status].color}>{statusMap[q.status].text}</Tag>}
                      >
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                          <div style={{ color: '#8c8c8c', fontSize: 12 }}>报价总额</div>
                          <div style={{
                            fontSize: 26,
                            fontWeight: 700,
                            color: isLowest ? '#389e0d' : '#cf1322',
                          }}>
                            ¥{q.totalAmount.toLocaleString()}
                          </div>
                        </div>
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.8 }}>
                          <p>运费: {q.shippingFee ? `¥${q.shippingFee}` : '包邮'}</p>
                          <p>税: {q.taxAmount ? `¥${q.taxAmount}` : '-'}</p>
                          <p>平均交期: {Math.round(q.items.reduce((s, i) => s + i.leadTime, 0) / q.items.length)} 天</p>
                          <p>有效期至: {q.validUntil}</p>
                        </div>
                        {q.status === 'submitted' && (
                          <Button
                            block
                            type={isLowest ? 'primary' : 'default'}
                            size="small"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                              acceptQuote(q.id);
                              message.success(`已采纳 ${q.supplierName} 的报价`);
                            }}
                          >
                            采纳此报价
                          </Button>
                        )}
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className="stat-cards">
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">报价总数</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-trend">覆盖 {Object.keys(quotesByPO).length} 个采购需求</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">待处理报价</div>
          <div className="stat-value" style={{ color: '#faad14' }}>{stats.submitted}</div>
          <div className="stat-trend" style={{ color: '#faad14' }}>等待比价并采纳</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">已采纳报价</div>
          <div className="stat-value" style={{ color: '#52c41a' }}>{stats.accepted}</div>
          <div className="stat-trend">平均节支率 8.5%</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">已成交总金额</div>
          <div className="stat-value">¥{stats.acceptedAmount.toLocaleString()}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>节省 ¥{Math.round(stats.acceptedAmount * 0.085).toLocaleString()}</div>
        </Card>
      </div>

      <div className="page-container">
        <div className="page-header">
          <div>
            <div className="page-title">供应商报价管理</div>
            <div className="page-subtitle">收集供应商报价、横向比价、择优选择</div>
          </div>
          <Space>
            <Button icon={<TeamOutlined />} onClick={() => message.info('供应商信息管理（占位）')}>
              供应商库
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              录入报价
            </Button>
          </Space>
        </div>

        <Tabs
          defaultActiveKey="comparison"
          items={[
            {
              key: 'comparison',
              label: '比价视图',
              children: renderComparisonView(),
            },
            {
              key: 'list',
              label: '全部报价',
              children: (
                <>
                  <div className="filter-bar">
                    <Input
                      placeholder="搜索采购单号/供应商名"
                      prefix={<SearchOutlined />}
                      value={keyword}
                      onChange={e => setKeyword(e.target.value)}
                      style={{ width: 260 }}
                      allowClear
                    />
                    <Select
                      placeholder="报价状态"
                      allowClear
                      style={{ width: 150 }}
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.text }))}
                    />
                    <Button type="primary" ghost onClick={() => { setKeyword(''); setStatusFilter(undefined); }}>
                      重置
                    </Button>
                  </div>
                  <Table
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    scroll={{ x: 1400 }}
                    pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
                  />
                </>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="录入供应商报价"
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        width={860}
        okText="提交报价"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="purchaseOrderId" label="关联采购单" rules={[{ required: true, message: '请选择采购单' }]}>
                <Select
                  showSearch
                  placeholder="选择需要报价的采购单"
                  options={pendingPOs.map(p => ({
                    value: p.id,
                    label: `${p.orderNo} - ${p.title}`,
                  }))}
                  onChange={(poId) => {
                    const po = pendingPOs.find(p => p.id === poId);
                    if (po) {
                      form.setFieldsValue({
                        items: po.items.map(i => ({
                          productId: i.productId,
                          unitPrice: undefined,
                          leadTime: 7,
                        }))
                      });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
                <Select
                  showSearch
                  placeholder="选择供应商"
                  options={suppliers.map(s => ({
                    value: s.id,
                    label: `${s.name}（${s.rating}星，${s.paymentTerms}）`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <div className="modal-section-title">报价明细</div>
          <Form.List name="items">
            {(fields) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const productId = form.getFieldValue(['items', name, 'productId']);
                  const product = products.find(p => p.id === productId);
                  return (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 8 }}
                      title={product ? `${product.name} (${product.sku})` : '物料'}
                    >
                      <Row gutter={12} align="middle">
                        <Col span={8}>
                          <Form.Item
                            {...restField}
                            name={[name, 'unitPrice']}
                            label="单价 (元)"
                            rules={[{ required: true }]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber min={0} prefix="¥" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            {...restField}
                            name={[name, 'leadTime']}
                            label="交期 (天)"
                            rules={[{ required: true }]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber min={1} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                            需求数量: <strong>{product ? (pendingPOs.find(p => p.id === form.getFieldValue('purchaseOrderId'))?.items.find(i => i.productId === productId)?.quantity || 0) : 0}</strong>
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </>
            )}
          </Form.List>

          <Divider />
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="shippingFee" label="运费 (元)" initialValue={0} style={{ marginBottom: 0 }}>
                <InputNumber min={0} prefix="¥" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taxAmount" label="税额 (元)" style={{ marginBottom: 0 }}>
                <InputNumber min={0} prefix="¥" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="validUntil" label="报价有效期至" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="报价说明" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} placeholder="报价条款、折扣、付款条件等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="比价详情"
        open={!!detailPO}
        onCancel={() => setDetailPO(null)}
        footer={[<Button key="close" onClick={() => setDetailPO(null)}>关闭</Button>]}
        width={960}
      >
        {detailPO && (() => {
          const qs = quotesByPO[detailPO] || [];
          if (qs.length === 0) return <p>暂无数据</p>;
          const po = purchaseOrders.find(p => p.id === detailPO);
          const allItems = po?.items || [];

          return (
            <div>
              <p><strong>采购单：</strong>{po?.orderNo} - {po?.title}</p>
              <div className="modal-section-title">物料价格对比</div>
              <Table
                size="small"
                pagination={false}
                dataSource={allItems}
                rowKey="productId"
                columns={[
                  { title: '物料', dataIndex: 'productName', width: 180 },
                  { title: 'SKU', dataIndex: 'sku', width: 120 },
                  { title: '需求数量', dataIndex: 'quantity', width: 90, align: 'right' },
                  ...qs.map(q => ({
                    title: (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{q.supplierName}</div>
                        <Tag color={statusMap[q.status].color} style={{ fontSize: 10 }}>
                          {statusMap[q.status].text}
                        </Tag>
                      </div>
                    ),
                    width: 140,
                    align: 'right',
                    render: (_: any, row: any) => {
                      const qi = q.items.find(i => i.productId === row.productId);
                      if (!qi) return '-';
                      const minPrice = Math.min(...qs.map(qq => qq.items.find(ii => ii.productId === row.productId)?.unitPrice || 999999));
                      const isMin = qi.unitPrice === minPrice;
                      return (
                        <div>
                          <div style={{ fontWeight: isMin ? 700 : 500, color: isMin ? '#389e0d' : '#cf1322' }}>
                            ¥{qi.unitPrice}
                          </div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                            交期 {qi.leadTime}天 | ¥{qi.subtotal.toLocaleString()}
                          </div>
                        </div>
                      );
                    }
                  })),
                ]}
              />
              <Divider />
              <div className="modal-section-title">综合比较</div>
              <Table
                size="small"
                pagination={false}
                dataSource={qs}
                rowKey="id"
                columns={[
                  { title: '供应商', dataIndex: 'supplierName', width: 200 },
                  { title: '金额', dataIndex: 'totalAmount', width: 120, align: 'right', render: v => `¥${v.toLocaleString()}` },
                  { title: '运费', dataIndex: 'shippingFee', width: 90, align: 'right', render: v => v ? `¥${v}` : '包邮' },
                  { title: '税', dataIndex: 'taxAmount', width: 90, align: 'right', render: v => v ? `¥${v}` : '-' },
                  { title: '平均交期', width: 100, align: 'right', render: (_, r) => `${Math.round(r.items.reduce((s, i) => s + i.leadTime, 0) / r.items.length)}天` },
                  { title: '有效期', dataIndex: 'validUntil', width: 110 },
                  { title: '状态', width: 100, render: (_, r) => <Tag color={statusMap[r.status].color}>{statusMap[r.status].text}</Tag> },
                  {
                    title: '操作', width: 120, render: (_, r) => r.status === 'submitted' && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => {
                          acceptQuote(r.id);
                          message.success('已采纳报价');
                          setDetailPO(null);
                        }}
                      >
                        采纳
                      </Button>
                    )
                  }
                ]}
              />
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
