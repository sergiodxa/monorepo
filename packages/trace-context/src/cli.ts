/**
 * `@sdxc/cli` middleware giving every command run a trace: continued from the `TRACEPARENT`
 * and `TRACESTATE` environment variables OpenTelemetry uses as a process's carrier, or started
 * here, bound for `currentTrace()`, published as `ctx.trace`, and stamped on the run's log.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CommandMiddleware, Env } from "@sdxc/cli";

import { currentLog } from "@sdxc/logger";

import type { TraceContext } from "./context.js";

import { extract, toTraceParent, traceFields } from "./context.js";
import { currentTrace, runWithTrace } from "./current.js";
import { CurrentTrace } from "./middleware.js";
import { stringify as stringifyTraceState } from "./tracestate.js";

export { CurrentTrace } from "./middleware.js";

const TRACE_PROPERTY = { property: "trace" } as const;

/**
 * The trace an environment carries, read the way `extract()` reads headers: a missing or
 * invalid `TRACEPARENT` starts a new trace and an invalid `TRACESTATE` is dropped.
 */
function traceOf(env: Env): TraceContext {
	let headers = new Headers();
	if (env.TRACEPARENT !== undefined) headers.set("traceparent", env.TRACEPARENT);
	if (env.TRACESTATE !== undefined) headers.set("tracestate", env.TRACESTATE);
	return extract(headers);
}

/**
 * The variables a child process continues `trace` from, naming this run's span as its parent.
 * `TRACESTATE` is `undefined` for an empty state, which removes one inherited from this process.
 */
function traceEnv(trace: TraceContext): Env {
	let state = stringifyTraceState(trace.state);
	return { TRACEPARENT: toTraceParent(trace), TRACESTATE: state === "" ? undefined : state };
}

/**
 * Continues or starts the run's trace, binds it for `currentTrace()`, publishes it as
 * `ctx.trace`, sets `traceFields()` on the current log, and hands it to every child process
 * `ctx.exec` starts as `TRACEPARENT`, unless the call passes its own in `options.env`. When a trace is already current (a host bound one) it is
 * joined, as `log()` joins a log. Jobs the command enqueues carry the trace.
 *
 * @example createCLI({ name: "app", commands, middleware: [log(logger), trace()] });
 */
export function trace(): CommandMiddleware<{
	key: typeof CurrentTrace;
	value: TraceContext;
	property: "trace";
}> {
	return async (ctx, next) => {
		let current = currentTrace();

		if (current !== undefined) {
			ctx.set(CurrentTrace, current, TRACE_PROPERTY);
			ctx.setExecEnv(traceEnv(current));
			await next();
			return;
		}

		let started = traceOf(ctx.env);
		currentLog()?.set(traceFields(started));
		ctx.set(CurrentTrace, started, TRACE_PROPERTY);
		ctx.setExecEnv(traceEnv(started));

		await runWithTrace(started, () => next());
	};
}
