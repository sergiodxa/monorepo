/**
 * Router middleware publishing the invocation's log as `ctx.log`. It joins the log already
 * current — a dispatcher's, a host's — or opens a `request` log of its own, and records
 * the route and method once the handler has run, since routes match after router
 * middleware starts. The retiring `logger` middleware stays until every consumer has moved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { createContextKey } from "remix/router";

import type { Logger } from "./create-logger.js";

import { currentLog } from "./current.js";
import { Log } from "./log.js";
import { Logger as RequestLogger } from "./request-logger.js";

declare module "remix/router" {
	interface RequestContext {
		/** The request-scoped logger, flushed once the response is settled. */
		logger: RequestLogger;
		/** The invocation's log, emitted once the response is settled. */
		log: Log;
	}
}

/** Reads the invocation's log off a request context whose middleware chain is not known. */
export const CurrentLog = createContextKey<Log>();

const LOG_PROPERTY = { property: "log" } as const;

/** Decodes one path segment, keeping it as-is when it is not valid percent-encoding. */
function decode(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

/**
 * The matched route as a pattern, reconstructed by substituting each param's value back
 * out of the pathname, so a log carries `/app/:teamId/monitors` and never the team id.
 * A handler that knows better overrides it with `ctx.log.set({ route })`.
 */
function routeOf(ctx: RequestContext<any>): string {
	let pathname = ctx.url.pathname;
	let params = Object.entries(ctx.params as Record<string, string | undefined>).filter(
		(entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
	);
	if (params.length === 0) return pathname;

	let route = pathname
		.split("/")
		.map((segment) => {
			let decoded = decode(segment);
			let match = params.find(([, value]) => value === decoded);
			return match === undefined ? segment : `:${match[0]}`;
		})
		.join("/");

	for (let [name, value] of params) {
		if (value.includes("/") && route.includes(value)) route = route.replace(value, `*${name}`);
	}

	return route;
}

/** What the router knows about a request once it has been handled. */
function describe(ctx: RequestContext<any>): Log.Fields {
	return { route: routeOf(ctx), http: { method: ctx.method } };
}

/**
 * Publishes the invocation's log as `ctx.log`.
 *
 * When a log is already current it is joined, so a request served inside a host's or a
 * dispatcher's log produces one record. Otherwise a `request` log opens — carrying
 * `logger`'s configuration when one is given — and emits once the response is settled.
 *
 * @param logger The worker's configuration. Omitted, the log carries none, which is the
 * visible sign that the host running this router has not wrapped its entry point.
 * @example createRouter({ middleware: [log(logger)] });
 */
export function log(
	logger?: Logger,
): Middleware<{ key: typeof CurrentLog; value: Log; property: "log" }> {
	return async (ctx, next) => {
		let current = currentLog();

		if (current !== undefined) {
			ctx.set(CurrentLog, current, LOG_PROPERTY);
			try {
				return await next();
			} finally {
				current.set(describe(ctx));
			}
		}

		let opened = logger === undefined ? new Log({ kind: "request" }) : logger.open("request");

		return opened.run(async (self) => {
			ctx.set(CurrentLog, self, LOG_PROPERTY);
			try {
				let response = await next();
				self.set({ http: { status: response.status } });
				return response;
			} finally {
				self.set(describe(ctx));
			}
		});
	};
}

/**
 * Creates a request-scoped `Logger` for each request and flushes it once the request completes.
 *
 * @returns The downstream response, after recording it and flushing logs.
 * @throws Re-throws any downstream error after logging it as `unhandled_error`.
 * @example
 * createRouter({ middleware: [logger] });
 */
export const logger: Middleware = async (ctx, next) => {
	ctx.logger = new RequestLogger(ctx.request);

	try {
		let response = await next();
		ctx.logger.response = response;
		return response;
	} catch (error) {
		ctx.logger.error("unhandled_error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		throw error;
	} finally {
		ctx.logger.flush();
	}
};

export default logger;
