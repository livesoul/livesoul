"use client";

import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Alert,
  Space,
  Divider,
  Steps,
  Tabs,
} from "antd";
import {
  KeyOutlined,
  SafetyOutlined,
  ShoppingCartOutlined,
  CheckCircleFilled,
  GoogleOutlined,
  MailOutlined,
  LockOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveCredentialsCloud, type Credentials } from "@/lib/credentials";

const { Title, Paragraph, Text, Link } = Typography;

type AuthTab = "login" | "signup";

/** Wrapper with Suspense boundary (required for useSearchParams in Next.js 15) */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Auth state
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(
    searchParams.get("error") === "auth"
      ? "การเข้าสู่ระบบล้มเหลว กรุณาลองใหม่"
      : null,
  );
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Shopee credentials state (step 2)
  const [showShopeeStep, setShowShopeeStep] = useState(false);
  const [form] = Form.useForm<Credentials>();
  const [testing, setTesting] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [credSuccess, setCredSuccess] = useState(false);

  // Check if user is already authenticated → show Shopee step or redirect
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const res = await fetch("/api/credentials");
          const json = await res.json();
          if (json.credentials && json.credentials.length > 0) {
            router.replace("/");
          } else {
            setShowShopeeStep(true);
          }
        } catch {
          setShowShopeeStep(true);
        }
      }
    })();
  }, [supabase, router]);

  // ─── Auth handlers ───────────────────────────────────────────────

  async function handleGoogleLogin() {
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  }

  async function handleEmailLogin(values: { email: string; password: string }) {
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setAuthError(
        error.message.includes("Invalid login")
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : error.message,
      );
      setAuthLoading(false);
    } else {
      // Check if user has Shopee credentials
      const res = await fetch("/api/credentials");
      const json = await res.json();
      if (json.credentials && json.credentials.length > 0) {
        router.replace("/");
      } else {
        setShowShopeeStep(true);
        setAuthLoading(false);
      }
    }
  }

  async function handleEmailSignup(values: {
    email: string;
    password: string;
  }) {
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(error.message);
    } else {
      setMagicLinkSent(true);
    }
    setAuthLoading(false);
  }

  async function handleMagicLink(values: { email: string }) {
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(error.message);
    } else {
      setMagicLinkSent(true);
    }
    setAuthLoading(false);
  }

  // ─── Shopee Credentials handler (step 2) ────────────────────────

  async function handleShopeeSubmit(values: Credentials) {
    setTesting(true);
    setCredError(null);
    setCredSuccess(false);

    const result = await saveCredentialsCloud(values);

    if (result.ok) {
      setCredSuccess(true);
      setTimeout(() => router.replace("/"), 800);
    } else {
      setCredError(result.error ?? "ไม่สามารถบันทึก credentials ได้");
    }
    setTesting(false);
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #fff1f0 0%, #fff7e6 100%)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "16px",
        paddingTop: "max(24px, env(safe-area-inset-top, 24px))",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Space direction="vertical" size={6}>
            <ShoppingCartOutlined style={{ fontSize: 40, color: "#ee4d2d" }} />
            <Title level={3} style={{ margin: 0, color: "#ee4d2d" }}>
              LiveSoul Affiliate
            </Title>
            <Text type="secondary">
              {showShopeeStep
                ? "เชื่อมต่อ Shopee Affiliate API"
                : "เข้าสู่ระบบเพื่อใช้งาน"}
            </Text>
          </Space>
        </div>

        {/* ─── Step 2: Shopee Credentials ─── */}
        {showShopeeStep ? (
          <Card
            bordered={false}
            style={{
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
              borderRadius: 12,
            }}
          >
            <Title level={4} style={{ marginBottom: 4 }}>
              <KeyOutlined style={{ marginRight: 8, color: "#ee4d2d" }} />
              ใส่ API Credentials
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              Credentials จะถูกเก็บบน cloud อย่างปลอดภัย สามารถเข้าใช้ได้ทุก
              เครื่อง
            </Paragraph>

            {credError && (
              <Alert
                message={credError}
                type="error"
                showIcon
                closable
                onClose={() => setCredError(null)}
                style={{ marginBottom: 20 }}
              />
            )}
            {credSuccess && (
              <Alert
                message={
                  <Space>
                    <CheckCircleFilled style={{ color: "#52c41a" }} />
                    ยืนยัน credentials สำเร็จ! กำลังเข้าสู่ระบบ…
                  </Space>
                }
                type="success"
                style={{ marginBottom: 20 }}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleShopeeSubmit}
              requiredMark={false}
            >
              <Form.Item
                label={<Text strong>App ID</Text>}
                name="appId"
                rules={[{ required: true, message: "กรุณาใส่ App ID" }]}
              >
                <Input
                  prefix={<SafetyOutlined style={{ color: "#bbb" }} />}
                  placeholder="เช่น 12345678901"
                  size="large"
                  autoComplete="off"
                />
              </Form.Item>

              <Form.Item
                label={<Text strong>Secret</Text>}
                name="secret"
                rules={[{ required: true, message: "กรุณาใส่ Secret" }]}
                style={{ marginBottom: 28 }}
              >
                <Input.Password
                  prefix={<KeyOutlined style={{ color: "#bbb" }} />}
                  placeholder="32-character secret key"
                  size="large"
                  autoComplete="off"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={testing}
                  disabled={credSuccess}
                  style={{
                    background: "#ee4d2d",
                    borderColor: "#ee4d2d",
                    height: 48,
                  }}
                >
                  {testing ? "กำลังทดสอบ…" : "ทดสอบและบันทึก"}
                </Button>
              </Form.Item>
            </Form>

            <Divider style={{ margin: "16px 0" }} />

            <Steps
              direction="vertical"
              size="small"
              style={{ marginTop: 4 }}
              items={[
                {
                  title: (
                    <Text style={{ fontSize: 13 }}>
                      ไปที่{" "}
                      <Link
                        href="https://affiliate.shopee.co.th/open-api"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Shopee Affiliate → Open API
                      </Link>
                    </Text>
                  ),
                  status: "process",
                },
                {
                  title: (
                    <Text style={{ fontSize: 13 }}>
                      คัดลอก <Text code>App ID</Text> และ{" "}
                      <Text code>Secret</Text>
                    </Text>
                  ),
                  status: "process",
                },
                {
                  title: (
                    <Text style={{ fontSize: 13 }}>
                      วางด้านบน แล้วกด ทดสอบและบันทึก
                    </Text>
                  ),
                  status: "process",
                },
              ]}
            />
          </Card>
        ) : (
          /* ─── Step 1: Auth ─── */
          <Card
            bordered={false}
            style={{
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
              borderRadius: 12,
            }}
          >
            {authError && (
              <Alert
                message={authError}
                type="error"
                showIcon
                closable
                onClose={() => setAuthError(null)}
                style={{ marginBottom: 20 }}
              />
            )}

            {magicLinkSent ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <MailOutlined
                  style={{ fontSize: 48, color: "#ee4d2d", marginBottom: 16 }}
                />
                <Title level={4}>เช็คอีเมลของคุณ</Title>
                <Paragraph type="secondary">
                  เราได้ส่งลิงก์เข้าสู่ระบบไปยังอีเมลของคุณแล้ว
                  <br />
                  คลิกลิงก์ในอีเมลเพื่อเข้าสู่ระบบ
                </Paragraph>
                <Button type="link" onClick={() => setMagicLinkSent(false)}>
                  ส่งอีกครั้ง
                </Button>
              </div>
            ) : (
              <>
                {/* Google OAuth button */}
                <Button
                  size="large"
                  block
                  icon={<GoogleOutlined />}
                  onClick={handleGoogleLogin}
                  loading={authLoading}
                  style={{
                    height: 48,
                    marginBottom: 16,
                    fontWeight: 500,
                  }}
                >
                  เข้าสู่ระบบด้วย Google
                </Button>

                <Divider plain>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    หรือใช้อีเมล
                  </Text>
                </Divider>

                <Tabs
                  activeKey={authTab}
                  onChange={(key) => setAuthTab(key as AuthTab)}
                  centered
                  items={[
                    {
                      key: "login",
                      label: (
                        <Space size={4}>
                          <LockOutlined />
                          เข้าสู่ระบบ
                        </Space>
                      ),
                      children: (
                        <Form
                          layout="vertical"
                          onFinish={handleEmailLogin}
                          requiredMark={false}
                        >
                          <Form.Item
                            name="email"
                            rules={[
                              { required: true, message: "กรุณาใส่อีเมล" },
                              { type: "email", message: "อีเมลไม่ถูกต้อง" },
                            ]}
                          >
                            <Input
                              prefix={
                                <MailOutlined style={{ color: "#bbb" }} />
                              }
                              placeholder="อีเมล"
                              size="large"
                              autoComplete="email"
                            />
                          </Form.Item>
                          <Form.Item
                            name="password"
                            rules={[
                              {
                                required: true,
                                message: "กรุณาใส่รหัสผ่าน",
                              },
                            ]}
                          >
                            <Input.Password
                              prefix={
                                <LockOutlined style={{ color: "#bbb" }} />
                              }
                              placeholder="รหัสผ่าน"
                              size="large"
                              autoComplete="current-password"
                            />
                          </Form.Item>
                          <Form.Item style={{ marginBottom: 8 }}>
                            <Button
                              type="primary"
                              htmlType="submit"
                              size="large"
                              block
                              loading={authLoading}
                              style={{
                                background: "#ee4d2d",
                                borderColor: "#ee4d2d",
                                height: 48,
                              }}
                            >
                              เข้าสู่ระบบ
                            </Button>
                          </Form.Item>
                        </Form>
                      ),
                    },
                    {
                      key: "signup",
                      label: (
                        <Space size={4}>
                          <UserAddOutlined />
                          สมัครสมาชิก
                        </Space>
                      ),
                      children: (
                        <Form
                          layout="vertical"
                          onFinish={handleEmailSignup}
                          requiredMark={false}
                        >
                          <Form.Item
                            name="email"
                            rules={[
                              { required: true, message: "กรุณาใส่อีเมล" },
                              { type: "email", message: "อีเมลไม่ถูกต้อง" },
                            ]}
                          >
                            <Input
                              prefix={
                                <MailOutlined style={{ color: "#bbb" }} />
                              }
                              placeholder="อีเมล"
                              size="large"
                              autoComplete="email"
                            />
                          </Form.Item>
                          <Form.Item
                            name="password"
                            rules={[
                              {
                                required: true,
                                message: "กรุณาใส่รหัสผ่าน",
                              },
                              {
                                min: 6,
                                message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
                              },
                            ]}
                          >
                            <Input.Password
                              prefix={
                                <LockOutlined style={{ color: "#bbb" }} />
                              }
                              placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
                              size="large"
                              autoComplete="new-password"
                            />
                          </Form.Item>
                          <Form.Item style={{ marginBottom: 8 }}>
                            <Button
                              type="primary"
                              htmlType="submit"
                              size="large"
                              block
                              loading={authLoading}
                              style={{
                                background: "#ee4d2d",
                                borderColor: "#ee4d2d",
                                height: 48,
                              }}
                            >
                              สมัครสมาชิก
                            </Button>
                          </Form.Item>
                        </Form>
                      ),
                    },
                  ]}
                />

                <Divider plain>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    หรือ
                  </Text>
                </Divider>

                {/* Magic Link */}
                <Form
                  layout="inline"
                  onFinish={handleMagicLink}
                  style={{ display: "flex", gap: 8 }}
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: "" },
                      { type: "email", message: "" },
                    ]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Input
                      prefix={<MailOutlined style={{ color: "#bbb" }} />}
                      placeholder="อีเมลสำหรับ Magic Link"
                      autoComplete="email"
                    />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button htmlType="submit" loading={authLoading}>
                      ส่ง Magic Link
                    </Button>
                  </Form.Item>
                </Form>
              </>
            )}
          </Card>
        )}

        <Paragraph
          type="secondary"
          style={{ textAlign: "center", marginTop: 16, fontSize: 12 }}
        >
          🔒 ข้อมูลถูกเก็บอย่างปลอดภัยบน cloud พร้อม Row Level Security
        </Paragraph>
      </div>
    </div>
  );
}
