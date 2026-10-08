/**
 * The collection builders, written through `stringify` and read back through
 * `parseCollection`, so what an app serves is what a remote server reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	collection,
	collectionPage,
	orderedCollection,
	orderedCollectionPage,
} from "./collections.js";

import { parseCollection, stringify } from "./index.js";

/** The outbox every page here belongs to. */
const OUTBOX = "https://letters.blog/activitypub/outbox";

/** A Create as an app authors it for its outbox. */
const CREATE = {
	id: "https://letters.blog/articles/remix-v3#create",
	type: "Create",
	actor: "https://letters.blog/activitypub/actor",
	object: { id: "https://letters.blog/articles/remix-v3", type: "Article", name: "Remix v3" },
};

describe("orderedCollection", () => {
	test("writes the count-only shape of a followers list", () => {
		let followers = orderedCollection({ id: `${OUTBOX}/followers`, totalItems: 3 });
		expect(JSON.parse(stringify(followers))).toMatchObject({
			id: `${OUTBOX}/followers`,
			type: "OrderedCollection",
			totalItems: 3,
		});
		expect(stringify(followers)).not.toContain("orderedItems");
	});

	test("reads back with its first page", () => {
		let outbox = orderedCollection({ id: OUTBOX, totalItems: 10, first: `${OUTBOX}?page=1` });
		expect(parseCollection(JSON.parse(stringify(outbox)))).toMatchObject({
			status: "success",
			data: { type: "OrderedCollection", first: `${OUTBOX}?page=1`, orderedItems: [] },
		});
	});
});

describe("orderedCollectionPage", () => {
	test("reads back with its activities embedded and the last page's next absent", () => {
		let page = orderedCollectionPage({
			id: `${OUTBOX}?page=1`,
			partOf: OUTBOX,
			orderedItems: [CREATE, "https://letters.blog/articles/old#create"],
			next: null,
			prev: `${OUTBOX}?page=0`,
		});
		let result = parseCollection(JSON.parse(stringify(page)));
		if (result.status === "failure") throw result.error;
		expect(result.data).toMatchObject({
			type: "OrderedCollectionPage",
			partOf: OUTBOX,
			next: null,
			prev: `${OUTBOX}?page=0`,
			orderedItems: [
				expect.objectContaining({
					type: "Create",
					object: expect.objectContaining({ name: "Remix v3" }),
				}),
				"https://letters.blog/articles/old#create",
			],
		});
	});
});

describe("collection and collectionPage", () => {
	test("write the unordered shapes", () => {
		let replies = collection({ id: `${CREATE.object.id}/replies`, totalItems: 0 });
		let page = collectionPage({ id: `${replies.id}?page=1`, partOf: replies.id, items: [] });
		expect(parseCollection(JSON.parse(stringify(replies)))).toMatchObject({
			data: { type: "Collection", totalItems: 0, items: [] },
		});
		expect(parseCollection(JSON.parse(stringify(page)))).toMatchObject({
			data: { type: "CollectionPage", partOf: replies.id },
		});
	});
});
