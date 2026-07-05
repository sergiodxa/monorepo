import { Logger } from "@pkg/logger/request";
import { env } from "cloudflare:workers";

import { pollHostnames } from "~/app/jobs/poll-hostnames";
import { purgeDeletedBlogs } from "~/app/jobs/purge-deleted-blogs";
import { reportUsage } from "~/app/jobs/report-usage";
import { container } from "~/app/lib/container";

import { createDashboardRouter } from "./app";
import Blog from "./tenant";

export { Blog };

/** Custom-hostname metadata written by the hostname service, read here. */
interface HostMetadata {
	blog_id?: string;
	region?: string;
}

/** Slugs never routed to a tenant DO (reserved subdomains). */
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

function notFound(): Response {
	return new Response("Not found", { status: 404 });
}

/** Routes a request to the tenant DO and meters billable page views. */
async function forwardToBlog(request: Request, blogId: string, region?: string): Promise<Response> {
	let locationHint = region as DurableObjectLocationHint | undefined;
	let stub = env.BLOG.getByName(blogId, locationHint ? { locationHint } : undefined);
	let response = await stub.fetch(request);
	trackPageView(request, response, blogId);
	return response;
}

/** KV-first slug → blog resolution; cache misses fall back to D1 and repopulate KV. */
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

/** Same-zone/explicit-route custom domains carry no hostMetadata: look them up in D1. */
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

/** A billable page view: GET, non-/cms, 200 text/html document navigation. */
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

/** Non-blocking Analytics Engine write for a billable page view. */
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
	async fetch(request) {
		let url = new URL(request.url);
		let hostname = url.hostname;

		// 1. Custom domain via CF for SaaS custom metadata.
		let metadata = request.cf?.hostMetadata as HostMetadata | undefined;
		if (metadata?.blog_id) return forwardToBlog(request, metadata.blog_id, metadata.region);

		// 2. Platform domain -> static assets, then dashboard/marketing router.
		if (hostname === env.PLATFORM_DOMAIN) {
			let asset = await env.ASSETS.fetch(
				new Request(request.url, { method: request.method, headers: request.headers }),
			);
			if (asset.ok) return asset;

			let logger = new Logger(request);
			try {
				let response = await container.scope(() => createDashboardRouter().fetch(request));
				logger.response = response;
				return response;
			} finally {
				logger.flush();
			}
		}

		// 3. Wildcard subdomain {slug}.blog.sergiodxa.com.
		if (hostname.endsWith(`.${env.PLATFORM_DOMAIN}`)) {
			let slug = hostname.slice(0, -(env.PLATFORM_DOMAIN.length + 1));
			if (slug.includes(".") || RESERVED_SLUGS.has(slug)) return notFound();
			let entry = await resolveSlug(slug);
			if (!entry) return notFound();
			return forwardToBlog(request, entry.blogId, entry.region);
		}

		// 4. Unknown host: same-zone/explicit-route custom domains (no hostMetadata).
		let custom = await resolveCustomHostname(hostname);
		if (custom) return forwardToBlog(request, custom.blogId, custom.region);

		return notFound();
	},

	async scheduled(controller) {
		await container.scope(async () => {
			if (controller.cron === "0 1 * * *") await reportUsage();
			if (controller.cron === "0 2 * * *") {
				await purgeDeletedBlogs();
				await pollHostnames();
			}
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;
