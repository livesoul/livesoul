import { createHmac, createHash } from "crypto";

/**
 * Generate SHA256 signature for Shopee Affiliate API
 *
 * Signature = SHA256(AppId + Timestamp + Payload + Secret)
 *
 * @param appId - The Open API appId
 * @param timestamp - Unix timestamp in seconds
 * @param payload - The request body (JSON string)
 * @param secret - The Open API secret
 * @returns 64-char lowercase hex signature
 */
export function generateSignature(
  appId: string,
  timestamp: number,
  payload: string,
  secret: string,
): string {
  const factor = `${appId}${timestamp}${payload}${secret}`;
  return createHash("sha256").update(factor).digest("hex");
}

/**
 * Build the Authorization header value
 *
 * Format: SHA256 Credential={AppId}, Timestamp={Timestamp}, Signature={Signature}
 */
export function buildAuthorizationHeader(
  appId: string,
  timestamp: number,
  payload: string,
  secret: string,
): string {
  const signature = generateSignature(appId, timestamp, payload, secret);
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

/**
 * Get current unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
