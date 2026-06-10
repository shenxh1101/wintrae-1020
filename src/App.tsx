import { useState } from 'react';
import { Layout, Menu, Avatar, Badge, Dropdown } from 'antd';
import {
  ShoppingCartOutlined, FileSearchOutlined, InboxOutlined,
  StockOutlined, TruckOutlined, CalculatorOutlined,
  BellOutlined, UserOutlined, WarningOutlined, UserSwitchOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { WindowKey } from './types';
import { useAppStore } from './store/appStore';
import PurchaseWindow from './components/PurchaseWindow';
import QuoteWindow from './components/QuoteWindow';
import ReceiptWindow from './components/ReceiptWindow';
import StockWindow from './components/StockWindow';
import ShippingWindow from './components/ShippingWindow';
import ReconciliationWindow from './components/ReconciliationWindow';
import SalesOrderWindow from './components/SalesOrderWindow';

const { Sider, Header, Content } = Layout;

const menuItems: MenuProps['items'] = [
  { key: 'sales', icon: <UserSwitchOutlined />, label: '销售订单' },
  { key: 'purchase', icon: <ShoppingCartOutlined />, label: '采购计划' },
  { key: 'quote', icon: <FileSearchOutlined />, label: '供应商报价' },
  { key: 'receipt', icon: <InboxOutlined />, label: '入库验收' },
  { key: 'stock', icon: <StockOutlined />, label: '库存台账' },
  { key: 'shipping', icon: <TruckOutlined />, label: '发货跟踪' },
  { key: 'reconciliation', icon: <CalculatorOutlined />, label: '对账中心' },
];

const windowTitles: Record<WindowKey, { title: string; subtitle: string }> = {
  sales: { title: '销售订单', subtitle: '客户订单管理、订单跟踪、发货状态查询' },
  purchase: { title: '采购计划', subtitle: '创建采购需求、确认交期、跟踪订单进度' },
  quote: { title: '供应商报价', subtitle: '收集多家报价、横向比价、选择最优供应商' },
  receipt: { title: '入库验收', subtitle: '登记到货数量、记录质检结果、自动更新库存' },
  stock: { title: '库存台账', subtitle: '实时库存查询、缺货预警、销售订单库存分配' },
  shipping: { title: '发货跟踪', subtitle: '生成发货单、物流节点追踪、库存自动扣减' },
  reconciliation: { title: '对账中心', subtitle: '供应商应付款汇总、月度报表分析' },
};

export default function App() {
  const [activeKey, setActiveKey] = useState<WindowKey>('purchase');
  const stockRisks = useAppStore(s => s.stockRisks);
  const criticalCount = stockRisks.filter(r => r.riskLevel === 'critical').length;

  const renderWindow = () => {
    switch (activeKey) {
      case 'sales': return <SalesOrderWindow />;
      case 'purchase': return <PurchaseWindow />;
      case 'quote': return <QuoteWindow />;
      case 'receipt': return <ReceiptWindow />;
      case 'stock': return <StockWindow />;
      case 'shipping': return <ShippingWindow />;
      case 'reconciliation': return <ReconciliationWindow />;
    }
  };

  const userMenu: MenuProps['items'] = [
    { key: 'profile', label: '个人资料' },
    { key: 'settings', label: '系统设置' },
    { type: 'divider' },
    { key: 'logout', label: '退出登录' },
  ];

  const notifyMenu: MenuProps['items'] = [
    {
      key: 'header',
      label: <div style={{ fontWeight: 600, color: '#1677ff' }}>缺货预警通知</div>,
      disabled: true,
    },
    ...stockRisks.slice(0, 5).map(r => ({
      key: r.productId,
      label: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>{r.productName}</span>
            <span className={`risk-badge ${r.riskLevel === 'critical' ? 'risk-critical' : 'risk-warning'}`}>
              {r.riskLevel === 'critical' ? '紧急' : '预警'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
            可用库存: {r.availableQty} | 安全库存: {r.safetyStock}
          </div>
        </div>
      )
    })),
    { type: 'divider' },
    {
      key: 'more',
      label: <a onClick={() => setActiveKey('stock')}>查看全部库存预警 →</a>,
    },
  ];

  return (
    <Layout className="app-layout">
      <Sider className="app-sider" width={240} theme="dark">
        <div className="logo">
          <StockOutlined style={{ fontSize: 22 }} />
          <span>供应链管理系统</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={({ key }) => setActiveKey(key as WindowKey)}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout className="app-layout-right">
        <Header className="app-header">
          <div>
            <div className="header-title">{windowTitles[activeKey].title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dropdown menu={{ items: notifyMenu }} placement="bottomRight" trigger={['click']}>
              <Badge count={criticalCount} size="small" offset={[-2, 2]}>
                <BellOutlined style={{ fontSize: 20, color: '#595959', cursor: 'pointer', padding: 8 }} />
              </Badge>
            </Dropdown>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
              <div className="header-user">
                <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
                <span style={{ fontSize: 14 }}>管理员</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="app-content">
          {renderWindow()}
        </Content>
      </Layout>
    </Layout>
  );
}
