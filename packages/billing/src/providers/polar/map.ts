/**
 * The mapping from Polar's wire shapes onto our own models: every parse, every
 * vocabulary translation, and the slug lookup that keeps Polar's identifiers out
 * of a call site. A shape or a status with no mapping here is reported, not passed on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";

import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { BillingError } from "../../core/errors";
import type {
	BillingInterval,
	Checkout,
	CheckoutStatus,
	Cost,
	Customer,
	Discount,
	EntitlementState,
	EntitlementSubscription,
	MeterBalance,
	MeterQuantity,
	Money,
	Order,
	PortalSession,
	Price,
	PriceKind,
	Product,
	Subscription,
	SubscriptionStatus,
	UsageMetadata,
	UsageRecord,
} from "../../core/types";

import { reportSkipped } from "../../core/errors";

import { toMappingError } from "./errors";
import {
	CHECKOUT_SCHEMA,
	COST_METADATA_SCHEMA,
	CUSTOMER_SCHEMA,
	CUSTOMER_SESSION_SCHEMA,
	CUSTOMER_STATE_SCHEMA,
	DISCOUNT_SCHEMA,
	EVENT_SCHEMA,
	METER_QUANTITIES_SCHEMA,
	ORDER_SCHEMA,
	PRODUCT_SCHEMA,
	SUBSCRIPTION_SCHEMA,
} from "./schemas";

/**
 * Our vocabulary for each state Polar keeps a subscription in, declared as data
 * so a state Polar adds is a visible omission. `revoked` covers the states
 * Polar ends a subscription in without the customer asking.
 */
const SUBSCRIPTION_STATUSES: Readonly<Record<string, SubscriptionStatus>> = {
	incomplete: "incomplete",
	incomplete_expired: "revoked",
	trialing: "trialing",
	active: "active",
	past_due: "past_due",
	canceled: "canceled",
	unpaid: "revoked",
};

/**
 * Our vocabulary for each state Polar keeps a checkout in. A confirmed session
 * has produced what it was opened for, so it reads as completed.
 */
const CHECKOUT_STATUSES: Readonly<Record<string, CheckoutStatus>> = {
	open: "open",
	confirmed: "completed",
	succeeded: "completed",
	expired: "expired",
	failed: "failed",
};

/** Basis points in one whole percent, which is how Polar states a percentage discount. */
const BASIS_POINTS_PER_PERCENT = 100;

/** Metadata keys Polar reserves for a structured value, read as a cost rather than a scalar. */
const RESERVED_METADATA_KEYS: readonly string[] = ["_cost", "_llm"];

/** Fields of a checkout that authorize acting on it, so they stay out of a stored payload. */
const CHECKOUT_REDACTIONS: readonly string[] = ["client_secret", "customer_ip_address"];

/** Fields of a session that authorize acting as the customer. */
const SESSION_REDACTIONS: readonly string[] = ["token"];

/**
 * What the mapping needs beyond the payload: the connection to name in a
 * failure, and the configured slugs Polar's identifiers are translated through.
 */
export interface PolarMapping {
	connection: string;
	/** Our product slug for each configured Polar product id. */
	products: ReadonlyMap<string, string>;
	/** Our meter slug for each configured Polar meter id. */
	meters: ReadonlyMap<string, string>;
	/** Our feature slug for each configured Polar benefit id. */
	features: ReadonlyMap<string, string>;
}

/** Keeps Polar's own payload beside our model, with anything that authorizes a call removed. */
function providerDataOf(
	raw: unknown,
	redactions: readonly string[] = [],
): Readonly<Record<string, unknown>> {
	if (typeof raw !== "object" || raw === null) return {};

	return Object.fromEntries(
		Object.entries(raw as Record<string, unknown>).filter(([key]) => !redactions.includes(key)),
	);
}

/** Reads a Polar payload through its schema, reporting a shape with no mapping. */
function read<Output>(
	schema: Schema<unknown, Output>,
	raw: unknown,
	mapping: PolarMapping,
	what: string,
): Result<Output, BillingError> {
	let parsed = s.parseSafe(schema, raw);
	if (parsed.success) return success(parsed.value);

	let issues = parsed.issues.map((issue) => issue.message).join("; ");

	return failure(toMappingError(mapping.connection, `unmappable Polar ${what}: ${issues}`));
}

/**
 * Translates a Polar product id into our own slug. A product the connection was
 * not configured with is reported, since a call site addresses the catalog by
 * slug and a projection written from a guess is worse than a failed read.
 */
function slugOf(productId: string, mapping: PolarMapping): Result<string, BillingError> {
	let slug = mapping.products.get(productId);
	if (slug !== undefined) return success(slug);

	return failure(
		toMappingError(
			mapping.connection,
			`Polar product ${productId} is not in this connection's configured catalog`,
		),
	);
}

/** Translates a Polar subscription state into ours, reporting one with no mapping. */
function statusOf(status: string, mapping: PolarMapping): Result<SubscriptionStatus, BillingError> {
	let mapped = SUBSCRIPTION_STATUSES[status];
	if (mapped !== undefined) return success(mapped);

	return failure(
		toMappingError(mapping.connection, `Polar subscription status "${status}" has no mapping`),
	);
}

/** Turns a Polar amount into money, which every Polar endpoint states in minor units. */
function moneyOf(
	amount: number | null | undefined,
	currency: string | null | undefined,
): Money | null {
	if (amount === null || amount === undefined) return null;
	if (currency === null || currency === undefined) return null;

	return { amount, currency };
}

/** Reads a Polar metadata bag as text, which is what our models carry. */
function metadataOf(
	bag: Record<string, string | number | boolean> | undefined,
): Record<string, string> {
	return Object.fromEntries(Object.entries(bag ?? {}).map(([key, value]) => [key, String(value)]));
}

/**
 * Reads what a price charges. Recurrence lives on the product rather than the
 * price, so a fixed price is recurring exactly when its product is.
 */
function kindOf(amountType: string, recurring: boolean): PriceKind {
	if (amountType === "metered_unit") return "metered";
	return recurring ? "recurring" : "one_time";
}

/**
 * Maps one way to buy a product. A pay-what-you-want or free price carries no
 * amount, since what the customer pays is settled at the hosted page.
 */
function priceOf(
	price: {
		id: string;
		amount_type: string;
		price_amount?: number | null;
		price_currency?: string | null;
		meter_id?: string | null;
	},
	recurring: boolean,
	interval: BillingInterval | null,
	mapping: PolarMapping,
): Price {
	let kind = kindOf(price.amount_type, recurring);

	return {
		id: price.id,
		kind,
		interval: kind === "recurring" ? interval : null,
		amount:
			price.amount_type === "fixed" ? moneyOf(price.price_amount, price.price_currency) : null,
		meter:
			price.meter_id === null || price.meter_id === undefined
				? null
				: (mapping.meters.get(price.meter_id) ?? null),
		providerData: providerDataOf(price),
	};
}

/**
 * Maps a customer. A team customer bills through its owner member rather than an
 * address of its own, so its email is absent and the record stays readable.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our customer, or the mapping failure the payload produced.
 */
export function mapCustomer(raw: unknown, mapping: PolarMapping): Result<Customer, BillingError> {
	let parsed = read(CUSTOMER_SCHEMA, raw, mapping, "customer");
	if (isFailure(parsed)) return parsed;

	let customer = parsed.data;

	return success({
		id: customer.id,
		externalId: customer.external_id ?? null,
		email: customer.email ?? null,
		name: customer.name ?? null,
		metadata: metadataOf(customer.metadata),
		createdAt: customer.created_at,
		providerData: providerDataOf(raw),
	});
}

/**
 * Maps a product, addressed by our own slug.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our product, or the mapping failure the payload produced.
 */
export function mapProduct(raw: unknown, mapping: PolarMapping): Result<Product, BillingError> {
	let parsed = read(PRODUCT_SCHEMA, raw, mapping, "product");
	if (isFailure(parsed)) return parsed;

	let product = parsed.data;

	let slug = slugOf(product.id, mapping);
	if (isFailure(slug)) return slug;

	let recurring = product.is_recurring ?? product.recurring_interval !== null;
	let interval = product.recurring_interval ?? null;

	let features: Record<string, boolean> = {};
	for (let benefit of product.benefits ?? []) {
		let feature = mapping.features.get(benefit.id);
		if (feature !== undefined) features[feature] = true;
	}

	return success({
		id: product.id,
		slug: slug.data,
		name: product.name,
		description: product.description ?? null,
		prices: (product.prices ?? []).map((price) => priceOf(price, recurring, interval, mapping)),
		features,
		archived: product.is_archived ?? false,
		createdAt: product.created_at,
		providerData: providerDataOf(raw),
	});
}

/**
 * Maps a hosted checkout session.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our session, or the mapping failure the payload produced.
 */
export function mapCheckout(raw: unknown, mapping: PolarMapping): Result<Checkout, BillingError> {
	let parsed = read(CHECKOUT_SCHEMA, raw, mapping, "checkout");
	if (isFailure(parsed)) return parsed;

	let checkout = parsed.data;

	if (checkout.product_id === null || checkout.product_id === undefined) {
		return failure(
			toMappingError(mapping.connection, `Polar checkout ${checkout.id} names no product`),
		);
	}

	let slug = slugOf(checkout.product_id, mapping);
	if (isFailure(slug)) return slug;

	let status = CHECKOUT_STATUSES[checkout.status];
	if (status === undefined) {
		return failure(
			toMappingError(
				mapping.connection,
				`Polar checkout status "${checkout.status}" has no mapping`,
			),
		);
	}

	return success({
		id: checkout.id,
		url: checkout.url,
		status,
		productSlug: slug.data,
		customerId: checkout.customer_id ?? null,
		customerExternalId: checkout.external_customer_id ?? null,
		amount: moneyOf(checkout.total_amount, checkout.currency),
		discountId: checkout.discount_id ?? null,
		subscriptionId: checkout.subscription_id ?? null,
		orderId: null,
		expiresAt: checkout.expires_at ?? null,
		createdAt: checkout.created_at,
		providerData: providerDataOf(raw, CHECKOUT_REDACTIONS),
	});
}

/**
 * Maps a subscription.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our subscription, or the mapping failure the payload produced.
 */
export function mapSubscription(
	raw: unknown,
	mapping: PolarMapping,
): Result<Subscription, BillingError> {
	let parsed = read(SUBSCRIPTION_SCHEMA, raw, mapping, "subscription");
	if (isFailure(parsed)) return parsed;

	let subscription = parsed.data;

	let slug = slugOf(subscription.product_id, mapping);
	if (isFailure(slug)) return slug;

	let status = statusOf(subscription.status, mapping);
	if (isFailure(status)) return status;

	return success({
		id: subscription.id,
		customerId: subscription.customer_id,
		productSlug: slug.data,
		priceId: subscription.prices?.at(0)?.id ?? null,
		status: status.data,
		providerStatus: subscription.status,
		amount: moneyOf(subscription.amount, subscription.currency),
		interval: subscription.recurring_interval ?? null,
		currentPeriodStart: subscription.current_period_start ?? null,
		currentPeriodEnd: subscription.current_period_end ?? null,
		cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
		canceledAt: subscription.canceled_at ?? null,
		endsAt: subscription.ends_at ?? null,
		metadata: metadataOf(subscription.metadata),
		createdAt: subscription.created_at,
		providerData: providerDataOf(raw),
	});
}

/**
 * Maps a paid purchase.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our order, or the mapping failure the payload produced.
 */
export function mapOrder(raw: unknown, mapping: PolarMapping): Result<Order, BillingError> {
	let parsed = read(ORDER_SCHEMA, raw, mapping, "order");
	if (isFailure(parsed)) return parsed;

	let order = parsed.data;
	let slug: string | null = null;

	if (order.product_id !== null && order.product_id !== undefined) {
		let resolved = slugOf(order.product_id, mapping);
		if (isFailure(resolved)) return resolved;
		slug = resolved.data;
	}

	let refunded = order.refunded_amount ?? 0;

	return success({
		id: order.id,
		customerId: order.customer_id,
		customerEmail: order.customer?.email ?? null,
		customerExternalId: order.customer?.external_id ?? null,
		productSlug: slug,
		subscriptionId: order.subscription_id ?? null,
		total: { amount: order.total_amount, currency: order.currency },
		subtotal: { amount: order.subtotal_amount, currency: order.currency },
		tax: moneyOf(order.tax_amount, order.currency),
		discountId: order.discount_id ?? null,
		paid: order.paid ?? false,
		refunded: refunded > 0 ? { amount: refunded, currency: order.currency } : null,
		createdAt: order.created_at,
		providerData: providerDataOf(raw),
	});
}

/**
 * Maps a discount. Polar scopes one to products by id, so a scope entry this
 * connection has no slug for is dropped from `productSlugs` while the rest
 * stand, which keeps a discount scoped elsewhere from reading as applying
 * everywhere. A discount whose whole scope is unconfigured applies to nothing
 * here and is reported instead.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our discount, or the mapping failure the payload produced.
 */
export function mapDiscount(raw: unknown, mapping: PolarMapping): Result<Discount, BillingError> {
	let parsed = read(DISCOUNT_SCHEMA, raw, mapping, "discount");
	if (isFailure(parsed)) return parsed;

	let discount = parsed.data;
	let slugs: string[] = [];
	let unconfigured: string[] = [];

	for (let product of discount.products ?? []) {
		let slug = mapping.products.get(product.id);
		if (slug === undefined) unconfigured.push(product.id);
		else slugs.push(slug);
	}

	if (slugs.length === 0 && unconfigured.length > 0) {
		return failure(
			toMappingError(
				mapping.connection,
				`Polar discount ${discount.id} is scoped to products outside this connection's configured catalog: ${unconfigured.join(", ")}`,
			),
		);
	}

	if (unconfigured.length > 0) {
		reportSkipped(
			mapping.connection,
			`discount=${discount.id} products=${unconfigured.join(",")} reason=unconfigured_product`,
		);
	}

	let basisPoints = discount.basis_points ?? null;

	return success({
		id: discount.id,
		code: discount.code ?? null,
		name: discount.name,
		kind: discount.type === "percentage" ? "percentage" : "fixed",
		percentage: basisPoints === null ? null : basisPoints / BASIS_POINTS_PER_PERCENT,
		amount: moneyOf(discount.amount, discount.currency),
		productSlugs: slugs,
		maxRedemptions: discount.max_redemptions ?? null,
		redemptions: discount.redemptions_count ?? 0,
		startsAt: discount.starts_at ?? null,
		endsAt: discount.ends_at ?? null,
		createdAt: discount.created_at,
		providerData: providerDataOf(raw),
	});
}

/** Reads the cost Polar carries under a reserved metadata key, as a decimal string. */
function costOf(metadata: Record<string, unknown> | undefined): Cost | null {
	let parsed = s.parseSafe(COST_METADATA_SCHEMA, metadata?._cost);
	if (!parsed.success) return null;

	return { amount: String(parsed.value.amount), currency: parsed.value.currency };
}

/** Reads the metadata a caller sent, leaving Polar's reserved keys to their own readers. */
function usageMetadataOf(metadata: Record<string, unknown> | undefined): UsageMetadata {
	let entries = Object.entries(metadata ?? {}).filter(
		([key, value]) =>
			!RESERVED_METADATA_KEYS.includes(key) &&
			(typeof value === "string" || typeof value === "number" || typeof value === "boolean"),
	);

	return Object.fromEntries(entries) as UsageMetadata;
}

/**
 * Maps an ingested usage event as Polar stored it.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our record, or the mapping failure the payload produced.
 */
export function mapUsageRecord(
	raw: unknown,
	mapping: PolarMapping,
): Result<UsageRecord, BillingError> {
	let parsed = read(EVENT_SCHEMA, raw, mapping, "event");
	if (isFailure(parsed)) return parsed;

	let event = parsed.data;

	return success({
		id: event.id,
		name: event.name,
		customerId: event.customer_id ?? null,
		customerExternalId: event.external_customer_id ?? null,
		externalId: event.external_id ?? null,
		timestamp: event.timestamp,
		metadata: usageMetadataOf(event.metadata),
		cost: costOf(event.metadata),
		providerData: providerDataOf(raw),
	});
}

/**
 * Maps the session a customer manages their billing through.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our session, or the mapping failure the payload produced.
 */
export function mapPortalSession(
	raw: unknown,
	mapping: PolarMapping,
): Result<PortalSession, BillingError> {
	let parsed = read(CUSTOMER_SESSION_SCHEMA, raw, mapping, "customer session");
	if (isFailure(parsed)) return parsed;

	return success({
		url: parsed.data.customer_portal_url,
		expiresAt: parsed.data.expires_at ?? null,
		providerData: providerDataOf(raw, SESSION_REDACTIONS),
	});
}

/** The window and the meter a quantity read was asked about, which the answer omits. */
export interface MeterReadContext {
	meter: string;
	customerId: string | null;
	from: Date | null;
	to: Date | null;
}

/**
 * Maps a meter read, reporting the total over the window asked about while the
 * buckets stay in the platform payload.
 *
 * @param raw - The payload as Polar answered with it.
 * @param context - The meter, customer, and window the read was asked about.
 * @param mapping - The connection and its configured slugs.
 * @returns Our reading, or the mapping failure the payload produced.
 */
export function mapMeterQuantity(
	raw: unknown,
	context: MeterReadContext,
	mapping: PolarMapping,
): Result<MeterQuantity, BillingError> {
	let parsed = read(METER_QUANTITIES_SCHEMA, raw, mapping, "meter quantities");
	if (isFailure(parsed)) return parsed;

	return success({
		meter: context.meter,
		customerId: context.customerId,
		quantity: parsed.data.total,
		cost: null,
		from: context.from,
		to: context.to,
		providerData: providerDataOf(raw),
	});
}

/**
 * Maps the snapshot of what a customer holds right now: the products their
 * entitling subscriptions grant, the feature flags this connection is
 * configured to read, and the balance of every configured meter.
 *
 * @param raw - The payload as Polar answered with it.
 * @param mapping - The connection and its configured slugs.
 * @returns Our snapshot, or the mapping failure the payload produced.
 */
export function mapEntitlementState(
	raw: unknown,
	mapping: PolarMapping,
): Result<EntitlementState, BillingError> {
	let parsed = read(CUSTOMER_STATE_SCHEMA, raw, mapping, "customer state");
	if (isFailure(parsed)) return parsed;

	let state = parsed.data;
	let products: string[] = [];
	let subscriptions: EntitlementSubscription[] = [];

	for (let active of state.active_subscriptions ?? []) {
		let slug = mapping.products.get(active.product_id);

		if (slug === undefined) {
			reportSkipped(
				mapping.connection,
				`subscription=${active.id} product=${active.product_id} reason=unconfigured_product`,
			);
			continue;
		}

		let status = statusOf(active.status, mapping);
		if (isFailure(status)) return status;

		if (!products.includes(slug)) products.push(slug);

		subscriptions.push({
			subscriptionId: active.id,
			productSlug: slug,
			status: status.data,
			currentPeriodStart: active.current_period_start ?? null,
			currentPeriodEnd: active.current_period_end ?? null,
			cancelAtPeriodEnd: active.cancel_at_period_end ?? false,
		});
	}

	let features: Record<string, boolean> = {};
	for (let granted of state.granted_benefits ?? []) {
		let feature = mapping.features.get(granted.benefit_id);
		if (feature !== undefined) features[feature] = true;
	}

	let meters: MeterBalance[] = [];
	for (let active of state.active_meters ?? []) {
		let meter = mapping.meters.get(active.meter_id);
		if (meter === undefined) continue;

		meters.push({
			meter,
			credited: active.credited_units,
			consumed: active.consumed_units,
			balance: active.balance,
		});
	}

	return success({
		customerId: state.id,
		externalId: state.external_id ?? null,
		products,
		features,
		meters,
		subscriptions,
		readAt: new Date(),
		providerData: providerDataOf(raw),
	});
}
