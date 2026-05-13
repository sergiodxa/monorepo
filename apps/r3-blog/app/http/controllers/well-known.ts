import controller from "@pkg/remix-helpers/controller";

import routes from "~/routes/web";

const CANONICAL_ORIGIN = "https://sergiodxa.com";
const CANONICAL_RESOURCE = "acct:hello@sergiodxa.com";
const CANONICAL_PROFILE_URL = new URL("/", CANONICAL_ORIGIN).toString();
const CANONICAL_AVATAR_URL = new URL(routes.wellKnown.avatar.href(), CANONICAL_ORIGIN).toString();
const X_PROFILE_URL = "https://x.com/sergiodxa";
const GITHUB_PROFILE_URL = "https://github.com/sergiodxa";
const GITHUB_SPONSORS_URL = "https://github.com/sponsors/sergiodxa";
const YOUTUBE_PROFILE_URL = "https://www.youtube.com/sergiodxa";
const GITHUB_AVATAR_URL = "https://github.com/sergiodxa.png";
const PROFILE_NAME = "Sergio Xalambrí";
const PROFILE_SUMMARY =
	"Web Developer from Buenos Aires with 10+ years of experience. I work at Daffy and maintain several open-source libraries around React Router and OAuth2.";

interface WebFingerProperties {
	"http://schema.org/name": string;
	"http://schema.org/description": string;
	"http://schema.org/url": string;
	"http://schema.org/image": string;
}

interface WebFingerLink {
	rel: string;
	href: string;
	type?: string;
}

interface WebFingerDocument {
	subject: string;
	aliases: Array<string>;
	properties: WebFingerProperties;
	links: Array<WebFingerLink>;
}

/**
 * Normalizes supported WebFinger resource identifiers to a canonical value.
 *
 * Accepting both the acct URI and homepage URL keeps discovery working for clients
 * that identify a person by site URL instead of account syntax.
 *
 * @param resource Raw `resource` query parameter from the request URL.
 * @returns The canonical subject when the resource is recognized, otherwise `null`.
 */
function normalizeResource(resource: string | null) {
	if (resource === CANONICAL_RESOURCE) return CANONICAL_RESOURCE;
	if (resource === CANONICAL_ORIGIN) return CANONICAL_RESOURCE;
	if (resource === CANONICAL_PROFILE_URL) return CANONICAL_RESOURCE;

	return null;
}

/**
 * Returns the stable JRD payload advertised for Sergio's public site identity.
 *
 * @param subject Canonical resource identifier to expose in the JRD payload.
 * @returns WebFinger document with homepage, avatar, RSS, and social profile links.
 */
function createWebFingerDocument(subject: string): WebFingerDocument {
	return {
		subject,
		aliases: [CANONICAL_PROFILE_URL],
		properties: {
			"http://schema.org/name": PROFILE_NAME,
			"http://schema.org/description": PROFILE_SUMMARY,
			"http://schema.org/url": CANONICAL_PROFILE_URL,
			"http://schema.org/image": CANONICAL_AVATAR_URL,
		},
		links: [
			{ rel: "self", type: "text/html", href: CANONICAL_PROFILE_URL },
			{
				rel: "http://webfinger.net/rel/profile-page",
				type: "text/html",
				href: CANONICAL_PROFILE_URL,
			},
			{
				rel: "http://webfinger.net/rel/avatar",
				type: "image/png",
				href: CANONICAL_AVATAR_URL,
			},
			{
				rel: "alternate",
				type: "application/rss+xml",
				href: new URL(routes.rss.feed.href(), CANONICAL_ORIGIN).toString(),
			},
			{
				rel: "alternate",
				type: "application/rss+xml",
				href: new URL(routes.rss.articles.href(), CANONICAL_ORIGIN).toString(),
			},
			{
				rel: "alternate",
				type: "application/rss+xml",
				href: new URL(routes.rss.tutorials.href(), CANONICAL_ORIGIN).toString(),
			},
			{
				rel: "alternate",
				type: "application/rss+xml",
				href: new URL(routes.rss.bookmarks.href(), CANONICAL_ORIGIN).toString(),
			},
			{ rel: "me", href: X_PROFILE_URL },
			{ rel: "me", href: GITHUB_PROFILE_URL },
			{ rel: "me", href: GITHUB_SPONSORS_URL },
			{ rel: "me", href: YOUTUBE_PROFILE_URL },
		],
	};
}

/**
 * Groups the `.well-known` resource endpoints exposed by the public site.
 *
 * Contract: `webFinger` returns JRD JSON for the canonical identity, while `avatar`
 * returns a PNG fetched from GitHub using the stable redirecting profile image URL.
 */
export default controller<typeof routes.wellKnown>({
	middleware: [],
	actions: {
		/**
		 * Serves the site's WebFinger JRD document for Sergio's canonical identity.
		 *
		 * @param ctx Request context providing the parsed request URL.
		 * @returns JRD JSON for known resources, or a small JSON error response otherwise.
		 */
		async webFinger(ctx) {
			let resource = ctx.url.searchParams.get("resource");
			let subject = normalizeResource(resource);

			if (!resource) {
				return Response.json(
					{ error: "Missing resource query parameter." },
					{ status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } },
				);
			}

			if (!subject) {
				return Response.json(
					{ error: "Unknown resource." },
					{ status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } },
				);
			}

			let body = createWebFingerDocument(subject);

			return new Response(JSON.stringify(body), {
				headers: {
					"Content-Type": "application/jrd+json; charset=utf-8",
				},
			});
		},

		/**
		 * Proxies Sergio's public avatar as a stable PNG under this site's well-known path.
		 *
		 * `https://github.com/sergiodxa.png` is intentionally stable: GitHub may redirect it to
		 * a versioned `avatars.githubusercontent.com` URL, and `fetch` follows that redirect.
		 *
		 * @returns PNG response sourced from GitHub, or a gateway error when the upstream fails.
		 */
		async avatar() {
			let upstream = await fetch(GITHUB_AVATAR_URL, {
				headers: { Accept: "image/png" },
			});

			if (!upstream.ok) {
				return new Response("Unable to load avatar.", {
					status: 502,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}

			let body = await upstream.arrayBuffer();

			return new Response(body, {
				headers: {
					"Cache-Control": "public, max-age=3600",
					"Content-Type": "image/png",
				},
			});
		},
	},
});
