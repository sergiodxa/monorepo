/**
 * The delivery log under a webhook endpoint: `GET .../deliveries` pages its
 * most recent attempts, and `POST .../deliveries/:deliveryId/replay` writes a
 * fresh delivery row carrying an existing one's own payload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { endpointIdParam } from "~/app/http/controllers/management/webhook-endpoints/shared";
import { managementPaging } from "~/app/http/lib/management-pagination";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

function mountedMiddleware(options: ManagementControllerOptions, bucket: "read" | "write") {
	return [
		managementAuth({
			issuer: options.issuer,
			resolveDashboardSubjectId: options.resolveDashboardSubjectId,
		}),
		managementTenant(options.resolveStub),
		managementRateLimit(options.limiter, { bucket }),
	];
}

/** A delivery named in the replay route's own path that this endpoint does not hold. */
function deliveryNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such webhook delivery exists.",
	});
}

/**
 * Builds the `webhookDeliveriesList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.webhookDeliveriesList, createWebhookDeliveriesListAction(options));
 */
export function createWebhookDeliveriesListAction(options: ManagementControllerOptions) {
	return createAction(routes.webhookDeliveriesList, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "webhooks:write");
			if (refused) return refused;

			let endpointId = endpointIdParam(ctx);

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return managementProblem("invalidRequest");
			}

			let result = await ctx.tenantStub.readDeliveryPage({
				endpointId,
				cursor: paging.data.cursor,
				limit: paging.data.perPage,
			});

			if (!result.ok) {
				return managementProblem("badCursor");
			}

			let headers = managementPaging.paginate(
				new Headers(),
				{ items: result.deliveries, cursors: result.cursors },
				{ url: ctx.url },
			);

			return json(result.deliveries, { status: 200, headers });
		},
	});
}

/** Parses and requires the `:deliveryId` path param the replay route matches. */
function deliveryIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ deliveryId: s.string() }), ctx.params).deliveryId;
}

/**
 * Builds the `webhookDeliveriesReplay` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.webhookDeliveriesReplay, createWebhookDeliveriesReplayAction(options));
 */
export function createWebhookDeliveriesReplayAction(options: ManagementControllerOptions) {
	return createAction(routes.webhookDeliveriesReplay, {
		middleware: [...mountedMiddleware(options, "write"), managementIdempotency],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "webhooks:write");
			if (refused) return refused;

			let deliveryId = deliveryIdParam(ctx);

			let result = await ctx.tenantStub.replayDelivery({
				deliveryId,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return deliveryNotFound();

			return json(result.delivery, { status: 201 });
		},
	});
}
