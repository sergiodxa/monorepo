/**
 * The tools this blog offers an agent, declared the way routes are: a name, a description
 * that is the prompt a model chooses by, and the JSON Schema its arguments must satisfy.
 *
 * Every tool declares `readOnlyHint`, letting a client run it without asking a person, and
 * `openWorldHint: false`, since nothing here reaches past this blog's own database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { tool, tools } from "@pkg/mcp";

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
			"Search this blog's published articles, tutorials and glossary entries by title, excerpt and tags. Use this first when looking for writing on a topic; it returns slugs that get_post reads in full.",
		input: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Words to look for. Matched against titles, excerpts and tags.",
					minLength: 1,
					maxLength: 200,
				},
				kind: {
					type: "string",
					enum: ["article", "tutorial", "glossary"],
					description: "Restrict the search to one kind of post.",
				},
				tag: {
					type: "string",
					description: "Only return posts carrying this tag. Tutorials are the tagged type.",
					maxLength: 100,
				},
				limit: {
					type: "integer",
					description: "How many results to return.",
					minimum: 1,
					maximum: 50,
					default: 10,
				},
			},
			required: ["query"],
		},
		annotations: READ_ONLY,
	}),

	posts: tools({
		list: tool("list_posts", {
			title: "List posts",
			description:
				"List this blog's published articles or tutorials, newest first. Use search_posts when looking for a topic; use this to see what exists.",
			input: {
				type: "object",
				properties: {
					type: {
						type: "string",
						enum: ["articles", "tutorials"],
						description: "Which collection to list.",
					},
					limit: {
						type: "integer",
						description: "How many posts to return.",
						minimum: 1,
						maximum: 100,
						default: 20,
					},
					offset: {
						type: "integer",
						description: "How many posts to skip, for paging through the list.",
						minimum: 0,
						default: 0,
					},
				},
				required: ["type"],
			},
			annotations: READ_ONLY,
		}),

		get: tool("get_post", {
			title: "Read a post",
			description:
				"Read one published article or tutorial in full, as Markdown. Needs the slug, which search_posts and list_posts return.",
			input: {
				type: "object",
				properties: {
					type: {
						type: "string",
						enum: ["articles", "tutorials"],
						description: "Which collection the post belongs to.",
					},
					slug: {
						type: "string",
						description: "The post's URL slug, without the collection prefix.",
						minLength: 1,
						maxLength: 200,
					},
				},
				required: ["type", "slug"],
			},
			annotations: READ_ONLY,
		}),
	}),

	glossary: tools({
		list: tool("list_glossary", {
			title: "List glossary terms",
			description:
				"List every term defined in this blog's glossary. Short enough to read whole, so there is no glossary search.",
			input: { type: "object", properties: {}, additionalProperties: false },
			annotations: READ_ONLY,
		}),

		get: tool("get_glossary_term", {
			title: "Read a glossary term",
			description: "Read one glossary term's full definition. Needs the slug from list_glossary.",
			input: {
				type: "object",
				properties: {
					slug: {
						type: "string",
						description: "The term's slug, as list_glossary reports it.",
						minLength: 1,
						maxLength: 200,
					},
				},
				required: ["slug"],
			},
			annotations: READ_ONLY,
		}),
	}),

	bookmarks: tool("list_bookmarks", {
		title: "List bookmarks",
		description:
			"List the external links this blog's author has bookmarked, newest first. Each is a title and somebody else's URL, so there is nothing here to read in full.",
		input: {
			type: "object",
			properties: {
				limit: {
					type: "integer",
					description: "How many bookmarks to return.",
					minimum: 1,
					maximum: 100,
					default: 20,
				},
				offset: {
					type: "integer",
					description: "How many bookmarks to skip, for paging through the list.",
					minimum: 0,
					default: 0,
				},
			},
		},
		annotations: READ_ONLY,
	}),
});
