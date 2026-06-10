import { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Modal, Form, InputNumber, DatePicker,
  Card, Row, Col, Divider, message, Input, Select, Radio,
  Space,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, CheckCircleOutlined,
  CloseCircleOutlined, EyeOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store/appStore';
import { WarehouseReceipt, QCResult } from '../types';

const qcResultMap: Record<QCResult, { color: string; text: string; icon: any }> = {
  pass: { color: 'green', text: '全部合格', icon: CheckCircleOutlined },
  partial: { color: 'orange', text: '部分合格', icon: ExclamationCircleOutlined },
  fail: { color: 'red', text: '全部不合格', icon: CloseCircleOutlined },
};

export default function ReceiptWindow() {
  const { receipts, purchaseOrders, addReceipt } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<WarehouseReceipt | null>(null);
  const [keyword, setKeyword] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>();
  const [form] = Form.useForm();

  const stats = useMemo(() => {
    const thisMonth = dayjs().startOf('month');
    const monthReceipts = receipts.filter(r => dayjs(r.receivedDate).isAfter(thisMonth));
    const totalQty = monthReceipts.reduce((s, r) =>
      s + r.items.reduce((is, i) => is + i.acceptedQty, 0), 0);
    const totalRejected = monthReceipts.reduce((s, r) =>
      s + r.items.reduce((is, i) => is + i.rejectedQty, 0), 0);
    const qcPassRate = totalQty + totalRejected > 0
      ? Math.round(totalQty / (totalQty + totalRejected) * 100)
      : 100;
    return {
      total: receipts.length,
      monthCount: monthReceipts.length,
      monthQty: totalQty,
      qcPassRate,
    };
  }, [receipts]);

  const filteredData = useMemo(() => {
    return receipts.filter(r => {
      if (keyword && !r.receiptNo.includes(keyword) && !r.purchaseOrderNo.includes(keyword) && !r.supplierName.includes(keyword)) return false;
      if (warehouseFilter && r.warehouse !== warehouseFilter) return false;
      return true;
    });
  }, [receipts, keyword, warehouseFilter]);

  const confirmedPOs = useMemo(() => {
    return purchaseOrders.filter(p =>
      ['confirmed', 'partial_received'].includes(p.status)
    );
  }, [purchaseOrders]);

  const warehouses = ['A区一号仓', 'A区二号仓', 'B区露天场', 'C区备品仓', 'D区设备仓'];

  const columns: ColumnsType<WarehouseReceipt> = [
    { title: '入库单号', dataIndex: 'receiptNo', width: 160, fixed: 'left' },
    { title: '采购单号', dataIndex: 'purchaseOrderNo', width: 160 },
    { title: '供应商', dataIndex: 'supplierName', width: 220 },
    { title: '仓库', dataIndex: 'warehouse', width: 120 },
    {
      title: '总金额 (元)',
      dataIndex: 'totalAmount',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>¥{v.toLocaleString()}</span>,
    },
    { title: '收货日期', dataIndex: 'receivedDate', width: 120 },
    { title: '收货人', dataIndex: 'receiver', width: 100 },
    { title: '质检员', dataIndex: 'inspector', width: 100 },
    {
      title: '质检状态',
      width: 110,
      render: (_, r) => {
        const hasPartial = r.items.some(i => i.qcResult === 'partial');
        const hasFail = r.items.some(i => i.qcResult === 'fail');
        let result: QCResult = 'pass';
        if (hasFail) result = 'fail';
        else if (hasPartial) result = 'partial';
        const cfg = qcResultMap[result];
        const Icon = cfg.icon;
        return <Tag color={cfg.color} icon={<Icon />}>{cfg.text}</Tag>;
      },
    },
    {
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-col">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewReceipt(record)}>
            详情
          </Button>
        </div>
      ),
    },
  ];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const po = confirmedPOs.find(p => p.id === values.purchaseOrderId);
      if (!po) return;

      const items = values.items.map((it: any) => {
        const poItem = po.items.find(i => i.productId === it.productId);
        const actualQty = it.actualQty ?? poItem?.quantity ?? 0;
        const acceptedQty = it.acceptedQty ?? actualQty;
        const rejectedQty = actualQty - acceptedQty;
        const unitPrice = poItem?.unitPrice ?? 0;
        let qcResult: QCResult = 'pass';
        if (rejectedQty >= actualQty) qcResult = 'fail';
        else if (rejectedQty > 0) qcResult = 'partial';

        return {
          productId: it.productId,
          productName: poItem?.productName || '',
          sku: poItem?.sku || '',
          expectedQty: poItem?.quantity || 0,
          actualQty,
          acceptedQty,
          rejectedQty,
          qcResult,
          qcRemark: it.qcRemark,
          unitPrice,
          subtotal: acceptedQty * unitPrice,
        };
      });

      const totalAmount = items.reduce((s: number, i: any) => s + i.subtotal, 0);

      addReceipt({
        purchaseOrderId: values.purchaseOrderId,
        purchaseOrderNo: po.orderNo,
        supplierId: po.supplierId || '',
        supplierName: po.supplierName || '',
        items,
        totalAmount,
        receivedDate: values.receivedDate?.format('YYYY-MM-DD'),
        warehouse: values.warehouse,
        receiver: values.receiver,
        inspector: values.inspector,
        remark: values.remark,
      });

      message.success('入库单创建成功，库存已自动更新');
      setIsModalOpen(false);
      form.resetFields();
    } catch (e) {
      // validation
    }
  };

  return (
    <div>
      <div className="stat-cards">
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">入库单总数</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>本月 {stats.monthCount} 单</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">本月入库件数</div>
          <div className="stat-value">{stats.monthQty.toLocaleString()}</div>
          <div className="stat-trend">包含 {warehouses.length} 个仓库</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">质检合格率</div>
          <div className="stat-value" style={{ color: '#52c41a' }}>{stats.qcPassRate}%</div>
          <div className="stat-trend" style={{ color: stats.qcPassRate >= 98 ? '#52c41a' : '#faad14' }}>
            {stats.qcPassRate >= 98 ? '质量稳定' : '注意提升'}
          </div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">待入库采购单</div>
          <div className="stat-value" style={{ color: '#faad14' }}>{confirmedPOs.length}</div>
          <div className="stat-trend" style={{ color: '#faad14' }}>请及时安排验收</div>
        </Card>
      </div>

      <div className="page-container">
        <div className="page-header">
          <div>
            <div className="page-title">入库验收记录</div>
            <div className="page-subtitle">登记到货数量、记录质检结果，自动更新库存台账</div>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            登记到货入库
          </Button>
        </div>

        <div className="filter-bar">
          <Input
            placeholder="搜索入库单/采购单/供应商"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="仓库"
            allowClear
            style={{ width: 160 }}
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            options={warehouses.map(w => ({ value: w, label: w }))}
          />
          <Button type="primary" ghost onClick={() => { setKeyword(''); setWarehouseFilter(undefined); }}>
            重置
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条记录` }}
        />
      </div>

      <Modal
        title="登记到货入库"
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        width={900}
        okText="确认入库"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>基本信息</Divider>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="purchaseOrderId"
                label="关联采购单"
                rules={[{ required: true, message: '请选择采购单' }]}
              >
                <Select
                  showSearch
                  placeholder="选择已确认的采购单"
                  options={confirmedPOs.map(p => ({
                    value: p.id,
                    label: `${p.orderNo} - ${p.title}（${p.supplierName || '待定供应商'}）`,
                  }))}
                  onChange={(poId) => {
                    const po = confirmedPOs.find(p => p.id === poId);
                    if (po) {
                      form.setFieldsValue({
                        items: po.items.map(i => ({
                          productId: i.productId,
                          actualQty: i.quantity,
                          acceptedQty: i.quantity,
                          qcRemark: '',
                        }))
                      });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="receivedDate" label="收货日期" rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="warehouse" label="收货仓库" rules={[{ required: true }]}>
                <Select options={warehouses.map(w => ({ value: w, label: w }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="receiver" label="收货人" rules={[{ required: true }]} initialValue="周仓管">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspector" label="质检员" rules={[{ required: true }]} initialValue="吴质检">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>到货验收明细</Divider>
          <Form.List name="items">
            {(fields) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const poId = form.getFieldValue('purchaseOrderId');
                  const po = confirmedPOs.find(p => p.id === poId);
                  const productId = form.getFieldValue(['items', name, 'productId']);
                  const poItem = po?.items.find(i => i.productId === productId);
                  const actualQty = form.getFieldValue(['items', name, 'actualQty']);
                  const acceptedQty = form.getFieldValue(['items', name, 'acceptedQty']);
                  const rejectedQty = actualQty - (acceptedQty || 0);

                  return (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 10, borderLeft: '4px solid #1677ff' }}
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <span>
                            {poItem?.productName || '物料'} <span style={{ color: '#8c8c8c', fontSize: 12 }}>({poItem?.sku})</span>
                          </span>
                          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                            采购数量: <strong>{poItem?.quantity || 0}</strong>
                            {poItem?.unitPrice ? ` | 单价: ¥${poItem.unitPrice}` : ''}
                          </span>
                        </div>
                      }
                    >
                      <Row gutter={12} align="middle">
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, 'actualQty']}
                            label="实际到货数量"
                            rules={[{ required: true }]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber min={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, 'acceptedQty']}
                            label="合格数量"
                            rules={[{ required: true }]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber min={0} max={actualQty} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <div style={{ padding: '4px 8px', background: rejectedQty > 0 ? '#fff1f0' : '#f6ffed', borderRadius: 4 }}>
                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>不合格数量</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: rejectedQty > 0 ? '#cf1322' : '#389e0d' }}>
                              {rejectedQty || 0}
                            </div>
                          </div>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, 'qcRemark']}
                            label="质检备注"
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="不合格原因等" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </>
            )}
          </Form.List>

          <Form.Item name="remark" label="整体备注" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} placeholder="送货单编号、异常情况等" />
          </Form.Item>

          <div style={{ padding: 12, background: '#e6f4ff', borderRadius: 6, border: '1px solid #91caff' }}>
            <strong style={{ color: '#1677ff' }}>💡 操作提示：</strong>
            <span style={{ color: '#0958d9', fontSize: 13 }}>
              &nbsp;确认入库后将自动更新对应物料的库存数量、库存总价值，并生成库存变动记录和供应商应付账单。
            </span>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`入库单详情 - ${viewReceipt?.receiptNo}`}
        open={!!viewReceipt}
        onCancel={() => setViewReceipt(null)}
        footer={[<Button key="close" onClick={() => setViewReceipt(null)}>关闭</Button>]}
        width={780}
      >
        {viewReceipt && (
          <div>
            <Row gutter={24}>
              <Col span={12}>
                <p><strong>入库单号：</strong>{viewReceipt.receiptNo}</p>
                <p><strong>采购单号：</strong>{viewReceipt.purchaseOrderNo}</p>
                <p><strong>供应商：</strong>{viewReceipt.supplierName}</p>
                <p><strong>仓库：</strong>{viewReceipt.warehouse}</p>
              </Col>
              <Col span={12}>
                <p><strong>收货日期：</strong>{viewReceipt.receivedDate}</p>
                <p><strong>收货人：</strong>{viewReceipt.receiver}</p>
                <p><strong>质检员：</strong>{viewReceipt.inspector}</p>
                <p><strong>总金额：</strong>
                  <span style={{ color: '#cf1322', fontWeight: 600, fontSize: 16 }}>
                    ¥{viewReceipt.totalAmount.toLocaleString()}
                  </span>
                </p>
              </Col>
            </Row>
            <Divider />
            <div className="modal-section-title">验收明细</div>
            <Table
              size="small"
              pagination={false}
              dataSource={viewReceipt.items}
              rowKey="productId"
              columns={[
                { title: '物料名称', dataIndex: 'productName' },
                { title: 'SKU', dataIndex: 'sku', width: 110 },
                { title: '应到', dataIndex: 'expectedQty', width: 60, align: 'right' },
                { title: '实到', dataIndex: 'actualQty', width: 60, align: 'right' },
                { title: '合格', dataIndex: 'acceptedQty', width: 60, align: 'right', render: v => <span style={{ color: '#389e0d', fontWeight: 600 }}>{v}</span> },
                { title: '不合格', dataIndex: 'rejectedQty', width: 70, align: 'right', render: v => v > 0 ? <span style={{ color: '#cf1322', fontWeight: 600 }}>{v}</span> : v },
                { title: '单价', width: 90, align: 'right', render: (_, r) => `¥${r.unitPrice}` },
                { title: '合格小计', width: 110, align: 'right', render: (_, r) => `¥${r.subtotal.toLocaleString()}` },
                {
                  title: '质检结果', width: 100, align: 'center', render: (_, r) => {
                    const cfg = qcResultMap[r.qcResult];
                    const Icon = cfg.icon;
                    return <Tag color={cfg.color} icon={<Icon />}>{cfg.text}</Tag>;
                  }
                },
                { title: '备注', dataIndex: 'qcRemark', ellipsis: true },
              ]}
            />
            {viewReceipt.remark && (
              <>
                <Divider />
                <p><strong>备注：</strong>{viewReceipt.remark}</p>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
