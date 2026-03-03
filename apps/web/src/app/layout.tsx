import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import thTH from "antd/locale/th_TH";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveSoul Affiliate — Shopee",
  description: "Shopee Affiliate Dashboard & Tools powered by LiveSoul",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>
        <AntdRegistry>
          <ConfigProvider
            locale={thTH}
            theme={{
              token: {
                colorPrimary: "#ee4d2d",
                borderRadius: 8,
              },
            }}
          >
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
