/**
 * The tools this blog offers an agent, declared the way routes are: a name, a description
 * that is the prompt a model chooses by, and the schema its arguments must satisfy.
 *
 * Every tool declares `readOnlyHint`, letting a client run it without asking a person, and
 * `openWorldHint: false`, since nothing here reaches past this blog's own database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/**
 * The tool tree the MCP handler is mapped against.
 *
 * Grouped by content area, so one controller file owns one group and a tool added here is a
 * type error until it is answered.
 */
export default tools({
	searchPosts: tool("search_posts", {
		title: "Search posts",
		description:
			"Search this blog's published articles, tutorials and glossary entries by title, tags and full text. Use this first when looking for writing on a topic; it returns slugs that get_post reads in full.",
		input: s.object({
			query: s.string().pipe(checks.minLength(1), checks.maxLength(200)).meta({
				description:
					'Words to look for, each matched as a word prefix against titles, tags and post text; a post must match every word. Quote a phrase ("route pattern") to match it exactly, and prefix a word with - to exclude it. Results come best match first.',
			}),
			kind: s.optional(
				s
					.enum_(["article", "tutorial", "glossary"])
					.meta({ description: "Restrict the search to one kind of post." }),
			),
			tag: s.optional(
				s.string().pipe(checks.maxLength(100)).meta({
					description: "Only return posts carrying this tag. Tutorials are the tagged type.",
				}),
			),
			limit: s.defaulted(
				s
					.integer()
					.pipe(checks.min(1), checks.max(50))
					.meta({ description: "How many results to return." }),
				10,
			),
		}),
		annotations: READ_ONLY,
	}),

	posts: tools({
		list: tool("list_posts", {
			title: "List posts",
			description:
				"List this blog's published articles or tutorials, newest first. Use search_posts when looking for a topic; use this to see what exists.",
			input: s.object({
				type: s.enum_(["articles", "tutorials"]).meta({ description: "Which collection to list." }),
				limit: s.defaulted(
					s
						.integer()
						.pipe(checks.min(1), checks.max(100))
						.meta({ description: "How many posts to return." }),
					20,
				),
				offset: s.defaulted(
					s
						.integer()
						.pipe(checks.min(0))
						.meta({ description: "How many posts to skip, for paging through the list." }),
					0,
				),
			}),
			annotations: READ_ONLY,
		}),

		get: tool("get_post", {
			title: "Read a post",
			description:
				"Read one published article or tutorial in full, as Markdown. Needs the slug, which search_posts and list_posts return.",
			input: s.object({
				type: s
					.enum_(["articles", "tutorials"])
					.meta({ description: "Which collection the post belongs to." }),
				slug: s
					.string()
					.pipe(checks.minLength(1), checks.maxLength(200))
					.meta({ description: "The post's URL slug, without the collection prefix." }),
			}),
			annotations: READ_ONLY,
		}),
	}),

	glossary: tools({
		list: tool("list_glossary", {
			title: "List glossary terms",
			description:
				"List every term defined in this blog's glossary. Short enough to read whole, so there is no glossary search.",
			input: s.object({}, { unknownKeys: "error" }),
			annotations: READ_ONLY,
		}),

		get: tool("get_glossary_term", {
			title: "Read a glossary term",
			description: "Read one glossary term's full definition. Needs the slug from list_glossary.",
			input: s.object({
				slug: s
					.string()
					.pipe(checks.minLength(1), checks.maxLength(200))
					.meta({ description: "The term's slug, as list_glossary reports it." }),
			}),
			annotations: READ_ONLY,
		}),
	}),

	bookmarks: tool("list_bookmarks", {
		title: "List bookmarks",
		description:
			"List the external links this blog's author has bookmarked, newest first. Each is a title and somebody else's URL, so there is nothing here to read in full.",
		input: s.object({
			limit: s.defaulted(
				s
					.integer()
					.pipe(checks.min(1), checks.max(100))
					.meta({ description: "How many bookmarks to return." }),
				20,
			),
			offset: s.defaulted(
				s
					.integer()
					.pipe(checks.min(0))
					.meta({ description: "How many bookmarks to skip, for paging through the list." }),
				0,
			),
		}),
		annotations: READ_ONLY,
	}),
});
