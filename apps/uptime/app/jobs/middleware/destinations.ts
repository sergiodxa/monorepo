/**
 * Job middleware that publishes the factory turning an alert's channel into a messaging
 * destination, so the delivery job reads `ctx.destinations` and a test installs one that
 * answers a recording destination instead of reaching Slack or PagerDuty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobMiddleware } from "@sdxc/jobs";

import { createContextKey } from "remix/router";

import type { DestinationFactory } from "~/app/services/alert-destination";

import { destinationFor } from "~/app/services/alert-destination";

/** Where a job's destination factory lives on the context, installed as `ctx.destinations`. */
export const Destinations = createContextKey<DestinationFactory>();

/** What {@link destinations} publishes, which is what types `ctx.destinations` for handlers. */
export type DestinationsEffect = {
	key: typeof Destinations;
	value: DestinationFactory;
	property: "destinations";
};

/**
 * Publishes the production destination factory for the job about to run.
 *
 * @returns The middleware, for a dispatcher's chain.
 * @example createJobDispatcher({ middleware: [database(), destinations()] });
 */
export function destinations(): JobMiddleware<DestinationsEffect> {
	return async (ctx, next) => {
		ctx.set(Destinations, destinationFor, { property: "destinations" });
		await next();
	};
}
