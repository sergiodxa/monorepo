import { validateEvent } from "@polar-sh/sdk/webhooks";
import { success, failure } from "@pkg/result";
import { ok, badRequest } from "@pkg/response";
import { Product } from "~/data/product";
import buttondown from "~/services/buttondown";
import logsnag from "~/services/logsnag";
import type { Route } from "./+types/webhooks.polar";
import { env } from "cloudflare:workers";

async function processWebhook(request: Request) {
	if (!env.POLAR_WEBHOOK_SECRET) {
		return failure(new Error("POLAR_WEBHOOK_SECRET is not set"));
	}

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

			await logsnag.track({
				channel: "payments",
				event: "Order Paid",
				timestamp: event.data.createdAt,
				user_id: customerEmail,
				description: `Order paid for ${productName} (${productId})`,
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
	let result = await processWebhook(request);

	if (result.status === "success") {
		return ok(null);
	}

	return badRequest({ error: result.error.message });
}
