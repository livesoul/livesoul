// ============================================================
// GraphQL Query/Mutation builders for Shopee Affiliate API
// ============================================================

import type {
  ShopeeOfferQueryParams,
  ShopOfferQueryParams,
  ProductOfferQueryParams,
  ConversionReportQueryParams,
  ValidatedReportQueryParams,
  GenerateShortLinkInput,
} from "./types";

/** Build GraphQL args string from params object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildArgs(params: Record<string, any>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return "";

  const args = entries
    .map(([key, value]) => {
      if (typeof value === "string") return `${key}: "${value}"`;
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        if (typeof value[0] === "string") {
          return `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`;
        }
        return `${key}: [${value.join(", ")}]`;
      }
      return `${key}: ${value}`;
    })
    .filter(Boolean)
    .join(", ");

  return args ? `(${args})` : "";
}

// ─── Shopee Offer List ──────────────────────────────────────

const SHOPEE_OFFER_FIELDS = `
  commissionRate
  imageUrl
  offerLink
  originalLink
  offerName
  offerType
  categoryId
  collectionId
  periodStartTime
  periodEndTime
`;

export function buildShopeeOfferQuery(
  params: ShopeeOfferQueryParams = {},
): string {
  const args = buildArgs(params);
  return `{
  shopeeOfferV2${args} {
    nodes {${SHOPEE_OFFER_FIELDS}}
    pageInfo {
      page
      limit
      hasNextPage
    }
  }
}`;
}

// ─── Shop Offer List ────────────────────────────────────────

const SHOP_OFFER_FIELDS = `
  commissionRate
  imageUrl
  offerLink
  originalLink
  shopId
  shopName
  ratingStar
  shopType
  remainingBudget
  periodStartTime
  periodEndTime
  sellerCommCoveRatio
  bannerInfo {
    count
    banners {
      fileName
      imageUrl
      imageSize
      imageWidth
      imageHeight
    }
  }
`;

export function buildShopOfferQuery(params: ShopOfferQueryParams = {}): string {
  const args = buildArgs(params);
  return `{
  shopOfferV2${args} {
    nodes {${SHOP_OFFER_FIELDS}}
    pageInfo {
      page
      limit
      hasNextPage
    }
  }
}`;
}

// ─── Product Offer List ─────────────────────────────────────

const PRODUCT_OFFER_FIELDS = `
  itemId
  commissionRate
  sellerCommissionRate
  shopeeCommissionRate
  commission
  sales
  priceMax
  priceMin
  productCatIds
  ratingStar
  priceDiscountRate
  imageUrl
  productName
  shopId
  shopName
  shopType
  productLink
  offerLink
  periodStartTime
  periodEndTime
`;

export function buildProductOfferQuery(
  params: ProductOfferQueryParams = {},
): string {
  const args = buildArgs(params);
  return `{
  productOfferV2${args} {
    nodes {${PRODUCT_OFFER_FIELDS}}
    pageInfo {
      page
      limit
      hasNextPage
    }
  }
}`;
}

// ─── Short Link ─────────────────────────────────────────────

export function buildShortLinkMutation(input: GenerateShortLinkInput): string {
  const subIdsStr = input.subIds
    ? `, subIds: [${input.subIds.map((s) => `"${s}"`).join(", ")}]`
    : "";
  return `mutation {
  generateShortLink(input: {originUrl: "${input.originUrl}"${subIdsStr}}) {
    shortLink
  }
}`;
}

// ─── Conversion Report ──────────────────────────────────────

const CONVERSION_REPORT_FIELDS = `
  purchaseTime
  clickTime
  conversionId
  shopeeCommissionCapped
  sellerCommission
  totalCommission
  buyerType
  utmContent
  device
  referrer
  linkedMcnName
  mcnContractId
  mcnManagementFeeRate
  mcnManagementFee
  netCommission
  orders {
    orderId
    orderStatus
    shopType
    items {
      shopId
      shopName
      completeTime
      itemId
      itemName
      itemPrice
      displayItemStatus
      actualAmount
      qty
      imageUrl
      itemTotalCommission
      itemSellerCommission
      itemSellerCommissionRate
      itemShopeeCommissionCapped
      itemShopeeCommissionRate
      itemNotes
      channelType
      attributionType
      globalCategoryLv1Name
      globalCategoryLv2Name
      globalCategoryLv3Name
      refundAmount
      fraudStatus
      modelId
      promotionId
    }
  }
`;

export function buildConversionReportQuery(
  params: ConversionReportQueryParams = {},
): string {
  const args = buildArgs(params);
  return `{
  conversionReport${args} {
    nodes {${CONVERSION_REPORT_FIELDS}}
    pageInfo {
      limit
      hasNextPage
      scrollId
    }
  }
}`;
}

// ─── Validated Report ───────────────────────────────────────

const VALIDATED_REPORT_FIELDS = `
  purchaseTime
  clickTime
  conversionId
  shopeeCommissionCapped
  sellerCommission
  totalCommission
  buyerType
  utmContent
  device
  referrer
  linkedMcnName
  mcnContractId
  mcnManagementFeeRate
  mcnManagementFee
  netCommission
  orders {
    orderId
    orderStatus
    shopType
    items {
      shopId
      shopName
      completeTime
      itemId
      itemName
      itemPrice
      displayItemStatus
      actualAmount
      qty
      imageUrl
      itemTotalCommission
      itemSellerCommission
      itemSellerCommissionRate
      itemShopeeCommissionCapped
      itemShopeeCommissionRate
      itemNotes
      channelType
      attributionType
      globalCategoryLv1Name
      globalCategoryLv2Name
      globalCategoryLv3Name
      refundAmount
      fraudStatus
      modelId
      promotionId
    }
  }
`;

export function buildValidatedReportQuery(
  params: ValidatedReportQueryParams = {},
): string {
  const args = buildArgs(params);
  return `{
  validatedReport${args} {
    nodes {${VALIDATED_REPORT_FIELDS}}
    pageInfo {
      limit
      hasNextPage
      scrollId
    }
  }
}`;
}
