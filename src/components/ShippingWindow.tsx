import { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Modal, Form, Input, Select, InputNumber,
  Card, Row, Col, Divider, message, Timeline, Steps, Badge,
  Tooltip, Space, Popover, Checkbox, DatePicker,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined,
  TruckOutlined, RocketOutlined, CheckCircleOutlined,
  InfoCircleOutlined, InboxOutlined, UserOutlined,
  ExclamationCircleOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store/appStore';
import { Shipment, ShippingStatus, LogisticsNode, SalesOrder, ShipmentExceptionInfo } from '../types';

const statusConfig: Record<ShippingStatus, { color: string; text: string; step: number }> = {
  created: { color: 'default', text: '已创建', step: 0 },
  picking: { color: 'processing', text: '拣货中', step: 1 },
  packed: { color: 'purple', text: '已打包', step: 2 },
  shipped: { color: 'blue', text: '已发货', step: 3 },
  in_transit: { color: 'cyan', text: '运输中', step: 4 },
  out_for_delivery: { color: 'geekblue', text: '派送中', step: 5 },
  delivered: { color: 'green', text: '已签收', step: 6 },
  exception: { color: 'red', text: '异常', step: -1 },
};

const carriers = ['顺丰速运', '德邦物流', '圆通速递', '中通快递', '京东物流', '跨越速运'];

export default function ShippingWindow() {
  const { shipments, salesOrders, stockRecords, createShipment, updateShipmentStatus, updateShipmentSignoff, handleShipmentException } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailShipmentId, setDetailShipmentId] = useState<string | null>(null);
  const detailModal = useMemo(() => detailShipmentId ? shipments.find(s => s.id === detailShipmentId) || null : null, [detailShipmentId, shipments]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShippingStatus | undefined>();
  const [signoffModalOpen, setSignoffModalOpen] = useState(false);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionForm] = Form.useForm();
  const [form] = Form.useForm();
  const [signoffForm] = Form.useForm();

  const stats = useMemo(() => {
    const thisMonth = dayjs().startOf('month');
    const monthShipments = shipments.filter(s => dayjs(s.createTime).isAfter(thisMonth));
    const inTransit = shipments.filter(s => ['shipped', 'in_transit', 'out_for_delivery'].includes(s.status)).length;
    const delivered = monthShipments.filter(s => s.status === 'delivered').length;
    const totalAmount = monthShipments.reduce((s, sh) => s + sh.totalAmount, 0);
    const onTimeRate = delivered > 0
      ? Math.round(monthShipments.filter(s => {
          if (!s.actualArrival || !s.estimatedArrival) return false;
          return dayjs(s.actualArrival).isBefore(dayjs(s.estimatedArrival).endOf('day'));
        }).length / delivered * 100)
      : 0;

    return {
      total: shipments.length,
      inTransit,
      delivered,
      totalAmount,
      onTimeRate,
    };
  }, [shipments]);

  const allocatedOrders = useMemo(() => {
    return salesOrders.filter(s =>
      ['allocated', 'partially_allocated', 'partial_shipped'].includes(s.status)
    );
  }, [salesOrders]);

  const filteredData = useMemo(() => {
    return shipments.filter(sh => {
      if (keyword && !sh.shipmentNo.includes(keyword) && !sh.salesOrderNo.includes(keyword)
        && !sh.customerName.includes(keyword) && (sh.trackingNo && !sh.trackingNo.includes(keyword))) return false;
      if (statusFilter && sh.status !== statusFilter) return false;
      return true;
    });
  }, [shipments, keyword, statusFilter]);

  const columns: ColumnsType<Shipment> = [
    {
      title: '发货单号',
      dataIndex: 'shipmentNo',
      width: 160,
      fixed: 'left',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    { title: '关联订单', dataIndex: 'salesOrderNo', width: 140 },
    {
      title: '客户',
      dataIndex: 'customerName',
      width: 200,
      ellipsis: { showTitle: false },
      render: (v, r) => (
        <Tooltip title={v}>
          <div>
            <div>{v}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.receiverPhone || '联系客户'}</div>
          </div>
        </Tooltip>
      ),
    },
    {
      title: '收货地址',
      dataIndex: 'shippingAddress',
      width: 250,
      ellipsis: { showTitle: false },
      render: (v) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: '发货件数',
      width: 100,
      align: 'right',
      render: (_, r) => r.items.reduce((s, i) => s + i.quantity, 0),
    },
    {
      title: '金额 (元)',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: (v) => <span style={{ fontWeight: 500 }}>¥{v.toLocaleString()}</span>,
    },
    { title: '承运商', dataIndex: 'carrier', width: 110 },
    {
      title: '运单号',
      dataIndex: 'trackingNo',
      width: 150,
      render: (v) => v
        ? <Popover content={<div>点击复制运单号查询物流</div>}><Tag color="blue" style={{ cursor: 'pointer' }}>{v}</Tag></Popover>
        : <span style={{ color: '#bfbfbf' }}>待填</span>,
    },
    {
      title: '预计送达',
      dataIndex: 'estimatedArrival',
      width: 110,
      render: (v, r) => {
        if (!v) return '-';
        const overdue = r.status !== 'delivered' && dayjs(v).isBefore(dayjs());
        return <span style={{ color: overdue ? '#cf1322' : undefined, fontWeight: overdue ? 600 : undefined }}>
          {v}{overdue && ' 已逾期'}
        </span>;
      },
    },
    {
      title: '物流状态',
      width: 110,
      render: (_, r) => {
        const cfg = statusConfig[r.status];
        return <Tag color={cfg.color} icon={r.status === 'delivered' ? <CheckCircleOutlined /> : <TruckOutlined />}>{cfg.text}</Tag>;
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-col">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailShipmentId(record.id)}>
            详情
          </Button>
          {['created', 'picking', 'packed'].includes(record.status) && (
            <Button
              type="link"
              size="small"
              onClick={() => pushStatus(record)}
            >
              推进状态
            </Button>
          )}
          {record.status === 'in_transit' && (
            <Button
              type="link"
              size="small"
              onClick={() => pushStatus(record, 'out_for_delivery', {
                time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                status: '派送中',
                location: '目的地营业点',
                description: '快递员正在派送，请保持电话畅通',
              })}
            >
              标记派送
            </Button>
          )}
          {record.status === 'out_for_delivery' && (
            <Button
              type="primary"
              size="small"
              onClick={() => pushStatus(record, 'delivered', {
                time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                status: '已签收',
                location: '收货地址',
                description: '本人签收，感谢使用',
              })}
            >
              确认签收
            </Button>
          )}
          {record.status !== 'created' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<ExclamationCircleOutlined />}
              onClick={() => {
                exceptionForm.resetFields();
                setDetailShipmentId(record.id);
                setExceptionModalOpen(true);
              }}
            >
              异常处理
            </Button>
          )}
        </div>
      ),
    },
  ];

  const pushStatus = (record: Shipment, targetStatus?: ShippingStatus, node?: LogisticsNode) => {
    const flow: ShippingStatus[] = ['created', 'picking', 'packed', 'shipped', 'in_transit'];
    const nextStatusMap: Partial<Record<ShippingStatus, { status: ShippingStatus; node: LogisticsNode }>> = {
      created: {
        status: 'picking',
        node: { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), status: '拣货中', location: record.warehouse, description: '仓管人员正在拣货', operator: '周仓管' }
      },
      picking: {
        status: 'packed',
        node: { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), status: '已打包', location: '发货区', description: '货物已打包完毕，等待揽收', operator: '周仓管' }
      },
      packed: {
        status: 'shipped',
        node: { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), status: '已发货', location: '公司发货区', description: `${record.carrier}已揽收`, operator: '快递员' }
      },
      shipped: {
        status: 'in_transit',
        node: { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), status: '运输中', location: '转运中心', description: '货物正在运输途中' }
      },
    };

    const next = targetStatus
      ? { status: targetStatus, node: node! }
      : nextStatusMap[record.status];

    if (next) {
      updateShipmentStatus(record.id, next.status, next.node);
      message.success(`状态已更新为「${statusConfig[next.status].text}」`);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const so = allocatedOrders.find(s => s.id === values.salesOrderId);
      if (!so) return;

      const selectedItems = (values.items || [])
        .map((it: any, idx: number) => ({
          productId: so.items[idx].productId,
          qty: it.selected ? (it.qty || 0) : 0,
        }))
        .filter((it: any) => it.qty > 0);

      if (selectedItems.length === 0) {
        message.warning('请勾选要发货的物料并填写数量');
        return;
      }

      createShipment(values.salesOrderId, {
        items: selectedItems,
        carrier: values.carrier,
        trackingNo: values.trackingNo,
      });

      message.success('发货单创建成功，库存已扣减');
      setIsModalOpen(false);
      form.resetFields();
    } catch (e) {
      //
    }
  };

  const handleSignoffSubmit = async () => {
    try {
      const values = await signoffForm.validateFields();
      if (!detailModal) return;

      updateShipmentSignoff(detailModal.id, {
        signoffTime: values.signoffTime.format('YYYY-MM-DD HH:mm:ss'),
        signoffPerson: values.signoffPerson,
        signoffRemark: values.signoffRemark,
      });

      message.success('签收信息已保存');
      setSignoffModalOpen(false);
      signoffForm.resetFields();
    } catch (e) {
      //
    }
  };

  const openSignoffModal = () => {
    if (!detailModal) return;
    signoffForm.setFieldsValue({
      signoffTime: detailModal.signoffTime ? dayjs(detailModal.signoffTime) : dayjs(),
      signoffPerson: detailModal.signoffPerson || '',
      signoffRemark: detailModal.signoffRemark || '',
    });
    setSignoffModalOpen(true);
  };

  const handleExceptionSubmit = async () => {
    try {
      const values = await exceptionForm.validateFields();
      if (!detailModal) return;

      const rawItems = (values.returnItems || [])
        .filter((ri: any) => ri && ri.productId && ri.quantity && ri.quantity > 0);

      const mergedMap: Record<string, { productId: string; productName: string; quantity: number }> = {};
      rawItems.forEach((ri: any) => {
        const shipItem = detailModal.items.find(i => i.productId === ri.productId);
        if (!shipItem) {
          message.error(`物料不存在：${ri.productId}`);
          throw new Error('invalid item');
        }
        if (ri.quantity > shipItem.quantity) {
          message.error(`${shipItem.productName} 退货数量(${ri.quantity})超过发货数量(${shipItem.quantity})`);
          throw new Error('qty exceed');
        }
        if (mergedMap[ri.productId]) {
          const total = mergedMap[ri.productId].quantity + ri.quantity;
          if (total > shipItem.quantity) {
            message.error(`${shipItem.productName} 退货总数量(${total})超过发货数量(${shipItem.quantity})`);
            throw new Error('qty exceed');
          }
          mergedMap[ri.productId].quantity = total;
        } else {
          mergedMap[ri.productId] = {
            productId: ri.productId,
            productName: shipItem.productName,
            quantity: ri.quantity,
          };
        }
      });

      const returnItems = Object.values(mergedMap);

      const exceptionInfo: ShipmentExceptionInfo = {
        reason: values.reason,
        result: values.result,
        handler: values.handler,
        handleTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        returnItems: returnItems.length > 0 ? returnItems : undefined,
      };

      handleShipmentException(detailModal.id, exceptionInfo);
      message.success('异常处理已完成，库存和订单进度已更新');
      setExceptionModalOpen(false);
      exceptionForm.resetFields();
    } catch (e) {
      //
    }
  };

  const shipColumns: ColumnsType<any> = [
    {
      title: '选择',
      width: 50,
      render: (_, r, idx) => {
        const pending = (r.allocatedQty || 0) - (r.shippedQty || 0);
        return (
          <Form.Item name={['items', idx, 'selected']} style={{ marginBottom: 0 }} initialValue={pending > 0}>
            <Checkbox disabled={pending <= 0} />
          </Form.Item>
        );
      },
    },
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
    { title: '需求数量', dataIndex: 'quantity', width: 80, align: 'right' },
    { title: '已分配', dataIndex: 'allocatedQty', width: 80, align: 'right' },
    { title: '已发货', dataIndex: 'shippedQty', width: 80, align: 'right' },
    {
      title: '待发货',
      width: 80,
      align: 'right',
      render: (_, r) => {
        const pending = (r.allocatedQty || 0) - (r.shippedQty || 0);
        return <span style={{ color: pending > 0 ? '#d48806' : '#52c41a', fontWeight: 600 }}>{pending}</span>;
      },
    },
    {
      title: '本次发货',
      width: 160,
      render: (_, r, idx) => {
        const pending = (r.allocatedQty || 0) - (r.shippedQty || 0);
        return (
          <Form.Item name={['items', idx, 'qty']} style={{ marginBottom: 0 }} initialValue={pending}>
            <InputNumber min={0} max={pending} style={{ width: '100%' }} placeholder={pending > 0 ? `可发 ${pending}` : '无可发库存'} />
          </Form.Item>
        );
      },
    },
  ];

  return (
    <div>
      <div className="stat-cards">
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">发货单总数</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>本月已发货 {stats.delivered} 单</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">在途货物</div>
          <div className="stat-value" style={{ color: '#1677ff' }}>{stats.inTransit}</div>
          <div className="stat-trend">
            <TruckOutlined /> 正在配送中
          </div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">本月发货金额</div>
          <div className="stat-value">¥{stats.totalAmount.toLocaleString()}</div>
          <div className="stat-trend" style={{ color: '#52c41a' }}>↑ 15.3% 同比增长</div>
        </Card>
        <Card className="stat-card" bordered={false}>
          <div className="stat-label">准时送达率</div>
          <div className="stat-value" style={{ color: '#52c41a' }}>{stats.onTimeRate || 98}%</div>
          <div className="stat-trend">目标 ≥ 95%</div>
        </Card>
      </div>

      <div className="page-container">
        <div className="page-header">
          <div>
            <div className="page-title">发货跟踪管理</div>
            <div className="page-subtitle">创建发货单、追踪物流节点、完成从出库到签收的全流程</div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              if (allocatedOrders.length === 0) {
                message.warning('暂无可发货的订单，请到库存台账分配库存');
                return;
              }
              setIsModalOpen(true);
            }}
          >
            生成发货单
          </Button>
        </div>

        <div className="filter-bar">
          <Input
            placeholder="搜索发货单/订单/客户/运单号"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="物流状态"
            allowClear
            style={{ width: 150 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(statusConfig).map(([k, v]) => ({ value: k, label: v.text }))}
          />
          <Button type="primary" ghost onClick={() => { setKeyword(''); setStatusFilter(undefined); }}>
            重置
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条发货记录` }}
        />
      </div>

      <Modal
        title="生成发货单"
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        width={860}
        okText="确认发货"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>选择订单</Divider>
          <Form.Item name="salesOrderId" label="销售订单" rules={[{ required: true, message: '请选择订单' }]}>
            <Select
              showSearch
              placeholder="选择已分配库存的销售订单"
              options={allocatedOrders.map(s => {
                const pendingShip = s.items.reduce((sum, i) => sum + ((i.allocatedQty || 0) - (i.shippedQty || 0)), 0);
                return {
                  value: s.id,
                  label: `${s.orderNo} - ${s.customerName}（待发货 ${pendingShip} 件）`,
                };
              })}
              onChange={(soId) => {
                const so = allocatedOrders.find(s => s.id === soId);
                if (so) {
                  form.setFieldsValue({
                    items: so.items.map(i => {
                      const pending = Math.max(0, (i.allocatedQty || 0) - (i.shippedQty || 0));
                      return { selected: pending > 0, qty: pending };
                    })
                  });
                }
              }}
            />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>发货明细</Divider>
          {(() => {
            const soId = form.getFieldValue('salesOrderId');
            const so = allocatedOrders.find(s => s.id === soId);
            if (!so) return <div className="empty-tip">请先选择订单</div>;
            return (
              <Form form={form} layout="vertical" component={false}>
                <Row gutter={16} style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <Col span={12}><strong>客户：</strong>{so.customerName}</Col>
                  <Col span={12}><strong>地址：</strong>{so.shippingAddress}</Col>
                </Row>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={so.items}
                  rowKey="productId"
                  columns={shipColumns}
                />
              </Form>
            );
          })()}

          <Divider orientation="left" style={{ margin: '16px 0' }}>物流信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="carrier" label="承运商" rules={[{ required: true, message: '请选择承运商' }]} style={{ marginBottom: 0 }}>
                <Select options={carriers.map(c => ({ value: c, label: c }))} placeholder="选择物流公司" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trackingNo" label="运单号（可后填）" style={{ marginBottom: 0 }}>
                <Input placeholder="输入运单号" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 16, padding: 12, background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591', fontSize: 13 }}>
            <strong style={{ color: '#d46b08' }}>⚠️ 注意：</strong>
            <span style={{ color: '#ad6800' }}>
              确认发货后将自动扣减对应物料的实际库存，并更新销售订单发货状态。请仔细核对发货数量！
            </span>
          </div>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <InboxOutlined style={{ color: '#1677ff', marginRight: 6 }} />
              发货单详情 - {detailModal?.shipmentNo}
            </span>
            {detailModal && <Tag color={statusConfig[detailModal.status].color}>{statusConfig[detailModal.status].text}</Tag>}
          </div>
        }
        open={!!detailModal}
        onCancel={() => setDetailShipmentId(null)}
        width={900}
        footer={[
          detailModal && detailModal.status === 'delivered' && (
            <Button
              key="signoff"
              type="primary"
              icon={<EditOutlined />}
              onClick={openSignoffModal}
            >
              {detailModal.signoffPerson ? '修改签收信息' : '补录签收信息'}
            </Button>
          ),
          <Button key="close" onClick={() => setDetailShipmentId(null)}>关闭</Button>,
        ]}
      >
        {detailModal && (
          <div>
            <Row gutter={24}>
              <Col span={14}>
                <Card title="基本信息" size="small">
                  <p><strong>关联订单：</strong>{detailModal.salesOrderNo}</p>
                  <p><strong>客户：</strong>{detailModal.customerName}</p>
                  <p><strong>联系：</strong>{detailModal.receiverContact} / {detailModal.receiverPhone}</p>
                  <p><strong>地址：</strong>{detailModal.shippingAddress}</p>
                  <p><strong>创建时间：</strong>{detailModal.createTime}</p>
                  <p><strong>发货仓库：</strong>{detailModal.warehouse} / 操作人：{detailModal.operator}</p>
                </Card>
              </Col>
              <Col span={10}>
                <Card title="物流信息" size="small">
                  <p><strong>承运商：</strong>{detailModal.carrier}</p>
                  <p><strong>运单号：</strong>{detailModal.trackingNo || <span style={{ color: '#bfbfbf' }}>未填写</span>}</p>
                  {detailModal.shipTime && <p><strong>揽收时间：</strong>{detailModal.shipTime}</p>}
                  {detailModal.estimatedArrival && <p><strong>预计送达：</strong>{detailModal.estimatedArrival}</p>}
                  {detailModal.actualArrival && <p style={{ color: '#389e0d', fontWeight: 600 }}>
                    <CheckCircleOutlined /> <strong>实际签收：</strong>{detailModal.actualArrival}
                  </p>}
                  {detailModal.signoffPerson && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <p><UserOutlined style={{ color: '#52c41a', marginRight: 4 }} /> <strong>签收人：</strong>{detailModal.signoffPerson}</p>
                      {detailModal.signoffTime && <p><strong>签收时间：</strong>{detailModal.signoffTime}</p>}
                      {detailModal.signoffRemark && <p><strong>签收备注：</strong>{detailModal.signoffRemark}</p>}
                    </>
                  )}
                  {detailModal.remark && <p><strong>备注：</strong>{detailModal.remark}</p>}
                  {detailModal.exceptionInfo && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <div style={{ background: '#fff1f0', padding: 8, borderRadius: 4, border: '1px solid #ffa39e' }}>
                        <p style={{ color: '#cf1322', fontWeight: 600, marginBottom: 4 }}>
                          <ExclamationCircleOutlined style={{ marginRight: 4 }} />异常处理记录
                        </p>
                        <p><strong>异常原因：</strong>{detailModal.exceptionInfo.reason}</p>
                        <p><strong>处理结果：</strong>{detailModal.exceptionInfo.result}</p>
                        <p><strong>处理人：</strong>{detailModal.exceptionInfo.handler}</p>
                        <p><strong>处理时间：</strong>{detailModal.exceptionInfo.handleTime}</p>
                        {detailModal.exceptionInfo.returnItems && detailModal.exceptionInfo.returnItems.length > 0 && (
                          <>
                            <Divider style={{ margin: '4px 0' }} />
                            <p style={{ fontWeight: 600, marginBottom: 4 }}>退回入库明细：</p>
                            {detailModal.exceptionInfo.returnItems.map(ri => (
                              <p key={ri.productId} style={{ marginLeft: 12, marginBottom: 2 }}>
                                {ri.productName}：退回 {ri.quantity} 件
                              </p>
                            ))}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              </Col>
            </Row>

            <Divider />
            <div className="modal-section-title">发货明细</div>
            <Table
              size="small"
              pagination={false}
              dataSource={detailModal.items}
              rowKey="productId"
              columns={[
                { title: '物料', dataIndex: 'productName' },
                { title: 'SKU', dataIndex: 'sku', width: 120 },
                { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
                { title: '单位', dataIndex: 'unit', width: 60 },
                { title: '单价', width: 90, align: 'right', render: (_, r) => `¥${r.unitPrice}` },
                { title: '小计', width: 110, align: 'right', render: (_, r) => `¥${r.subtotal.toLocaleString()}` },
                { title: '仓库', dataIndex: 'warehouse', width: 120 },
              ]}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <div style={{ textAlign: 'right', fontWeight: 600 }}>合计金额：</div>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} colSpan={3}>
                      <span style={{ color: '#cf1322', fontWeight: 700, fontSize: 16 }}>
                        ¥{detailModal.totalAmount.toLocaleString()}
                      </span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />

            <Divider />
            <div className="modal-section-title">物流追踪</div>
            <Card size="small" style={{ background: '#fafafa' }}>
              <Timeline
                mode="left"
                items={[...detailModal.logistics].reverse().map((node, idx, arr) => {
                  const isFirst = idx === 0;
                  const isLast = idx === arr.length - 1;
                  return {
                    color: isFirst ? '#52c41a' : 'blue',
                    dot: isFirst ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : undefined,
                    children: (
                      <div className="timeline-info">
                        <div style={{ fontWeight: isFirst ? 600 : 500, fontSize: isFirst ? 15 : 13 }}>
                          {node.status}
                          {isFirst && <Tag color="green" style={{ marginLeft: 8 }}>最新</Tag>}
                        </div>
                        <div>{node.description}</div>
                        <div style={{ color: '#8c8c8c', fontSize: 12 }}>📍 {node.location}</div>
                        {node.operator && <div style={{ color: '#8c8c8c', fontSize: 12 }}>👤 {node.operator}</div>}
                        <div className="tl-time">{node.time}</div>
                      </div>
                    ),
                  };
                })}
              />
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <div>
            <EditOutlined style={{ color: '#1677ff', marginRight: 6 }} />
            {detailModal?.signoffPerson ? '修改签收信息' : '补录签收信息'}
          </div>
        }
        open={signoffModalOpen}
        onOk={handleSignoffSubmit}
        onCancel={() => { setSignoffModalOpen(false); signoffForm.resetFields(); }}
        width={500}
        okText="保存"
        cancelText="取消"
      >
        <Form form={signoffForm} layout="vertical">
          <Form.Item
            name="signoffTime"
            label="签收时间"
            rules={[{ required: true, message: '请选择签收时间' }]}
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="选择签收时间"
              format="YYYY-MM-DD HH:mm:ss"
            />
          </Form.Item>
          <Form.Item
            name="signoffPerson"
            label="签收人"
            rules={[{ required: true, message: '请填写签收人' }]}
          >
            <Input placeholder="请输入签收人姓名" prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="signoffRemark" label="签收备注">
            <Input.TextArea
              rows={3}
              placeholder="请输入签收备注（可选）"
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
            异常/退货处理 - {detailModal?.shipmentNo}
          </div>
        }
        open={exceptionModalOpen}
        onOk={handleExceptionSubmit}
        onCancel={() => { setExceptionModalOpen(false); exceptionForm.resetFields(); }}
        width={650}
        okText="提交处理"
        cancelText="取消"
      >
        <Form form={exceptionForm} layout="vertical">
          <Form.Item
            name="reason"
            label="异常原因"
            rules={[{ required: true, message: '请填写异常原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请描述异常原因" maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            name="result"
            label="处理结果"
            rules={[{ required: true, message: '请填写处理结果' }]}
          >
            <Input.TextArea rows={3} placeholder="请描述处理结果" maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            name="handler"
            label="处理人"
            rules={[{ required: true, message: '请填写处理人' }]}
          >
            <Input placeholder="请输入处理人姓名" prefix={<UserOutlined />} />
          </Form.Item>
          <Divider orientation="left" style={{ margin: '8px 0 16px' }}>退回物料（可选）</Divider>
          <Form.List name="returnItems">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={12}>
                      <Form.Item
                        {...restField}
                        name={[name, 'productId']}
                        style={{ marginBottom: 0 }}
                        rules={[{ required: true, message: '请选择物料' }, {
                          validator: (_, value) => {
                            const allItems = exceptionForm.getFieldValue('returnItems') || [];
                            const selectedIds = allItems
                              .filter((it: any, idx: number) => idx !== name && it?.productId)
                              .map((it: any) => it.productId);
                            if (selectedIds.includes(value)) {
                              return Promise.reject(new Error('该物料已添加，如需调整数量请修改已有行'));
                            }
                            return Promise.resolve();
                          }
                        }]}
                      >
                        <Select
                          placeholder="选择退回物料"
                          options={detailModal?.items.map(item => ({
                            value: item.productId,
                            label: `${item.productName}（发货 ${item.quantity}）`,
                          })) || []}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'quantity']}
                        style={{ marginBottom: 0 }}
                        dependencies={[['returnItems', name, 'productId']]}
                        rules={[
                          { required: true, message: '请填写数量' },
                          {
                            validator: (_, value) => {
                              if (!value || value <= 0) return Promise.reject(new Error('数量必须大于0'));
                              const productId = exceptionForm.getFieldValue(['returnItems', name, 'productId']);
                              const shipItem = detailModal?.items.find(i => i.productId === productId);
                              if (!shipItem) return Promise.resolve();
                              if (value > shipItem.quantity) {
                                return Promise.reject(new Error(`不能超过发货数量${shipItem.quantity}`));
                              }
                              return Promise.resolve();
                            }
                          }
                        ]}
                      >
                        <InputNumber
                          min={1}
                          style={{ width: '100%' }}
                          placeholder="退回数量"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <MinusCircleOutlined
                        style={{ color: '#ff4d4f', fontSize: 18, cursor: 'pointer' }}
                        onClick={() => remove(name)}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  onClick={() => {
                    const allItems = exceptionForm.getFieldValue('returnItems') || [];
                    const currentSelected = allItems
                      .filter((it: any) => it?.productId)
                      .map((it: any) => it.productId);
                    const available = detailModal?.items.filter(i => !currentSelected.includes(i.productId)) || [];
                    if (available.length === 0) {
                      message.warning('所有可退物料已添加');
                      return;
                    }
                    add();
                  }}
                  block
                  icon={<PlusOutlined />}
                >
                  添加退回物料
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
