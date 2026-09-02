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
} from "./core/contract";
export type { BillingErrorCode, BillingErrorOptions } from "./core/errors";
export type { OptionalCapability } from "./core/supports";
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
} from "./core/types";
export type {
	BillingEventOf,
	BillingEventType,
	BillingWebhookHandler,
	BillingWebhookHandlers,
	BillingWebhookOptions,
	WebhookDelivery,
	WebhookLogger,
	WebhookStore,
} from "./webhooks";

export { BillingError } from "./core/errors";
export { OPTIONAL_CAPABILITIES, supports } from "./core/supports";
export { DEFAULT_PAGE_SIZE, minorUnitDigits } from "./core/types";
export { BillingWebhook, MemoryWebhookStore } from "./webhooks";
