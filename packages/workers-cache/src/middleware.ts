/**
 * Remix fetch-router middleware that publishes a callable `context.cache`: route
 * handlers declare how a response caches and which tags it carries, actions
 * purge by tag, and the middleware writes the headers onto the finished response
 * after refusing any declaration that would cache per-visitor content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
import type { Middleware, RequestContext } from "remix/fetch-router";

import { isFailure } from "@pkg/result";
import { Session } from "remix/session";

import type { PurgeError } from "./purge-error";
import type { CacheInterface, CachePolicy, CacheTag } from "./types";
import type { CacheRefusalReason } from "./unsafe-cache-policy-error";

import { cacheTag } from "./cache-tag";
import {
	CACHE_CONTROL_HEADER,
	CACHE_TAG_HEADER,
	CACHEABLE_METHODS,
	CACHEABLE_STATUS_CODES,
	NON_CACHEABLE_POLICY,
} from "./platform";
import { purge as purgeCache } from "./purge";
import { UnsafeCachePolicyError } from "./unsafe-cache-policy-error";

// Declared here (an imported module, not an ambient .d.ts) so the augmentation
// is applied in consuming projects that import the middleware.
declare module "remix/fetch-router" {
	interface RequestContext {
		/** Declares how this response caches, and purges cached entries by tag. */
		cache: CacheDeclaration;
	}
}

// Re-exported so a consumer can name the refusal it caught, since the throw only
// happens through this middleware.
export type { CacheRefusalReason } from "./unsafe-cache-policy-error";

export { UnsafeCachePolicyError } from "./unsafe-cache-policy-error";

/** Log event emitted when a declaration is refused and the response downgraded. */
const DOWNGRADE_EVENT = "workers_cache.downgraded";

/** Log event emitted when a deferred purge failed after the response was produced. */
const DEFERRED_PURGE_FAILED_EVENT = "workers_cache.deferred_purge_failed";

/** Hosts treated as development when `NODE_ENV` does not say which mode this is. */
const DEVELOPMENT_HOSTNAMES: ReadonlySet<string> = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
	"0.0.0.0",
]);

/**
 * Matches the `public` directive as its own token, so `max-age=60` and a policy
 * that merely contains the letters is never mistaken for a public one.
 */
const PUBLIC_DIRECTIVE_PATTERN = /(?:^|[\s,;])public(?:$|[\s,;=])/i;

/** A log function that takes one message, the shape a plain logger exposes. */
export type CacheLogFunction = (message: string) => void;

/**
 * The minimal logger the middleware reports refusals and deferred failures
 * through. Any request-scoped logger published as `context.logger` with this
 * shape is used as-is, so refusals land in the same stream as the request log.
 */
export interface CacheLogger {
	/**
	 * Writes an error-level event.
	 *
	 * @param event - Event name, e.g. `workers_cache.downgraded`.
	 * @param payload - Structured details about the event.
	 */
	error(event: string, payload?: Record<string, unknown>): void;
}

/** The object form of a declaration, for passing tags as a list. */
export interface CacheDeclarationOptions {
	/** The `Cache-Control` value to write when the declaration is not refused. */
	policy: CachePolicy;
	/** Tags to add to this request's set; repeats across calls collapse. */
	tags?: readonly CacheTag[];
}

/** The callable published as `context.cache`. */
export interface CacheDeclaration {
	/**
	 * Declares how this response caches. Tags add to the request's set, and the
	 * most recent policy wins when more than one participant declares.
	 *
	 * @param policy - The `Cache-Control` value to write.
	 * @param tags - Tags this response should be purgeable by.
	 */
	(policy: CachePolicy, ...tags: CacheTag[]): void;
	/**
	 * Object form of a declaration, for a tag list built elsewhere.
	 *
	 * @param declaration - Policy and tags; see {@link CacheDeclarationOptions}.
	 */
	(declaration: CacheDeclarationOptions): void;
	/**
	 * Invalidates entries by tag and waits for the platform, so an action that
	 * redirects to the page it just changed cannot race its own purge.
	 *
	 * @param tags - Tags to invalidate; an empty call is a failure, not a no-op.
	 * @returns Success when the platform accepted the purge, otherwise the error.
	 */
	purge(...tags: CacheTag[]): Promise<Result<void, PurgeError>>;
	/**
	 * Queues a purge to run after the response, for invalidations whose freshness
	 * nobody is about to observe. Failures are logged, never thrown.
	 *
	 * @param tags - Tags to invalidate once the response has been produced.
	 */
	purgeLater(...tags: CacheTag[]): void;
}

/** Options that configure the workers cache middleware. */
export interface WorkersCacheMiddlewareOptions {
	/**
	 * The platform cache interface, or a resolver that reads it off the request
	 * context. It is resolved here and closed over, so nothing downstream has to
	 * thread a platform object into the actions that purge.
	 */
	cache: CacheInterface | ((context: RequestContext) => CacheInterface);
}

/**
 * Wraps a fixed cache interface in a resolver so the middleware has one code
 * path for the value form and the per-request form.
 *
 * @param cache - The cache interface given at registration.
 * @returns A resolver that ignores the context and returns that interface.
 */
function toResolver(cache: CacheInterface): (context: RequestContext) => CacheInterface {
	return () => cache;
}

/**
 * Adapts a plain log function to the structured shape used here, encoding the
 * payload as JSON so no detail is lost when the logger takes only a message.
 *
 * @param log - A log function that accepts one message.
 * @returns A logger that writes events through it.
 */
function toStructuredLogger(log: CacheLogFunction): CacheLogger {
	return {
		error(event: string, payload?: Record<string, unknown>): void {
			log(payload === undefined ? event : `${event} ${JSON.stringify(payload)}`);
		},
	};
}

/**
 * Finds the request's logger without requiring one: a structured logger
 * published as `context.logger`, or a plain log function in that position, which
 * is what a router-level logger middleware installs there.
 *
 * A request with no logger still gets the downgrade — the refusal is enforced
 * either way — but nothing to report it to, which is why development throws.
 *
 * @param context - The current request context.
 * @returns A logger, or `undefined` when the request has none.
 */
function resolveLogger(context: RequestContext): CacheLogger | undefined {
	let candidate: unknown = Reflect.get(context, "logger");

	if (typeof candidate === "object" && candidate !== null && "error" in candidate) {
		let write = Reflect.get(candidate, "error");
		if (typeof write === "function") return candidate as CacheLogger;
	}

	if (typeof candidate === "function") return toStructuredLogger(candidate as CacheLogFunction);

	return undefined;
}

/**
 * Whether the request belongs to an identified visitor.
 *
 * A session middleware upstream is the precise signal, so when one ran its
 * session decides: data in it means the request is identified, an untouched one
 * means it is not. Without that middleware the request's cookies are all this
 * can look at, and it errs toward refusing rather than caching a response that
 * may have been built for one visitor.
 *
 * @param context - The current request context.
 * @returns `true` when a public policy would be unsafe for this request.
 */
function hasSession(context: RequestContext): boolean {
	if (context.has(Session)) {
		let session = context.get(Session);
		if (!session) return false;
		let [values, flash] = session.data;
		return Object.keys(values).length > 0 || Object.keys(flash).length > 0;
	}

	return context.headers.has("Cookie");
}

/**
 * Whether a policy marks the response as shared-cacheable.
 *
 * @param policy - The declared `Cache-Control` value.
 * @returns `true` when the policy carries the `public` directive.
 */
function isPublicPolicy(policy: CachePolicy): boolean {
	return PUBLIC_DIRECTIVE_PATTERN.test(policy);
}

/**
 * Whether a refusal should throw instead of only being logged. `NODE_ENV`
 * decides when it says which mode this is; otherwise a request to a local host
 * is treated as development, which covers a worker running locally.
 *
 * @param context - The current request context.
 * @returns `true` when the process is running in development.
 */
function isDevelopment(context: RequestContext): boolean {
	let mode = typeof process === "undefined" ? undefined : process.env.NODE_ENV;
	if (mode === "production") return false;
	if (mode === "development") return true;
	return DEVELOPMENT_HOSTNAMES.has(context.url.hostname);
}

/**
 * Writes headers onto a finished response, falling back to a copy when the
 * response's headers reject mutation, as platform-produced responses do.
 *
 * @param response - The response the handler produced.
 * @param entries - Header name and value pairs to write.
 * @returns The same response, or an equivalent one carrying the headers.
 */
function withHeaders(
	response: Response,
	entries: readonly (readonly [string, string])[],
): Response {
	try {
		for (let [name, value] of entries) response.headers.set(name, value);
		return response;
	} catch {
		let headers = new Headers(response.headers);
		for (let [name, value] of entries) headers.set(name, value);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

/**
 * Creates a middleware that gives every route in its scope the ability to
 * declare how its response caches and to purge cached entries by tag.
 *
 * The factory carries no policy, so registering it broadly costs nothing: a
 * route that never calls `context.cache()` gets no cache headers at all, and
 * each route decides its own lifetime where the response is built. Register it
 * outside anything that attaches `Set-Cookie` or rewrites the response, since
 * its refusal checks inspect whatever response reaches it.
 *
 * @param options - Plumbing only; see {@link WorkersCacheMiddlewareOptions}.
 * @returns A middleware that publishes `context.cache`.
 * @example
 * let router = createRouter({ middleware: [cache({ cache: (ctx) => ctx.cacheBinding })] });
 */
export default function cache(options: WorkersCacheMiddlewareOptions): Middleware {
	let resolveCache =
		typeof options.cache === "function" ? options.cache : toResolver(options.cache);

	return async (context, next) => {
		let cacheInterface = resolveCache(context);
		let policy: CachePolicy | undefined;
		let tags = new Set<CacheTag>();
		let deferred = new Set<CacheTag>();

		/**
		 * Records a declaration. Tags accumulate across every call in the request so
		 * a controller-scoped middleware and its handler contribute to one header,
		 * while the policy is replaced, since only one lifetime can be written.
		 */
		function declare(
			policyOrDeclaration: CachePolicy | CacheDeclarationOptions,
			...rest: CacheTag[]
		): void {
			if (typeof policyOrDeclaration === "string") {
				policy = policyOrDeclaration;
				for (let tag of rest) tags.add(tag);
				return;
			}

			policy = policyOrDeclaration.policy;
			for (let tag of policyOrDeclaration.tags ?? []) tags.add(tag);
		}

		let declaration = Object.assign(declare, {
			/** Purges the given tags now, reporting the outcome to the caller. */
			purge(...purged: CacheTag[]): Promise<Result<void, PurgeError>> {
				return purgeCache(cacheInterface, { tags: purged });
			},

			/** Queues the given tags for a purge that runs once the response exists. */
			purgeLater(...purged: CacheTag[]): void {
				for (let tag of purged) deferred.add(tag);
			},
		}) as CacheDeclaration;

		context.cache = declaration;

		/**
		 * Refuses a declaration: the response is downgraded so nothing stores it,
		 * the refusal is logged at error level, and development additionally throws
		 * because the route asked for something unsafe.
		 */
		function refuse(response: Response, reason: CacheRefusalReason): Response {
			let declaredPolicy = policy ?? "";

			resolveLogger(context)?.error(DOWNGRADE_EVENT, {
				reason,
				policy: declaredPolicy,
				method: context.method,
				path: context.url.pathname,
			});

			if (isDevelopment(context)) {
				throw new UnsafeCachePolicyError(reason, declaredPolicy, context.url.pathname);
			}

			return withHeaders(response, [[CACHE_CONTROL_HEADER, NON_CACHEABLE_POLICY]]);
		}

		/**
		 * Applies the declaration to the finished response, or leaves the response
		 * exactly as the handler built it when no header should be written.
		 */
		function apply(response: Response): Response {
			if (policy === undefined) return response;
			if (!CACHEABLE_METHODS.has(context.method.toUpperCase())) return response;
			if (!CACHEABLE_STATUS_CODES.has(response.status)) return response;

			if (response.headers.has("Set-Cookie")) return refuse(response, "set-cookie");
			if (isPublicPolicy(policy) && hasSession(context)) {
				return refuse(response, "session-with-public-policy");
			}

			let headers: [string, string][] = [[CACHE_CONTROL_HEADER, policy]];
			if (tags.size > 0) headers.push([CACHE_TAG_HEADER, cacheTag([...tags])]);
			return withHeaders(response, headers);
		}

		/** Runs the queued purges, logging failures because the response is already out. */
		async function flush(): Promise<void> {
			if (deferred.size === 0) return;

			let purged = [...deferred];
			deferred.clear();

			let result = await purgeCache(cacheInterface, { tags: purged });
			if (!isFailure(result)) return;

			resolveLogger(context)?.error(DEFERRED_PURGE_FAILED_EVENT, {
				error: result.error.message,
				tags: purged,
			});
		}

		try {
			return apply(await next());
		} finally {
			await flush();
		}
	};
}
