/**
 * Each wire variation the readers fold, checked on the smallest document that carries
 * it, so a regression names the variation rather than a whole captured fixture.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { ActivityPub } from "./types.js";

import { PUBLIC } from "./constants.js";
import { parseActivity, parseObject } from "./parse.js";

/** The id every document here carries. */
const ID = "https://mastodon.social/users/alice/statuses/1";

/** The actor every activity here names. */
const ACTOR = "https://mastodon.social/users/alice";

/**
 * Parses a Note made of `members`, failing the test when it does not parse.
 *
 * @param members - The members besides `id` and `type`.
 */
function note(members: Record<string, unknown>): ActivityPub.Object {
	let result = parseObject({ id: ID, type: "Note", ...members });
	if (result.status === "failure") throw result.error;
	return result.data;
}

describe("addressing", () => {
	test.each(["as:Public", "Public", PUBLIC])("reads %s as PUBLIC", (spelling) => {
		expect(note({ to: spelling, cc: [spelling, ACTOR] })).toMatchObject({
			to: [PUBLIC],
			cc: [PUBLIC, ACTOR],
		});
	});

	test("reads embedded recipients as their ids, and keeps bto and bcc", () => {
		expect(note({ to: [{ id: ACTOR, type: "Person" }], bto: ACTOR, bcc: [ACTOR] })).toMatchObject({
			to: [ACTOR],
			bto: [ACTOR],
			bcc: [ACTOR],
		});
	});

	test("points at an entry that names nothing", () => {
		let result = parseObject({ id: ID, type: "Note", to: [PUBLIC, 5] });
		if (result.status === "success") throw new Error("Expected a failure.");
		expect(result.error.issues[0]?.at).toBe("/to/1");
	});
});

describe("references", () => {
	test("reduces an embedded author and reply target to IRIs", () => {
		expect(
			note({
				attributedTo: [{ id: ACTOR, type: "Person" }, "https://peertube.tv/video-channels/x"],
				inReplyTo: { id: "https://letters.blog/articles/1", type: "Article" },
			}),
		).toMatchObject({
			attributedTo: [ACTOR, "https://peertube.tv/video-channels/x"],
			inReplyTo: "https://letters.blog/articles/1",
		});
	});

	test("reduces an embedded actor to its IRI, and an array of objects to the first", () => {
		let result = parseActivity({
			id: `${ID}/activity`,
			type: "Announce",
			actor: { id: ACTOR, type: "Person", inbox: `${ACTOR}/inbox` },
			object: ["https://letters.blog/articles/1", "https://letters.blog/articles/2"],
		});
		if (result.status === "failure") throw result.error;
		expect(result.data).toMatchObject({ actor: ACTOR, object: "https://letters.blog/articles/1" });
	});

	test("reads an embedded actor in an Update as an Actor", () => {
		let result = parseActivity({
			id: `${ACTOR}#updates/1`,
			type: "Update",
			actor: ACTOR,
			object: { id: ACTOR, type: "Person", preferredUsername: "alice", inbox: `${ACTOR}/inbox` },
		});
		if (result.status === "failure") throw result.error;
		expect(result.data.object).toMatchObject({ preferredUsername: "alice", movedTo: null });
	});
});

describe("text and language maps", () => {
	test("fills plain values from their maps when only the map was sent", () => {
		expect(
			note({
				contentMap: { es: "<p>Hola</p>", en: "<p>Hi</p>" },
				nameMap: { en: "Title" },
				summaryMap: { en: "CW" },
			}),
		).toMatchObject({
			content: "<p>Hola</p>",
			contentMap: { es: "<p>Hola</p>", en: "<p>Hi</p>" },
			name: "Title",
			summary: "CW",
		});
	});

	test("keeps the plain value when both arrive", () => {
		expect(note({ content: "<p>A</p>", contentMap: { en: "<p>B</p>" } }).content).toBe("<p>A</p>");
	});

	test("reads a Misskey reaction without content from `_misskey_reaction`", () => {
		let result = parseActivity({
			id: "https://misskey.io/likes/1",
			type: "Like",
			actor: "https://misskey.io/users/1",
			object: ID,
			_misskey_reaction: "👍",
		});
		if (result.status === "failure") throw result.error;
		expect(result.data.content).toBe("👍");
	});
});

describe("url", () => {
	test.each([
		["a string", "https://mastodon.social/@alice/1", "https://mastodon.social/@alice/1"],
		["a Link", { type: "Link", href: "https://a.tv/w/1" }, "https://a.tv/w/1"],
		[
			"Links where HTML is not first",
			[
				{ type: "Link", href: "https://a.tv/1.m3u8", mediaType: "application/x-mpegURL" },
				{ type: "Link", href: "https://a.tv/w/1", mediaType: "text/html; charset=utf-8" },
			],
			"https://a.tv/w/1",
		],
		[
			"Links with no HTML",
			[{ type: "Link", href: "https://a.tv/1.mp4", mediaType: "video/mp4" }],
			"https://a.tv/1.mp4",
		],
		["an empty array", [], null],
	])("reads %s", (_label, url, expected) => {
		expect(note({ url }).url).toBe(expected);
	});
});

describe("quote", () => {
	test.each(["quote", "quoteUrl", "quoteUri", "_misskey_quote"])("reads %s", (member) => {
		expect(note({ [member]: "https://letters.blog/articles/1" }).quote).toBe(
			"https://letters.blog/articles/1",
		);
	});

	test("prefers FEP-044f `quote` over the older names", () => {
		expect(note({ quote: "https://a.blog/1", _misskey_quote: "https://a.blog/2" }).quote).toBe(
			"https://a.blog/1",
		);
	});
});

describe("type", () => {
	test("picks the first known name of several, dropping `as:`", () => {
		expect(note({ type: ["x:Custom", "as:Article"] }).type).toBe("Article");
		expect(note({ type: ["x:Custom", "y:Other"] }).type).toBe("x:Custom");
	});
});

describe("tags and attachments", () => {
	test("drops entries of types it does not model and entries missing what they need", () => {
		let object = note({
			tag: [
				{ type: "Hashtag", name: "#ok" },
				{ type: "Hashtag" },
				{ type: "Mention", name: "@x" },
				{ type: "Link", href: "https://a.tv" },
				"https://a.tv/tags/1",
			],
			attachment: [
				{
					type: "Document",
					mediaType: "image/png",
					url: { type: "Link", href: "https://a.tv/1.png" },
				},
				{ type: "Document", mediaType: "image/png" },
				{ type: "Note", content: "?" },
			],
		});
		expect(object.tag).toEqual([{ type: "Hashtag", name: "#ok", href: null }]);
		expect(object.attachment).toEqual([
			{
				type: "Document",
				url: "https://a.tv/1.png",
				mediaType: "image/png",
				name: null,
				blurhash: null,
				width: null,
				height: null,
				focalPoint: null,
			},
		]);
	});
});

describe("dates", () => {
	test("reads ISO 8601 with an offset, and points at an invalid one", () => {
		expect(note({ published: "2026-10-01T12:00:00+02:00" }).published).toEqual(
			new Date("2026-10-01T10:00:00Z"),
		);
		let result = parseObject({ id: ID, type: "Note", updated: "not a date" });
		if (result.status === "success") throw new Error("Expected a failure.");
		expect(result.error.issues[0]?.at).toBe("/updated");
	});
});

describe("proofs", () => {
	test("keeps complete DataIntegrityProofs and drops the rest", () => {
		let object = note({
			proof: [
				{
					type: "DataIntegrityProof",
					cryptosuite: "eddsa-jcs-2022",
					verificationMethod: `${ACTOR}#ed25519-key`,
					proofPurpose: "assertionMethod",
					proofValue:
						"z3sXaxjKs4M3BRicwWA9peyNPJvJqxtGsDmpt1jjoHCjgeUf71TRFz56osPSfDErszyLp5Ks1EhYSgpDaNM977Rg2",
					created: "2026-10-01T12:00:00Z",
				},
				{ type: "DataIntegrityProof", cryptosuite: "eddsa-jcs-2022" },
				{ type: "RsaSignature2017", signatureValue: "x" },
			],
		});
		expect(object.proof).toEqual([
			expect.objectContaining({
				cryptosuite: "eddsa-jcs-2022",
				created: new Date("2026-10-01T12:00:00Z"),
			}),
		]);
	});
});
