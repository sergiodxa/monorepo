import type { Result } from "@pkg/result";
import { success, failure } from "@pkg/result";
import type { SubscribeOutput } from "~/schemas/subscribe";
import buttondown, { ButtondownError } from "~/services/buttondown";
import logsnag from "~/services/logsnag";

export async function subscribe(
	payload: SubscribeOutput,
	ipAddress: string | null,
): Promise<Result<string, Error>> {
	if (!payload.email) {
		return failure(new Error("Email is required"));
	}

	try {
		if (await buttondown.isSubscribed(payload.email)) {
			return success("You're already subscribed");
		}

		await buttondown.subscribe(
			payload.email,
			{
				source: payload.source,
				campaign: payload.campaign,
				medium: payload.medium,
			},
			ipAddress,
		);

		await logsnag.track({
			channel: "newsletter",
			event: "User Subscribed",
			timestamp: new Date(),
			user_id: payload.email,
			description: "User subscribed to React Router OAuth2 Handbook Newsletter",
		});

		return success("Subscribed");
	} catch (error) {
		if (error instanceof ButtondownError) {
			return failure(error);
		}
		if (error instanceof Error) {
			return failure(error);
		}
		return failure(new Error("Unknown error occurred"));
	}
}
