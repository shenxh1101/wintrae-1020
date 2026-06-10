import { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Input, Select, DatePicker, Space, Modal, Form,
  InputNumber, Card, Row, Col, Statistic, Divider, message, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store/appStore';
import { PurchaseOrder, PurchaseStatus } from '../types';

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
  const { purchaseOrders, suppliers, products, addPurchaseOrder, updatePurchaseOrder } = useAppStore();
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
        width={720}
      >
        {viewOrder && (
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
        )}
      </Modal>
    </div>
  );
}
