import { validateEvent } from "@polar-sh/sdk/webhooks";
import { Product } from "~/data/product";
import buttondown from "~/services/buttondown";
import logsnag from "~/services/logsnag";
import type { Route } from "./+types/webhooks.polar";
import { env } from "cloudflare:workers";

export async function action({ request }: Route.ActionArgs) {
	if (!env.POLAR_WEBHOOK_SECRET) {
		throw new Error("POLAR_WEBHOOK_SECRET is not set");
	}

	try {
		const event = validateEvent(
			await request.text(),
			Object.fromEntries(request.headers),
			env.POLAR_WEBHOOK_SECRET,
		);

		if (event.type === "order.paid") {
			if (!event.data.product) {
				return new Response("Product is required", { status: 400 });
			}

			const productId = event.data.product.id;
			const productName = event.data.product.name;
			const customerEmail = event.data.customer.email;

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

		return new Response("OK", { status: 200 });
	} catch {
		return new Response("Error processing webhook", { status: 400 });
	}
}
