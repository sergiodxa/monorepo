/**
 * Runs every `parse*` over documents in the shapes Mastodon, Misskey, Pixelfed,
 * GoToSocial and Threads emit, and checks the failures that name every broken member.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	FIXTURES,
	GOTOSOCIAL_ACTOR,
	GOTOSOCIAL_CREATE_NOTE,
	GOTOSOCIAL_FEATURED,
	LOCAL_ACTOR,
	LOCAL_ARTICLE,
	MASTODON_ACCEPT,
	MASTODON_ACTOR,
	MASTODON_CREATE_NOTE,
	MASTODON_DELETE_ACTOR,
	MASTODON_DELETE_NOTE,
	MASTODON_FOLLOWERS,
	MASTODON_OUTBOX_PAGE,
	MASTODON_QUOTE,
	MASTODON_REPLIES,
	MASTODON_UNDO_FOLLOW,
	MISSKEY_ACTOR,
	MISSKEY_QUOTE,
	MISSKEY_REACTION,
	PIXELFED_CREATE_NOTE,
	THREADS_ACTOR,
	THREADS_CREATE_NOTE,
} from "./fixtures/index.js";

import type { ActivityPub } from "./index.js";

import {
	ActivityPubError,
	ActivityPubParseError,
	PUBLIC,
	parseActivity,
	parseActor,
	parseCollection,
	parseObject,
} from "./index.js";

/** A minimal activity to break one member of at a time. */
const MINIMAL_LIKE = {
	id: "https://mastodon.social/users/alice#likes/1",
	type: "Like",
	actor: "https://mastodon.social/users/alice",
	object: LOCAL_ARTICLE,
};

/** The reader each fixture kind goes through. */
const READERS = {
	activity: parseActivity,
	actor: parseActor,
	collection: parseCollection,
};

/**
 * The parsed value of a document that must parse, failing the test with every issue
 * otherwise.
 *
 * @param result - A `parse*` result.
 */
function data<T>(result: { status: "success"; data: T } | { status: "failure"; error: Error }): T {
	if (result.status === "failure") throw result.error;
	return result.data;
}

/**
 * The embedded object of an activity, failing when it arrived as an IRI.
 *
 * @param activity - A parsed activity.
 */
function embedded(activity: ActivityPub.Activity): ActivityPub.Object | ActivityPub.Activity {
	if (activity.object === null || typeof activity.object === "string") {
		throw new Error("The activity's object is not embedded.");
	}
	return activity.object;
}

describe("every fixture", () => {
	test.each(FIXTURES)("$name parses", ({ kind, document }) => {
		let result = READERS[kind](document);
		expect(result.status === "failure" ? result.error.issues : []).toEqual([]);
	});
});

describe("parseActor", () => {
	test("reads a Mastodon actor's keys, endpoints, fields and images", () => {
		let actor = data(parseActor(MASTODON_ACTOR));
		expect(actor).toMatchObject({
			id: "https://mastodon.social/users/alice",
			type: "Person",
			preferredUsername: "alice",
			inbox: "https://mastodon.social/users/alice/inbox",
			featured: "https://mastodon.social/users/alice/collections/featured",
			endpoints: { sharedInbox: "https://mastodon.social/inbox" },
			publicKey: {
				id: "https://mastodon.social/users/alice#main-key",
				owner: "https://mastodon.social/users/alice",
			},
			alsoKnownAs: ["https://hachyderm.io/users/alice"],
			discoverable: true,
			indexable: true,
			manuallyApprovesFollowers: false,
			url: "https://mastodon.social/@alice",
		});
		expect(actor.attachment).toEqual([
			expect.objectContaining({ type: "PropertyValue", name: "Website" }),
			{ type: "PropertyValue", name: "Pronouns", value: "she/her" },
		]);
		expect(actor.icon?.mediaType).toBe("image/png");
		expect(actor.published).toEqual(new Date("2022-11-05T00:00:00Z"));
		expect(actor.tag).toEqual([expect.objectContaining({ type: "Emoji", name: ":blobcat:" })]);
	});

	test("reads Misskey's null image and typed Key", () => {
		let actor = data(parseActor(MISSKEY_ACTOR));
		expect(actor.image).toBeNull();
		expect(actor.icon?.url).toBe("https://media.misskey-io.jp/files/webpublic-0a1b2c3d.webp");
		expect(actor.publicKey?.id).toBe("https://misskey.io/users/9k2xq3h7c1#main-key");
	});

	test("reads GoToSocial's fragmentless key id and manual approval", () => {
		let actor = data(parseActor(GOTOSOCIAL_ACTOR));
		expect(actor.publicKey?.id).toBe("https://gts.superseriousbusiness.org/users/erin/main-key");
		expect(actor.manuallyApprovesFollowers).toBe(true);
	});

	test("reads Threads' trailing-slash ids and empty summary", () => {
		let actor = data(parseActor(THREADS_ACTOR));
		expect(actor.id).toBe("https://threads.net/ap/users/17841400000000001/");
		expect(actor.summary).toBe("");
		expect(actor.indexable).toBe(false);
	});

	test("refuses a document that is not an actor type", () => {
		let result = parseActor({ ...MASTODON_ACTOR, type: "Note" });
		expect(result.status).toBe("failure");
		if (result.status === "failure") expect(result.error.issues[0]?.at).toBe("/type");
	});

	test("names every member a followable actor lacks", () => {
		let { inbox: _inbox, preferredUsername: _name, ...rest } = MASTODON_ACTOR;
		let result = parseActor(rest);
		if (result.status === "success") throw new Error("Expected a failure.");
		expect(result.error.issues.map((issue) => issue.at).sort()).toEqual([
			"/inbox",
			"/preferredUsername",
		]);
	});

	test("fails on a present but incomplete publicKey", () => {
		let result = parseActor({ ...MASTODON_ACTOR, publicKey: { id: "x" } });
		if (result.status === "success") throw new Error("Expected a failure.");
		expect(result.error.issues[0]?.at).toBe("/publicKey");
	});
});

describe("parseActivity", () => {
	test("keeps a Mastodon Create's embedded Note with every wire variation read", () => {
		let activity = data(parseActivity(MASTODON_CREATE_NOTE));
		expect(activity).toMatchObject({
			type: "Create",
			actor: "https://mastodon.social/users/alice",
		});
		let note = embedded(activity);
		expect(note).toMatchObject({
			type: "Note",
			attributedTo: ["https://mastodon.social/users/alice"],
			to: [PUBLIC],
			cc: ["https://mastodon.social/users/alice/followers", LOCAL_ACTOR],
			inReplyTo: LOCAL_ARTICLE,
			url: "https://mastodon.social/@alice/113250000000000001",
			sensitive: false,
			summary: null,
			quote: null,
		});
		expect(note.contentMap.en).toBe(note.content);
		expect(note.attachment).toEqual([
			{
				type: "Document",
				url: "https://files.mastodon.social/media_attachments/files/113/250/000/000/000/001/original/photo.jpeg",
				mediaType: "image/jpeg",
				name: "A whiteboard covered in route diagrams",
				blurhash: "UBL_:rOpGG-oBUNG,qRj2so|=eE1w^n4S5NH",
				width: 1600,
				height: 1200,
				focalPoint: [0.1, -0.25],
			},
		]);
		expect(note.tag.map((tag) => tag.type)).toEqual(["Mention", "Hashtag", "Emoji"]);
		expect(note.updated).toEqual(new Date("2026-10-01T12:40:00Z"));
	});

	test("keeps the Follow an Undo and an Accept embed", () => {
		let undo = data(parseActivity(MASTODON_UNDO_FOLLOW));
		expect(embedded(undo)).toMatchObject({ type: "Follow", object: LOCAL_ACTOR });
		let accept = data(parseActivity(MASTODON_ACCEPT));
		expect(embedded(accept)).toMatchObject({ type: "Follow", actor: LOCAL_ACTOR });
	});

	test("reads a Delete of a Tombstone and a Delete of an actor IRI", () => {
		let note = data(parseActivity(MASTODON_DELETE_NOTE));
		expect(embedded(note).type).toBe("Tombstone");
		let actor = data(parseActivity(MASTODON_DELETE_ACTOR));
		expect(actor.object).toBe("https://mastodon.social/users/bob");
	});

	test("reads the quote from Mastodon 4.5's `quote`", () => {
		let activity = data(parseActivity(MASTODON_QUOTE));
		expect(embedded(activity).quote).toBe(LOCAL_ARTICLE);
	});

	test("reads the quote from Misskey's `_misskey_quote` and `quoteUrl`", () => {
		let activity = data(parseActivity(MISSKEY_QUOTE));
		expect(embedded(activity).quote).toBe(LOCAL_ARTICLE);
	});

	test("reads a Misskey reaction's emoji as the Like's content", () => {
		let like = data(parseActivity(MISSKEY_REACTION));
		expect(like).toMatchObject({ type: "Like", object: LOCAL_ARTICLE, content: ":blobcat:" });
		expect(like.tag[0]).toMatchObject({ type: "Emoji", name: ":blobcat:" });
	});

	test("reads Pixelfed's Image attachments as media", () => {
		let note = embedded(data(parseActivity(PIXELFED_CREATE_NOTE)));
		expect(note.attachment).toHaveLength(2);
		expect(note.attachment[0]).toMatchObject({ type: "Image", width: 1080, height: 1350 });
		expect(note.attachment[1]).toMatchObject({ type: "Image", name: null });
	});

	test("reads GoToSocial's single-value addressing and tag as arrays", () => {
		let activity = data(parseActivity(GOTOSOCIAL_CREATE_NOTE));
		expect(activity.to).toEqual([PUBLIC]);
		expect(activity.cc).toEqual(["https://gts.superseriousbusiness.org/users/erin/followers"]);
		let note = embedded(activity);
		expect(note.to).toEqual([PUBLIC]);
		expect(note.tag).toEqual([{ type: "Mention", href: LOCAL_ACTOR, name: "@hello@letters.blog" }]);
		expect(note.summary).toBe("");
	});

	test("reads Threads' `as:Public` and picks the HTML link from a list", () => {
		let activity = data(parseActivity(THREADS_CREATE_NOTE));
		expect(activity.to).toEqual([PUBLIC]);
		let note = embedded(activity);
		expect(note.url).toBe("https://www.threads.net/@frank/post/C8abcdEFgh");
		expect(note.published).toEqual(new Date("2026-10-05T15:00:00Z"));
	});

	test("accepts an activity type it does not model, keeping the type", () => {
		let activity = data(
			parseActivity({
				id: "https://sharkey.social/bites/1",
				type: "Bite",
				actor: "https://sharkey.social/users/1",
				target: LOCAL_ARTICLE,
			}),
		);
		expect(activity).toMatchObject({ type: "Bite", target: LOCAL_ARTICLE, object: null });
	});

	test("refuses an activity without an actor, pointing at it", () => {
		let { actor: _actor, ...rest } = MINIMAL_LIKE;
		let result = parseActivity(rest);
		if (result.status === "success") throw new Error("Expected a failure.");
		expect(result.error).toBeInstanceOf(ActivityPubParseError);
		expect(result.error).toBeInstanceOf(ActivityPubError);
		expect(result.error).toMatchObject({
			code: "invalid-document",
			retryable: false,
			kind: "activity",
		});
		expect(result.error.issues).toEqual([{ at: "/actor", message: '"actor" is required.' }]);
	});

	test("points into an embedded object that breaks the shape", () => {
		let result = parseActivity({
			...MASTODON_CREATE_NOTE,
			object: { ...MASTODON_CREATE_NOTE.object, published: "yesterday", content: 5 },
		});
		if (result.status === "success") throw new Error("Expected a failure.");
		expect(result.error.issues.map((issue) => issue.at).sort()).toEqual([
			"/object/content",
			"/object/published",
		]);
		expect(result.error.message).toMatch(/^Invalid activity at \/object\//);
	});

	test("refuses a relative id and a value that is not an object", () => {
		let relative = parseActivity({ ...MINIMAL_LIKE, id: "/likes/1" });
		if (relative.status === "success") throw new Error("Expected a failure.");
		expect(relative.error.issues[0]?.at).toBe("/id");

		let array = parseActivity([MINIMAL_LIKE]);
		if (array.status === "success") throw new Error("Expected a failure.");
		expect(array.error.issues).toEqual([{ at: "", message: "The document is not a JSON object." }]);
	});
});

describe("parseObject", () => {
	test("keeps an unknown type and reads a Tombstone as an Object", () => {
		let question = data(
			parseObject({ id: "https://mastodon.social/users/alice/statuses/1", type: "Question" }),
		);
		expect(question).toMatchObject({ type: "Question", to: [], tag: [], contentMap: {} });
		let tombstone = data(parseObject(MASTODON_DELETE_NOTE.object));
		expect(tombstone.type).toBe("Tombstone");
	});
});

describe("parseCollection", () => {
	test("reads a followers collection that shows only its count", () => {
		expect(data(parseCollection(MASTODON_FOLLOWERS))).toEqual({
			id: "https://mastodon.social/users/alice/followers",
			type: "OrderedCollection",
			totalItems: 1234,
			first: "https://mastodon.social/users/alice/followers?page=1",
			last: null,
			orderedItems: [],
		});
	});

	test("reads an outbox page's activities, embedded and by IRI", () => {
		let page = data(parseCollection(MASTODON_OUTBOX_PAGE));
		if (page.type !== "OrderedCollectionPage") throw new Error("Expected a page.");
		expect(page.partOf).toBe("https://mastodon.social/users/alice/outbox");
		expect(page.orderedItems).toHaveLength(2);
		expect(page.orderedItems[1]).toMatchObject({ type: "Create", actor: MASTODON_ACTOR.id });
	});

	test("reads Mastodon's replies with the first page embedded without an id", () => {
		let replies = data(parseCollection(MASTODON_REPLIES));
		if (replies.type !== "Collection") throw new Error("Expected a collection.");
		expect(replies.first).toMatchObject({ type: "CollectionPage", id: null, items: [] });
	});

	test("reads GoToSocial's featured posts as IRIs", () => {
		let featured = data(parseCollection(GOTOSOCIAL_FEATURED));
		if (featured.type !== "OrderedCollection") throw new Error("Expected a collection.");
		expect(featured.orderedItems.every((item) => typeof item === "string")).toBe(true);
	});

	test("refuses a document that is not a collection", () => {
		let result = parseCollection(MASTODON_ACTOR);
		if (result.status === "success") throw new Error("Expected a failure.");
		expect(result.error).toMatchObject({ kind: "collection" });
		expect(result.error.issues[0]?.at).toBe("/type");
	});
});
