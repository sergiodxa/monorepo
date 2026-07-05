import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks.js";
import { env } from "cloudflare:workers";

/**
 * Thin Polar billing client for the account-level subscription (base fee +
 * metered page-view overage). Checkout and the customer portal are Polar-hosted;
 * usage is ingested per blog-day by the reporting cron.
 *
 * Note: this is the integration surface — the meter/product/credits must be
 * configured in Polar (see ADR-009 Billing). Methods are best-effort against the
 * Polar REST API and tolerate failure so the cron can retry.
 */
export class PolarService {
	private base = "https://api.polar.sh/v1";

	private headers(): HeadersInit {
		return {
			authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
			"content-type": "application/json",
		};
	}

	/** Creates a hosted checkout for an account and returns its URL. */
	async createCheckout(accountId: string, successUrl: string): Promise<string | null> {
		let response = await fetch(`${this.base}/checkouts`, {
			method: "POST",
			headers: this.headers(),
			body: JSON.stringify({
				product_id: env.POLAR_PRODUCT_ID,
				success_url: successUrl,
				metadata: { account_id: accountId },
			}),
		});
		if (!response.ok) return null;
		let data = (await response.json()) as { url?: string };
		return data.url ?? null;
	}

	/** Returns a customer-portal URL for managing payment/cancellation/invoices. */
	async portalUrl(customerId: string): Promise<string | null> {
		let response = await fetch(`${this.base}/customer-sessions`, {
			method: "POST",
			headers: this.headers(),
			body: JSON.stringify({ customer_id: customerId }),
		});
		if (!response.ok) return null;
		let data = (await response.json()) as { customer_portal_url?: string };
		return data.customer_portal_url ?? null;
	}

	/** Ingests a page-view meter event for a customer (idempotency handled upstream). */
	async ingestPageViews(customerId: string, views: number, day: string): Promise<boolean> {
		let response = await fetch(`${this.base}/events/ingest`, {
			method: "POST",
			headers: this.headers(),
			body: JSON.stringify({
				events: [
					{
						name: "page_views",
						customer_id: customerId,
						metadata: { views, day },
					},
				],
			}),
		});
		return response.ok;
	}

	/**
	 * Verifies a Polar webhook against `POLAR_WEBHOOK_SECRET` using the Standard
	 * Webhooks scheme (`webhook-id`/`webhook-timestamp`/`webhook-signature` headers).
	 * Fails closed: an unset secret or an invalid signature returns `false`.
	 * @param request - The incoming webhook request (for its headers).
	 * @param body - The raw request body used to compute the signature.
	 */
	verifyWebhook(request: Request, body: string): boolean {
		let secret = env.POLAR_WEBHOOK_SECRET;
		if (!secret) return false;

		let headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		try {
			validateEvent(body, headers, secret);
			return true;
		} catch (error) {
			if (error instanceof WebhookVerificationError) return false;
			// The signature verified but the SDK could not type the event (e.g. an event
			// type it does not model); the security boundary passed, so accept it.
			return true;
		}
	}
}
