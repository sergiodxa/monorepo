/**
 * Turns a verified reply, mention, like or boost into the same summary a Webmention
 * receiver stores, so an app keeps one moderation queue and one list of responses for
 * both protocols, with remote HTML already sanitized for rendering beside its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

import type { Inbound } from "./inbox-handle.js";
import type { ActivityPub } from "./types.js";

/** A response to local content, in the shape a Webmention is stored in. */
export interface Summary {
	/** A quote reads as a `mention`, the kind Webmention gives a post that links without replying. */
	kind: "reply" | "like" | "repost" | "mention";
	/** The remote post for a reply or mention, the activity for a like or repost. */
	id: string;
	/** The page a reader opens: the post's HTML `url`, else its id. */
	url: string;
	/** The local object or actor the response attaches to. */
	target: string;
	author: SummaryAuthor;
	/** Sanitized against the remote object's id; a Misskey or Pleroma reaction carries its emoji. */
	content: { html: string; text: string } | null;
	published: Date | null;
}

/** Who responded, as a byline shows them. */
export interface SummaryAuthor {
	id: string;
	/** `@user@host`, the form fediverse software displays and resolves. */
	handle: string;
	name: string | null;
	/** The profile page, else the actor's id. */
	url: string;
	/** The avatar. */
	photo: string | null;
}

/**
 * Summarizes a reply, mention, like or boost of local content. A Like with `content`
 * (Misskey's emoji reaction) and Pleroma's `EmojiReact` read as `like`.
 *
 * @param inbound - What a `create`, `update`, `like` or `announce` handler received.
 * @returns The summary, or `null` for any other activity or one with nothing local to attach to.
 * @example
 * let summary = summarize(inbound);
 * if (summary) await filter.check({ content: summary.content?.html ?? "", format: "html", author: summary.author });
 */
export function summarize(inbound: Inbound): Summary | null {
	let { activity, actor, object, target } = inbound;
	if (target === null) return null;
	let author = authorOf(actor);

	if (activity.type === "Create" || activity.type === "Update") {
		if (object === null) return null;
		return {
			kind: object.inReplyTo === target ? "reply" : "mention",
			id: object.id,
			url: object.url ?? object.id,
			target,
			author,
			content: contentOf(object.content, object.id),
			published: object.published ?? activity.published,
		};
	}

	let kind = reactionKind(activity.type);
	if (kind === null) return null;
	return {
		kind,
		id: activity.id,
		url: activity.url ?? activity.id,
		target,
		author,
		content: kind === "like" ? contentOf(activity.content, activity.id) : null,
		published: activity.published,
	};
}

/**
 * The kind a reaction reads as.
 *
 * @param type - The activity's type.
 */
function reactionKind(type: string): "like" | "repost" | null {
	if (type === "Like" || type === "EmojiReact") return "like";
	if (type === "Announce") return "repost";
	return null;
}

/**
 * The byline of an actor.
 *
 * @param actor - The sender.
 */
function authorOf(actor: ActivityPub.Actor): SummaryAuthor {
	let host = URL.parse(actor.id)?.host ?? "";
	return {
		id: actor.id,
		handle: `@${actor.preferredUsername}@${host}`,
		name: actor.name,
		url: actor.url ?? actor.id,
		photo: actor.icon?.url ?? null,
	};
}

/**
 * Remote HTML made safe to render, with its relative URLs resolved against the object, and
 * the text a reader sees in it. `null` when there is no content or no text survives.
 *
 * @param html - The remote markup.
 * @param baseUrl - The object's id.
 */
function contentOf(html: string | null, baseUrl: string): Summary["content"] {
	if (html === null || html.trim() === "") return null;
	let sanitized = HTML.sanitize(html, { baseUrl });
	if (isFailure(sanitized)) return null;
	let parsed = HTML.parse(sanitized.data);
	let text = isFailure(parsed) ? "" : parsed.data.text;
	if (sanitized.data.trim() === "" && text === "") return null;
	return { html: sanitized.data, text };
}
