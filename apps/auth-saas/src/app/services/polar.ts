import { Polar } from "@polar-sh/sdk";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { env } from "cloudflare:workers";

export { PolarError };

/**
 * Get a configured Polar SDK client.
 * Creates a new instance each time since env may not be available at module load.
 */
function getClient() {
	return new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
}

/**
 * Polar billing service for subscription and usage management.
 * Uses the official @polar-sh/sdk for type-safe API access.
 *
 * @see https://docs.polar.sh/api
 */
export default class PolarService {
	// ============================================================================
	// CUSTOMERS
	// ============================================================================

	/**
	 * Create a new customer in Polar.
	 */
	static async createCustomer(
		email: string,
		name: string | null,
		metadata: Record<string, string> = {},
	) {
		let client = getClient();
		return await client.customers.create({
			email,
			name: name ?? undefined,
			metadata,
		});
	}

	/**
	 * Get a customer by ID.
	 */
	static async getCustomer(customerId: string) {
		let client = getClient();
		return await client.customers.get({ id: customerId });
	}

	/**
	 * Update customer metadata.
	 */
	static async updateCustomer(
		customerId: string,
		updates: { name?: string; metadata?: Record<string, string> },
	) {
		let client = getClient();
		return await client.customers.update({
			id: customerId,
			customerUpdate: {
				name: updates.name,
				metadata: updates.metadata,
			},
		});
	}

	// ============================================================================
	// SUBSCRIPTIONS
	// ============================================================================

	/**
	 * Get a subscription by ID.
	 */
	static async getSubscription(subscriptionId: string) {
		let client = getClient();
		return await client.subscriptions.get({ id: subscriptionId });
	}

	/**
	 * List subscriptions for a customer.
	 */
	static async listSubscriptions(customerId: string) {
		let client = getClient();
		let result = await client.subscriptions.list({ customerId });
		let subscriptions = [];
		for await (let page of result) {
			subscriptions.push(...page.result.items);
		}
		return subscriptions;
	}

	/**
	 * Revoke a subscription (immediate cancellation).
	 */
	static async revokeSubscription(subscriptionId: string) {
		let client = getClient();
		return await client.subscriptions.revoke({ id: subscriptionId });
	}

	/**
	 * Cancel a subscription.
	 * @deprecated Use revokeSubscription instead
	 */
	static async cancelSubscription(subscriptionId: string) {
		return await PolarService.revokeSubscription(subscriptionId);
	}

	// ============================================================================
	// EVENTS (Usage-Based Billing)
	// ============================================================================

	/**
	 * Ingest events for usage-based billing.
	 * Used for reporting MAU counts.
	 */
	static async ingestEvents(
		events: Array<{
			customerId: string;
			name: string;
			metadata?: Record<string, string | number | boolean>;
			timestamp?: Date;
		}>,
	): Promise<void> {
		let client = getClient();
		await client.events.ingest({
			events: events.map((event) => ({
				customerId: event.customerId,
				name: event.name,
				metadata: event.metadata,
				timestamp: event.timestamp,
			})),
		});
	}

	/**
	 * Report MAU count for a tenant.
	 * This is called daily by the scheduled job.
	 */
	static async reportMAU(
		polarCustomerId: string,
		mauCount: number,
		tenantId: string,
		month: string,
	): Promise<void> {
		await PolarService.ingestEvents([
			{
				customerId: polarCustomerId,
				name: "mau",
				metadata: {
					tenant_id: tenantId,
					month,
					count: mauCount,
				},
			},
		]);
	}

	// ============================================================================
	// CHECKOUT
	// ============================================================================

	/**
	 * Create a checkout session for a new subscription.
	 * Returns the checkout URL to redirect the user to.
	 */
	static async createCheckoutSession(
		productId: string,
		customerId: string,
		successUrl: string,
		metadata: Record<string, string> = {},
	): Promise<{ url: string }> {
		let client = getClient();
		let checkout = await client.checkouts.create({
			products: [productId],
			customerId,
			successUrl,
			metadata,
		});
		return { url: checkout.url };
	}

	// ============================================================================
	// CUSTOMER PORTAL
	// ============================================================================

	/**
	 * Create a customer portal session.
	 * Returns the portal URL for the customer to manage their subscription.
	 */
	static async createPortalSession(customerId: string): Promise<{ url: string }> {
		let client = getClient();
		let session = await client.customerSessions.create({ customerId });
		return { url: session.customerPortalUrl };
	}
}
