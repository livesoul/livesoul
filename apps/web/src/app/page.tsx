"use client";

import {
  Layout,
  Grid,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tag,
  Space,
  Table,
  Alert,
  DatePicker,
  Button,
  Image,
  Drawer,
  Menu,
  Select,
  Popconfirm,
  List,
  message,
} from "antd";
import {
  ShopOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  ShoppingCartOutlined,
  ReloadOutlined,
  SyncOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LogoutOutlined,
  MenuOutlined,
  PlusOutlined,
  SettingOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ColumnsType } from "antd/es/table";
// ⚠️ Always import from @/lib/tz — never use bare dayjs — see tz.ts for why
import { bkk, dayjs } from "@/lib/tz";
import {
  loadCredentialsCloud,
  deleteCredentialCloud,
  clearCredentials,
  type StoredCredential,
} from "@/lib/credentials";
import { createClient } from "@/lib/supabase/client";
import type {
  ConversionNode,
  ConversionOrder,
  ConversionItem,
} from "@/lib/shopee-browser";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

const menuItems = [
  {
    key: "dashboard",
    icon: <AppstoreOutlined />,
    label: "Dashboard",
  },
  {
    key: "reports",
    icon: <BarChartOutlined />,
    label: "Reports",
    children: [{ key: "conversion", label: "Conversion Report" }],
  },
];

interface Summary {
  totalConversions: number;
  totalOrders: number;
  totalItems: number;
  totalCommission: string;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

interface ApiResponse {
  summary: Summary;
  conversions: ConversionNode[];
  error?: string;
}

interface FlatRow {
  key: string;
  conversionId: number;
  purchaseTime: number;
  buyerType: string;
  device: string;
  orderId: string;
  orderStatus: string;
  itemName: string;
  itemPrice: string;
  qty: number;
  shopName: string;
  imageUrl: string;
  itemTotalCommission: string;
}

function flattenConversions(conversions: ConversionNode[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const conv of conversions) {
    for (const order of conv.orders ?? []) {
      for (const item of order.items ?? []) {
        rows.push({
          key: `${conv.conversionId}-${order.orderId}-${item.itemId}-${rows.length}`,
          conversionId: conv.conversionId,
          purchaseTime: conv.purchaseTime,
          buyerType: conv.buyerType,
          device: conv.device,
          orderId: order.orderId,
          orderStatus: order.orderStatus,
          itemName: item.itemName,
          itemPrice: item.itemPrice,
          qty: item.qty,
          shopName: item.shopName,
          imageUrl: item.imageUrl,
          itemTotalCommission: item.itemTotalCommission,
        });
      }
    }
  }
  return rows;
}

const statusColor: Record<string, string> = {
  PENDING: "orange",
  COMPLETED: "green",
  CANCELLED: "red",
  UNPAID: "default",
};

const columns: ColumnsType<FlatRow> = [
  {
    title: "เวลาซื้อ",
    dataIndex: "purchaseTime",
    width: 160,
    sorter: (a, b) => a.purchaseTime - b.purchaseTime,
    defaultSortOrder: "descend",
    // tz: bkk() ensures display is always in Asia/Bangkok (UTC+7)
    render: (ts: number) => bkk(ts * 1000).format("DD MMM YYYY HH:mm"),
  },
  {
    title: "สินค้า",
    dataIndex: "itemName",
    ellipsis: true,
    width: 280,
    render: (name: string, row: FlatRow) => (
      <Space>
        {row.imageUrl && (
          <Image
            src={row.imageUrl}
            alt={name}
            width={40}
            height={40}
            style={{ borderRadius: 4, objectFit: "cover" }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPk3ELjXwAAAABJRU5ErkJggg=="
          />
        )}
        <Text ellipsis style={{ maxWidth: 220 }}>
          {name}
        </Text>
      </Space>
    ),
  },
  {
    title: "ร้านค้า",
    dataIndex: "shopName",
    width: 140,
    ellipsis: true,
    responsive: ["sm"],
  },
  {
    title: "ราคา",
    dataIndex: "itemPrice",
    width: 90,
    align: "right",
    render: (v: string) => `฿${parseFloat(v).toLocaleString()}`,
  },
  {
    title: "จำนวน",
    dataIndex: "qty",
    width: 70,
    align: "center",
  },
  {
    title: "Order ID",
    dataIndex: "orderId",
    width: 160,
    responsive: ["md"],
    render: (v: string) => (
      <Text copyable={{ text: v }} style={{ fontSize: 12 }}>
        {v}
      </Text>
    ),
  },
  {
    title: "สถานะ",
    dataIndex: "orderStatus",
    width: 100,
    filters: [
      { text: "PENDING", value: "PENDING" },
      { text: "COMPLETED", value: "COMPLETED" },
      { text: "CANCELLED", value: "CANCELLED" },
      { text: "UNPAID", value: "UNPAID" },
    ],
    onFilter: (value, record) => record.orderStatus === value,
    render: (status: string) => (
      <Tag color={statusColor[status] ?? "default"}>{status}</Tag>
    ),
  },
  {
    title: "Commission",
    dataIndex: "itemTotalCommission",
    width: 110,
    align: "right",
    sorter: (a, b) =>
      parseFloat(a.itemTotalCommission) - parseFloat(b.itemTotalCommission),
    render: (v: string) => (
      <Text strong style={{ color: "#52c41a" }}>
        ฿{parseFloat(v).toFixed(2)}
      </Text>
    ),
  },
  {
    title: "Buyer",
    dataIndex: "buyerType",
    width: 90,
    responsive: ["md"],
    filters: [
      { text: "NEW", value: "NEW" },
      { text: "EXISTING", value: "EXISTING" },
    ],
    onFilter: (value, record) => record.buyerType === value,
    render: (v: string) => (
      <Tag color={v === "NEW" ? "blue" : "default"}>{v}</Tag>
    ),
  },
  {
    title: "Device",
    dataIndex: "device",
    width: 80,
    responsive: ["md"],
    filters: [
      { text: "APP", value: "APP" },
      { text: "WEB", value: "WEB" },
    ],
    onFilter: (value, record) => record.device === value,
  },
];

export default function HomePage() {
  const router = useRouter();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [activeCredId, setActiveCredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Initial range: yesterday only — fast load (use presets for wider ranges)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    bkk().subtract(1, "day").startOf("day"),
    bkk().subtract(1, "day").endOf("day"),
  ]);

  const supabase = createClient();

  // Auth guard — redirect to /login if not authenticated
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      // Load credentials from cloud
      const creds = await loadCredentialsCloud();
      if (creds.length === 0) {
        // No credentials yet → send to login step 2
        router.replace("/login");
        return;
      }
      setCredentials(creds);
      setActiveCredId(creds[0].id);
      setAuthReady(true);
    })();
  }, [router, supabase]);

  async function handleLogout() {
    clearCredentials();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleDeleteCredential(id: string) {
    const result = await deleteCredentialCloud(id);
    if (result.ok) {
      const updated = credentials.filter((c) => c.id !== id);
      setCredentials(updated);
      if (updated.length === 0) {
        router.replace("/login");
        return;
      }
      if (activeCredId === id) {
        setActiveCredId(updated[0].id);
      }
      message.success("ลบ credential สำเร็จ");
    } else {
      message.error(result.error ?? "ลบไม่สำเร็จ");
    }
  }

  async function handleManualSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: activeCredId }),
      });
      const json = await res.json();
      if (json.error) {
        message.error(json.error);
      } else {
        const parts: string[] = [];
        if (json.d1?.newRecords > 0) parts.push(`${json.d1.newRecords} new`);
        if (json.d1?.updatedRecords > 0)
          parts.push(`${json.d1.updatedRecords} updated`);
        if (json.d1?.statusChanges > 0)
          parts.push(`${json.d1.statusChanges} status changes`);
        if (json.historical?.statusChanges > 0)
          parts.push(`${json.historical.statusChanges} historical changes`);
        const summary = parts.length > 0 ? parts.join(", ") : "No changes";
        message.success(`Sync completed (${json.elapsed}): ${summary}`);
        // Refresh data after sync
        fetchData();
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const fetchData = useCallback(async () => {
    if (!authReady || !activeCredId) return;
    setLoading(true);
    setError(null);
    try {
      const start = bkk(dateRange[0]).startOf("day").unix();
      const end = bkk(dateRange[1]).endOf("day").unix();

      const url = `/api/conversions?purchaseTimeStart=${start}&purchaseTimeEnd=${end}&limit=500&credentialId=${activeCredId}`;
      const res = await fetch(url);
      const json: ApiResponse = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [dateRange, activeCredId, authReady]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Don't render until auth is confirmed
  if (!authReady) return null;

  // Predefined presets — all ends capped at yesterday (today has no data yet)
  const yesterday = bkk().subtract(1, "day");
  const capYesterday = (d: dayjs.Dayjs) =>
    d.isAfter(yesterday, "day") ? yesterday.endOf("day") : d.endOf("day");
  const rangePresets: { label: string; value: [dayjs.Dayjs, dayjs.Dayjs] }[] = [
    {
      label: "เมื่อวาน",
      value: [yesterday.startOf("day"), yesterday.endOf("day")],
    },
    {
      label: "ครึ่งเดือนแรก",
      value: [bkk().startOf("month"), capYesterday(bkk().date(15))],
    },
    {
      label: "ครึ่งเดือนหลัง",
      value: [
        bkk().date(16).startOf("day"),
        capYesterday(bkk().endOf("month")),
      ],
    },
    {
      label: "เดือนนี้",
      value: [bkk().startOf("month"), yesterday.endOf("day")],
    },
    {
      label: "เดือนที่แล้ว",
      value: [
        bkk().subtract(1, "month").startOf("month"),
        bkk().subtract(1, "month").endOf("month"),
      ],
    },
  ];

  const summary = data?.summary;
  const rows = data ? flattenConversions(data.conversions) : [];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Mobile nav drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={240}
        styles={{ body: { padding: 0 } }}
        title={
          <Space>
            <ShoppingCartOutlined style={{ color: "#ee4d2d" }} />
            <Text strong>LiveSoul</Text>
          </Space>
        }
      >
        <Menu
          mode="inline"
          defaultSelectedKeys={["conversion"]}
          defaultOpenKeys={["reports"]}
          items={menuItems}
          style={{ borderRight: 0, height: "100%" }}
          onClick={() => setDrawerOpen(false)}
        />
      </Drawer>

      {/* Settings drawer — credential management */}
      <Drawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        placement="right"
        width={360}
        title={
          <Space>
            <SettingOutlined />
            <Text strong>จัดการ Accounts</Text>
          </Space>
        }
      >
        <List
          dataSource={credentials}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title="ลบ credential นี้?"
                  description={`${item.label} (${item.app_id.slice(0, 6)}…)`}
                  onConfirm={() => handleDeleteCredential(item.id)}
                  okText="ลบ"
                  cancelText="ยกเลิก"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={item.label}
                description={`App ID: ${item.app_id.slice(0, 8)}… · ${bkk(item.created_at).format("DD MMM YYYY")}`}
              />
              {item.id === activeCredId && (
                <Tag color="green">ใช้งานอยู่</Tag>
              )}
            </List.Item>
          )}
        />
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={() => {
            setSettingsOpen(false);
            router.push("/login?add=1");
          }}
          style={{ marginTop: 16 }}
        >
          เพิ่ม Account ใหม่
        </Button>
      </Drawer>

      <Layout>
        {/* Responsive header */}
        <Header
          style={{
            background: "#fff",
            padding: isMobile ? "8px 12px" : "0 24px",
            height: "auto",
            lineHeight: "normal",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          {isMobile ? (
            /* Mobile: two rows */
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Row 1: hamburger + title + icon buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Button
                  icon={<MenuOutlined />}
                  type="text"
                  size="small"
                  onClick={() => setDrawerOpen(true)}
                />
                <Title level={5} style={{ margin: 0, flex: 1 }}>
                  Conversion Report
                </Title>
                <Button
                  icon={<SyncOutlined spin={syncing} />}
                  type="text"
                  size="small"
                  onClick={handleManualSync}
                  loading={syncing}
                  title="Sync to DB"
                />
                <Button
                  icon={<ReloadOutlined />}
                  type="text"
                  size="small"
                  onClick={fetchData}
                  loading={loading}
                />
                <Button
                  icon={<SettingOutlined />}
                  type="text"
                  size="small"
                  onClick={() => setSettingsOpen(true)}
                  title="จัดการ Accounts"
                />
                <Button
                  icon={<LogoutOutlined />}
                  type="text"
                  size="small"
                  danger
                  onClick={handleLogout}
                />
              </div>
              {/* Row 2: credential selector */}
              {credentials.length > 0 && (
                <Select
                  value={activeCredId}
                  onChange={(val) => {
                    if (val === "__add__") {
                      router.push("/login?add=1");
                    } else {
                      setActiveCredId(val);
                    }
                  }}
                  style={{ width: "100%" }}
                  size="small"
                  options={[
                    ...credentials.map((c) => ({
                      value: c.id,
                      label: `${c.label} (${c.app_id.slice(0, 6)}…)`,
                    })),
                    {
                      value: "__add__",
                      label: (
                        <span>
                          <PlusOutlined /> เพิ่ม Account
                        </span>
                      ),
                    },
                  ]}
                />
              )}
              {/* Row 3: full-width date picker */}
              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0], dates[1]]);
                  }
                }}
                allowClear={false}
                disabledDate={(current) => current >= bkk().startOf("day")}
                presets={rangePresets}
                style={{ width: "100%" }}
                size="small"
              />
            </div>
          ) : (
            /* Desktop: single row */
            <div
              style={{
                height: 64,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Title level={4} style={{ margin: 0 }}>
                Conversion Report
              </Title>
              <Space>
                {credentials.length > 0 && (
                  <Select
                    value={activeCredId}
                    onChange={(val) => {
                      if (val === "__add__") {
                        router.push("/login?add=1");
                      } else {
                        setActiveCredId(val);
                      }
                    }}
                    style={{ minWidth: 180 }}
                    options={[
                      ...credentials.map((c) => ({
                        value: c.id,
                        label: `${c.label} (${c.app_id.slice(0, 6)}…)`,
                      })),
                      {
                        value: "__add__",
                        label: (
                          <span>
                            <PlusOutlined /> เพิ่ม Account
                          </span>
                        ),
                      },
                    ]}
                  />
                )}
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setDateRange([dates[0], dates[1]]);
                    }
                  }}
                  allowClear={false}
                  disabledDate={(current) => current >= bkk().startOf("day")}
                  presets={rangePresets}
                />
                <Button
                  icon={<SyncOutlined />}
                  onClick={handleManualSync}
                  loading={syncing}
                >
                  Sync DB
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchData}
                  loading={loading}
                >
                  Refresh
                </Button>
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setSettingsOpen(true)}
                >
                  Accounts
                </Button>
                <Button icon={<LogoutOutlined />} onClick={handleLogout} danger>
                  ออกจากระบบ
                </Button>
              </Space>
            </div>
          )}
        </Header>

        <Content style={{ padding: isMobile ? 12 : 24, background: "#f5f5f5" }}>
          {error && (
            <Alert
              message="API Error"
              description={error}
              type="error"
              showIcon
              closable
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Summary Stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={12} lg={4}>
              <Card>
                <Statistic
                  title="Total Commission"
                  value={summary?.totalCommission ?? "0"}
                  prefix={<DollarOutlined />}
                  suffix="฿"
                  valueStyle={{ color: "#52c41a", fontSize: 24 }}
                  loading={loading}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} lg={4}>
              <Card>
                <Statistic
                  title="Conversions"
                  value={summary?.totalConversions ?? 0}
                  prefix={<ShopOutlined />}
                  valueStyle={{ color: "#ee4d2d" }}
                  loading={loading}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} lg={4}>
              <Card>
                <Statistic
                  title="Orders"
                  value={summary?.totalOrders ?? 0}
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: "#1890ff" }}
                  loading={loading}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} lg={4}>
              <Card>
                <Statistic
                  title="Pending"
                  value={summary?.pendingOrders ?? 0}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: "#faad14" }}
                  loading={loading}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} lg={4}>
              <Card>
                <Statistic
                  title="Completed"
                  value={summary?.completedOrders ?? 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: "#52c41a" }}
                  loading={loading}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} lg={4}>
              <Card>
                <Statistic
                  title="Cancelled"
                  value={summary?.cancelledOrders ?? 0}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: "#ff4d4f" }}
                  loading={loading}
                />
              </Card>
            </Col>
          </Row>

          {/* Data Table */}
          <Card title={`รายการ Conversion (${rows.length} items)`}>
            <Table
              columns={columns}
              dataSource={rows}
              loading={loading}
              size="small"
              scroll={{ x: 1200 }}
              pagination={{
                defaultPageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                showTotal: (total) => `ทั้งหมด ${total} รายการ`,
              }}
              summary={() => {
                if (rows.length === 0) return null;
                const totalItemCommission = rows.reduce(
                  (sum, row) =>
                    sum + parseFloat(row.itemTotalCommission || "0"),
                  0,
                );
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={7} align="right">
                        <Text strong>รวม Commission:</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right">
                        <Text strong style={{ color: "#52c41a", fontSize: 16 }}>
                          ฿{totalItemCommission.toFixed(2)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={8} colSpan={2} />
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
}
