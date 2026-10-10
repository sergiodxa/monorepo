/**
 * The taxonomy the landing page sorts the published packages into: a reader scanning
 * the list is looking for a problem to solve, not an alphabet, so the groups are
 * named after problems. Membership is stated by directory name, and a package the
 * table does not mention falls into {@link OTHER_GROUP}, so a newly published one
 * appears on the page the day it ships instead of vanishing from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One group's title and the directories that belong to it, in the order they read best. */
export interface PackageGroupDefinition {
	title: string;
	packages: string[];
}

/** Where a published package with no group of its own is listed. */
export const OTHER_GROUP = "Everything else";

export const PACKAGE_GROUPS: PackageGroupDefinition[] = [
	{
		title: "HTTP & responses",
		packages: [
			"http",
			"response",
			"api-client",
			"get-client-ip",
			"ip",
			"outbound",
			"user-agent",
			"structured-fields",
			"digest-fields",
			"http-signatures",
			"server-timing",
			"catch-response-middleware",
			"trailing-slash-middleware",
			"no-www-middleware",
			"well-known",
		],
	},
	{
		title: "API design",
		packages: ["openapi", "problem", "json-schema", "pagination", "idempotency", "merge-patch"],
	},
	{
		title: "Identity & security",
		packages: [
			"auth",
			"authz",
			"jwt",
			"passkey",
			"saml",
			"scim",
			"crypto",
			"security-headers",
			"webhooks",
		],
	},
	{
		title: "Forms & abuse",
		packages: ["captcha", "honeypot", "spam", "password-policy", "email-address"],
	},
	{
		title: "Content & formats",
		packages: [
			"markdown",
			"math",
			"diagram",
			"yaml",
			"xml",
			"html",
			"csv",
			"icalendar",
			"epub",
			"zip",
			"distill",
			"jsdoc",
		],
	},
	{
		title: "Feeds & publishing",
		packages: [
			"rss",
			"atom",
			"json-feed",
			"feed",
			"opml",
			"sitemap",
			"robots",
			"microformats",
			"micropub",
			"webmention",
			"websub",
			"activitypub",
			"newsletter",
		],
	},
	{
		title: "Data & storage",
		packages: [
			"data-model",
			"cache",
			"workers-cache",
			"search",
			"session-storage-kv",
			"data-table-d1",
			"data-table-sqlstorage",
		],
	},
	{
		title: "Interface",
		packages: [
			"ui",
			"u",
			"icons",
			"i18n",
			"messageformat",
			"seo",
			"highlight",
			"lazy-route",
			"lazy-frame",
			"qr",
		],
	},
	{
		title: "Operations",
		packages: [
			"jobs",
			"cron",
			"backoff",
			"logger",
			"trace-context",
			"rate-limit",
			"flags",
			"flags-engine",
			"billing",
			"attribution",
			"mail",
			"messaging",
			"web-push",
			"hostname",
			"doh",
			"zone-file",
			"rdap",
			"mcp",
			"cloudflare-pricing",
		],
	},
	{
		title: "Language & values",
		packages: [
			"result",
			"types",
			"dates",
			"duration",
			"strings",
			"semver",
			"location",
			"validate",
			"expression",
			"bracket-params",
			"uuid",
			"typeid",
			"random",
		],
	},
	{ title: "Testing", packages: ["spec", "sample", "cloudflare-mocks"] },
];
