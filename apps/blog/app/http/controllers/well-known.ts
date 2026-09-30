/**
 * Controller for `.well-known` discovery endpoints. It serves a WebFinger JRD document
 * for the site's canonical identity (normalizing acct-URI and homepage-URL resource
 * forms) and proxies the owner's public avatar as a PNG from GitHub. It exists to make
 * the site discoverable by fediverse and identity clients under standard well-known paths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Jrd, JrdLink } from "@sdxc/well-known/webfinger";

import { badRequest, notFound } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { respond } from "@sdxc/well-known/response";
import { readQuery, select, webFinger } from "@sdxc/well-known/webfinger";
import { createController } from "remix/router";

import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/** Every feed stream, each advertised in all three formats it is served in. */
const FEED_STREAMS = ["feed", "articles", "tutorials", "bookmarks"] as const;

/**
 * RFC 7033 §5 asks every WebFinger answer, errors included, to allow any origin, so a
 * browser-based client can read why a lookup failed as well as what it found.
 */
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

/**
 * One JRD link; the site's links carry no titles or link properties.
 *
 * @param rel Relation type, a registered name or a URI.
 * @param href Absolute target URL.
 * @param type Media type of the target, when a client can use it to pick a link.
 */
function link(rel: string, href: string, type: string | null = null): JrdLink {
	return { rel, href, type, titles: {}, properties: {} };
}

/**
 * Normalizes supported WebFinger resource identifiers to a canonical value.
 *
 * Accepting both the acct URI and homepage URL keeps discovery working for
 * clients that identify a person by account syntax or by plain site URL.
 *
 * @param resource Raw `resource` query parameter from the request URL.
 * @returns The canonical subject when the resource is recognized, otherwise `null`.
 */
function normalizeResource(resource: string) {
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
 * @returns WebFinger document with homepage, avatar, feed, and social profile links.
 */
function createWebFingerDocument(subject: string): Jrd {
	let home = new URL("/", PROFILE.canonical.origin).toString();
	let avatar = new URL(routes.wellKnown.avatar.href(), PROFILE.canonical.origin).toString();
	let feed = (path: string) => new URL(path, PROFILE.canonical.origin).toString();

	return {
		subject,
		aliases: [home],
		properties: {
			"http://schema.org/name": PROFILE.name,
			"http://schema.org/description": PROFILE.summary,
			"http://schema.org/url": home,
			"http://schema.org/image": avatar,
		},
		links: [
			link("self", home, "text/html"),
			link("http://webfinger.net/rel/profile-page", home, "text/html"),
			link("http://webfinger.net/rel/avatar", avatar, "image/png"),
			...FEED_STREAMS.flatMap((stream) => [
				link("alternate", feed(routes.rss[stream].href()), "application/rss+xml"),
				link("alternate", feed(routes.atom[stream].href()), "application/atom+xml"),
				link("alternate", feed(routes.jsonFeed[stream].href()), "application/feed+json"),
			]),
			link("me", PROFILE.x.profile),
			link("me", PROFILE.github.profile),
			link("me", PROFILE.github.sponsor),
			link("me", PROFILE.youtube.profile),
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
		 * Serves the site's WebFinger JRD document for Sergio's canonical identity, keeping
		 * only the links whose relation a `rel` parameter asks for (RFC 7033 §4.3).
		 *
		 * @param ctx Request context providing the parsed request URL.
		 * @returns JRD JSON for known resources, a JSON 400 without `resource`, a JSON 404 for
		 *   anyone else's; every answer allows any origin.
		 */
		async webFinger(ctx) {
			let query = readQuery(ctx.url);
			if (isFailure(query)) {
				return badRequest({ error: query.error.message }, { headers: CORS_HEADERS });
			}

			let subject = normalizeResource(query.data.resource);
			if (!subject) return notFound({ error: "Unknown resource." }, { headers: CORS_HEADERS });

			return await respond(webFinger, select(createWebFingerDocument(subject), query.data.rels), {
				request: ctx.request,
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
