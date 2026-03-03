# Shopee Affiliate Open API Document

> **KOL Affiliate Program** — Open API Document

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Request and Response](#request-and-response)
- [API List](#api-list)
  - [Get Offer List](#get-offer-list)
    - [Get Shopee Offer List](#1-get-shopee-offer-list)
    - [Get Brand Offer List](#2-get-brand-offer-list)
    - [Get Shop Offer List](#3-get-shop-offer-list)
    - [Get Product Offer List](#4-get-product-offer-list)
  - [Get Short Link](#get-short-link)
  - [Get Conversion Report](#get-conversion-report)
    - [Get Conversion Report Data](#1-get-conversion-report-data)
    - [Get Validated Report Data](#2-get-validated-report-data)

---

## Overview

### Function List

- Get offer list
- Get short link
- Get conversion report

### API Calling Process

Shopee Affiliate Open API platform USES the **GraphQL** specification to handle requests.

GraphQL is based on the HTTP protocol, so it's easy to integrate with various HTTP libraries like cURL and Requests. There are also a variety of open source clients to choose from: <https://graphql.org/code/#graphql-clients>

For more specifications on GraphQL, please refer to <https://graphql.org/>.

### Authentication

All requests use authorization headers to provide authentication information. For details, please refer to [Authentication](#authentication).

### Rate Limit

- The system limits the number of API calls issued within a specified time period.
- The current system limit is **2000 times/hour**.
- If the limit is exceeded, the system will refuse to process the request. The client needs to wait for the next time window to resend the request.

### Timestamp and Timezone

- Shopee is using local time in **UTC+** time format for each local region to store the data.
- But regardless of your timezone, a timestamp represents a moment that is the same everywhere.
- Get Timestamp from Shopee Open API platform.

---

## Important Notes ⚠️ Must Read

### Scrollid

> If you need to query multiple pages of data, you need to **Query Twice or more!**

- The first query can get the content of the first page and scrollid, and the maximum number of data returned per page is **500**.
- Scrollid is used to help query the content of the second page and later. In order to get the content of the second page and later you **Must Query with Scrollid**.
- Scrollid is **one-time valid**, the valid time is only **30 seconds**.
- So after the first request for scrollid, please query the content of the second and later page within 30 seconds.
- The query without scrollid requires an interval of **longer than 30 seconds**.

### Queryable Time Range of Conversion Report

- The available querying data time range is **Recent 3 Months**.
- The time range that can be queried in the Open API is consistent with the time range of affiliate system portal.
- If you query longer than the range, system will send error.

### Tool to Request and Check

Here is an useful tool to make request and check:

🔗 <https://open-api.affiliate.shopee.co.th/explorer>

---

## Authentication

### Overview

All requests provide authentication information through the **Authorization Header**.

### Authentication Header Structure

```
Authorization: SHA256 Credential={AppId}, Timestamp={Timestamp}, Signature={Signature}
```

**Calculation method:** `SHA256(Credential + Timestamp + Payload + Secret)`

### Example of Authorization Header

```
Authorization: SHA256 Credential=123456, Timestamp=1599999999,
Signature=0bc0bd3ba6c41d98a591976bf95db97a58720a9e6d778845408765c3fafa069d.
```

### Description of Authorization Header Components

| Component      | Description                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SHA256**     | The algorithm used to calculate the signature, currently only supports SHA256.                                                                                                                                           |
| **Credential** | The Open API appId obtained from the affiliate platform is used to identify the request identity and calculate the signature.                                                                                            |
| **Timestamp**  | The difference between the timestamp of the request and the server time cannot exceed 10 minutes, so please ensure that the time of the machine that initiated the request is accurate. Used to calculate the signature. |
| **Signature**  | Represented as a 256-bit signature of 64 lowercase hexadecimal characters. Calculation method: `SHA256(Credential + Timestamp + Payload + Secret)`                                                                       |

### Signature Calculation

Before sending a request, please obtain the **AppId and Secret** from the affiliate platform. (Please keep the secret equivalent to the password, don't disclose it.)

#### Calculation Steps

1. **Get the payload of the request** — payload is a request body:

```json
{
  "query": "{\nbrandOffer{\n    nodes{\n      commissionRate\n      offerName\n    }\n}\n}"
}
```

> According to GraphQL standard, the request body must be in a valid JSON format.
> When query by string conditions we should escape double quotes first. Like this:
> `{"query":"{\conversionReport(purchaseTimeStart: 1600621200, purchaseTimeEnd: 1601225999, scrollId: \"some characters\"){...}}"}`

2. **Get the current timestamp**

3. **Construct a signature factor:** Compose a string with `AppId + Timestamp + Payload + Secret`

4. **Perform the SHA256 algorithm** on the signature factor:
   `signature = SHA256(Credential + Timestamp + Payload + Secret)` to get the signature (lowercase hexadecimal)

5. **Generate Authorization header:**
   `SHA256 Credential=${AppId}, Timestamp=${Timestamp}, Signature=${signature}`

#### Example

- Hypothesis AppId=123456, Secret=demo
- Current time=2020-01-01 00:00:00 UTC+0, Timestamp=1577836800

Please send payload as:

```json
{
  "query": "{\nbrandOffer{\n    nodes{\n      commissionRate\n      offerName\n    }\n}\n}"
}
```

1. Get the payload of the request
2. Get the current timestamp
3. Construct a signature factor: `AppId + Timestamp + Payload + Secret`

```
factor = 123456 + 1577836800 + {"query":"{\nbrandOffer{\n    nodes{\n      commissionRate\n      offerName\n    }\n}\n}"} + demo
         |AppId|  |Timestamp|                              |Payload|                                                        |Secret|
```

4. Calculate the signature:
   `signature = sha256(factor)`, result should be `dc88d72feea70c80c52c3399751a7d34966763f51a7f056aa070a5e9df645412`

5. Generate Authorization header:
   ```
   Authorization: SHA256 Credential=123456,
   Timestamp=1577836800,Signature=dc88d72feea70c80c52c3399751a7d34966763f51a7f056aa070a5e9df645412
   ```

---

## Request and Response

### Request

- Open API request need to use the `POST` method, and the content type is `application/json`.
- Endpoint is `https://open-api.affiliate.shopee.co.th/graphql` and no matter what operation is performed, the endpoint remains the same.

The request format is:

```json
{
  "query": "...",
  "operationName": "...",
  "variables": { "myVariable": "someValue", ... }
}
```

Where `operationName` and `variables` are optional fields.
Only when there are multiple operations in the query, `OperationName` is required.

### Response

If Open API has received your request, it will return a response with an HTTP Status Code of **200**. The data and error information will be returned in `JSON` format which is:

```json
{
  "data": { ... },
  "errors": [ ... ]
}
```

If no error occurs, the error information won't be returned.

### Error Structure

| Field              | Type   | Description                          |
| ------------------ | ------ | ------------------------------------ |
| message            | String | Error overview                       |
| path               | String | The location of the request in error |
| extensions         | object | Error details                        |
| extensions.code    | Int    | Error code                           |
| extensions.message | String | Error description                    |

### Error Codes

| Error code | Meaning                       | Description                                                           |
| ---------- | ----------------------------- | --------------------------------------------------------------------- |
| 10000      | System error                  | System error                                                          |
| 10010      | Request parsing error         | Incorrect query syntax, incorrect field type, API does not exist, etc |
| 10020      | Identity authentication error | Signature is incorrect or expired                                     |
| 10030      | Trigger traffic limiting      | The number of requests exceeds the threshold                          |
| 11000      | Business processing error     | Business processing error                                             |

---

## API List

---

## Get Offer List

### 1. Get Shopee Offer List

> **Version 2.0**

- **Query:** `shopeeOfferV2`
- **ResultType:** `ShopeeOfferConnectionV2!`

#### Query Parameters

| Field    | Type   | Description                                                                                                                              | Example |
| -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| keyword  | String | Search by offer name                                                                                                                     | clothes |
| sortType | Int    | **LATEST_DESC = 1:** Sort offers by latest update time. **HIGHEST_COMMISSION_DESC = 2:** Sort offers by commission rate from high to low | 1       |
| page     | Int    | Page number                                                                                                                              | 2       |
| limit    | Int    | Number of data per page                                                                                                                  | 10      |

#### Response Parameters

| Field    | Type             | Description      | Example |
| -------- | ---------------- | ---------------- | ------- |
| nodes    | [ShopeeOfferV2]! | Data list        |         |
| pageInfo | PageInfo!        | Page information |         |

#### ShopeeOfferV2 Structure

| Field           | Type   | Description                                                       | Example |
| --------------- | ------ | ----------------------------------------------------------------- | ------- |
| commissionRate  | String | Commission rate, e.g. set "0.0123" if the rate is 1.23%           |         |
| imageUrl        | String | Image url                                                         |         |
| offerLink       | String | Offer link                                                        |         |
| originalLink    | String | Original link                                                     |         |
| offerName       | String | Offer name                                                        |         |
| offerType       | Int    | **CAMPAIGN_TYPE_COLLECTION = 1;** **CAMPAIGN_TYPE_CATEGORY = 2;** |         |
| categoryId      | Int64  | CategoryId returns when `offerType = CAMPAIGN_TYPE_CATEGORY`      |         |
| collectionId    | Int64  | CollectionId returns when `offerType = CAMPAIGN_TYPE_COLLECTION`  |         |
| periodStartTime | Int    | Offer start time                                                  |         |
| periodEndTime   | Int    | Offer end time                                                    |         |

#### PageInfo Structure

| Field       | Type | Description             | Example |
| ----------- | ---- | ----------------------- | ------- |
| page        | Int  | The current page number | 2       |
| limit       | Int  | Number of data per page | 10      |
| hasNextPage | Bool | If it has next page     | true    |

---

### 2. Get Brand Offer List

> **Version 2.0**

- **Query:** `brandOfferV2`
- **ResultType:** `BrandOfferConnectionV2!`

> _(New API — see screenshots for full details)_

---

### 3. Get Shop Offer List

> **Version 2.0**

- **Query:** `shopOfferV2`
- **ResultType:** `ShopOfferConnectionV2`

#### Query Parameters

| Field                         | Type   | Description                                                                                                                                                                                                                                            | Example     |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| shopId **(New)**              | Int64  | Search by shop id                                                                                                                                                                                                                                      | 84499012    |
| keyword                       | String | Search by shop name                                                                                                                                                                                                                                    | demo        |
| shopType **(New)**            | [Int]  | Filter by specific shop type: **OFFICIAL_SHOP = 1:** Filter mall shop; **PREFERRED_SHOP = 2:** Filter preferred(Star) shop; **PREFERRED_PLUS_SHOP = 4:** Filter preferred(Star+) shop                                                                  | [1,4]       |
| isKeySeller **(New)**         | Bool   | Filter for offers from Shopee's key sellers; **TRUE** = Offers from key sellers; **FALSE** = All offers regardless of the key seller status                                                                                                            | true        |
| sortType                      | Int    | **SHOP_LIST_SORT_TYPE_LATEST_DESC = 1:** Sort by last update time; **SHOP_LIST_SORT_TYPE_HIGHEST_COMMISSION_DESC = 2:** Sort by commission rate from high to low; **SHOP_LIST_SORT_TYPE_POPULAR_SHOP_DESC = 3:** Sort by Popular shop from high to low |             |
| sellerCommCoveRatio **(New)** | String | The ratio of products with seller commission. e.g. set "0.123" if the rate is large or equal to 1.23%                                                                                                                                                  | "", "0.123" |
| page                          | Int    | Page number                                                                                                                                                                                                                                            | 2           |
| limit                         | Int    | Number of data per page                                                                                                                                                                                                                                | 10          |

#### Response Parameters

| Field    | Type           | Description      | Example |
| -------- | -------------- | ---------------- | ------- |
| nodes    | [ShopOfferV2]! | Data list        |         |
| pageInfo | PageInfo!      | Page information |         |

#### ShopOfferV2 Structure

| Field                         | Type       | Description                                                                                                                                                                                                                                                                           | Example                            |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| commissionRate                | String     | Commission rate, e.g. set "0.0123" if the rate is 1.23%                                                                                                                                                                                                                               | "0.25"                             |
| imageUrl                      | String     | Image url                                                                                                                                                                                                                                                                             |                                    |
| offerLink                     | String     | Offer link                                                                                                                                                                                                                                                                            | https://shope.ee/xxxxxxxx          |
| originalLink                  | String     | Original link                                                                                                                                                                                                                                                                         | https://shopee.co.id/shop/19162748 |
| shopId                        | Int64      | Shop ID                                                                                                                                                                                                                                                                               | 84499012                           |
| shopName                      | String     | Shop name                                                                                                                                                                                                                                                                             | Ikea                               |
| ratingStar **(New)**          | String     | Shop Rating in Product Detail Page                                                                                                                                                                                                                                                    | "3.7"                              |
| shopType **(New)**            | [Int]      | **OFFICIAL_SHOP = 1:** Product offers from official shops / Shopee Mall sellers; **PREFERRED_SHOP = 2:** Product offers from preferred sellers; **PREFERRED_PLUS_SHOP = 4:** Product offers from preferred plus sellers                                                               | [], [1,4]                          |
| remainingBudget **(New)**     | Int        | Remaining budget available for this seller's shop offer: **Unlimited (0):** Offer does not have a budget limit; **Normal (3):** Offer has above 50% budget remaining; **Low (2):** Below 50% budget remaining (medium risk); **Very Low (1):** Below 30% budget remaining (high risk) | 1                                  |
| periodStartTime               | Int        | Offer start time                                                                                                                                                                                                                                                                      | 1687712400                         |
| periodEndTime                 | Int        | Offer end time                                                                                                                                                                                                                                                                        | 1690822799                         |
| sellerCommCoveRatio **(New)** | String     | The ratio of products with seller commission. e.g. set "0.0123" if the rate is large or equal to 1.23%                                                                                                                                                                                | "", "0.123"                        |
| bannerInfo                    | BannerInfo | Banner Info                                                                                                                                                                                                                                                                           |                                    |

#### PageInfo Structure

| Field       | Type | Description             | Example |
| ----------- | ---- | ----------------------- | ------- |
| page        | Int  | The current page number | 2       |
| limit       | Int  | Number of data per page | 10      |
| hasNextPage | Bool | If it has next page     | true    |

#### BannerInfo Structure

| Field   | Type       | Description     | Example |
| ------- | ---------- | --------------- | ------- |
| count   | Int        | Banner quantity | 13      |
| banners | [Banner!]! | Banner          |         |

#### Banner Structure

| Field       | Type   | Description     | Example   |
| ----------- | ------ | --------------- | --------- |
| fileName    | String | Image file name | "454.jpg" |
| imageUrl    | String | Image url       |           |
| imageSize   | Int    | Image size      | 1747107   |
| imageWidth  | Int    | Image width     | 5998      |
| imageHeight | Int    | Image height    | 3000      |

---

### 4. Get Product Offer List

> **Version 2.0**

- **Query:** `productOfferV2`
- **ResultType:** `ProductOfferConnectionV2`

#### Query Parameters

| Field                  | Type   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Example     |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| shopId **(New)**       | Int64  | Search by shop id                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 84499012    |
| itemId **(New)**       | Int64  | Search by item id                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 17979995178 |
| productCatId **(New)** | Int32  | Filter specific Level 1 / Level 2 / Level 3 product category tiers using the category id. See category guides: [TH](https://seller.shopee.co.th/edu/category-guide), [SG](https://seller.shopee.sg/edu/category-guide), [MY](https://seller.shopee.com.my/edu/category-guide), [TW](https://seller.shopee.tw/portal/categories), [ID](https://seller.shopee.co.id/edu/category-guide), [VN](https://banhang.shopee.vn/edu/category-guide), [PH](https://seller.shopee.ph/edu/category-guide), [BR](https://seller.shopee.com.br/edu/category-guide)                                                                                                                                                             | 100001      |
| listType               | Int    | Type of product offer list (listType can only be used as a query parameter with matchId, can not be used with the rest of the input): **ALL = 0:** Recommendation product list, not available to sort; **HIGHEST_COMMISSION = 1:** _(To Be Removed)_ Highest commission product offer list; **TOP_PERFORMING = 2:** Top performing product offer list; **LANDING_CATEGORY = 3:** Product offer list of recommendation category in landing page; **DETAIL_CATEGORY = 4:** Product offer list of specific category in detail page; **DETAIL_SHOP = 5:** Product offer list of specific shop in detail page; **DETAIL_COLLECTION = 6:** _(To Be Removed)_ Product offer list of specific collection in detail page | 1           |
| matchId                | Int64  | The matchid for specific listType (can only be used with listType): CategoryId for `LANDING_CATEGORY` and `DETAIL_CATEGORY`; ShopId for `DETAIL_SHOP`; CollectionId for `DETAIL_COLLECTION`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 10012       |
| keyword                | String | Search by product name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | shopee      |
| sortType               | Int    | **RELEVANCE_DESC = 1:** Only for search by keyword, sort by relevance; **ITEM_SOLD_DESC = 2:** Sort by sold count from high to low; **PRICE_DESC = 3:** Sort by price from high to low; **PRICE_ASC = 4:** Sort by price from low to high; **COMMISSION_DESC = 5:** Sort by commission rate from high to low                                                                                                                                                                                                                                                                                                                                                                                                    | 2           |
| page                   | Int    | Page number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2           |
| isAMSOffer **(New)**   | Bool   | Filter by type of offer: **TRUE** = Filter for offers that have seller (AMS) commission; **FALSE** = Filter for all offers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | true        |
| isKeySeller **(New)**  | Bool   | Filter for offers from Shopee's key sellers; **TRUE** = Offers from key sellers; **FALSE** = All offers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | true        |
| limit                  | Int    | Number of data per page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 10          |

#### Response Parameters

| Field    | Type              | Description      | Example |
| -------- | ----------------- | ---------------- | ------- |
| nodes    | [ProductOfferV2]! | Data list        |         |
| pageInfo | PageInfo!         | Page information |         |

#### ProductOfferV2 Structure

| Field                          | Type   | Description                                                                                                            | Example                  |
| ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| itemId                         | Int64  | Item ID                                                                                                                | 17979995178              |
| commissionRate                 | String | Maximum Commission rate, e.g. set "0.0123" if the rate is 1.23%                                                        | "0.25"                   |
| sellerCommissionRate **(New)** | String | Seller Commission rate (Commission Xtra rate)                                                                          | "0.25"                   |
| shopeeCommissionRate **(New)** | String | Shopee Commission rate                                                                                                 | "0.25"                   |
| commission **(New)**           | String | Commission amount = price × commissionRate. Note: The unit is the local currency                                       | "27000"                  |
| appExistRate _(To Be Removed)_ | String | Commission rate for non-first-time order users on the app                                                              |                          |
| appNewRate _(To Be Removed)_   | String | Commission rate for new users on the app                                                                               |                          |
| webExistRate _(To Be Removed)_ | String | Commission rate for non-first-time order users on the web                                                              |                          |
| webNewRate _(To Be Removed)_   | String | Commission rate for new users on the web                                                                               |                          |
| price _(To Be Removed)_        | String | Product Price. Note: The unit is the local currency                                                                    |                          |
| sales                          | Int32  | Sales count for this product                                                                                           | 25                       |
| priceMax **(New)**             | String | Product maximum price. Note: The unit is the local currency                                                            | "55.99"                  |
| priceMin **(New)**             | String | Product minimum price. Note: The unit is the local currency                                                            | "45.99"                  |
| productCatIds **(New)**        | [Int]  | Product category id. Returns category id level 1, level 2, level 3 in order, or 0 if the relevant level does not exist | [100012, 100068, 100259] |
| ratingStar **(New)**           | String | The product rating shown in Shopee Product Page                                                                        | "4.7"                    |
| priceDiscountRate **(New)**    | Int    | The price discount shown in Shopee Product Page. 10 represents 10%                                                     | 10                       |
| imageUrl                       | String | Image url                                                                                                              |                          |
| productName                    | String | Product name                                                                                                           | IKEA starfish            |
| shopId **(New)**               | Int64  | Shop id                                                                                                                | 84499012                 |
| shopName                       | String | Shop name                                                                                                              | IKEA                     |
| shopType **(New)**             | [Int]  | **OFFICIAL_SHOP = 1;** **PREFERRED_SHOP = 2;** **PREFERRED_PLUS_SHOP = 4;**                                            | [], [1,4]                |
| productLink                    | String | Product link                                                                                                           |                          |
| offerLink                      | String | Offer link                                                                                                             |                          |
| periodStartTime                | Int    | Offer Start Time                                                                                                       | 1687539600               |
| periodEndTime                  | Int    | Offer End Time                                                                                                         | 1688144399               |

#### PageInfo Structure

| Field       | Type | Description             | Example |
| ----------- | ---- | ----------------------- | ------- |
| page        | Int  | The current page number | 2       |
| limit       | Int  | Number of data per page | 10      |
| hasNextPage | Bool | If it has next page     | true    |

---

## Get Short Link

- **Mutation:** `generateShortLink`
- **ResultType:** `ShortLinkResult!`

### Parameters

| Field     | Type     | Description                                                 | Example                                                                    |
| --------- | -------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| originUrl | String!  | Original url                                                | https://shopee.co.th/Apple-Iphone-11-128GB-Local-Set-i.52377417.6309028319 |
| subIds    | [String] | Sub id in utm content in tracking link, it has five sub ids | ["s1","s2","s3","s4","s5"]                                                 |

### Result

| Field     | Type    | Description | Example |
| --------- | ------- | ----------- | ------- |
| shortLink | String! | Short link  |         |

### Example

```bash
curl -X POST 'https://open-api.affiliate.shopee.co.th/graphql' \
-H 'Authorization:SHA256 Credential=123456, Signature=x9bc0bd3ba6c41d98a591976bf95db97a58720a9e6d778845408765c3fa...' \
-H 'Content-Type: application/json' \
--data-raw '{"query":"mutation{\n    generateShortLink(input:{originUrl:\"https://shopee.co.th/Apple-Iphone-11-128...
```

---

## Get Conversion Report

### 1. Get Conversion Report Data

- **Query:** `conversionReport`
- **ResultType:** `ConversionReportConnection!`

#### Query Parameters

| Field                              | Type     | Description                                                                                                            | Example          |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------- |
| purchaseTimeStart                  | Int      | Start of place order time range, unix timestamp                                                                        |                  |
| purchaseTimeEnd                    | Int      | End of place order time range, unix timestamp                                                                          |                  |
| completeTimeStart                  | Int      | Start of order complete time range, unix timestamp                                                                     |                  |
| completeTimeEnd                    | Int      | End of order complete time range, unix timestamp                                                                       |                  |
| shopName                           | String   | Shop name                                                                                                              |                  |
| shopId                             | Int64    | Shop id                                                                                                                |                  |
| shopType                           | [String] | ShopType: `ALL`, `SHOPEE_MALL_CB`, `SHOPEE_MALL_NON_CB`, `C2C_CB`, `C2C_NON_CB`, `PREFERRED_CB`, `PREFERRED_NON_CB`    | [SHOPEE_MALL_CB] |
| checkoutId _(To Be Removed)_       | Int64    | Checkout id                                                                                                            |                  |
| conversionId                       | Int64    | ConversionId, known as Checkout id before                                                                              |                  |
| conversionStatus _(To Be Removed)_ | String   | Conversion Status: `ALL`(default), `PENDING`, `COMPLETED`, `CANCELLED`                                                 |                  |
| orderId                            | String   | Order id                                                                                                               |                  |
| productName                        | String   | Product name                                                                                                           |                  |
| productId                          | Int64    | Product id                                                                                                             |                  |
| categoryLv1Id                      | Int64    | Level 1 category id                                                                                                    |                  |
| categoryLv2Id                      | Int64    | Level 2 category id                                                                                                    |                  |
| categoryLv3Id                      | Int64    | Level 3 category id                                                                                                    |                  |
| categoryType                       | String   | Product type: `ALL`(default), `DP`, `MP`                                                                               |                  |
| orderStatus                        | String   | Order Status: `ALL`(default), `UNPAID`, `PENDING`, `COMPLETED`, `CANCELLED`                                            |                  |
| buyerType                          | String   | Buyer type: `ALL`(default), `NEW`, `EXISTING`                                                                          |                  |
| attributionType                    | String   | Attribution type: `Ordered in Same Shop`, `Ordered in Different Shop`                                                  |                  |
| device                             | String   | Device type: `ALL`(default), `APP`, `WEB`                                                                              |                  |
| limit                              | Int      | The maximum number of return data                                                                                      |                  |
| productType                        | String   | Product type: `ALL`(default), `DP`, `MP`                                                                               |                  |
| fraudStatus                        | String   | Fraud Status: `ALL`, `UNVERIFIED`, `VERIFIED`, `FRAUD`                                                                 |                  |
| scrollId ⚠️                        | String   | Page cursor, empty for the first query. **Note:** valid time is 30 seconds. See [Scrollid important notes](#scrollid). |                  |
| campaignPartnerName **(New)**      | String   | Affiliate campaign partner                                                                                             |                  |
| campaignType **(New)**             | String   | Campaign Type: `ALL`(default), `Seller Open Campaign`, `Seller Target Campaign`, `MCN Campaign`, `Non-Seller Campaign` |                  |

#### Response Parameters

| Field    | Type                | Description      | Example |
| -------- | ------------------- | ---------------- | ------- |
| nodes    | [ConversionReport]! | Data list        |         |
| pageInfo | PageInfo!           | Page information |         |

#### ConversionReport Structure

| Field                                      | Type                     | Description                                                                                                                                                                | Example |
| ------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| purchaseTime                               | Int                      | Purchase Time                                                                                                                                                              |         |
| clickTime                                  | Int                      | Click Link Time                                                                                                                                                            |         |
| checkoutId _(To Be Removed)_               | Int64                    | Conversion id                                                                                                                                                              |         |
| conversionId                               | Int64                    | Conversion id                                                                                                                                                              |         |
| conversionStatus _(To Be Removed)_         | String                   | Conversion Status: `ALL`, `PENDING`, `COMPLETED`, `CANCELLED`                                                                                                              |         |
| grossCommission _(To Be Removed)_          | String                   | Gross Shopee Commission. Calculated Shopee commission before commission cap applies. Note: The unit is the local currency                                                  |         |
| cappedCommission _(To Be Removed)_         | String                   | Capped Shopee Commission. Calculated Shopee commission after commission cap applies. Note: The unit is the local currency                                                  |         |
| totalBrandCommission _(To Be Removed)_     | String                   | Total seller commission in one conversion. Note: The unit is the local currency                                                                                            |         |
| estimatedTotalCommission _(To Be Removed)_ | String                   | Gross Commission. Estimated total commission will be paid to you (before validation)                                                                                       |         |
| shopeeCommissionCapped                     | String                   | Gross Shopee Commission: Calculated Shopee commission after commission cap applies. Note: Amounts are denoted in local currency.                                           |         |
| sellerCommission                           | String                   | Gross Seller Commission: Calculated Seller commission. Note: Amounts are denoted in local currency.                                                                        |         |
| totalCommission                            | String                   | Gross commission from the seller and Shopee, after applying the commission cap but before deducting the MCN management fee. Note: Amounts are denoted in local currency.   |         |
| buyerType                                  | String                   | Buyer Status: `New` or `Existing`                                                                                                                                          |         |
| utmContent                                 | String                   | Sub id. Value(s) passed in your sub-id(s) parameter in your Affiliate link(s)                                                                                              |         |
| device                                     | String                   | Device type                                                                                                                                                                |         |
| referrer                                   | String                   | Referrer                                                                                                                                                                   |         |
| orders                                     | [ConversionReportOrder]! | Order list in conversion                                                                                                                                                   |         |
| linkedMcnName **(New)**                    | String                   | The name of MCN that affiliate has been linked with                                                                                                                        |         |
| mcnContractId **(New)**                    | Int64                    | The contract id between affiliate and linked MCN                                                                                                                           |         |
| mcnManagementFeeRate **(New)**             | String                   | The rate of the management fee allocated to the MCN, based on the gross commission                                                                                         |         |
| mcnManagementFee **(New)**                 | String                   | The management fee allocated to MCN based on total gross commission. Note: Amounts are denoted in local currency.                                                          |         |
| netCommission **(New)**                    | String                   | Net commission from the seller and Shopee, calculated after applying the commission cap and deducting the MCN management fee. Note: Amounts are denoted in local currency. |         |
| campaignType **(New)**                     | String                   | Campaign Type: `ALL`(default), `Seller Open Campaign`, `Seller Target Campaign`, `MCN Campaign`, `Non-Seller Campaign`                                                     |         |

#### ConversionReportOrder Structure

| Field       | Type                         | Description                                                                                                   | Example |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| orderId     | String                       | Order id                                                                                                      |         |
| orderStatus | String                       | Order Status: `UNPAID`, `PENDING`, `COMPLETED`, `CANCELLED`                                                   |         |
| shopType    | String                       | Shop type: `SHOPEE_MALL_CB`, `SHOPEE_MALL_NON_CB`, `C2C_CB`, `C2C_NON_CB`, `PREFERRED_CB`, `PREFERRED_NON_CB` |         |
| items       | [ConversionReportOrderItem]! | Item list in order                                                                                            |         |

#### ConversionReportOrderItem Structure

| Field                                  | Type   | Description                                                                                                                                                                      | Example |
| -------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| shopId                                 | Int64  | Shop id                                                                                                                                                                          |         |
| shopName                               | String | Shop name                                                                                                                                                                        |         |
| completeTime                           | Int    | Order completed time                                                                                                                                                             |         |
| itemId                                 | Int64  | Item id                                                                                                                                                                          |         |
| itemName                               | String | Item name                                                                                                                                                                        |         |
| itemPrice                              | String | Item price. Note: The unit is the local currency                                                                                                                                 |         |
| displayItemStatus **(New)**            | String | The combined status of order status and fraud status for item                                                                                                                    |         |
| actualAmount                           | String | Purchase Value: Paid item value of user when purchase. Excluded from rebates (vouchers, discounts, cashback, etc) and shipping fee. Note: Amounts are denoted in local currency. |         |
| qty                                    | Int    | Item Quantity                                                                                                                                                                    |         |
| imageUrl                               | String | Image url                                                                                                                                                                        |         |
| itemCommission _(To Be Removed)_       | String | Item Shopee Commission. Total Shopee platform commission in one item (before checkout cap). Note: The unit is the local currency                                                 |         |
| grossBrandCommission _(To Be Removed)_ | String | Item Brand Commission. Additional commission from Brand offers in one item. Note: The unit is the local currency                                                                 |         |
| itemTotalCommission                    | String | Total commission from seller and Shopee before MCN management fee deduction. Note: Amounts are denoted in local currency.                                                        |         |
| itemSellerCommission                   | String | Commission from Seller offers in one item. Note: Amounts are denoted in local currency.                                                                                          |         |
| itemSellerCommissionRate               | String | The rate of the commission offered by the seller                                                                                                                                 |         |
| itemShopeeCommissionCapped             | String | Shopee platform commission in one item (after order cap). Note: Amounts are denoted in local currency.                                                                           |         |
| itemShopeeCommissionRate               | String | The rate of the commission offered by Shopee                                                                                                                                     |         |
| itemNotes                              | String | Textual explanation of pending, cancel, and fraud status                                                                                                                         |         |
| channelType                            | String | Buyer order source channels                                                                                                                                                      |         |
| attributionType                        | String | Buyer order specific type                                                                                                                                                        |         |
| globalCategoryLv1Name                  | String | Level 1 global category name                                                                                                                                                     |         |
| globalCategoryLv2Name                  | String | Level 2 global category name                                                                                                                                                     |         |
| globalCategoryLv3Name                  | String | Level 3 global category name                                                                                                                                                     |         |
| refundAmount                           | String | Refund amount. Only for Digital Product, order confirmed received by user with partial refund                                                                                    |         |
| fraudStatus                            | String | Fraud status                                                                                                                                                                     |         |
| modelId                                | Int64  | Model id is the unique id per item variation                                                                                                                                     |         |
| promotionId                            | String | Promotion id is the unique id per bundle deal and add on deal items                                                                                                              |         |
| campaignPartnerName **(New)**          | String | The name of the campaign partner who initiated the MCN campaign                                                                                                                  |         |
| campaignType **(New)**                 | String | Campaign Type: `ALL`(default), `Seller Open Campaign`, `Seller Target Campaign`, `MCN Campaign`, `Non-Seller Campaign`                                                           |         |

#### PageInfo Structure (Conversion Report)

| Field       | Type   | Description                                                       | Example |
| ----------- | ------ | ----------------------------------------------------------------- | ------- |
| limit       | Int    | Number of data per page                                           | 20      |
| hasNextPage | Bool   | If it has next page                                               | true    |
| scrollId    | String | Page cursor, empty for the first query. Valid time is 30 seconds. |         |

---

### 2. Get Validated Report Data

- **Query:** `validatedReport`
- **ResultType:** `ValidatedReportConnection!`

#### Query Parameters

| Field                  | Type   | Description                                                                                                            | Example |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ------- |
| validationId **(New)** | Int64  | Validation id, can be found in Billing Information                                                                     |         |
| limit                  | Int    | The maximum number of return data                                                                                      |         |
| scrollId ⚠️            | String | Page cursor, empty for the first query. **Note:** valid time is 30 seconds. See [Scrollid important notes](#scrollid). |         |

#### Response Parameters

| Field    | Type               | Description      | Example |
| -------- | ------------------ | ---------------- | ------- |
| nodes    | [ValidatedReport]! | Data list        |         |
| pageInfo | PageInfo!          | Page information |         |

#### ValidatedReport Structure

| Field                          | Type                    | Description                                                                                                                         | Example |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| purchaseTime                   | Int                     | Purchase Time                                                                                                                       |         |
| clickTime                      | Int                     | Click Link Time                                                                                                                     |         |
| conversionId                   | Int64                   | Conversion id                                                                                                                       |         |
| shopeeCommissionCapped         | String                  | Gross Shopee Commission: Calculated Shopee commission after commission cap applies. Note: Amounts are denoted in local currency.    |         |
| sellerCommission               | String                  | Gross Seller Commission: Calculated Seller commission. Note: Amounts are denoted in local currency.                                 |         |
| totalCommission                | String                  | Gross Commission from Shopee and Seller after commission cap applies. Note: Amounts are denoted in local currency.                  |         |
| buyerType                      | String                  | Buyer Status: `New` or `Existing`                                                                                                   |         |
| utmContent                     | String                  | Sub id. Value(s) passed in your sub-id(s) parameter in your Affiliate link(s)                                                       |         |
| device                         | String                  | Device type                                                                                                                         |         |
| referrer                       | String                  | Referrer                                                                                                                            |         |
| orders                         | [ValidatedReportOrder]! | Order list in conversion                                                                                                            |         |
| linkedMcnName **(New)**        | String                  | The name of MCN that affiliate has been linked with                                                                                 |         |
| mcnContractId **(New)**        | String                  | The contract id between affiliate and linked MCN                                                                                    |         |
| mcnManagementFeeRate **(New)** | String                  | The rate of the management fee allocated to the MCN                                                                                 |         |
| mcnManagementFee **(New)**     | String                  | The management fee allocated to MCN. Note: Amounts are denoted in local currency.                                                   |         |
| netCommission **(New)**        | String                  | Net commission after applying the commission cap and deducting the MCN management fee. Note: Amounts are denoted in local currency. |         |
| campaignType **(New)**         | String                  | Campaign Type: `ALL`(default), `Seller Open Campaign`, `Seller Target Campaign`, `MCN Campaign`, `Non-Seller Campaign`              |         |

#### ValidatedReportOrder Structure

| Field       | Type                        | Description                                                                                                   | Example |
| ----------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| orderId     | String                      | Order id                                                                                                      |         |
| orderStatus | String                      | Order Status: `UNPAID`, `PENDING`, `COMPLETED`, `CANCELLED`                                                   |         |
| shopType    | String                      | Shop type: `SHOPEE_MALL_CB`, `SHOPEE_MALL_NON_CB`, `C2C_CB`, `C2C_NON_CB`, `PREFERRED_CB`, `PREFERRED_NON_CB` |         |
| items       | [ValidatedReportOrderItem]! | Item list in order                                                                                            |         |

#### ValidatedReportOrderItem Structure

| Field                         | Type   | Description                                                                                                            | Example |
| ----------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ------- |
| shopId                        | Int64  | Shop id                                                                                                                |         |
| shopName                      | String | Shop name                                                                                                              |         |
| completeTime                  | Int    | Affiliate Order Complete Time                                                                                          |         |
| itemId                        | Int64  | Item id                                                                                                                |         |
| itemName                      | String | Item name                                                                                                              |         |
| itemPrice                     | String | Item price. Note: The unit is the local currency                                                                       |         |
| displayItemStatus **(New)**   | String | The combined status of order status and fraud status for item                                                          |         |
| actualAmount                  | String | Purchase Value: Paid item value of user when purchase. Note: Amounts are denoted in local currency.                    |         |
| qty                           | Int    | Item Quantity. Note: It refers to adjusted item quantity for the Adjusted Orders.                                      |         |
| imageUrl                      | String | Image url                                                                                                              |         |
| itemTotalCommission           | String | Total commission from seller and Shopee. Note: Amounts are denoted in local currency.                                  |         |
| itemSellerCommission          | String | Commission from Seller offers in one item. Note: Amounts are denoted in local currency.                                |         |
| itemSellerCommissionRate      | String | The rate of the commission offered by the seller                                                                       |         |
| itemShopeeCommissionCapped    | String | Shopee platform commission in one item (after order cap). Note: Amounts are denoted in local currency.                 |         |
| itemShopeeCommissionRate      | String | The rate of the commission offered by Shopee                                                                           |         |
| itemNotes                     | String | Textual explanation of pending, cancel, and fraud status                                                               |         |
| channelType                   | String | Buyer order source channels                                                                                            |         |
| attributionType               | String | Buyer order specific type                                                                                              |         |
| globalCategoryLv1Name         | String | Level 1 global category name                                                                                           |         |
| globalCategoryLv2Name         | String | Level 2 global category name                                                                                           |         |
| globalCategoryLv3Name         | String | Level 3 global category name                                                                                           |         |
| refundAmount                  | String | Refund amount. Only for Digital Product                                                                                |         |
| fraudStatus                   | String | Fraud status                                                                                                           |         |
| modelId                       | Int64  | Model id is the unique id per item variation                                                                           |         |
| promotionId                   | String | Promotion id is the unique id per bundle deal and add on deal items                                                    |         |
| campaignPartnerName **(New)** | String | The name of the campaign partner                                                                                       |         |
| campaignType **(New)**        | String | Campaign Type: `ALL`(default), `Seller Open Campaign`, `Seller Target Campaign`, `MCN Campaign`, `Non-Seller Campaign` |         |

#### PageInfo Structure (Validated Report)

| Field       | Type   | Description                                                       | Example |
| ----------- | ------ | ----------------------------------------------------------------- | ------- |
| limit       | Int    | Number of data per page                                           | 20      |
| hasNextPage | Bool   | If it has next page                                               | true    |
| scrollId    | String | Page cursor, empty for the first query. Valid time is 30 seconds. |         |

---

## Common Error Codes

| Error Code | Error Description              | Remark                                                                             |
| ---------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| 10000      | System Error                   |                                                                                    |
| 10010      | Request parsing error          | Incorrect query syntax, incorrect field type, API does not exist                   |
| 10020      | Invalid Signature              |                                                                                    |
| 10020      | Your App has been disabled     |                                                                                    |
| 10020      | Request Expired                |                                                                                    |
| 10020      | Invalid Timestamp              |                                                                                    |
| 10020      | Invalid Credential             |                                                                                    |
| 10020      | Invalid Authorization Header   |                                                                                    |
| 10020      | Unsupported Auth Type          |                                                                                    |
| 10030      | Rate limit exceeded            |                                                                                    |
| 10031      | Access deny                    |                                                                                    |
| 10032      | Invalid affiliate id           |                                                                                    |
| 10033      | Account is frozen              |                                                                                    |
| 10034      | Affiliate id in black list     |                                                                                    |
| 10035      | No access to Open API Platform | Contact: https://help.shopee.co.th/portal/webform/c07a3cf32bfd4cd59f5c819d84583d4e |
| 11000      | Business Error                 |                                                                                    |
| 11001      | Params Error : {reason}        |                                                                                    |
| 11002      | Bind Account Error : {reason}  |                                                                                    |

---

## Quick Reference

### Endpoint

```
POST https://open-api.affiliate.shopee.co.th/graphql
Content-Type: application/json
```

### Authorization Header Format

```
Authorization: SHA256 Credential={AppId}, Timestamp={Timestamp}, Signature={SHA256(AppId + Timestamp + Payload + Secret)}
```

### API Explorer

🔗 <https://open-api.affiliate.shopee.co.th/explorer>

---

> _Document generated from Shopee Affiliate Open API screenshots — March 2026_
