import type { Route } from "./+types/sitemap[.]xml";

// All landing pages with their paths and priorities
const LANDING_PAGES = [
	// Homepage
	{ path: "/", priority: 1.0, changefreq: "weekly" },

	// Features
	{ path: "/features/monitors", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/alerts", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/status-pages", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/analytics", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/teams", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/api", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/integrations", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/maintenance", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/dns", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/ssl", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/cron-jobs", priority: 0.8, changefreq: "monthly" },
	{ path: "/features/content-monitoring", priority: 0.8, changefreq: "monthly" },

	// Use Cases
	{ path: "/use-cases/website-monitoring", priority: 0.7, changefreq: "monthly" },
	{ path: "/use-cases/api-monitoring", priority: 0.7, changefreq: "monthly" },
	{ path: "/use-cases/cron-jobs", priority: 0.7, changefreq: "monthly" },
	{ path: "/use-cases/healthcheck", priority: 0.7, changefreq: "monthly" },
	{ path: "/use-cases/ecommerce", priority: 0.7, changefreq: "monthly" },
	{ path: "/use-cases/saas", priority: 0.7, changefreq: "monthly" },
	{ path: "/use-cases/microservices", priority: 0.7, changefreq: "monthly" },

	// For (audience)
	{ path: "/for/solo-devs", priority: 0.7, changefreq: "monthly" },
	{ path: "/for/startups", priority: 0.7, changefreq: "monthly" },
	{ path: "/for/agencies", priority: 0.7, changefreq: "monthly" },
	{ path: "/for/enterprises", priority: 0.7, changefreq: "monthly" },
	{ path: "/for/devops", priority: 0.7, changefreq: "monthly" },
	{ path: "/for/indie-hackers", priority: 0.7, changefreq: "monthly" },

	// Comparison pages
	{ path: "/vs/uptimerobot", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/better-uptime", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/pingdom", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/statuscake", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/datadog", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/site24x7", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/checkly", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/ohdear", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/cronitor", priority: 0.6, changefreq: "monthly" },
	{ path: "/vs/healthchecks", priority: 0.6, changefreq: "monthly" },

	// Legal
	{ path: "/terms", priority: 0.3, changefreq: "yearly" },
	{ path: "/privacy", priority: 0.3, changefreq: "yearly" },
] as const;

export function loader({ request }: Route.LoaderArgs) {
	let lastmod = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

	let urls = LANDING_PAGES.map(
		(page) => `
  <url>
    <loc>${new URL(page.path, request.url).toString()}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
	).join("");

	let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

	return new Response(sitemap, {
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "public, max-age=3600, s-maxage=86400",
		},
	});
}
