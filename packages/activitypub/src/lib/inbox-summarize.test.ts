/**
 * `summarize` over the fixtures each implementation sends: replies, quotes and mentions,
 * likes, Misskey and Pleroma emoji reactions and boosts, with remote HTML sanitized and
 * the author's handle built from the actor document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	LOCAL_ACTOR,
	LOCAL_ARTICLE,
	MASTODON_ACTOR,
	MASTODON_ANNOUNCE,
	MASTODON_CREATE_NOTE,
	MASTODON_FOLLOW,
	MASTODON_LIKE,
	MASTODON_QUOTE,
	MISSKEY_ACTOR,
	MISSKEY_REACTION,
} from "../fixtures/index.js";

import type { Inbound } from "./inbox-handle.js";

import { summarize } from "./inbox-summarize.js";
import { parseActivity, parseActor } from "./parse.js";

const ALICE = unwrap(parseActor(MASTODON_ACTOR));

/**
 * The Inbound a handler would receive for `activity`.
 *
 * @param activity - The activity JSON.
 * @param target - The local object it concerns.
 * @param actor - The sender.
 */
function inbound(activity: Record<string, unknown>, target: string | null, actor = ALICE): Inbound {
	let parsed = unwrap(parseActivity(activity));
	let object = typeof parsed.object === "object" ? parsed.object : null;
	return {
		activity: parsed,
		actor,
		origin: new URL(actor.id).origin,
		verification: "signature",
		object,
		target,
		receivedAt: new Date("2026-10-07T12:00:00Z"),
	};
}

describe("summarize", () => {
	test("reads a reply to a local object, with sanitized content and the author's handle", () => {
		let summary = summarize(inbound(MASTODON_CREATE_NOTE, LOCAL_ARTICLE));

		expect(summary).toMatchObject({
			kind: "reply",
			id: MASTODON_CREATE_NOTE.object.id,
			url: MASTODON_CREATE_NOTE.object.url,
			target: LOCAL_ARTICLE,
			author: {
				id: MASTODON_ACTOR.id,
				handle: "@alice@mastodon.social",
				name: "Alice :blobcat:",
				url: "https://mastodon.social/@alice",
				photo: MASTODON_ACTOR.icon.url,
			},
			published: new Date("2026-10-01T12:34:56Z"),
		});
		expect(summary?.content?.text).toContain("Great write-up");
		expect(summary?.content?.html).toContain("<p>");
	});

	test("reads a quote and a mention as mention", () => {
		let quote = summarize(inbound(MASTODON_QUOTE, LOCAL_ARTICLE));
		let mention = summarize(
			inbound(
				{ ...MASTODON_CREATE_NOTE, object: { ...MASTODON_CREATE_NOTE.object, inReplyTo: null } },
				LOCAL_ACTOR,
			),
		);

		expect(quote?.kind).toBe("mention");
		expect(mention?.kind).toBe("mention");
		expect(mention?.target).toBe(LOCAL_ACTOR);
	});

	test("removes scripts and resolves relative links against the object", () => {
		let note = {
			...MASTODON_CREATE_NOTE.object,
			content: '<p>Hi <a href="/tags/x">#x</a><script>alert(1)</script></p>',
			contentMap: {},
		};

		let summary = summarize(inbound({ ...MASTODON_CREATE_NOTE, object: note }, LOCAL_ARTICLE));

		expect(summary?.content?.html).not.toContain("script");
		expect(summary?.content?.html).toContain('href="https://mastodon.social/tags/x"');
	});

	test("reads a Like as like, without content", () => {
		let summary = summarize(inbound(MASTODON_LIKE, LOCAL_ARTICLE));

		expect(summary).toMatchObject({
			kind: "like",
			id: MASTODON_LIKE.id,
			url: MASTODON_LIKE.id,
			content: null,
		});
	});

	test("reads a Misskey reaction and a Pleroma EmojiReact as like, with the emoji", () => {
		let carol = unwrap(parseActor(MISSKEY_ACTOR));
		let misskey = summarize(inbound(MISSKEY_REACTION, LOCAL_ARTICLE, carol));
		let pleroma = summarize(
			inbound({ ...MASTODON_LIKE, type: "EmojiReact", content: "🔥" }, LOCAL_ARTICLE),
		);

		expect(misskey?.kind).toBe("like");
		expect(misskey?.content?.text).toBe(":blobcat:");
		expect(misskey?.author.handle).toBe("@carol@misskey.io");
		expect(pleroma?.kind).toBe("like");
		expect(pleroma?.content?.text).toBe("🔥");
	});

	test("reads an Announce as repost", () => {
		let summary = summarize(inbound(MASTODON_ANNOUNCE, LOCAL_ARTICLE));

		expect(summary).toMatchObject({
			kind: "repost",
			id: MASTODON_ANNOUNCE.id,
			published: new Date("2026-10-01T13:00:00Z"),
		});
	});

	test("answers null for anything that is not a response, or has no target", () => {
		expect(summarize(inbound(MASTODON_FOLLOW, LOCAL_ACTOR))).toBeNull();
		expect(summarize(inbound(MASTODON_LIKE, null))).toBeNull();
	});
});
