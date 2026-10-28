/**
 * Looks up the priced operation from the route param and runs {@link requirePayment}
 * with that operation's amount, description and Bazaar metadata, unless the
 * operator Bearer token is present.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { requirePayment } from "@sdxc/x402/middleware";

import { httpBazaar } from "~/app/services/bazaar";
import { isOwnerRequest } from "~/app/services/owner-access";
import { findOperation } from "~/config/catalog";

/**
 * Answers 404 when the `*id` is unknown, otherwise collects payment for that catalog row.
 * The operator's `Authorization: Bearer` matching `OWNER_ACCESS_TOKEN` skips payment.
 */
export const requireOperationPayment: Middleware = async (ctx, next) => {
	let id = ctx.params.id;
	if (typeof id !== "string" || id.includes("/")) {
		return new Response(JSON.stringify({ error: "not_found" }), {
			status: 404,
			headers: { "content-type": "application/json" },
		});
	}

	let operation = findOperation(id);
	if (operation === undefined) {
		return new Response(JSON.stringify({ error: "not_found", id }), {
			status: 404,
			headers: { "content-type": "application/json" },
		});
	}

	if (isOwnerRequest(ctx.request)) {
		ctx.log.set({ owner: { bypass: true, operation: operation.id, surface: "http" } });
		return next();
	}

	return requirePayment({
		amount: operation.amount,
		description: operation.description,
		resourceUrl: () => new URL(`/v1/${operation.id}`, ctx.url).href,
		extensions: { bazaar: httpBazaar(operation) },
	})(ctx, next);
};
