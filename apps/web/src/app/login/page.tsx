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
} from "antd";
import {
  KeyOutlined,
  SafetyOutlined,
  ShoppingCartOutlined,
  CheckCircleFilled,
  GoogleOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveCredentialsCloud, type Credentials } from "@/lib/credentials";

const { Title, Paragraph, Text, Link } = Typography;

interface CredentialForm extends Credentials {
  label: string;
}

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
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(
    searchParams.get("error") === "auth"
      ? "การเข้าสู่ระบบล้มเหลว กรุณาลองใหม่"
      : null,
  );

  // Shopee credentials state (step 2)
  const [showShopeeStep, setShowShopeeStep] = useState(false);
  const [form] = Form.useForm<CredentialForm>();
  const [testing, setTesting] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [credSuccess, setCredSuccess] = useState(false);
  const isAddingAccount =
    searchParams.get("add") === "1" || searchParams.get("setup") === "1";

  // Check if user is already authenticated → show Shopee step or redirect
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (isAddingAccount) {
          // User wants to add another account — go straight to Shopee step
          setShowShopeeStep(true);
          return;
        }
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
  }, [supabase, router, isAddingAccount]);

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

  // ─── Shopee Credentials handler (step 2) ────────────────────────

  async function handleShopeeSubmit(values: CredentialForm) {
    setTesting(true);
    setCredError(null);
    setCredSuccess(false);

    const result = await saveCredentialsCloud(
      { appId: values.appId, secret: values.secret },
      values.label || "default",
    );

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
                ? isAddingAccount
                  ? "เพิ่ม Shopee Account ใหม่"
                  : "เชื่อมต่อ Shopee Affiliate API"
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
              initialValues={{ label: "" }}
            >
              <Form.Item
                label={<Text strong>ชื่อ Account</Text>}
                name="label"
                rules={[
                  {
                    required: true,
                    message: "กรุณาตั้งชื่อ เช่น หลัก, ร้าน A",
                  },
                ]}
              >
                <Input
                  prefix={<TagOutlined style={{ color: "#bbb" }} />}
                  placeholder="เช่น หลัก, ร้าน A, ร้านสอง"
                  size="large"
                  autoComplete="off"
                />
              </Form.Item>

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

            {/* Google OAuth button */}
            <Button
              size="large"
              block
              icon={<GoogleOutlined />}
              onClick={handleGoogleLogin}
              loading={authLoading}
              style={{
                height: 48,
                fontWeight: 500,
              }}
            >
              เข้าสู่ระบบด้วย Google
            </Button>
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
