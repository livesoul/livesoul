// ============================================================
// Shopee Affiliate Open API — Type Definitions
// Generated from API documentation
// ============================================================

// ─── Enums & Constants ──────────────────────────────────────

/** Sort type for Shopee Offer List */
export enum ShopeeOfferSortType {
  LATEST_DESC = 1,
  HIGHEST_COMMISSION_DESC = 2,
}

/** Sort type for Shop Offer List */
export enum ShopOfferSortType {
  LATEST_DESC = 1,
  HIGHEST_COMMISSION_DESC = 2,
  POPULAR_SHOP_DESC = 3,
}

/** Sort type for Product Offer List */
export enum ProductOfferSortType {
  RELEVANCE_DESC = 1,
  ITEM_SOLD_DESC = 2,
  PRICE_DESC = 3,
  PRICE_ASC = 4,
  COMMISSION_DESC = 5,
}

/** Shop type filter */
export enum ShopType {
  OFFICIAL_SHOP = 1,
  PREFERRED_SHOP = 2,
  PREFERRED_PLUS_SHOP = 4,
}

/** Product offer list type */
export enum ProductListType {
  ALL = 0,
  /** @deprecated To Be Removed */
  HIGHEST_COMMISSION = 1,
  TOP_PERFORMING = 2,
  LANDING_CATEGORY = 3,
  DETAIL_CATEGORY = 4,
  DETAIL_SHOP = 5,
  /** @deprecated To Be Removed */
  DETAIL_COLLECTION = 6,
}

/** Offer type for Shopee offers */
export enum OfferType {
  CAMPAIGN_TYPE_COLLECTION = 1,
  CAMPAIGN_TYPE_CATEGORY = 2,
}

/** Remaining budget level */
export enum RemainingBudget {
  UNLIMITED = 0,
  VERY_LOW = 1,
  LOW = 2,
  NORMAL = 3,
}

/** Order status */
export type OrderStatus = "UNPAID" | "PENDING" | "COMPLETED" | "CANCELLED";

/** Buyer type */
export type BuyerType = "ALL" | "NEW" | "EXISTING";

/** Device type */
export type DeviceType = "ALL" | "APP" | "WEB";

/** Fraud status */
export type FraudStatus = "ALL" | "UNVERIFIED" | "VERIFIED" | "FRAUD";

/** Shop type string (for conversion report) */
export type ShopTypeString =
  | "ALL"
  | "SHOPEE_MALL_CB"
  | "SHOPEE_MALL_NON_CB"
  | "C2C_CB"
  | "C2C_NON_CB"
  | "PREFERRED_CB"
  | "PREFERRED_NON_CB";

/** Campaign type */
export type CampaignType =
  | "ALL"
  | "Seller Open Campaign"
  | "Seller Target Campaign"
  | "MCN Campaign"
  | "Non-Seller Campaign";

// ─── Shared Structures ──────────────────────────────────────

export interface PageInfo {
  page: number;
  limit: number;
  hasNextPage: boolean;
}

export interface ScrollPageInfo {
  limit: number;
  hasNextPage: boolean;
  scrollId: string;
}

// ─── Shopee Offer (shopeeOfferV2) ───────────────────────────

export interface ShopeeOfferQueryParams {
  keyword?: string;
  sortType?: ShopeeOfferSortType;
  page?: number;
  limit?: number;
}

export interface ShopeeOfferV2 {
  commissionRate: string;
  imageUrl: string;
  offerLink: string;
  originalLink: string;
  offerName: string;
  offerType: OfferType;
  categoryId: number;
  collectionId: number;
  periodStartTime: number;
  periodEndTime: number;
}

export interface ShopeeOfferConnectionV2 {
  nodes: ShopeeOfferV2[];
  pageInfo: PageInfo;
}

// ─── Shop Offer (shopOfferV2) ───────────────────────────────

export interface ShopOfferQueryParams {
  shopId?: number;
  keyword?: string;
  shopType?: ShopType[];
  isKeySeller?: boolean;
  sortType?: ShopOfferSortType;
  sellerCommCoveRatio?: string;
  page?: number;
  limit?: number;
}

export interface Banner {
  fileName: string;
  imageUrl: string;
  imageSize: number;
  imageWidth: number;
  imageHeight: number;
}

export interface BannerInfo {
  count: number;
  banners: Banner[];
}

export interface ShopOfferV2 {
  commissionRate: string;
  imageUrl: string;
  offerLink: string;
  originalLink: string;
  shopId: number;
  shopName: string;
  ratingStar: string;
  shopType: ShopType[];
  remainingBudget: RemainingBudget;
  periodStartTime: number;
  periodEndTime: number;
  sellerCommCoveRatio: string;
  bannerInfo: BannerInfo;
}

export interface ShopOfferConnectionV2 {
  nodes: ShopOfferV2[];
  pageInfo: PageInfo;
}

// ─── Product Offer (productOfferV2) ─────────────────────────

export interface ProductOfferQueryParams {
  shopId?: number;
  itemId?: number;
  productCatId?: number;
  listType?: ProductListType;
  matchId?: number;
  keyword?: string;
  sortType?: ProductOfferSortType;
  page?: number;
  isAMSOffer?: boolean;
  isKeySeller?: boolean;
  limit?: number;
}

export interface ProductOfferV2 {
  itemId: number;
  commissionRate: string;
  sellerCommissionRate: string;
  shopeeCommissionRate: string;
  commission: string;
  sales: number;
  priceMax: string;
  priceMin: string;
  productCatIds: number[];
  ratingStar: string;
  priceDiscountRate: number;
  imageUrl: string;
  productName: string;
  shopId: number;
  shopName: string;
  shopType: ShopType[];
  productLink: string;
  offerLink: string;
  periodStartTime: number;
  periodEndTime: number;
}

export interface ProductOfferConnectionV2 {
  nodes: ProductOfferV2[];
  pageInfo: PageInfo;
}

// ─── Short Link (generateShortLink) ─────────────────────────

export interface GenerateShortLinkInput {
  originUrl: string;
  subIds?: string[];
}

export interface ShortLinkResult {
  shortLink: string;
}

// ─── Conversion Report (conversionReport) ───────────────────

export interface ConversionReportQueryParams {
  purchaseTimeStart?: number;
  purchaseTimeEnd?: number;
  completeTimeStart?: number;
  completeTimeEnd?: number;
  shopName?: string;
  shopId?: number;
  shopType?: ShopTypeString[];
  conversionId?: number;
  orderId?: string;
  productName?: string;
  productId?: number;
  categoryLv1Id?: number;
  categoryLv2Id?: number;
  categoryLv3Id?: number;
  categoryType?: string;
  orderStatus?: string;
  buyerType?: BuyerType;
  attributionType?: string;
  device?: DeviceType;
  limit?: number;
  productType?: string;
  fraudStatus?: FraudStatus;
  scrollId?: string;
  campaignPartnerName?: string;
  campaignType?: CampaignType;
}

export interface ConversionReportOrderItem {
  shopId: number;
  shopName: string;
  completeTime: number;
  itemId: number;
  itemName: string;
  itemPrice: string;
  displayItemStatus: string;
  actualAmount: string;
  qty: number;
  imageUrl: string;
  itemTotalCommission: string;
  itemSellerCommission: string;
  itemSellerCommissionRate: string;
  itemShopeeCommissionCapped: string;
  itemShopeeCommissionRate: string;
  itemNotes: string;
  channelType: string;
  attributionType: string;
  globalCategoryLv1Name: string;
  globalCategoryLv2Name: string;
  globalCategoryLv3Name: string;
  refundAmount: string;
  fraudStatus: string;
  modelId: number;
  promotionId: string;
  campaignPartnerName: string;
  campaignType: CampaignType;
}

export interface ConversionReportOrder {
  orderId: string;
  orderStatus: OrderStatus;
  shopType: ShopTypeString;
  items: ConversionReportOrderItem[];
}

export interface ConversionReport {
  purchaseTime: number;
  clickTime: number;
  conversionId: number;
  shopeeCommissionCapped: string;
  sellerCommission: string;
  totalCommission: string;
  buyerType: string;
  utmContent: string;
  device: string;
  referrer: string;
  orders: ConversionReportOrder[];
  linkedMcnName: string;
  mcnContractId: number;
  mcnManagementFeeRate: string;
  mcnManagementFee: string;
  netCommission: string;
  campaignType: CampaignType;
}

export interface ConversionReportConnection {
  nodes: ConversionReport[];
  pageInfo: ScrollPageInfo;
}

// ─── Validated Report (validatedReport) ─────────────────────

export interface ValidatedReportQueryParams {
  validationId?: number;
  limit?: number;
  scrollId?: string;
}

export interface ValidatedReportOrderItem {
  shopId: number;
  shopName: string;
  completeTime: number;
  itemId: number;
  itemName: string;
  itemPrice: string;
  displayItemStatus: string;
  actualAmount: string;
  qty: number;
  imageUrl: string;
  itemTotalCommission: string;
  itemSellerCommission: string;
  itemSellerCommissionRate: string;
  itemShopeeCommissionCapped: string;
  itemShopeeCommissionRate: string;
  itemNotes: string;
  channelType: string;
  attributionType: string;
  globalCategoryLv1Name: string;
  globalCategoryLv2Name: string;
  globalCategoryLv3Name: string;
  refundAmount: string;
  fraudStatus: string;
  modelId: number;
  promotionId: string;
  campaignPartnerName: string;
  campaignType: CampaignType;
}

export interface ValidatedReportOrder {
  orderId: string;
  orderStatus: OrderStatus;
  shopType: ShopTypeString;
  items: ValidatedReportOrderItem[];
}

export interface ValidatedReport {
  purchaseTime: number;
  clickTime: number;
  conversionId: number;
  shopeeCommissionCapped: string;
  sellerCommission: string;
  totalCommission: string;
  buyerType: string;
  utmContent: string;
  device: string;
  referrer: string;
  orders: ValidatedReportOrder[];
  linkedMcnName: string;
  mcnContractId: string;
  mcnManagementFeeRate: string;
  mcnManagementFee: string;
  netCommission: string;
  campaignType: CampaignType;
}

export interface ValidatedReportConnection {
  nodes: ValidatedReport[];
  pageInfo: ScrollPageInfo;
}

// ─── API Config ─────────────────────────────────────────────

export interface ShopeeAffiliateConfig {
  appId: string;
  secret: string;
  /** Default: https://open-api.affiliate.shopee.co.th/graphql */
  endpoint?: string;
}
