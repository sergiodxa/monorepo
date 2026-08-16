/**
 * Polar webhook controller. Verifies the Standard-Webhooks signature and, on a paid
 * order, tags the buyer in Buttondown with the tier they bought so the newsletter can
 * segment on it. Polar retries on any non-2xx, so every failure here is returned as a
 * 400 the retry can succeed against, and a genuine success is a genuine 200.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Logger } from "@pkg/logger/request";
import type { Result } from "@pkg/result";

import { json } from "@pkg/http/response";
import { BadRequest, Ok } from "@pkg/http/status-code";
import { PolarClient } from "@pkg/polar";
import { failure, isFailure, success } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { Product } from "~/app/data/product";
import { Buttondown } from "~/app/services/buttondown";
import routes from "~/routes/web";

/** The Buttondown metadata values that drive purchase segmentation. */
const TIERS: Record<string, string> = {
	[Product.Complete]: "complete",
	[Product.Essentials]: "individual",
};

/**
 * Verifies and handles one webhook delivery.
 *
 * @param request - The incoming webhook request, for its signature headers and raw body.
 * @param log - The request logger, so the outcome lands in the same trace as the request.
 * @returns `success` when the delivery was handled, `failure` with the reason otherwise.
 * The webhook secret never reaches the logs or the response: only the signature verdict
 * does.
 */
async function processWebhook(request: Request, log: Logger): Promise<Result<"OK", Error>> {
	let polar = getServiceContainer().get(PolarClient);
	let parsed = await polar.parseWebhook(request, await request.text(), env.POLAR_WEBHOOK_SECRET);

	if (isFailure(parsed)) return failure(parsed.error);

	let event = parsed.data;

	if (event.type !== "order.paid") return success("OK");

	if (!event.data.product) return failure(new Error("Product is required"));
	if (!event.data.customer.email) return failure(new Error("Customer email is required"));

	let productId = event.data.product.id;
	let productName = event.data.product.name;
	let customerEmail = event.data.customer.email;

	try {
		let buttondown = getServiceContainer().get(Buttondown);

		/**
		 * Only an existing subscriber is tagged. Someone who bought without ever joining
		 * the newsletter is recorded in the log and otherwise left alone — subscribing
		 * them here would add an address that never opted in.
		 */
		if (await buttondown.isSubscribed(customerEmail)) {
			let tier = TIERS[productId];
			if (tier) await buttondown.addMetadata(customerEmail, { purchase: tier });
		}

		log.info("order_paid", {
			channel: "payments",
			email: customerEmail,
			product: productName,
			productId,
		});

		return success("OK");
	} catch (error) {
		if (error instanceof Error) return failure(error);
		return failure(new Error("Error processing webhook"));
	}
}

/** POST /webhooks/polar — records a paid order against the buyer's newsletter profile. */
export default createAction(routes.webhooks.polar, async (ctx) => {
	let log = ctx.logger;
	let result = await processWebhook(ctx.request, log);

	if (isFailure(result)) {
		log.error("polar_webhook_failed", { error: result.error.message });
		return json({ error: result.error.message }, BadRequest);
	}

	return json(null, Ok);
});
