/**
 * Browser-compatible Shopee Affiliate API client
 *
 * Uses Web Crypto API (crypto.subtle) instead of Node.js `crypto` module,
 * so it works in both client-side React and static exports (GitHub Pages).
 */

import type { Credentials } from "./credentials";

const SHOPEE_ENDPOINT = "https://open-api.affiliate.shopee.co.th/graphql";

// ─── SHA256 via Web Crypto ────────────────────────────────────────────────────

async function sha256hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildAuthHeader(
  appId: string,
  secret: string,
  payload: string,
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const factor = `${appId}${timestamp}${payload}${secret}`;
  const signature = await sha256hex(factor);
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

// ─── GraphQL executor ─────────────────────────────────────────────────────────

interface GQLError {
  message: string;
  extensions?: { code: number; message: string };
}

async function shopeeGQL<T>(creds: Credentials, gqlQuery: string): Promise<T> {
  const payload = JSON.stringify({ query: gqlQuery });
  const authorization = await buildAuthHeader(
    creds.appId,
    creds.secret,
    payload,
  );

  const res = await fetch(SHOPEE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: payload,
  });

  if (!res.ok) {
    throw new Error(`Shopee API HTTP Error: ${res.status} ${res.statusText}`);
  }

  const result = (await res.json()) as { data?: T; errors?: GQLError[] };

  if (result.errors && result.errors.length > 0) {
    const err = result.errors[0];
    const code = err.extensions?.code ?? 0;
    throw new Error(`[Shopee API Error ${code}] ${err.message}`);
  }

  return result.data!;
}

// ─── Query builders ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildArgs(params: Record<string, any>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return "";
  const args = entries.map(([key, value]) => {
    if (typeof value === "string") return `${key}: "${value}"`;
    return `${key}: ${value}`;
  });
  return `(${args.join(", ")})`;
}

const CONVERSION_FIELDS = `
  purchaseTime
  conversionId
  totalCommission
  buyerType
  device
  orders {
    orderId
    orderStatus
    items {
      shopId
      shopName
      itemId
      itemName
      itemPrice
      qty
      imageUrl
      itemTotalCommission
    }
  }
`;

function buildConversionQuery(params: {
  purchaseTimeStart: number;
  purchaseTimeEnd: number;
  limit?: number;
  scrollId?: string;
}): string {
  return `{
  conversionReport${buildArgs(params)} {
    nodes {${CONVERSION_FIELDS}}
    pageInfo {
      limit
      hasNextPage
      scrollId
    }
  }
}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversionItem {
  shopName: string;
  itemId: number;
  itemName: string;
  itemPrice: string;
  qty: number;
  imageUrl: string;
  itemTotalCommission: string;
}

export interface ConversionOrder {
  orderId: string;
  orderStatus: string;
  items: ConversionItem[];
}

export interface ConversionNode {
  purchaseTime: number;
  conversionId: number;
  totalCommission: string;
  buyerType: string;
  device: string;
  orders: ConversionOrder[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FetchConversionsParams {
  purchaseTimeStart: number;
  purchaseTimeEnd: number;
  limit?: number;
}

/**
 * Fetch all conversion report pages using scrollId pagination.
 * Calls Shopee API directly from the browser using Web Crypto SHA256.
 */
export async function getAllConversions(
  creds: Credentials,
  params: FetchConversionsParams,
): Promise<ConversionNode[]> {
  const allNodes: ConversionNode[] = [];
  let scrollId: string | undefined;
  let hasNext = true;

  while (hasNext) {
    const query = buildConversionQuery({ ...params, scrollId });
    const data = await shopeeGQL<{
      conversionReport: {
        nodes: ConversionNode[];
        pageInfo: { hasNextPage: boolean; scrollId: string };
      };
    }>(creds, query);

    allNodes.push(...data.conversionReport.nodes);
    hasNext = data.conversionReport.pageInfo.hasNextPage;
    scrollId = data.conversionReport.pageInfo.scrollId;
  }

  return allNodes;
}

/**
 * Validate credentials by calling shopeeOfferV2 with limit 1.
 * Throws on invalid credentials.
 */
export async function validateCredentials(creds: Credentials): Promise<void> {
  const query = `{ shopeeOfferV2(limit: 1) { pageInfo { limit } } }`;
  await shopeeGQL(creds, query);
}

/**
 * Map Shopee API error message to Thai-friendly string.
 */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("10020"))
    return "App ID หรือ Secret ไม่ถูกต้อง (Invalid Credential)";
  if (msg.includes("10033")) return "บัญชีถูกระงับ (Account is frozen)";
  if (msg.includes("10035")) return "ไม่มีสิทธิ์เข้า Open API Platform";
  return msg;
}
