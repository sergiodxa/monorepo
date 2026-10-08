/**
 * The WebFinger link to an actor, written into a JRD the way Mastodon reads it, and
 * `lookup` resolving a handle through WebFinger and the actor against MSW servers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { MemoryCache } from "@sdxc/cache/memory";
import { isFailure, unwrap } from "@sdxc/result";
import { stringify } from "@sdxc/well-known/webfinger";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { actorLink, lookup } from "./discovery.js";
import { MASTODON_ACTOR } from "./fixtures/index.js";
import { createResolver } from "./remote.js";

const ACTOR = "https://mastodon.social/users/alice";
const WEBFINGER = "https://mastodon.social/.well-known/webfinger";
const USER_AGENT = "letters.blog/1.0 (+https://letters.blog)";

const server = setupServer();

let requests: Request[];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => {
	requests = [];
	server.use(publicDns());
	server.events.on("request:start", ({ request }) => {
		if (!request.url.startsWith("https://cloudflare-dns.com/")) requests.push(request.clone());
	});
});

afterEach(() => {
	server.events.removeAllListeners();
	server.resetHandlers();
});

afterAll(() => server.close());

/** Every name resolves to one public address, so the outbound DNS check lets it through. */
function publicDns() {
	return http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
		let url = new URL(request.url);
		let name = url.searchParams.get("name") ?? "";
		let asksA = url.searchParams.get("type") !== "AAAA";
		return HttpResponse.json({
			Status: 0,
			Answer: asksA ? [{ name, type: 1, TTL: 60, data: "93.184.216.34" }] : [],
		});
	});
}

/** A JRD for `acct:alice@mastodon.social` with the given links. */
function webfinger(links: Array<Record<string, string>>) {
	return http.get(WEBFINGER, () =>
		HttpResponse.json(
			{ subject: "acct:alice@mastodon.social", links },
			{ headers: { "content-type": "application/jrd+json" } },
		),
	);
}

/** The actor served as Mastodon serves it. */
function actor(json: Record<string, unknown> = MASTODON_ACTOR) {
	return http.get(ACTOR, () => HttpResponse.json(json));
}

/** A resolver over a fresh memory cache. */
function resolver() {
	return createResolver({ cache: new MemoryCache(), userAgent: USER_AGENT });
}

test("actorLink is a self link typed as ActivityStreams", () => {
	let jrd = {
		subject: "acct:hello@letters.blog",
		aliases: [],
		properties: {},
		links: [actorLink("https://letters.blog/activitypub/actor")],
	};
	expect((JSON.parse(stringify(jrd)) as { links: unknown }).links).toEqual([
		{
			rel: "self",
			type: "application/activity+json",
			href: "https://letters.blog/activitypub/actor",
		},
	]);
});

describe("lookup", () => {
	test.each(["@alice@mastodon.social", "alice@mastodon.social", "acct:alice@mastodon.social"])(
		"resolves %s through WebFinger and the self link",
		async (handle) => {
			server.use(
				webfinger([
					{
						rel: "http://webfinger.net/rel/profile-page",
						type: "text/html",
						href: "https://mastodon.social/@alice",
					},
					{ rel: "self", type: "application/activity+json", href: ACTOR },
				]),
				actor(),
			);

			let result = await lookup(handle, { resolver: resolver(), userAgent: USER_AGENT });

			expect(unwrap(result).id).toBe(ACTOR);
			let query = new URL(requests[0]?.url ?? "");
			expect(query.searchParams.get("resource")).toBe("acct:alice@mastodon.social");
			expect(requests[0]?.headers.get("accept")).toBe("application/jrd+json");
			expect(requests[0]?.headers.get("user-agent")).toBe(USER_AGENT);
		},
	);

	test("takes a self link typed as JSON-LD with the ActivityStreams profile", async () => {
		server.use(
			webfinger([
				{
					rel: "self",
					type: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
					href: ACTOR,
				},
			]),
			actor(),
		);

		let result = await lookup("alice@mastodon.social", { resolver: resolver() });

		expect(unwrap(result).id).toBe(ACTOR);
	});

	test("answers not-found when WebFinger names no ActivityStreams actor", async () => {
		server.use(
			webfinger([{ rel: "self", type: "text/html", href: "https://mastodon.social/@alice" }]),
		);

		let result = await lookup("alice@mastodon.social", { resolver: resolver() });

		expect(isFailure(result) && result.error.code).toBe("not-found");
	});

	test("answers not-found for an account the host does not know", async () => {
		server.use(http.get(WEBFINGER, () => new HttpResponse(null, { status: 404 })));

		let result = await lookup("nobody@mastodon.social", { resolver: resolver() });

		expect(isFailure(result) && result.error.code).toBe("not-found");
	});

	test("refuses an actor whose preferredUsername is another user", async () => {
		server.use(
			webfinger([{ rel: "self", type: "application/activity+json", href: ACTOR }]),
			actor({ ...MASTODON_ACTOR, preferredUsername: "mallory" }),
		);

		let result = await lookup("alice@mastodon.social", { resolver: resolver() });

		expect(isFailure(result) && result.error.code).toBe("id-mismatch");
	});

	test("matches the user regardless of case", async () => {
		server.use(
			webfinger([{ rel: "self", type: "application/activity+json", href: ACTOR }]),
			actor(),
		);

		let result = await lookup("Alice@mastodon.social", {
			resolver: resolver(),
		});

		expect(isFailure(result)).toBe(false);
	});

	test("answers invalid-document for a WebFinger answer that is not a JRD", async () => {
		server.use(http.get(WEBFINGER, () => HttpResponse.text("<html></html>")));

		let result = await lookup("alice@mastodon.social", { resolver: resolver() });

		expect(isFailure(result) && result.error.code).toBe("invalid-document");
	});

	test.each(["alice", "@alice", "alice@", "alice@host/path", "https://mastodon.social/@alice"])(
		"refuses %s, which names no host",
		async (handle) => {
			let result = await lookup(handle, { resolver: resolver() });

			expect(isFailure(result) && result.error.code).toBe("refused-url");
			expect(requests).toHaveLength(0);
		},
	);

	test("refuses a handle on a host inside a network before any request", async () => {
		let result = await lookup("admin@127.0.0.1", { resolver: resolver() });

		expect(isFailure(result) && result.error.code).toBe("refused-url");
		expect(requests).toHaveLength(0);
	});
});
