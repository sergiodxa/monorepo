/**
 * Free catalog of every priced operation: amounts, packages and example paths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { OPERATIONS } from "~/config/catalog";
import routes from "~/routes/web";

/** Answers `GET /v1` with the machine-readable catalog. */
export default createAction(routes.catalog, async (ctx) => {
	return Response.json({
		service: "sdxc-apis",
		payment: "x402",
		mcp: new URL("/mcp", ctx.url).href,
		operations: OPERATIONS.map((operation) => ({
			id: operation.id,
			title: operation.title,
			description: operation.description,
			package: operation.package,
			amount: operation.amount,
			priceUsd: operation.priceUsd,
			url: new URL(`/v1/${operation.id}`, ctx.url).href,
		})),
	});
});
