import { createController } from "remix/fetch-router";

import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

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
	if (resource === PROFILE.canonical.resource) return PROFILE.canonical.resource;
	if (resource === PROFILE.canonical.origin) return PROFILE.canonical.resource;
	if (resource === new URL("/", PROFILE.canonical.origin).toString()) {
		return PROFILE.canonical.resource;
	}

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
		aliases: [new URL("/", PROFILE.canonical.origin).toString()],
		properties: {
			"http://schema.org/name": PROFILE.name,
			"http://schema.org/description": PROFILE.summary,
			"http://schema.org/url": new URL("/", PROFILE.canonical.origin).toString(),
			"http://schema.org/image": new URL(
				routes.wellKnown.avatar.href(),
				PROFILE.canonical.origin,
			).toString(),
		},
		links: [
			{ rel: "self", type: "text/html", href: new URL("/", PROFILE.canonical.origin).toString() },
			{
				rel: "http://webfinger.net/rel/profile-page",
				type: "text/html",
				href: new URL("/", PROFILE.canonical.origin).toString(),
			},
			{
				rel: "http://webfinger.net/rel/avatar",
				type: "image/png",
				href: new URL(routes.wellKnown.avatar.href(), PROFILE.canonical.origin).toString(),
			},
			{
				rel: "alternate",
				type: "application/rss+xml",
				href: new URL(routes.rss.feed.href(), PROFILE.canonical.origin).toString(),
			},
			{
				rel: "alternate",
				type: "application/rss+xml",
				href: new URL(routes.rss.articles.href(), PROFILE.canonical.origin).toString(),
			},
			{
				rel: "alternate",
				type: "application/rss+xml",
				href: new URL(routes.rss.tutorials.href(), PROFILE.canonical.origin).toString(),
			},
			{
				rel: "alternate",
				type: "application/rss+xml",
				href: new URL(routes.rss.bookmarks.href(), PROFILE.canonical.origin).toString(),
			},
			{ rel: "me", href: PROFILE.x.profile },
			{ rel: "me", href: PROFILE.github.profile },
			{ rel: "me", href: PROFILE.github.sponsor },
			{ rel: "me", href: PROFILE.youtube.profile },
		],
	};
}

/**
 * Groups the `.well-known` resource endpoints exposed by the public site.
 *
 * Contract: `webFinger` returns JRD JSON for the canonical identity, while `avatar`
 * returns a PNG fetched from GitHub using the stable redirecting profile image URL.
 */
export default createController(routes.wellKnown, {
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
			let upstream = await fetch(PROFILE.github.avatar, {
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
