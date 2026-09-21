/**
 * Sends one webhook delivery: prepares it against the tenant's own object, POSTs the
 * signed request, and settles the attempt with what came back. The queue's own retry
 * timing follows the row's own schedule exactly, because a `pending` settlement
 * retries this same message after the delay `settleDelivery` already chose rather
 * than a delay decided here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";

import type { PrepareDeliveryResult, SettleDeliveryOutcome } from "~/database/webhook-deliveries";

import jobs from "~/app/jobs";

/** How long one delivery attempt may take before it counts as a timeout. */
const DELIVERY_TIMEOUT_MS = 10_000;

/** How much of a failed attempt's own response body one settlement carries. */
const SNIPPET_LENGTH = 512;

export default createJobHandler(jobs.deliverWebhook, async (ctx) => {
	let stub = ctx.tenant.getByName(ctx.input.tenantId);

	let prepared = await stub.prepareDelivery({ deliveryId: ctx.input.deliveryId });
	if (!prepared.ok) {
		return ctx.ack(`Delivery ${ctx.input.deliveryId} is no longer pending (${prepared.reason}).`);
	}

	let startedAt = performance.now();
	let outcome = await attempt(prepared);
	let durationMs = Math.round(performance.now() - startedAt);

	let settled = await stub.settleDelivery({
		deliveryId: ctx.input.deliveryId,
		durationMs,
		now: Date.now(),
		...outcome,
	});

	if (!settled.ok) {
		return ctx.exit(`Delivery ${ctx.input.deliveryId} was gone by the time it settled.`);
	}

	ctx.log.set({
		delivery: { id: ctx.input.deliveryId, outcome: outcome.outcome, status: settled.status },
	});

	if (settled.status === "pending") {
		return ctx.retry({ delay: Math.max(0, settled.nextAttemptAt - Date.now()) });
	}
});

/**
 * Sends the signed request and classifies what came back: a 2xx is delivered, any
 * other status is an HTTP error carrying a snippet of the body, the delivery timeout
 * firing is a timeout, and anything else `fetch` throws is treated as a connection or
 * TLS failure, the only other bucket a delivery attempt can land in.
 */
async function attempt(
	prepared: Extract<PrepareDeliveryResult, { ok: true }>,
): Promise<SettleDeliveryOutcome> {
	let signal = AbortSignal.timeout(DELIVERY_TIMEOUT_MS);

	try {
		let response = await fetch(prepared.url, {
			method: "POST",
			headers: prepared.headers,
			body: prepared.body,
			signal,
		});

		if (response.ok) return { outcome: "delivered", status: response.status };

		return { outcome: "http_error", status: response.status, snippet: await readSnippet(response) };
	} catch (error) {
		if (signal.aborted) return { outcome: "timeout" };

		return {
			outcome: "tls_error",
			snippet: error instanceof Error ? error.message : String(error),
		};
	}
}

/** Reads a failed response's own body, without letting the read itself fail the delivery. */
async function readSnippet(response: Response): Promise<string | undefined> {
	try {
		let text = await response.text();
		return text.length > SNIPPET_LENGTH ? text.slice(0, SNIPPET_LENGTH) : text;
	} catch {
		return undefined;
	}
}
