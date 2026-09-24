/**
 * Router middleware giving every request a trace: continued from the caller's `traceparent`
 * or started here, bound for `currentTrace()`, published as `ctx.trace`, and stamped on the
 * request's log. It goes directly after `log(logger)`, so the log it stamps is the request's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { createContextKey } from "remix/router";

import type { TraceContext } from "./context.js";

import { extract, startTrace, traceFields } from "./context.js";
import { currentTrace, runWithTrace } from "./current.js";

declare module "remix/router" {
	interface RequestContext {
		/** The trace this request belongs to, continued from the caller or started here. */
		trace: TraceContext;
	}
}

/**
 * Reads the request's trace off a context whose middleware chain is not known. The type is
 * written out because an exported key needs a nameable type to reach a published declaration.
 */
export const CurrentTrace: { defaultValue?: TraceContext } = createContextKey<TraceContext>();

const TRACE_PROPERTY = { property: "trace" } as const;

export namespace TraceMiddleware {
	export interface Options {
		/**
		 * Whether to continue the trace a request arrives with. A request this returns `false`
		 * for starts a new trace, and the dropped `traceparent` is noted on the log, which is
		 * how a public worker keeps callers from choosing the `trace_id` they are logged under.
		 * @default () => true
		 */
		accept?: (request: Request) => boolean;
	}
}

/**
 * The trace a request is served under: the caller's when `accept` allows it, otherwise a
 * new root, with the refused header noted on the log.
 */
function traceOf(request: Request, accept: (request: Request) => boolean): TraceContext {
	if (accept(request)) return extract(request.headers);

	let dropped = request.headers.get("traceparent");
	if (dropped !== null) currentLog()?.note("trace.rejected", { traceparent: dropped });

	return startTrace();
}

/**
 * Continues or starts the request's trace, binds it for `currentTrace()`, publishes it as
 * `ctx.trace`, and sets `traceFields()` on the current log. When a trace is already current
 * (a host or a dispatcher bound one) it is joined, as `log()` joins a log.
 *
 * @param options Whether to trust a caller's trace.
 * @example createRouter({ middleware: [log(logger), trace()] });
 */
export function trace(
	options: TraceMiddleware.Options = {},
): Middleware<{ key: typeof CurrentTrace; value: TraceContext; property: "trace" }> {
	let accept = options.accept ?? (() => true);

	return async (ctx, next) => {
		let current = currentTrace();

		if (current !== undefined) {
			ctx.set(CurrentTrace, current, TRACE_PROPERTY);
			return await next();
		}

		let started = traceOf(ctx.request, accept);
		currentLog()?.set(traceFields(started));
		ctx.set(CurrentTrace, started, TRACE_PROPERTY);

		return await runWithTrace(started, () => next());
	};
}
