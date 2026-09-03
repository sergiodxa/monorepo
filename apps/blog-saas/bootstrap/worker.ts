/**
 * The Cloudflare Worker entrypoint: routes every request to the right destination
 * (custom domain, platform dashboard, wildcard tenant subdomain, or unknown host),
 * meters billable page views, and runs the queue and cron entrypoints the background
 * jobs are dispatched through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { env } from "cloudflare:workers";

import { dispatcher } from "~/app/jobs/dispatcher";
import { container } from "~/app/lib/container";

import { createDashboardRouter } from "./app";
import Blog from "./tenant";

export { Blog };

/** Custom-hostname metadata written by the hostname service, read here. */
interface HostMetadata {
	blog_id?: string;
	region?: string;
}

const RESERVED_SLUGS = new Set([
	"sso",
	"www",
	"api",
	"cdn",
	"assets",
	"mail",
	"status",
	"fallback",
]);

/**
 * Builds the shared 404 response for unroutable hosts/slugs.
 *
 * @returns A 404 Not Found response.
 */
function notFound(): Response {
	return new Response("Not found", { status: 404 });
}

/**
 * Routes a request to a tenant Durable Object (optionally pinned to a region) and
 * meters the billable page view on the way back.
 *
 * @param request The incoming request to forward.
 * @param blogId The tenant blog id used to address the DO.
 * @param region Optional DO location hint keeping the DO near the blog's region.
 * @returns The tenant DO's response.
 */
async function forwardToBlog(request: Request, blogId: string, region?: string): Promise<Response> {
	let locationHint = region as DurableObjectLocationHint | undefined;
	let stub = env.BLOG.getByName(blogId, locationHint ? { locationHint } : undefined);
	let response = await stub.fetch(request);
	trackPageView(request, response, blogId);
	return response;
}

/**
 * Resolves a subdomain slug to its blog. Reads the KV slug cache first; on a miss,
 * looks up the non-deleted blog in D1 and repopulates KV so later requests hit cache.
 *
 * @param slug The subdomain label (the part before `.{PLATFORM_DOMAIN}`).
 * @returns The blog id and region, or `null` if no matching non-deleted blog exists.
 */
async function resolveSlug(slug: string): Promise<{ blogId: string; region: string } | null> {
	let cached = await env.SLUG_CACHE.get<{ blogId: string; region: string }>(`slug:${slug}`, "json");
	if (cached) return cached;

	let row = await env.PLATFORM_DB.prepare(
		"SELECT id, region FROM blogs WHERE slug = ?1 AND status != 'deleted' LIMIT 1",
	)
		.bind(slug)
		.first<{ id: string; region: string }>();
	if (!row) return null;

	let entry = { blogId: row.id, region: row.region };
	await env.SLUG_CACHE.put(`slug:${slug}`, JSON.stringify(entry));
	return entry;
}

/**
 * Resolves a custom domain to its blog by joining the `hostnames` and `blogs` tables
 * in D1. Used for same-zone/explicit-route domains, which arrive without CF for SaaS
 * `hostMetadata`.
 *
 * @param hostname The request's full hostname.
 * @returns The blog id and region for an active hostname on a non-deleted blog, or
 *   `null` if none matches.
 */
async function resolveCustomHostname(
	hostname: string,
): Promise<{ blogId: string; region: string } | null> {
	let row = await env.PLATFORM_DB.prepare(
		`SELECT b.id AS id, b.region AS region FROM hostnames h
		 JOIN blogs b ON b.id = h.blog_id
		 WHERE h.hostname = ?1 AND h.status = 'active' AND b.status != 'deleted' LIMIT 1`,
	)
		.bind(hostname)
		.first<{ id: string; region: string }>();
	return row ? { blogId: row.id, region: row.region } : null;
}

/**
 * Decides whether a request/response pair counts as a billable page view: a `GET`
 * for a non-`/cms` path returning a 200 `text/html` document navigation (identified
 * via `sec-fetch-dest`, falling back to the `accept` header).
 *
 * @param request The incoming request.
 * @param response The response produced for it.
 * @returns `true` if the exchange is a billable page view.
 */
function isBillablePageView(request: Request, response: Response): boolean {
	if (request.method !== "GET") return false;
	if (response.status !== 200) return false;
	let contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("text/html")) return false;
	if (new URL(request.url).pathname.startsWith("/cms")) return false;
	let dest = request.headers.get("sec-fetch-dest");
	if (dest) return dest === "document";
	return (request.headers.get("accept") ?? "").includes("text/html");
}

/**
 * Records a billable page view to Analytics Engine (non-blocking). No-op for
 * exchanges that are not billable page views per {@link isBillablePageView}.
 *
 * @param request The incoming request.
 * @param response The response produced for it.
 * @param blogId The tenant blog id the view is attributed to.
 */
function trackPageView(request: Request, response: Response, blogId: string): void {
	if (!isBillablePageView(request, response)) return;
	let url = new URL(request.url);
	env.ANALYTICS.writeDataPoint({
		blobs: [blogId, "page_view", url.hostname, new Date().toISOString().slice(0, 10)],
		doubles: [1],
		indexes: [blogId],
	});
}

export default {
	/**
	 * Main request handler. Dispatches by hostname in priority order: CF for SaaS
	 * custom domains, the platform domain (assets then dashboard), wildcard tenant
	 * subdomains, then same-zone custom domains from D1; unmatched hosts return 404.
	 *
	 * @param request The incoming request.
	 * @returns The response from the resolved destination, or a 404.
	 */
	async fetch(request) {
		let url = new URL(request.url);
		let hostname = url.hostname;

		let metadata = request.cf?.hostMetadata as HostMetadata | undefined;
		if (metadata?.blog_id) return forwardToBlog(request, metadata.blog_id, metadata.region);

		if (hostname === env.PLATFORM_DOMAIN) {
			let asset = await env.ASSETS.fetch(
				new Request(request.url, { method: request.method, headers: request.headers }),
			);
			if (asset.ok) return asset;

			return container.scope(() => createDashboardRouter().fetch(request));
		}

		if (hostname.endsWith(`.${env.PLATFORM_DOMAIN}`)) {
			let slug = hostname.slice(0, -(env.PLATFORM_DOMAIN.length + 1));
			if (slug.includes(".") || RESERVED_SLUGS.has(slug)) return notFound();
			let entry = await resolveSlug(slug);
			if (!entry) return notFound();
			return forwardToBlog(request, entry.blogId, entry.region);
		}

		let custom = await resolveCustomHostname(hostname);
		if (custom) return forwardToBlog(request, custom.blogId, custom.region);

		return notFound();
	},

	/**
	 * Cron entrypoint. Enqueues every job whose declared schedule is the one that fired
	 * and returns; the work itself happens on the queue delivery.
	 *
	 * @param controller The scheduled controller carrying the triggering `cron`
	 *   expression.
	 */
	async scheduled(controller) {
		await dispatcher.scheduled(controller);
	},

	/**
	 * Queue entrypoint. Runs each delivered message as the job its `type` names, inside
	 * the dispatcher's middleware chain.
	 *
	 * @param batch The delivered messages.
	 */
	async queue(batch) {
		await dispatcher.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
