/**
 * The cache policy a documentation page answers with. Every input to such a page is a
 * file in the deployed bundle plus the code-tab choices the reader's cookies remember,
 * so the page changes when a deploy changes it or when the reader switches tabs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { conditional, etag, policy, vary } from "@sdxc/http/cache";
import { isSuccess } from "@sdxc/result";
import { waitUntil } from "cloudflare:workers";

import { rememberedTabsVariant } from "~/app/services/remembered-tabs";

/** How long a browser reuses its own copy before revalidating against the tag. */
const CLIENT_MAX_AGE = "5 minutes";

/**
 * How long a shared cache may serve a stored copy without asking. A deploy is what
 * changes a page and nothing purges the edge, so this is the longest window a page
 * one deploy behind is acceptable for.
 */
const SHARED_MAX_AGE = "1 hour";

/**
 * Names the build every page was rendered from. The bundler stamps it in; a runner that
 * evaluates this module without that step, such as the test environment, gets a constant.
 * The dev server stamps `null`: its code changes under one process, so no name covers it.
 */
function buildId(): string | null {
	return typeof __BUILD_ID__ === "undefined" ? "development" : __BUILD_ID__;
}

/**
 * Gives a rendered page its cache policy and its validator, and answers a client whose
 * copy is still current with a `304` carrying no body.
 *
 * @param request - The incoming request, carrying the reader's validators.
 * @param response - The rendered page.
 * @param variant - What else the page was rendered from, for the parts of it that come from outside the bundle. Naming it here is what retires a reader's copy when one of those moves between deploys.
 * @returns The page with its policy and validator, or a `304`.
 */
export async function withBundleCache(
	request: Request,
	response: Response,
	variant = "",
): Promise<Response> {
	let body = await response.text();
	let headers = await cacheHeaders(request, response.headers, variant);
	return await conditional(request, new Response(body, { status: response.status, headers }));
}

/**
 * The response headers with the page's cache policy, `Vary` and validator applied, shared by
 * the buffered and the streamed paths so both answer a reader's copy the same way.
 */
async function cacheHeaders(request: Request, source: Headers, variant: string): Promise<Headers> {
	let headers = new Headers(source);

	/**
	 * A page renders the code-tab choices the reader picked, so their picks are part of
	 * what a stored copy is a copy of: a reader who has picked stays inside their own
	 * browser's cache, and only the page every reader gets the same way is worth a
	 */
	let selections = rememberedTabsVariant(request.headers.get("Cookie"));
	let shared = selections === "";

	/**
	 * A stored copy is what a reader should get, and what an author editing the page
	 * beside it should not: the bundle changes on every save in development, so the
	 * browser revalidates each time and the tag below still answers `304` when the
	 */
	let stored = import.meta.env.PROD
		? policy({
				visibility: shared ? "public" : "private",
				maxAge: CLIENT_MAX_AGE,
				sMaxAge: shared ? SHARED_MAX_AGE : undefined,
				staleWhileRevalidate: shared ? "1 day" : undefined,
			})
		: policy({ visibility: "public", noCache: true });

	headers.set("Cache-Control", stored.toString());
	vary(headers, "Cookie");

	let build = buildId();
	if (build !== null) {
		let tag = await etag(`${build}:${new URL(request.url).pathname}:${selections}:${variant}`, {
			weak: true,
		});
		if (isSuccess(tag)) headers.set("ETag", tag.data);
	}

	return headers;
}

/** The request headers that make a render answer `304`, dropped from the render a cache stores. */
const VALIDATOR_HEADERS = ["If-None-Match", "If-Modified-Since"];

/**
 * Gives a streamed render the page's cache policy and validator and answers a repeat `GET`
 * from the colo's Workers cache, keyed by address, build and `variant`. The reader's copy
 * keeps the renderer's stream, so a page's shell and its frame fallbacks reach the browser
 * before the frames do; a stored copy comes back as one chunk, so a blocking frame can
 * inline all of it. Outside the Workers runtime, or in development, every request renders.
 *
 * @param request - The incoming request, whose validators are answered on either path.
 * @param variant - What the page was rendered from beyond its address, such as the cookies it read.
 * @param render - Renders the page for a request carrying no validators, so a miss always stores a whole page.
 * @returns The stored or freshly rendered page, or a `304` when the reader's copy is current.
 */
export async function withStreamCache(
	request: Request,
	variant: string,
	render: (request: Request) => Promise<Response>,
): Promise<Response> {
	let cache = edgeCache();
	let build = buildId();
	let key = new URL(request.url);
	key.searchParams.set("__edge", `${build}:${variant}`);
	let cacheable = request.method === "GET" && cache !== null && build !== null;

	if (cacheable && cache !== null) {
		let hit = await cache.match(key.href);
		if (hit) return await conditional(request, await asOneChunk(hit));
	}

	let unvalidated = new Headers(request.headers);
	for (let name of VALIDATOR_HEADERS) unvalidated.delete(name);
	let rendered = await render(new Request(request, { headers: unvalidated }));
	let headers = await cacheHeaders(request, rendered.headers, variant);
	let control = headers.get("Cache-Control") ?? "";
	let storable =
		cacheable && rendered.status === 200 && control.includes("public") && rendered.body !== null;

	if (!storable || cache === null || rendered.body === null) {
		return await conditional(
			request,
			new Response(rendered.body, { status: rendered.status, headers }),
		);
	}
	let [reader, stored] = rendered.body.tee();
	waitUntil(cache.put(key.href, new Response(stored, { status: 200, headers })));
	return await conditional(request, new Response(reader, { status: 200, headers }));
}

/** A stored response with its whole body in one chunk, which a blocking frame inlines entire. */
async function asOneChunk(response: Response): Promise<Response> {
	let bytes = new Uint8Array(await response.arrayBuffer());
	let body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
	return new Response(body, { status: response.status, headers: response.headers });
}

/**
 * The colo's Workers cache, absent outside the Workers runtime. Cast, since the DOM's
 * `CacheStorage` type shadows the Workers declaration that has `default`.
 */
function edgeCache(): Cache | null {
	if (typeof caches === "undefined") return null;
	return (caches as unknown as { default?: Cache }).default ?? null;
}

/**
 * The values of the named cookies, in the order given, for a cache key: two readers whose
 * named cookies match share a stored copy, and any other cookie leaves the key alone.
 *
 * @param header - The request's `Cookie` header.
 * @param names - The cookies the page renders from.
 * @returns `name=value` pairs joined with `&`, with an empty value for a missing cookie.
 */
export function cookieVariant(header: string | null, names: readonly string[]): string {
	let pairs = new Map(
		(header ?? "").split(";").map((pair) => {
			let [name = "", ...value] = pair.trim().split("=");
			return [name, value.join("=")] as const;
		}),
	);
	return names.map((name) => `${name}=${pairs.get(name) ?? ""}`).join("&");
}
