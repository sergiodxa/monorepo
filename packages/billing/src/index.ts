/**
 * Vendor-neutral billing: the models an app programs against, the provider
 * contract every platform is reached through, one failure type, the capability
 * check, page-at-a-time listing, and the webhook endpoint. Providers live
 * behind their own subpaths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	Billing,
	CatalogApi,
	CheckoutApi,
	CreateCheckoutInput,
	CreateCustomerInput,
	CreatePortalInput,
	CustomerApi,
	DiscountApi,
	EntitlementApi,
	ListCustomersQuery,
	ListDiscountsQuery,
	ListOrdersQuery,
	ListProductsQuery,
	ListSubscriptionsQuery,
	ListUsageQuery,
	MeterApi,
	MeterQuantityQuery,
	OrderApi,
	PortalApi,
	SubscriptionApi,
	UpdateCustomerInput,
	UsageApi,
	WebhookApi,
	WebhookReference,
} from "./core/contract.js";
export type { BillingErrorCode, BillingErrorOptions } from "./core/errors.js";
export type { Secret } from "./core/secret.js";
export type { OptionalCapability } from "./core/supports.js";
export type {
	BillingEvent,
	BillingEventPayload,
	BillingInterval,
	Checkout,
	CheckoutStatus,
	Cost,
	Currency,
	Customer,
	CustomerRef,
	Discount,
	DiscountKind,
	EntitlementState,
	EntitlementSubscription,
	MeterBalance,
	MeterQuantity,
	Money,
	Order,
	Page,
	PortalSession,
	Price,
	PriceKind,
	Product,
	Subscription,
	SubscriptionStatus,
	UsageEvent,
	UsageIngest,
	UsageMetadata,
	UsageRecord,
} from "./core/types.js";
export type {
	BillingEventOf,
	BillingEventType,
	BillingWebhookHandler,
	BillingWebhookHandlers,
	BillingWebhookOptions,
	WebhookDelivery,
	WebhookStore,
} from "./webhooks/index.js";

export { BillingError } from "./core/errors.js";
export { OPTIONAL_CAPABILITIES, supports } from "./core/supports.js";
export { DEFAULT_PAGE_SIZE, minorUnitDigits } from "./core/types.js";
export { BillingWebhook, MemoryWebhookStore } from "./webhooks/index.js";
