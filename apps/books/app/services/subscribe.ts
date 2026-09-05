/**
 * Subscribe use case. Adds an address to the newsletter, short-circuiting when it is
 * already subscribed, forwarding UTM attribution and the caller's IP, and returning a
 * Result so the controller decides what a visitor sees. Every page with an email field
 * goes through it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { failure, success } from "@sdxc/result";

import type { SubscribeInput } from "~/app/http/validators/subscribe";
import type { Buttondown } from "~/app/services/buttondown";

/**
 * Subscribes an address, treating an address that is already on the list as a success:
 * every page that collects an email is offering something in return, and someone who
 * subscribed last month still gets it.
 *
 * @param buttondown - The newsletter client.
 * @param payload - The validated form payload.
 * @param ipAddress - The visitor's IP, or `null` when it cannot be resolved.
 * @returns `success` once the address is on the list, `failure` with the underlying
 * error — a {@link ButtondownError} carries the provider's `code` — otherwise.
 */
export async function subscribe(
	buttondown: Buttondown,
	payload: SubscribeInput,
	ipAddress: string | null,
): Promise<Result<"subscribed" | "already-subscribed", Error>> {
	try {
		let log = currentLog();

		if (await buttondown.isSubscribed(payload.email)) {
			log?.set({ subscribe: { result: "already-subscribed" } });
			return success("already-subscribed");
		}

		await buttondown.subscribe(
			payload.email,
			{ source: payload.source, campaign: payload.campaign, medium: payload.medium },
			ipAddress,
		);

		log?.set({
			subscribe: {
				result: "subscribed",
				source: payload.source,
				campaign: payload.campaign,
				medium: payload.medium,
			},
		});

		return success("subscribed");
	} catch (error) {
		if (error instanceof Error) return failure(error);
		return failure(new Error("Unknown error occurred"));
	}
}
