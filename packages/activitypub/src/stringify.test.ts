/**
 * The document `stringify` writes: the fixed `@context`, members omitted when they carry
 * nothing, dates and quotes in the forms receivers read, and parsed fixtures that read
 * back to the same values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { FIXTURES } from "./fixtures/index.js";

import type { ActivityPub } from "./index.js";

import {
	AS2_CONTEXT,
	DATA_INTEGRITY_CONTEXT,
	EXTENSION_CONTEXT,
	MULTIKEY_CONTEXT,
	PUBLIC,
	SECURITY_CONTEXT,
	parseActivity,
	parseActor,
	parseCollection,
	stringify,
	tombstone,
} from "./index.js";

/** The actor every document here is attributed to. */
const ACTOR = "https://letters.blog/activitypub/actor";

/** The reader each fixture kind goes through. */
const READERS = {
	activity: parseActivity,
	actor: parseActor,
	collection: parseCollection,
};

/**
 * The decoded JSON `stringify` wrote.
 *
 * @param document - The document to write.
 */
function written(document: ActivityPub.Draft<ActivityPub.Document>): Record<string, unknown> {
	return JSON.parse(stringify(document)) as Record<string, unknown>;
}

describe("stringify", () => {
	test("writes the README's article with the fixed context and ISO dates", () => {
		let article = {
			id: "https://letters.blog/articles/remix-v3",
			type: "Article",
			attributedTo: [ACTOR],
			to: [PUBLIC],
			cc: [`${ACTOR}/followers`],
			name: "Remix v3",
			summary: "What changed and why.",
			content: "<p>Body</p>",
			url: "https://letters.blog/articles/remix-v3",
			published: new Date("2026-10-01T12:00:00Z"),
			tag: [{ type: "Hashtag", name: "#remix", href: "https://letters.blog/tags/remix" }],
		} satisfies ActivityPub.Draft<ActivityPub.Object>;

		expect(written(article)).toEqual({
			"@context": [AS2_CONTEXT, SECURITY_CONTEXT, EXTENSION_CONTEXT],
			id: "https://letters.blog/articles/remix-v3",
			type: "Article",
			attributedTo: [ACTOR],
			to: [PUBLIC],
			cc: [`${ACTOR}/followers`],
			name: "Remix v3",
			summary: "What changed and why.",
			content: "<p>Body</p>",
			url: "https://letters.blog/articles/remix-v3",
			published: "2026-10-01T12:00:00.000Z",
			tag: [{ type: "Hashtag", name: "#remix", href: "https://letters.blog/tags/remix" }],
		});
	});

	test("omits null, empty lists, empty maps, bto and bcc", () => {
		let json = written({
			id: "https://letters.blog/notes/1",
			type: "Note",
			summary: null,
			contentMap: {},
			tag: [],
			to: [PUBLIC],
			bto: ["https://mastodon.social/users/alice"],
			bcc: ["https://mastodon.social/users/bob"],
		});
		expect(Object.keys(json)).toEqual(["@context", "id", "type", "to"]);
	});

	test("writes a non-empty contentMap, and embedded objects without a context", () => {
		let json = written({
			id: "https://letters.blog/notes/1/activity",
			type: "Create",
			actor: ACTOR,
			object: {
				id: "https://letters.blog/notes/1",
				type: "Note",
				content: "<p>Hola</p>",
				contentMap: { es: "<p>Hola</p>" },
			},
		});
		expect(json.object).toEqual({
			id: "https://letters.blog/notes/1",
			type: "Note",
			content: "<p>Hola</p>",
			contentMap: { es: "<p>Hola</p>" },
		});
	});

	test("writes a quote under every name a receiver reads", () => {
		let json = written({
			id: "https://letters.blog/notes/2",
			type: "Note",
			quote: "https://a.blog/1",
		});
		expect(json).toMatchObject({
			quote: "https://a.blog/1",
			_misskey_quote: "https://a.blog/1",
			quoteUri: "https://a.blog/1",
		});
	});

	test("adds the data-integrity and Multikey contexts only when used", () => {
		let json = written({
			id: ACTOR,
			type: "Person",
			preferredUsername: "hello",
			inbox: `${ACTOR}/inbox`,
			endpoints: { sharedInbox: null },
			assertionMethod: [
				{
					id: `${ACTOR}#ed25519-key`,
					type: "Multikey",
					controller: ACTOR,
					publicKeyMultibase: "z6Mk",
				},
			],
			proof: [
				{
					type: "DataIntegrityProof",
					cryptosuite: "eddsa-jcs-2022",
					verificationMethod: `${ACTOR}#ed25519-key`,
					proofPurpose: "assertionMethod",
					proofValue: "z5",
					created: new Date("2026-10-01T00:00:00Z"),
				},
			],
		});
		expect(json["@context"]).toEqual([
			AS2_CONTEXT,
			SECURITY_CONTEXT,
			DATA_INTEGRITY_CONTEXT,
			MULTIKEY_CONTEXT,
			EXTENSION_CONTEXT,
		]);
		expect(json.endpoints).toBeUndefined();
		expect(json.proof).toEqual([expect.objectContaining({ created: "2026-10-01T00:00:00.000Z" })]);
	});

	test("writes a Tombstone", () => {
		expect(
			written(
				tombstone({
					id: "https://letters.blog/notes/1",
					formerType: "Note",
					deleted: new Date("2026-10-02T00:00:00Z"),
				}),
			),
		).toMatchObject({
			type: "Tombstone",
			formerType: "Note",
			deleted: "2026-10-02T00:00:00.000Z",
		});
	});

	test.each(FIXTURES)("$name reads back to the same values", ({ kind, document }) => {
		let first = READERS[kind](document);
		if (first.status === "failure") throw first.error;
		let again = READERS[kind](JSON.parse(stringify(first.data)));
		if (again.status === "failure") throw again.error;
		expect(again.data).toEqual({ ...first.data, ...noBlindCopies(first.data) });
	});
});

/**
 * The members a round trip drops on purpose: `bto` and `bcc` are never written.
 *
 * @param document - A parsed document.
 */
function noBlindCopies(document: object): object {
	return "bto" in document ? { bto: [], bcc: [] } : {};
}
