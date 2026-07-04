import { Polar } from "@polar-sh/sdk";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { env } from "cloudflare:workers";

export { PolarError };

/**
 * Polar billing service for subscription and usage management.
 * Uses the official @polar-sh/sdk for type-safe API access.
 *
 * @see https://docs.polar.sh/api
 */
export default class PolarService {
	/**
	 * Get a configured Polar SDK client.
	 * @returns A new Polar client instance configured with the access token.
	 */
	static get client() {
		return new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
	}

	/**
	 * Create a new customer in Polar.
	 * @param email - The customer's email address.
	 * @param name - The customer's display name.
	 * @param metadata - Additional key-value pairs to store with the customer.
	 * @returns The created customer object.
	 */
	static async createCustomer(
		email: string,
		name: string | null,
		metadata: Record<string, string> = {},
	) {
		return await PolarService.client.customers.create({
			email,
			name: name ?? undefined,
			metadata,
		});
	}

	/**
	 * Get a customer by ID.
	 * @param customerId - The Polar customer ID.
	 * @returns The customer object.
	 */
	static async getCustomer(customerId: string) {
		return await PolarService.client.customers.get({ id: customerId });
	}

	/**
	 * Update customer information.
	 * @param customerId - The Polar customer ID.
	 * @param updates - The fields to update.
	 * @returns The updated customer object.
	 */
	static async updateCustomer(
		customerId: string,
		updates: { name?: string; metadata?: Record<string, string> },
	) {
		return await PolarService.client.customers.update({
			id: customerId,
			customerUpdate: {
				name: updates.name,
				metadata: updates.metadata,
			},
		});
	}

	/**
	 * Get a subscription by ID.
	 * @param subscriptionId - The Polar subscription ID.
	 * @returns The subscription object.
	 */
	static async getSubscription(subscriptionId: string) {
		return await PolarService.client.subscriptions.get({ id: subscriptionId });
	}

	/**
	 * List all subscriptions for a customer.
	 * @param customerId - The Polar customer ID.
	 * @returns An array of subscription objects.
	 */
	static async listSubscriptions(customerId: string) {
		let result = await PolarService.client.subscriptions.list({ customerId });
		let subscriptions = [];
		for await (let page of result) {
			subscriptions.push(...page.result.items);
		}
		return subscriptions;
	}

	/**
	 * Revoke a subscription immediately.
	 * @param subscriptionId - The Polar subscription ID.
	 * @returns The revoked subscription object.
	 */
	static async revokeSubscription(subscriptionId: string) {
		return await PolarService.client.subscriptions.revoke({ id: subscriptionId });
	}

	/**
	 * Cancel a subscription.
	 * @param subscriptionId - The Polar subscription ID.
	 * @returns The cancelled subscription object.
	 * @deprecated Use revokeSubscription instead.
	 */
	static async cancelSubscription(subscriptionId: string) {
		return await PolarService.revokeSubscription(subscriptionId);
	}

	/**
	 * Ingest usage events for billing.
	 * @param events - Array of events to ingest.
	 */
	static async ingestEvents(
		events: Array<{
			customerId: string;
			name: string;
			metadata?: Record<string, string | number | boolean>;
			timestamp?: Date;
		}>,
	): Promise<void> {
		await PolarService.client.events.ingest({
			events: events.map((event) => ({
				customerId: event.customerId,
				name: event.name,
				metadata: event.metadata,
				timestamp: event.timestamp,
			})),
		});
	}

	/**
	 * Report MAU count for a tenant. Called daily by the scheduled job.
	 * @param polarCustomerId - The Polar customer ID.
	 * @param mauCount - The monthly active user count.
	 * @param tenantId - The tenant identifier.
	 * @param month - The month being reported (YYYY-MM format).
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

	/**
	 * Create a checkout session for a new subscription.
	 * @param productId - The Polar product ID.
	 * @param customerId - The Polar customer ID.
	 * @param successUrl - URL to redirect to after successful checkout.
	 * @param metadata - Additional key-value pairs for the checkout.
	 * @returns Object containing the checkout URL.
	 */
	static async createCheckoutSession(
		productId: string,
		customerId: string,
		successUrl: string,
		metadata: Record<string, string> = {},
	): Promise<{ url: string }> {
		let checkout = await PolarService.client.checkouts.create({
			products: [productId],
			customerId,
			successUrl,
			metadata,
		});
		return { url: checkout.url };
	}

	/**
	 * Create a customer portal session for subscription management.
	 * @param customerId - The Polar customer ID.
	 * @returns Object containing the portal URL.
	 */
	static async createPortalSession(customerId: string): Promise<{ url: string }> {
		let session = await PolarService.client.customerSessions.create({ customerId });
		return { url: session.customerPortalUrl };
	}
}
