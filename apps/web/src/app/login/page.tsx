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
} from "@ant-design/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveCredentials,
  credentialHeaders,
  HEADER_APP_ID,
  HEADER_SECRET,
  type Credentials,
} from "@/lib/credentials";

const { Title, Paragraph, Text, Link } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [form] = Form.useForm<Credentials>();
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(values: Credentials) {
    setTesting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: credentialHeaders(values),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };

      if (json.ok) {
        setSuccess(true);
        saveCredentials(values);
        setTimeout(() => router.push("/"), 800);
      } else {
        setError(json.error ?? "Authentication failed");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับ server ได้");
    } finally {
      setTesting(false);
    }
  }

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
            <Text type="secondary">เชื่อมต่อ Shopee Affiliate API</Text>
          </Space>
        </div>

        <Card
          bordered={false}
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)", borderRadius: 12 }}
        >
          <Title level={4} style={{ marginBottom: 4 }}>
            <KeyOutlined style={{ marginRight: 8, color: "#ee4d2d" }} />
            ใส่ API Credentials
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 24 }}>
            Credentials จะถูกเก็บใน localStorage ของเครื่องคุณเท่านั้น ไม่ถูก
            build เข้า code หรือส่งออกไปที่ใด
          </Paragraph>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 20 }}
            />
          )}
          {success && (
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
            onFinish={handleSubmit}
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
                disabled={success}
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

          {/* How to get credentials */}
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
                    คัดลอก <Text code>App ID</Text> และ <Text code>Secret</Text>
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

        <Paragraph
          type="secondary"
          style={{ textAlign: "center", marginTop: 16, fontSize: 12 }}
        >
          🔒 Credentials ถูกเก็บใน{" "}
          <Text code style={{ fontSize: 11 }}>
            localStorage
          </Text>{" "}
          ของเบราว์เซอร์คุณเท่านั้น ไม่มีการส่งออกไปที่ใดนอกจาก Shopee API
        </Paragraph>
      </div>
    </div>
  );
}
