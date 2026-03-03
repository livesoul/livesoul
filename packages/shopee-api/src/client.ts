// ============================================================
// Shopee Affiliate API Client
// ============================================================

import { buildAuthorizationHeader, getCurrentTimestamp } from "./auth";
import {
  buildShopeeOfferQuery,
  buildShopOfferQuery,
  buildProductOfferQuery,
  buildShortLinkMutation,
  buildConversionReportQuery,
  buildValidatedReportQuery,
} from "./queries";
import type {
  ShopeeAffiliateConfig,
  ShopeeOfferQueryParams,
  ShopeeOfferConnectionV2,
  ShopOfferQueryParams,
  ShopOfferConnectionV2,
  ProductOfferQueryParams,
  ProductOfferConnectionV2,
  GenerateShortLinkInput,
  ShortLinkResult,
  ConversionReportQueryParams,
  ConversionReportConnection,
  ValidatedReportQueryParams,
  ValidatedReportConnection,
} from "./types";

const DEFAULT_ENDPOINT = "https://open-api.affiliate.shopee.co.th/graphql";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    path?: string;
    extensions?: {
      code: number;
      message: string;
    };
  }>;
}

export class ShopeeAffiliateClient {
  private appId: string;
  private secret: string;
  private endpoint: string;

  constructor(config: ShopeeAffiliateConfig) {
    this.appId = config.appId;
    this.secret = config.secret;
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  }

  /**
   * Execute a raw GraphQL query/mutation
   */
  async execute<T = unknown>(query: string): Promise<GraphQLResponse<T>> {
    const payload = JSON.stringify({ query });
    const timestamp = getCurrentTimestamp();
    const authorization = buildAuthorizationHeader(
      this.appId,
      timestamp,
      payload,
      this.secret,
    );

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: payload,
      cache: "no-store",
    } as RequestInit);

    if (!response.ok) {
      throw new Error(
        `Shopee API HTTP Error: ${response.status} ${response.statusText}`,
      );
    }

    const result = (await response.json()) as GraphQLResponse<T>;

    if (result.errors && result.errors.length > 0) {
      const err = result.errors[0];
      const code = err.extensions?.code ?? 0;
      throw new ShopeeApiError(err.message, code, result.errors);
    }

    return result;
  }

  // ─── Offer List APIs ────────────────────────────────────────

  /** Get Shopee Offer List (shopeeOfferV2) */
  async getShopeeOffers(
    params: ShopeeOfferQueryParams = {},
  ): Promise<ShopeeOfferConnectionV2> {
    const query = buildShopeeOfferQuery(params);
    const result = await this.execute<{
      shopeeOfferV2: ShopeeOfferConnectionV2;
    }>(query);
    return result.data!.shopeeOfferV2;
  }

  /** Get Shop Offer List (shopOfferV2) */
  async getShopOffers(
    params: ShopOfferQueryParams = {},
  ): Promise<ShopOfferConnectionV2> {
    const query = buildShopOfferQuery(params);
    const result = await this.execute<{
      shopOfferV2: ShopOfferConnectionV2;
    }>(query);
    return result.data!.shopOfferV2;
  }

  /** Get Product Offer List (productOfferV2) */
  async getProductOffers(
    params: ProductOfferQueryParams = {},
  ): Promise<ProductOfferConnectionV2> {
    const query = buildProductOfferQuery(params);
    const result = await this.execute<{
      productOfferV2: ProductOfferConnectionV2;
    }>(query);
    return result.data!.productOfferV2;
  }

  // ─── Short Link API ─────────────────────────────────────────

  /** Generate Short Link (generateShortLink mutation) */
  async generateShortLink(
    input: GenerateShortLinkInput,
  ): Promise<ShortLinkResult> {
    const query = buildShortLinkMutation(input);
    const result = await this.execute<{
      generateShortLink: ShortLinkResult;
    }>(query);
    return result.data!.generateShortLink;
  }

  // ─── Conversion Report APIs ─────────────────────────────────

  /** Get Conversion Report (conversionReport) */
  async getConversionReport(
    params: ConversionReportQueryParams = {},
  ): Promise<ConversionReportConnection> {
    const query = buildConversionReportQuery(params);
    const result = await this.execute<{
      conversionReport: ConversionReportConnection;
    }>(query);
    return result.data!.conversionReport;
  }

  /** Get Validated Report (validatedReport) */
  async getValidatedReport(
    params: ValidatedReportQueryParams = {},
  ): Promise<ValidatedReportConnection> {
    const query = buildValidatedReportQuery(params);
    const result = await this.execute<{
      validatedReport: ValidatedReportConnection;
    }>(query);
    return result.data!.validatedReport;
  }

  // ─── Convenience: Paginate all data ─────────────────────────

  /**
   * Auto-paginate conversion report using scrollId
   * Collects all pages within the 30s scrollId window
   */
  async getAllConversionReports(
    params: Omit<ConversionReportQueryParams, "scrollId">,
  ): Promise<ConversionReportConnection["nodes"]> {
    const allNodes: ConversionReportConnection["nodes"] = [];
    let scrollId: string | undefined;
    let hasNext = true;

    while (hasNext) {
      const result = await this.getConversionReport({
        ...params,
        scrollId,
      });
      allNodes.push(...result.nodes);
      hasNext = result.pageInfo.hasNextPage;
      scrollId = result.pageInfo.scrollId;
    }

    return allNodes;
  }
}

// ─── Custom Error ──────────────────────────────────────────

export class ShopeeApiError extends Error {
  public code: number;
  public errors: Array<{
    message: string;
    path?: string;
    extensions?: { code: number; message: string };
  }>;

  constructor(
    message: string,
    code: number,
    errors: Array<{
      message: string;
      path?: string;
      extensions?: { code: number; message: string };
    }>,
  ) {
    super(`[Shopee API Error ${code}] ${message}`);
    this.name = "ShopeeApiError";
    this.code = code;
    this.errors = errors;
  }
}
