/**
 * Keeping a tenant's entitlement projection in step with the provider (ADR-018):
 * the webhook handlers `POST /webhooks/billing` dispatches to, the reprojection
 * they and a checkout return share, and the reconciliation sweep that catches a
 * missed delivery. Every path re-reads `entitlements.of()` and rewrites the
 * projection from that snapshot rather than diffing a payload, so a replayed,
 * reordered, or missed delivery all converge on the same state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	Billing,
	BillingEventOf,
	BillingWebhookHandlers,
	EntitlementState,
} from "@sdxc/billing";
import type { Database } from "remix/data-table";

import { isFailure, isSuccess } from "@sdxc/result";
import { env } from "cloudflare:workers";

import type { BillingCheckoutRow } from "~/app/models/billing-checkout";
import type { TenantRow } from "~/app/models/tenant";

import BillingCheckout from "~/app/models/billing-checkout";
import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import TenantAddon from "~/app/models/tenant-addon";
import TenantEntitlement from "~/app/models/tenant-entitlement";
import { PLANS } from "~/app/services/billing/catalog";

/** How long a projection may go unread before the sweep refreshes it. */
const STALE_PROJECTION_MS = 60 * 60 * 1000;

/** How long a `past_due` subscription keeps full access before it lapses. */
const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Finds the tenant a subscription id was recorded against, whether as its base
 * plan or as one of its add-ons.
 *
 * @param db - Database connection.
 * @param subscriptionId - The provider's own subscription id.
 * @returns The tenant it belongs to, or null when no tenant holds it yet.
 */
export async function resolveTenantForSubscription(
	db: Database,
	subscriptionId: string,
): Promise<TenantRow | null> {
	let tenant = await Tenant.findBySubscriptionId(db, subscriptionId);
	if (tenant) return tenant;

	let addon = await TenantAddon.findBySubscriptionId(db, subscriptionId);
	if (!addon) return null;

	return Tenant.findById(db, addon.tenant_id);
}

/**
 * Attaches a subscription a completed checkout produced to the tenant it was
 * opened for: as the tenant's base plan, or as a new add-on row. Idempotent, so
 * both the checkout-return route and the `checkout.completed` handler can call
 * it for the same checkout without producing two add-on rows.
 *
 * @param db - Database connection.
 * @param checkout - The checkout attempt row the subscription was opened for.
 * @param subscriptionId - The subscription the checkout produced.
 */
export async function attachCheckoutSubscription(
	db: Database,
	checkout: BillingCheckoutRow,
	subscriptionId: string,
): Promise<void> {
	if (checkout.kind === "base") {
		await Tenant.update(db, checkout.tenant_id, {
			subscriptionId,
			subscriptionStatus: "active",
		});
		return;
	}

	let existing = await TenantAddon.findBySubscriptionId(db, subscriptionId);
	if (existing) return;

	await TenantAddon.create(db, {
		tenantId: checkout.tenant_id,
		productSlug: checkout.product_slug,
		subscriptionId,
		status: "active",
		currentPeriodEnd: null,
	});
}

/**
 * Rewrites a tenant's entitlement projection from an entitlement snapshot: only
 * the subscriptions the tenant itself holds — its base plan plus its add-ons —
 * are kept, since the snapshot's own `features` map is the union across every
 * tenant the customer owns and cannot gate this one on its own.
 *
 * @param db - Database connection.
 * @param billing - The configured billing platform, for reading each held
 * product's features.
 * @param tenantId - The tenant to reproject.
 * @param snapshot - An already-read snapshot for this tenant's customer; read
 * fresh from `entitlements.of()` when omitted.
 */
export async function reprojectTenant(
	db: Database,
	billing: Billing,
	tenantId: string,
	snapshot?: EntitlementState,
): Promise<void> {
	let tenant = await Tenant.findById(db, tenantId);
	if (!tenant) return;

	if (snapshot === undefined) {
		let customer = await Customer.findById(db, tenant.customer_id);
		if (!customer || customer.provider_customer_id === null) return;

		let read = await billing.entitlements.of({ id: customer.provider_customer_id });
		if (isFailure(read)) return;

		snapshot = read.data;
	}

	let addons = await TenantAddon.listByTenant(db, tenant.id);
	let heldSubscriptionIds = new Set<string>();
	if (tenant.subscription_id !== null) heldSubscriptionIds.add(tenant.subscription_id);
	for (let addon of addons) heldSubscriptionIds.add(addon.subscription_id);

	let products: string[] = [];
	let features: Record<string, boolean> = {};

	for (let subscription of snapshot.subscriptions) {
		if (!heldSubscriptionIds.has(subscription.subscriptionId)) continue;
		if (subscription.productSlug === null) continue;
		if (subscription.status !== "active" && subscription.status !== "trialing") continue;

		products.push(subscription.productSlug);

		let product = await billing.catalog.find(subscription.productSlug);
		if (isSuccess(product)) Object.assign(features, product.data.features);
	}

	await TenantEntitlement.upsert(db, tenant.id, {
		products,
		features,
		readAt: snapshot.readAt.getTime(),
	});

	let plan = PLANS[tenant.plan_slug as keyof typeof PLANS] ?? PLANS.free;

	try {
		await env.TENANT.getByName(tenant.id).applyEntitlements({
			plan: tenant.plan_slug,
			features,
			dauCap: plan.dauCap,
			auditRetentionDays: plan.auditRetentionDays,
			effectiveAt: Date.now(),
		});
	} catch (error) {
		/**
		 * The projection write above already landed, so a tenant whose object
		 * cannot be reached right now still reads correctly from
		 * `tenant_entitlements`; only its object-side cap and retention window
		 * stay stale until the next successful projection, the same billing
		 * outage degradation this function already accepts for `read_at`.
		 */
		console.error("failed to push entitlements onto the tenant's object", error);
	}
}

/**
 * Reprojects every tenant belonging to the customer a subscription or order
 * event named, sharing the one entitlement read across all of them.
 */
async function reprojectCustomerTenants(
	db: Database,
	billing: Billing,
	providerCustomerId: string,
): Promise<void> {
	let customer = await Customer.findByProviderCustomerId(
		db,
		billing.connection,
		providerCustomerId,
	);
	if (!customer) return;

	let read = await billing.entitlements.of({ id: providerCustomerId });
	if (isFailure(read)) return;

	for (let tenant of await Tenant.listByCustomer(db, customer.id)) {
		await reprojectTenant(db, billing, tenant.id, read.data);
	}
}

/**
 * Builds the `BillingWebhookHandlers` map `POST /webhooks/billing` dispatches
 * to. Takes `db` and `billing` explicitly rather than closing over module-scope
 * singletons, so a test builds the same handlers against `MemoryBilling` and an
 * isolated database.
 *
 * @param db - Database connection.
 * @param billing - The configured billing platform.
 * @returns The handler map, keyed by delivery name.
 */
export function createBillingWebhookHandlers(
	db: Database,
	billing: Billing,
): BillingWebhookHandlers {
	return {
		async "checkout.completed"(event: BillingEventOf<"checkout.completed">) {
			let checkout = await BillingCheckout.findByCheckoutId(db, event.checkout.id);
			if (!checkout) return;

			if (event.checkout.subscriptionId !== null) {
				await attachCheckoutSubscription(db, checkout, event.checkout.subscriptionId);
			}

			await reprojectTenant(db, billing, checkout.tenant_id);
		},

		async "subscription.activated"(event: BillingEventOf<"subscription.activated">) {
			let subscription = event.subscription;
			let tenant = await resolveTenantForSubscription(db, subscription.id);

			if (!tenant) {
				/**
				 * The checkout that would have named this tenant went missing; the
				 * checkout's own metadata is the only remaining way to attach it, and
				 * attaches it as the base plan, which is the case this fallback exists
				 * for — an add-on whose checkout event was lost is left for the
				 * reconciliation sweep once its tenant is known some other way.
				 */
				let tenantId = subscription.metadata.tenant;
				if (tenantId === undefined) return;

				let candidate = await Tenant.findById(db, tenantId);
				if (!candidate || candidate.subscription_id !== null) return;

				tenant = candidate;
			}

			tenant = await Tenant.update(db, tenant.id, {
				subscriptionId: subscription.id,
				subscriptionStatus: subscription.status,
				currentPeriodEnd: subscription.currentPeriodEnd?.getTime() ?? null,
				cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			});

			await reprojectTenant(db, billing, tenant.id);
		},

		async "subscription.updated"(event: BillingEventOf<"subscription.updated">) {
			let subscription = event.subscription;
			let tenant = await resolveTenantForSubscription(db, subscription.id);
			if (!tenant) return;

			if (tenant.subscription_id === subscription.id) {
				let graceUntil = tenant.grace_until;

				if (subscription.status === "past_due" && graceUntil === null) {
					graceUntil = Date.now() + GRACE_PERIOD_MS;
				} else if (subscription.status === "active") {
					graceUntil = null;
				}

				await Tenant.update(db, tenant.id, {
					subscriptionStatus: subscription.status,
					currentPeriodEnd: subscription.currentPeriodEnd?.getTime() ?? null,
					cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
					graceUntil,
				});
			} else {
				let addon = await TenantAddon.findBySubscriptionId(db, subscription.id);
				if (addon) {
					await TenantAddon.update(db, addon.id, {
						status: subscription.status,
						currentPeriodEnd: subscription.currentPeriodEnd?.getTime() ?? null,
					});
				}
			}

			await reprojectTenant(db, billing, tenant.id);
		},

		async "subscription.canceled"(event: BillingEventOf<"subscription.canceled">) {
			let subscription = event.subscription;
			let tenant = await resolveTenantForSubscription(db, subscription.id);
			if (!tenant) return;

			if (tenant.subscription_id === subscription.id) {
				await Tenant.update(db, tenant.id, {
					subscriptionStatus: subscription.status,
					currentPeriodEnd: subscription.currentPeriodEnd?.getTime() ?? null,
					cancelAtPeriodEnd: true,
				});
			} else {
				let addon = await TenantAddon.findBySubscriptionId(db, subscription.id);
				if (addon) {
					await TenantAddon.update(db, addon.id, {
						status: subscription.status,
						currentPeriodEnd: subscription.currentPeriodEnd?.getTime() ?? null,
					});
				}
			}

			await reprojectTenant(db, billing, tenant.id);
		},

		async "subscription.revoked"(event: BillingEventOf<"subscription.revoked">) {
			let subscription = event.subscription;
			let tenant = await resolveTenantForSubscription(db, subscription.id);
			if (!tenant) return;

			if (tenant.subscription_id === subscription.id) {
				await Tenant.update(db, tenant.id, {
					subscriptionStatus: subscription.status,
					lapsedAt: tenant.lapsed_at ?? Date.now(),
				});
			} else {
				let addon = await TenantAddon.findBySubscriptionId(db, subscription.id);
				if (addon) {
					await TenantAddon.update(db, addon.id, {
						status: subscription.status,
						currentPeriodEnd: addon.current_period_end,
					});
				}
			}

			await reprojectTenant(db, billing, tenant.id);

			/**
			 * The day-45 and day-59 deletion notices ADR-018 calls for once a tenant
			 * has lapsed are deferred here — a separate, sizeable chunk of
			 * transactional email work, not sent from this handler yet.
			 */
		},

		async "order.paid"(event: BillingEventOf<"order.paid">) {
			let customerId = event.order.customerId;
			if (customerId === null) return;

			let customer = await Customer.findByProviderCustomerId(db, billing.connection, customerId);
			if (customer) {
				for (let tenant of await Tenant.listByCustomer(db, customer.id)) {
					if (tenant.grace_until !== null) await Tenant.update(db, tenant.id, { graceUntil: null });
				}
			}

			await reprojectCustomerTenants(db, billing, customerId);
		},

		async "order.refunded"(event: BillingEventOf<"order.refunded">) {
			let customerId = event.order.customerId;
			if (customerId === null) return;

			await reprojectCustomerTenants(db, billing, customerId);
		},

		async "customer.updated"(event: BillingEventOf<"customer.updated">) {
			/**
			 * `customers` keeps no email column of its own — ADR-018 only adds the
			 * provider join columns — so there is nothing local to overwrite here;
			 * re-running the projection is what keeps a plan or feature change that
			 * coincided with this delivery in step.
			 */
			await reprojectCustomerTenants(db, billing, event.customer.id);
		},
	};
}

/**
 * Refreshes every entitlement projection last read more than an hour ago,
 * catching a delivery the webhook endpoint never received. Safe to call
 * repeatedly and from anywhere: each row re-reads `entitlements.of()` the same
 * way a handler does.
 *
 * @param db - Database connection.
 * @param billing - The configured billing platform.
 * @param options - `olderThanMs` overrides the one-hour staleness window;
 * `now` overrides the clock, for tests.
 * @returns How many stale projections were refreshed.
 */
export async function sweepStaleProjections(
	db: Database,
	billing: Billing,
	options: { olderThanMs?: number; now?: number } = {},
): Promise<{ swept: number }> {
	let now = options.now ?? Date.now();
	let cutoff = now - (options.olderThanMs ?? STALE_PROJECTION_MS);

	let stale = await TenantEntitlement.listStale(db, cutoff);

	for (let row of stale) await reprojectTenant(db, billing, row.tenant_id);

	return { swept: stale.length };
}
