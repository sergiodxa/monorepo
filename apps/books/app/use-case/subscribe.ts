import type { Result } from "@pkg/result";

import { success, failure } from "@pkg/result";

import type { SubscribeOutput } from "~/schemas/subscribe";

import { logger } from "~/middleware/logger";
import buttondown, { ButtondownError } from "~/services/buttondown";

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

		logger.info("user_subscribed", {
			channel: "newsletter",
			email: payload.email,
			source: payload.source,
			campaign: payload.campaign,
			medium: payload.medium,
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
