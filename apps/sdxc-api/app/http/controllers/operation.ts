/**
 * Runs one catalog operation after payment has settled: reads JSON, dispatches
 * to {@link runOperation}, answers JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { runOperation } from "~/app/services/run";
import routes from "~/routes/web";

/** Executes `POST /v1/*id` once {@link requireOperationPayment} has collected. */
export default createAction(routes.operation, async (ctx) => {
	let id = ctx.params.id;
	if (typeof id !== "string") {
		return Response.json({ error: "not_found" }, { status: 404 });
	}

	let input: unknown;
	try {
		input = await ctx.request.json();
	} catch {
		return Response.json({ error: "invalid_json" }, { status: 400 });
	}

	let result = await runOperation(id, input);
	if (isFailure(result)) {
		let status = result.error.code === "invalid_input" ? 400 : 422;
		return Response.json({ error: result.error.code, detail: result.error.message }, { status });
	}

	return Response.json({
		operation: id,
		payment: ctx.payment ?? null,
		result: result.data,
	});
});
