import { env } from "cloudflare:workers";

/**
 * Customer object from Polar API.
 */
interface PolarCustomer {
	id: string;
	email: string;
	name: string | null;
	metadata: Record<string, string>;
	created_at: string;
}

/**
 * Subscription object from Polar API.
 */
interface PolarSubscription {
	id: string;
	customer_id: string;
	product_id: string;
	status: "active" | "canceled" | "past_due" | "unpaid" | "incomplete";
	current_period_start: string;
	current_period_end: string;
	cancel_at_period_end: boolean;
	created_at: string;
}

/**
 * Meter event for usage-based billing.
 */
interface MeterEvent {
	customer_id: string;
	name: string;
	value: number;
	timestamp?: string;
	metadata?: Record<string, string>;
}

/**
 * Polar API error response.
 */
interface PolarError {
	type: string;
	detail: string;
}

/**
 * Polar billing service for subscription and usage management.
 * Requires POLAR_ACCESS_TOKEN environment variable.
 *
 * @see https://docs.polar.sh/api
 */
export default class PolarService {
	private static BASE_URL = "https://api.polar.sh/v1";

	static ApiError = class extends Error {
		override name = "PolarApiError";
		constructor(
			message: string,
			public statusCode: number,
			public type?: string,
		) {
			super(message);
		}
	};

	/**
	 * Make an authenticated request to Polar API.
	 */
	private static async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		let response = await fetch(`${PolarService.BASE_URL}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			let error: PolarError;
			try {
				error = (await response.json()) as PolarError;
			} catch {
				error = { type: "unknown", detail: response.statusText };
			}
			throw new PolarService.ApiError(error.detail, response.status, error.type);
		}

		return (await response.json()) as T;
	}

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
	): Promise<PolarCustomer> {
		return await PolarService.request<PolarCustomer>("POST", "/customers", {
			email,
			name,
			metadata,
		});
	}

	/**
	 * Get a customer by ID.
	 */
	static async getCustomer(customerId: string): Promise<PolarCustomer> {
		return await PolarService.request<PolarCustomer>("GET", `/customers/${customerId}`);
	}

	/**
	 * Update customer metadata.
	 */
	static async updateCustomer(
		customerId: string,
		updates: { name?: string; metadata?: Record<string, string> },
	): Promise<PolarCustomer> {
		return await PolarService.request<PolarCustomer>("PATCH", `/customers/${customerId}`, updates);
	}

	// ============================================================================
	// SUBSCRIPTIONS
	// ============================================================================

	/**
	 * Get a subscription by ID.
	 */
	static async getSubscription(subscriptionId: string): Promise<PolarSubscription> {
		return await PolarService.request<PolarSubscription>("GET", `/subscriptions/${subscriptionId}`);
	}

	/**
	 * List subscriptions for a customer.
	 */
	static async listSubscriptions(customerId: string): Promise<{ items: PolarSubscription[] }> {
		return await PolarService.request<{ items: PolarSubscription[] }>(
			"GET",
			`/subscriptions?customer_id=${customerId}`,
		);
	}

	/**
	 * Cancel a subscription at period end.
	 */
	static async cancelSubscription(subscriptionId: string): Promise<PolarSubscription> {
		return await PolarService.request<PolarSubscription>(
			"POST",
			`/subscriptions/${subscriptionId}/cancel`,
		);
	}

	// ============================================================================
	// METERS (Usage-Based Billing)
	// ============================================================================

	/**
	 * Report a meter event for usage-based billing.
	 * Used for reporting MAU counts.
	 */
	static async reportMeterEvent(event: MeterEvent): Promise<void> {
		await PolarService.request("POST", "/meters/events", {
			customer_id: event.customer_id,
			name: event.name,
			value: event.value,
			timestamp: event.timestamp ?? new Date().toISOString(),
			metadata: event.metadata,
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
		await PolarService.reportMeterEvent({
			customer_id: polarCustomerId,
			name: "mau",
			value: mauCount,
			metadata: {
				tenant_id: tenantId,
				month,
			},
		});
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
		return await PolarService.request<{ url: string }>("POST", "/checkouts/custom", {
			product_id: productId,
			customer_id: customerId,
			success_url: successUrl,
			metadata,
		});
	}

	// ============================================================================
	// CUSTOMER PORTAL
	// ============================================================================

	/**
	 * Create a customer portal session.
	 * Returns the portal URL for the customer to manage their subscription.
	 */
	static async createPortalSession(customerId: string): Promise<{ url: string }> {
		return await PolarService.request<{ url: string }>("POST", "/customer-portal/sessions", {
			customer_id: customerId,
		});
	}
}
