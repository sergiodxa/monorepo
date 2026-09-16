/**
 * The tools this reader offers an agent, declared the way routes are: a name, a description
 * that is the prompt a model chooses by, and the JSON Schema its arguments must satisfy.
 *
 * Every one of them is a projection of an RPC the web app already runs, so there is no
 * second data path here — only a schema, a bound and a shape. No argument names a reader:
 * the token decided which object answers, and no method below takes a subject.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { tool, tools } from "@sdxc/mcp";

/** Posts one page carries when the caller names no size. */
export const DEFAULT_PAGE = 20;

/**
 * The largest page a caller may ask for. A post is roughly 120 tokens of title, excerpt,
 * author, link and dates, so fifty is already most of what anybody wants to spend on one
 * tool call — the ceiling rather than the default.
 */
export const MAX_PAGE = 50;

/** Hints for a tool that only reads, and reaches nothing outside this reader's own data. */
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/**
 * The page reference, described so a model passes it back rather than reading it. It is a
 * keyset cursor, stable while the timeline moves under a reader who is away, which is why
 * there is no offset to page by instead.
 */
const CURSOR = {
	type: "string",
	description:
		"A page reference a previous call returned as nextCursor. Pass it back exactly as it was given; never build one, parse one, or guess one. Omit it for the first page.",
	minLength: 1,
	maxLength: 512,
} as const;

/** How many posts a page holds, bounded so one call cannot read a whole timeline. */
const LIMIT = {
	type: "integer",
	description: "How many posts to return.",
	minimum: 1,
	maximum: MAX_PAGE,
	default: DEFAULT_PAGE,
} as const;

/** Which posts a page of the queue holds, in the three states the reader's own views offer. */
const READ_STATE = {
	type: "string",
	enum: ["unread", "read", "all"],
	description: "Which posts to return. Defaults to the ones the reader has yet to read.",
	default: "unread",
} as const;

/** This app's own handle for a subscription, as every list and resource reports it. */
const FEED_ID = {
	type: "string",
	description: "The feed's id, as list_feeds and read_timeline report it.",
	minLength: 1,
	maxLength: 64,
} as const;

/** One stored post, named by the id every list and resource reports. */
const ITEM_ID = {
	type: "string",
	description: "The post's id, as read_timeline and the other reading tools report it.",
	minLength: 1,
	maxLength: 64,
} as const;

/**
 * The tool tree the MCP handler is mapped against.
 *
 * Grouped so one controller file owns one group, and a tool added here is a type error
 * until that controller answers for it.
 */
export default tools({
	timeline: tools({
		read: tool("read_timeline", {
			title: "Read the reading queue",
			description:
				"Read the reader's queue: every post from every feed they follow, newest first. Use this to answer what is new or what they have waiting. Asking for the first page also checks their feeds for anything published since they last looked; paging does not. Use search_timeline instead when looking for posts about something in particular.",
			input: {
				type: "object",
				properties: { readState: READ_STATE, cursor: CURSOR, limit: LIMIT },
			},
			annotations: READ_ONLY,
		}),

		search: tool("search_timeline", {
			title: "Search the reading queue",
			description:
				"Find posts in the reader's queue whose title, excerpt or author contains some words. Use this whenever looking for writing on a particular subject; use read_timeline when the question is what is new rather than what is about something.",
			input: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Words to look for, matched anywhere in a title, excerpt or author.",
						minLength: 1,
						maxLength: 200,
					},
					readState: READ_STATE,
					cursor: CURSOR,
					limit: LIMIT,
				},
				required: ["query"],
			},
			annotations: READ_ONLY,
		}),

		feed: tool("read_feed", {
			title: "Read one feed",
			description:
				"Read one followed feed's posts, read and unread alike, newest first. Needs the feed's id, which list_feeds reports.",
			input: {
				type: "object",
				properties: { feedId: FEED_ID, cursor: CURSOR, limit: LIMIT },
				required: ["feedId"],
			},
			annotations: READ_ONLY,
		}),

		saved: tool("read_saved", {
			title: "Read the saved posts",
			description:
				"Read the posts the reader asked to keep, newest first. These are the ones they chose deliberately, so this is the shelf rather than the queue.",
			input: { type: "object", properties: { cursor: CURSOR, limit: LIMIT } },
			annotations: READ_ONLY,
		}),
	}),

	feeds: tools({
		list: tool("list_feeds", {
			title: "List followed feeds",
			description:
				"List every feed the reader follows, with how many posts of each are unread and how much each publishes. Use this to decide where to look before reading anything.",
			input: { type: "object", properties: {} },
			annotations: READ_ONLY,
		}),

		get: tool("get_feed", {
			title: "Read one feed's details",
			description:
				"Read one followed feed's title, site, unread count and measured publishing rate. Needs the feed's id, which list_feeds reports.",
			input: { type: "object", properties: { feedId: FEED_ID }, required: ["feedId"] },
			/** The rate comes from the object that fetches the feed, which is past this one. */
			annotations: { readOnlyHint: true, openWorldHint: true },
		}),

		follow: tool("follow_feed", {
			title: "Follow a feed",
			description:
				"Follow whatever feed a URL leads to, accepting either a feed address or a page that advertises one. The first page of its posts arrives with it.",
			input: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "The feed's address, or the address of a page advertising one.",
						minLength: 1,
						maxLength: 2048,
					},
				},
				required: ["url"],
			},
			/** It reaches a publisher's origin, which is the one thing here outside this app. */
			annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
		}),

		unfollow: tool("unfollow_feed", {
			title: "Stop following a feed",
			description:
				"Stop following one feed. Its unread posts go with it; the ones the reader saved stay on their shelf. Ask before calling this: nothing brings the posts back.",
			input: { type: "object", properties: { feedId: FEED_ID }, required: ["feedId"] },
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		}),

		markRead: tool("mark_feed_read", {
			title: "Mark one feed read",
			description:
				"Take every unread post of one feed out of the queue at once. Ask before calling this: it empties that feed's queue and nothing undoes it.",
			input: { type: "object", properties: { feedId: FEED_ID }, required: ["feedId"] },
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		}),
	}),

	posts: tools({
		markRead: tool("mark_read", {
			title: "Mark a post read",
			description:
				"Mark one post read, or put it back among the unread. Calling it twice leaves the post exactly where one call left it.",
			input: {
				type: "object",
				properties: {
					itemId: ITEM_ID,
					read: {
						type: "boolean",
						description: "Whether the post is read. False puts it back among the unread.",
						default: true,
					},
				},
				required: ["itemId"],
			},
			annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
		}),

		save: tool("save_post", {
			title: "Keep a post",
			description:
				"Keep one post on the reader's shelf, or stop keeping it. A kept post is exempt from every rule that would otherwise delete it. Calling it twice leaves the post exactly where one call left it.",
			input: {
				type: "object",
				properties: {
					itemId: ITEM_ID,
					saved: {
						type: "boolean",
						description: "Whether to keep the post. False stops keeping it.",
						default: true,
					},
				},
				required: ["itemId"],
			},
			annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
		}),
	}),
});
