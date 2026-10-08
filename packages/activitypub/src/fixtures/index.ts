/**
 * Every captured-shape document, labelled with the implementation that emits it and the
 * reader it is for, so one test can run each `parse*` over all of them and later suites
 * reuse the same documents as inbound traffic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import {
	GOTOSOCIAL_ACTOR,
	GOTOSOCIAL_CREATE_NOTE,
	GOTOSOCIAL_FEATURED,
	GOTOSOCIAL_FOLLOW,
} from "./gotosocial.js";
import {
	MASTODON_ACCEPT,
	MASTODON_ACTOR,
	MASTODON_ANNOUNCE,
	MASTODON_CREATE_NOTE,
	MASTODON_DELETE_ACTOR,
	MASTODON_DELETE_NOTE,
	MASTODON_FOLLOW,
	MASTODON_FOLLOWERS,
	MASTODON_LIKE,
	MASTODON_OUTBOX_PAGE,
	MASTODON_QUOTE,
	MASTODON_REPLIES,
	MASTODON_UNDO_FOLLOW,
} from "./mastodon.js";
import {
	MISSKEY_ACTOR,
	MISSKEY_CREATE_NOTE,
	MISSKEY_FOLLOW,
	MISSKEY_QUOTE,
	MISSKEY_REACTION,
} from "./misskey.js";
import { PIXELFED_ACTOR, PIXELFED_CREATE_NOTE, PIXELFED_LIKE } from "./pixelfed.js";
import { THREADS_ACTOR, THREADS_CREATE_NOTE, THREADS_LIKE } from "./threads.js";

export * from "./gotosocial.js";
export * from "./mastodon.js";
export * from "./misskey.js";
export * from "./pixelfed.js";
export * from "./shared.js";
export * from "./threads.js";

/** One captured-shape document and the reader that must accept it. */
export interface Fixture {
	/** `<implementation> <what>`, for a test name. */
	name: string;
	kind: "activity" | "actor" | "collection";
	document: unknown;
}

/** Every fixture, grouped by implementation. */
export const FIXTURES: Fixture[] = [
	{ name: "Mastodon actor", kind: "actor", document: MASTODON_ACTOR },
	{ name: "Mastodon Create/Note", kind: "activity", document: MASTODON_CREATE_NOTE },
	{ name: "Mastodon Like", kind: "activity", document: MASTODON_LIKE },
	{ name: "Mastodon Announce", kind: "activity", document: MASTODON_ANNOUNCE },
	{ name: "Mastodon Follow", kind: "activity", document: MASTODON_FOLLOW },
	{ name: "Mastodon Undo/Follow", kind: "activity", document: MASTODON_UNDO_FOLLOW },
	{ name: "Mastodon Accept/Follow", kind: "activity", document: MASTODON_ACCEPT },
	{ name: "Mastodon Delete/Tombstone", kind: "activity", document: MASTODON_DELETE_NOTE },
	{ name: "Mastodon Delete/actor", kind: "activity", document: MASTODON_DELETE_ACTOR },
	{ name: "Mastodon 4.5 quote", kind: "activity", document: MASTODON_QUOTE },
	{ name: "Mastodon followers", kind: "collection", document: MASTODON_FOLLOWERS },
	{ name: "Mastodon outbox page", kind: "collection", document: MASTODON_OUTBOX_PAGE },
	{ name: "Mastodon replies", kind: "collection", document: MASTODON_REPLIES },
	{ name: "Misskey actor", kind: "actor", document: MISSKEY_ACTOR },
	{ name: "Misskey Create/Note", kind: "activity", document: MISSKEY_CREATE_NOTE },
	{ name: "Misskey reaction", kind: "activity", document: MISSKEY_REACTION },
	{ name: "Misskey quote", kind: "activity", document: MISSKEY_QUOTE },
	{ name: "Misskey Follow", kind: "activity", document: MISSKEY_FOLLOW },
	{ name: "Pixelfed actor", kind: "actor", document: PIXELFED_ACTOR },
	{ name: "Pixelfed Create/Note", kind: "activity", document: PIXELFED_CREATE_NOTE },
	{ name: "Pixelfed Like", kind: "activity", document: PIXELFED_LIKE },
	{ name: "GoToSocial actor", kind: "actor", document: GOTOSOCIAL_ACTOR },
	{ name: "GoToSocial Create/Note", kind: "activity", document: GOTOSOCIAL_CREATE_NOTE },
	{ name: "GoToSocial Follow", kind: "activity", document: GOTOSOCIAL_FOLLOW },
	{ name: "GoToSocial featured", kind: "collection", document: GOTOSOCIAL_FEATURED },
	{ name: "Threads actor", kind: "actor", document: THREADS_ACTOR },
	{ name: "Threads Create/Note", kind: "activity", document: THREADS_CREATE_NOTE },
	{ name: "Threads Like", kind: "activity", document: THREADS_LIKE },
];
