import type { SubscribePayload } from "~/data/subscribe-payload";
import buttondown from "~/services/buttondown";
import logsnag from "~/services/logsnag";

export async function subscribe(payload: SubscribePayload, ipAddress: string | null) {
	if (!payload.email) throw new Error("Email is required");

	if (await buttondown.isSubscribed(payload.email)) {
		return "You're already subscribed";
	}

	await buttondown.subscribe(payload.email, payload.utm, ipAddress);

	await logsnag.track({
		channel: "newsletter",
		event: "User Subscribed",
		timestamp: new Date(),
		user_id: payload.email,
		description: "User subscribed to React Router OAuth2 Handbook Newsletter",
	});

	return "Subscribed";
}
