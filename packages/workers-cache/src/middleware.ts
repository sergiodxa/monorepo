/**
 * Remix fetch-router middleware that publishes a callable `context.cache`: route
 * handlers declare how a response caches and which tags it carries, actions
 * purge by tag, and the middleware writes the headers onto the finished response
 * after refusing any declaration that would cache per-visitor content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Middleware, RequestContext } from "remix/router";

import { parseTargetedPolicy } from "@sdxc/http/cache";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { Session } from "remix/session";

import type { PurgeError } from "./purge-error.js";
import type { CacheInterface, CachePolicy, CacheTag, PurgeIssue } from "./types.js";
import type { CacheRefusalReason } from "./unsafe-cache-policy-error.js";

import { cacheTag } from "./cache-tag.js";
import {
	CACHE_CONTROL_HEADER,
	CACHE_TAG_HEADER,
	CACHEABLE_METHODS,
	CACHEABLE_STATUS_CODES,
	CDN_CACHE_CONTROL_HEADER,
	CLOUDFLARE_CDN_CACHE_CONTROL_HEADER,
	EDGE_TARGETED_HEADERS,
	NON_CACHEABLE_POLICY,
} from "./platform.js";
import { purge as purgeCache } from "./purge.js";
import { UnsafeCachePolicyError } from "./unsafe-cache-policy-error.js";

/**
 * Declared as an imported module so the augmentation applies in every
 * project that imports the middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Declares how this response caches, and purges cached entries by tag. */
		cache: CacheDeclaration;
	}
}

/**
 * Re-exported so a consumer can name the refusal it caught, since the throw
 * only happens through this middleware.
 */
export type { CacheRefusalReason } from "./unsafe-cache-policy-error.js";

export { UnsafeCachePolicyError } from "./unsafe-cache-policy-error.js";

/** Warning recorded when a declaration is refused and the response downgraded. */
const DOWNGRADE_EVENT = "cache.downgraded";

/** Warning recorded when a deferred purge failed after the response was produced. */
const DEFERRED_PURGE_FAILED_EVENT = "cache.purge_failed";

/**
 * What to record as the reason a purge failed: the platform's own rejection or
 * the issues it declined with, since the wrapper's message only restates the
 * tags the note already names.
 *
 * @param error The failure the purge reported.
 */
function describePurgeFailure(error: Error): string {
	let cause = error.cause;
	if (cause instanceof Error) return cause.message;
	if (typeof cause === "string") return cause;
	if (Array.isArray(cause) && cause.length > 0) {
		return (cause as readonly PurgeIssue[])
			.map((issue) => `${issue.code}: ${issue.message}`)
			.join("; ");
	}
	return error.message;
}

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

/** The object form of a declaration, for passing tags as a list or edge-only lifetimes. */
export interface CacheDeclarationOptions {
	/** The `Cache-Control` value to write when the declaration is not refused. */
	policy: CachePolicy;
	/**
	 * The `CDN-Cache-Control` value, which the edge and any CDN in front of it obey over
	 * `policy`, so browsers keep `policy`'s lifetime while CDNs keep this one.
	 */
	cdn?: CachePolicy;
	/**
	 * The `Cloudflare-CDN-Cache-Control` value, which only the edge reads, above `cdn`
	 * and `policy`; the edge strips it, so no cache past the edge sees it.
	 */
	cloudflare?: CachePolicy;
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
 * A session middleware upstream is the precise signal: data present means
 * identified, absent means anonymous. Without it, cookies decide, erring
 * toward refusal since a wrongly cached response could leak one visitor's data.
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

/** A targeted field some CDN will obey, and the value it holds. */
interface TargetedField {
	name: string;
	value: string;
	/** Whether the field lets a CDN store the response for every visitor of its URL. */
	shared: boolean;
}

/**
 * The targeted fields a CDN will obey, in the edge's target-list order, so the first is the
 * one the edge follows. An absent, empty or invalid field is left out, as caches ignore it;
 * a targeted field addresses a shared cache, so it stores unless it says `private` or `no-store`.
 *
 * @param values - Each targeted field's value, by name, or `null` when absent.
 */
function obeyedTargetedFields(values: ReadonlyMap<string, string | null>): TargetedField[] {
	let fields: TargetedField[] = [];
	for (let name of EDGE_TARGETED_HEADERS) {
		let value = values.get(name) ?? null;
		let parsed = parseTargetedPolicy(value);
		if (parsed === null || value === null) continue;
		fields.push({ name, value, shared: !parsed.private && !parsed.noStore });
	}
	return fields;
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
 * Whether a response already says how long it stays fresh, which a handler that builds
 * its own headers (a static document, a negotiated variant) is trusted to have chosen.
 *
 * @param response - The response the handler produced.
 */
function statesFreshness(response: Response): boolean {
	return response.headers.has(CACHE_CONTROL_HEADER) || response.headers.has("Expires");
}

/**
 * Writes headers onto a finished response, falling back to a copy when the
 * response's headers reject mutation, as platform-produced responses do.
 *
 * @param response - The response the handler produced.
 * @param entries - Header name and value pairs to write; a `null` value removes the header.
 * @returns The same response, or an equivalent one carrying the headers.
 */
function withHeaders(
	response: Response,
	entries: readonly (readonly [string, string | null])[],
): Response {
	try {
		writeHeaders(response.headers, entries);
		return response;
	} catch {
		let headers = new Headers(response.headers);
		writeHeaders(headers, entries);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

/**
 * Applies header writes in order, removing the headers whose value is `null`.
 *
 * @param headers - The headers to change.
 * @param entries - Header name and value pairs; a `null` value removes the header.
 */
function writeHeaders(
	headers: Headers,
	entries: readonly (readonly [string, string | null])[],
): void {
	for (let [name, value] of entries) {
		if (value === null) headers.delete(name);
		else headers.set(name, value);
	}
}

/**
 * The writes that downgrade a response: `Cache-Control` stops every cache, and the targeted
 * fields go, since the edge would otherwise obey them over `Cache-Control` and store it.
 */
const DOWNGRADE_HEADERS: readonly (readonly [string, string | null])[] = [
	[CACHE_CONTROL_HEADER, NON_CACHEABLE_POLICY],
	[CLOUDFLARE_CDN_CACHE_CONTROL_HEADER, null],
	[CDN_CACHE_CONTROL_HEADER, null],
];

/**
 * Creates a middleware publishing `context.cache`; a route that never declares is
 * kept out of every cache unless it set its own freshness. Register it outside code
 * that attaches `Set-Cookie` or rewrites the response, since its checks inspect it.
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
		let targeted = new Map<string, CachePolicy>();
		let tags = new Set<CacheTag>();
		let deferred = new Set<CacheTag>();

		/**
		 * Records a declaration. Tags accumulate across every call in the request so
		 * a controller-scoped middleware and its handler contribute to one header,
		 * while the policy and its targeted fields are replaced together as one lifetime.
		 */
		function declare(
			policyOrDeclaration: CachePolicy | CacheDeclarationOptions,
			...rest: CacheTag[]
		): void {
			targeted.clear();

			if (typeof policyOrDeclaration === "string") {
				policy = policyOrDeclaration;
				for (let tag of rest) tags.add(tag);
				return;
			}

			policy = policyOrDeclaration.policy;
			if (policyOrDeclaration.cloudflare !== undefined) {
				targeted.set(CLOUDFLARE_CDN_CACHE_CONTROL_HEADER, policyOrDeclaration.cloudflare);
			}
			if (policyOrDeclaration.cdn !== undefined) {
				targeted.set(CDN_CACHE_CONTROL_HEADER, policyOrDeclaration.cdn);
			}
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
		 * the refusal degrades the invocation's log with `cache.downgraded` set so
		 * it can be filtered for, and development additionally throws because the
		 * route asked for something unsafe.
		 */
		function refuse(
			response: Response,
			reason: CacheRefusalReason,
			declaredPolicy: string,
		): Response {
			currentLog()
				?.set({ cache: { downgraded: true, refusal: reason } })
				.warn(DOWNGRADE_EVENT, { reason, policy: declaredPolicy });

			if (isDevelopment(context)) {
				throw new UnsafeCachePolicyError(reason, declaredPolicy, context.url.pathname);
			}

			return withHeaders(response, DOWNGRADE_HEADERS);
		}

		/**
		 * Applies the declaration, judging safety by every field some shared cache obeys:
		 * `Cache-Control` and each valid targeted field. An undeclared response stating no freshness
		 * is marked non-cacheable, since Workers Cache stores a header-less `200` for two hours.
		 */
		function apply(response: Response): Response {
			if (!CACHEABLE_METHODS.has(context.method.toUpperCase())) return response;
			if (!CACHEABLE_STATUS_CODES.has(response.status)) return response;

			if (policy === undefined) {
				if (statesFreshness(response)) return response;
				return withHeaders(response, [[CACHE_CONTROL_HEADER, NON_CACHEABLE_POLICY]]);
			}

			if (response.headers.has("Set-Cookie")) return refuse(response, "set-cookie", policy);

			let fields = obeyedTargetedFields(
				new Map(
					EDGE_TARGETED_HEADERS.map((name) => [
						name,
						targeted.get(name) ?? response.headers.get(name),
					]),
				),
			);
			let shared = fields.find((field) => field.shared);
			if (isPublicPolicy(policy) && hasSession(context)) {
				return refuse(response, "session-with-public-policy", policy);
			}
			if (shared && hasSession(context)) {
				return refuse(response, "session-with-shared-targeted-policy", shared.value);
			}

			currentLog()?.set({
				cache: {
					policy,
					edge_field: fields[0]?.name ?? CACHE_CONTROL_HEADER,
					tag_count: tags.size,
				},
			});

			let headers: [string, string][] = [[CACHE_CONTROL_HEADER, policy], ...targeted];
			if (tags.size > 0) headers.push([CACHE_TAG_HEADER, cacheTag([...tags])]);
			return withHeaders(response, headers);
		}

		/**
		 * Runs the queued purges. The response is already out, so a failure is a
		 * warning on the invocation's log naming the tags that stayed cached.
		 */
		async function flush(): Promise<void> {
			if (deferred.size === 0) return;

			let purged = [...deferred];
			deferred.clear();

			let result = await purgeCache(cacheInterface, { tags: purged });
			if (!isFailure(result)) return;

			currentLog()?.warn(DEFERRED_PURGE_FAILED_EVENT, {
				error: describePurgeFailure(result.error),
				tags: purged.join(","),
			});
		}

		try {
			return apply(await next());
		} finally {
			await flush();
		}
	};
}
