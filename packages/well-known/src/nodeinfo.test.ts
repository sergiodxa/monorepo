/**
 * Exercises NodeInfo against documents shaped like the ones Mastodon serves: the links
 * document, reading 2.0 and 2.1, writing 2.1, the schema checks, and serving both
 * documents through `respond`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { NodeInfo } from "./nodeinfo.js";

import {
	NODEINFO_2_0,
	NODEINFO_2_1,
	nodeInfo,
	nodeInfoLinks,
	parse,
	parseLinks,
	stringify,
	stringifyLinks,
} from "./nodeinfo.js";
import { respond } from "./response.js";

/** The links document mastodon.social serves at `/.well-known/nodeinfo`. */
const MASTODON_LINKS = JSON.stringify({
	links: [{ rel: NODEINFO_2_0, href: "https://mastodon.social/nodeinfo/2.0" }],
});

/** A NodeInfo 2.0 document in Mastodon's shape. */
const MASTODON_2_0 = JSON.stringify({
	version: "2.0",
	software: {
		name: "mastodon",
		version: "4.3.0",
		repository: "https://github.com/mastodon/mastodon",
	},
	protocols: ["activitypub"],
	services: { outbound: [], inbound: [] },
	usage: {
		users: { total: 2873190, activeMonth: 279547, activeHalfyear: 590328 },
		localPosts: 136425671,
	},
	openRegistrations: true,
	metadata: {
		nodeName: "Mastodon",
		nodeDescription: "The original server operated by the Mastodon gGmbH non-profit",
	},
});

/** The same server described as NodeInfo 2.1. */
const MASTODON_2_1 = JSON.stringify({
	version: "2.1",
	software: {
		name: "mastodon",
		version: "4.3.0",
		repository: "https://github.com/mastodon/mastodon",
		homepage: "https://joinmastodon.org",
	},
	protocols: ["activitypub"],
	services: { outbound: [], inbound: [] },
	usage: {
		users: { total: 2873190, activeMonth: 279547, activeHalfyear: 590328 },
		localPosts: 136425671,
	},
	openRegistrations: true,
	metadata: { nodeName: "Mastodon" },
});

/** A single-author blog's document, as an app would publish it. */
const BLOG: NodeInfo = {
	version: "2.1",
	software: {
		name: "sergiodxa",
		version: "1.0.0",
		repository: null,
		homepage: "https://sergiodxa.com",
	},
	protocols: ["activitypub"],
	services: { inbound: [], outbound: ["atom1.0", "rss2.0"] },
	openRegistrations: false,
	usage: {
		users: { total: 1, activeMonth: 1, activeHalfyear: 1 },
		localPosts: 42,
		localComments: null,
	},
	metadata: {},
};

describe(parseLinks, () => {
	test("reads Mastodon's links document", () => {
		expect(unwrap(parseLinks(MASTODON_LINKS))).toEqual({
			links: [{ rel: NODEINFO_2_0, href: "https://mastodon.social/nodeinfo/2.0" }],
		});
	});

	test("reports a missing links array and links without rel or an absolute href", () => {
		let empty = parseLinks("{}");
		expect(isFailure(empty) && empty.error.issues[0]?.at).toBe("/links");
		let result = parseLinks(JSON.stringify({ links: [{ href: "/nodeinfo/2.1" }, 1] }));
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/links/0/rel",
			"/links/0/href",
			"/links/1",
		]);
	});

	test("round-trips through stringifyLinks", () => {
		expect(JSON.parse(stringifyLinks(unwrap(parseLinks(MASTODON_LINKS))))).toEqual(
			JSON.parse(MASTODON_LINKS),
		);
	});
});

describe(parse, () => {
	test("reads a 2.0 document with 2.1's software members null", () => {
		let document = unwrap(parse(MASTODON_2_0));
		expect(document.version).toBe("2.0");
		expect(document.software).toEqual({
			name: "mastodon",
			version: "4.3.0",
			repository: null,
			homepage: null,
		});
		expect(document.usage).toEqual({
			users: { total: 2873190, activeMonth: 279547, activeHalfyear: 590328 },
			localPosts: 136425671,
			localComments: null,
		});
		expect(document.openRegistrations).toBe(true);
		expect(document.metadata.nodeName).toBe("Mastodon");
	});

	test("reads a 2.1 document's repository and homepage", () => {
		let document = unwrap(parse(MASTODON_2_1));
		expect(document.version).toBe("2.1");
		expect(document.software.repository).toBe("https://github.com/mastodon/mastodon");
		expect(document.software.homepage).toBe("https://joinmastodon.org");
	});

	test("reports every place a document breaks the schema", () => {
		let result = parse(
			JSON.stringify({
				version: "3.0",
				software: { name: "Mastodon" },
				protocols: [],
				services: { inbound: [""], outbound: ["rss2.0"] },
				openRegistrations: "yes",
				usage: { users: { total: -1 }, localPosts: 1.5 },
			}),
		);
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/version",
			"/software/name",
			"/software/version",
			"/protocols",
			"/services/inbound/0",
			"/openRegistrations",
			"/usage/users/total",
			"/usage/localPosts",
			"/metadata",
		]);
	});

	test("keeps protocols and services outside the schema's registry", () => {
		let document = unwrap(
			parse(
				JSON.stringify({
					...(JSON.parse(MASTODON_2_1) as object),
					protocols: ["activitypub", "atproto"],
					services: { inbound: ["bluesky"], outbound: ["rss2.0", "nostr"] },
				}),
			),
		);
		expect(document.protocols).toEqual(["activitypub", "atproto"]);
		expect(document.services).toEqual({ inbound: ["bluesky"], outbound: ["rss2.0", "nostr"] });
	});

	test("reports a missing usage and a protocol that is not a string", () => {
		let result = parse(
			JSON.stringify({
				...(JSON.parse(MASTODON_2_1) as object),
				protocols: [1],
				usage: undefined,
			}),
		);
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/protocols/0",
			"/usage",
		]);
	});

	test("fails on text that is not a JSON object", () => {
		let result = parse("[]");
		expect(isFailure(result) && result.error.format).toBe("nodeinfo");
	});
});

describe(stringify, () => {
	test("round-trips a 2.1 document", () => {
		expect(JSON.parse(stringify(unwrap(parse(MASTODON_2_1))))).toEqual(JSON.parse(MASTODON_2_1));
	});

	test("writes a 2.0 document as 2.1", () => {
		let written = unwrap(parse(stringify(unwrap(parse(MASTODON_2_0)))));
		expect(written.version).toBe("2.1");
		expect(written.usage).toEqual(unwrap(parse(MASTODON_2_0)).usage);
	});

	test("leaves out null members", () => {
		expect(JSON.parse(stringify(BLOG))).toEqual({
			version: "2.1",
			software: { name: "sergiodxa", version: "1.0.0", homepage: "https://sergiodxa.com" },
			protocols: ["activitypub"],
			services: { inbound: [], outbound: ["atom1.0", "rss2.0"] },
			openRegistrations: false,
			usage: { users: { total: 1, activeHalfyear: 1, activeMonth: 1 }, localPosts: 42 },
			metadata: {},
		});
	});
});

describe("respond", () => {
	test("serves the links document as JSON with CORS", async () => {
		let response = await respond(nodeInfoLinks, {
			links: [{ rel: NODEINFO_2_1, href: "https://sergiodxa.com/nodeinfo/2.1" }],
		});
		expect(response.headers.get("Content-Type")).toBe("application/json");
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(await response.json()).toEqual({
			links: [{ rel: NODEINFO_2_1, href: "https://sergiodxa.com/nodeinfo/2.1" }],
		});
	});

	test("serves the document with the 2.1 profile", async () => {
		let response = await respond(nodeInfo, BLOG);
		expect(response.headers.get("Content-Type")).toBe(
			'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"',
		);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(unwrap(nodeInfo.parse(await response.text()))).toEqual(BLOG);
	});
});
