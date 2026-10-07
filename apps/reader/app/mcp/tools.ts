/**
 * The tools this reader offers an agent, declared the way routes are: a name, a description
 * that is the prompt a model chooses by, and the schema its arguments must satisfy, which
 * validates a call and is published to the model as JSON Schema.
 *
 * Every one of them is a projection of an RPC the web app already runs, so there is no
 * second data path here — only a schema, a bound and a shape. No argument names a reader:
 * the token decided which object answers, and no method below takes a subject.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
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
const CURSOR = s.optional(
	s.string().pipe(checks.minLength(1), checks.maxLength(512)).meta({
		description:
			"A page reference a previous call returned as nextCursor. Pass it back exactly as it was given; never build one, parse one, or guess one. Omit it for the first page.",
	}),
);

/** How many posts a page holds, bounded so one call cannot read a whole timeline. */
const LIMIT = s.defaulted(
	s
		.integer()
		.pipe(checks.min(1), checks.max(MAX_PAGE))
		.meta({ description: "How many posts to return." }),
	DEFAULT_PAGE,
);

/** Which posts a page of the queue holds, in the three states the reader's own views offer. */
const READ_STATE = s.defaulted(
	s.enum_(["unread", "read", "all"]).meta({
		description: "Which posts to return. Defaults to the ones the reader has yet to read.",
	}),
	"unread",
);

/** This app's own handle for a subscription, as every list and resource reports it. */
const FEED_ID = s
	.string()
	.pipe(checks.minLength(1), checks.maxLength(64))
	.meta({ description: "The feed's id, as list_feeds and read_timeline report it." });

/** One stored post, named by the id every list and resource reports. */
const ITEM_ID = s
	.string()
	.pipe(checks.minLength(1), checks.maxLength(64))
	.meta({ description: "The post's id, as read_timeline and the other reading tools report it." });

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
			input: s.object({ readState: READ_STATE, cursor: CURSOR, limit: LIMIT }),
			annotations: READ_ONLY,
		}),

		search: tool("search_timeline", {
			title: "Search the reading queue",
			description:
				"Find posts in the reader's queue whose title, excerpt or author holds every word of a query. Use this whenever looking for writing on a particular subject; use read_timeline when the question is what is new rather than what is about something.",
			input: s.object({
				query: s.string().pipe(checks.minLength(1), checks.maxLength(200)).meta({
					description:
						'Words to look for, each matched anywhere in a title, excerpt or author. Quote a phrase to match it as written; put OR (in capitals) between two words to match either; lead a word with - or NOT to leave out posts holding it; quote "OR", "AND" or "NOT" to search for the word itself.',
				}),
				readState: READ_STATE,
				cursor: CURSOR,
				limit: LIMIT,
			}),
			annotations: READ_ONLY,
		}),

		feed: tool("read_feed", {
			title: "Read one feed",
			description:
				"Read one followed feed's posts, read and unread alike, newest first. Needs the feed's id, which list_feeds reports.",
			input: s.object({ feedId: FEED_ID, cursor: CURSOR, limit: LIMIT }),
			annotations: READ_ONLY,
		}),

		saved: tool("read_saved", {
			title: "Read the saved posts",
			description:
				"Read the posts the reader asked to keep, newest first. These are the ones they chose deliberately, so this is the shelf rather than the queue.",
			input: s.object({ cursor: CURSOR, limit: LIMIT }),
			annotations: READ_ONLY,
		}),
	}),

	feeds: tools({
		list: tool("list_feeds", {
			title: "List followed feeds",
			description:
				"List every feed the reader follows, with how many posts of each are unread and how much each publishes. Use this to decide where to look before reading anything.",
			input: s.object({}),
			annotations: READ_ONLY,
		}),

		get: tool("get_feed", {
			title: "Read one feed's details",
			description:
				"Read one followed feed's title, site, unread count and measured publishing rate. Needs the feed's id, which list_feeds reports.",
			input: s.object({ feedId: FEED_ID }),
			/** The rate comes from the object that fetches the feed, which is past this one. */
			annotations: { readOnlyHint: true, openWorldHint: true },
		}),

		follow: tool("follow_feed", {
			title: "Follow a feed",
			description:
				"Follow whatever feed a URL leads to, accepting either a feed address or a page that advertises one. The first page of its posts arrives with it.",
			input: s.object({
				url: s
					.string()
					.pipe(checks.minLength(1), checks.maxLength(2048))
					.meta({ description: "The feed's address, or the address of a page advertising one." }),
			}),
			/** It reaches a publisher's origin, which is the one thing here outside this app. */
			annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
		}),

		unfollow: tool("unfollow_feed", {
			title: "Stop following a feed",
			description:
				"Stop following one feed. Its unread posts go with it; the ones the reader saved stay on their shelf. Ask before calling this: nothing brings the posts back.",
			input: s.object({ feedId: FEED_ID }),
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		}),

		markRead: tool("mark_feed_read", {
			title: "Mark one feed read",
			description:
				"Take every unread post of one feed out of the queue at once. Ask before calling this: it empties that feed's queue and nothing undoes it.",
			input: s.object({ feedId: FEED_ID }),
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		}),
	}),

	posts: tools({
		markRead: tool("mark_read", {
			title: "Mark a post read",
			description:
				"Mark one post read, or put it back among the unread. Calling it twice leaves the post exactly where one call left it.",
			input: s.object({
				itemId: ITEM_ID,
				read: s.defaulted(
					s.boolean().meta({
						description: "Whether the post is read. False puts it back among the unread.",
					}),
					true,
				),
			}),
			annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
		}),

		save: tool("save_post", {
			title: "Keep a post",
			description:
				"Keep one post on the reader's shelf, or stop keeping it. A kept post is exempt from every rule that would otherwise delete it. Calling it twice leaves the post exactly where one call left it.",
			input: s.object({
				itemId: ITEM_ID,
				saved: s.defaulted(
					s.boolean().meta({ description: "Whether to keep the post. False stops keeping it." }),
					true,
				),
			}),
			annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
		}),
	}),
});
