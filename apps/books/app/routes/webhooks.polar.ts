/**
 * Polar webhook route that verifies incoming events with the webhook secret and, on
 * an order.paid event, tags the paying customer in Buttondown with the purchased tier
 * (complete or individual); it returns 200 on success and 400 on failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Logger } from "@pkg/logger/batched";

import { ok, badRequest } from "@pkg/response";
import { success, failure } from "@pkg/result";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { env } from "cloudflare:workers";

import { Product } from "~/data/product";
import { logger } from "~/middleware/logger";
import buttondown from "~/services/buttondown";

import type { Route } from "./+types/webhooks.polar";

async function processWebhook(request: Request, log: Logger) {
	if (!env.POLAR_WEBHOOK_SECRET) return failure(new Error("POLAR_WEBHOOK_SECRET is not set"));

	try {
		let event = validateEvent(
			await request.text(),
			Object.fromEntries(request.headers),
			env.POLAR_WEBHOOK_SECRET,
		);

		if (event.type === "order.paid") {
			if (!event.data.product) {
				return failure(new Error("Product is required"));
			}
			if (!event.data.customer.email) {
				return failure(new Error("Customer email is required"));
			}

			let productId = event.data.product.id;
			let productName = event.data.product.name;
			let customerEmail = event.data.customer.email;

			if (await buttondown.isSubscribed(customerEmail)) {
				if (productId === Product.Complete) {
					await buttondown.addMetadata(customerEmail, { purchase: "complete" });
				} else if (productId === Product.Essentials) {
					await buttondown.addMetadata(customerEmail, {
						purchase: "individual",
					});
				}
			}

			log.info("order_paid", {
				channel: "payments",
				email: customerEmail,
				product: productName,
				productId,
			});
		}

		return success("OK");
	} catch (error) {
		if (error instanceof Error) {
			return failure(error);
		}
		return failure(new Error("Error processing webhook"));
	}
}

export async function action({ request }: Route.ActionArgs) {
	let log = logger().action("routes/webhooks.polar");
	let result = await processWebhook(request, log);

	if (result.status === "success") return ok(null);

	return badRequest({ error: result.error.message });
}
