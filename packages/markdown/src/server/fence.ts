/**
 * The Markdoc node for fenced code blocks: it normalizes the language written
 * on the fence to a Prism grammar identifier, highlights the body when a
 * grammar answers to that name, and emits a `Fence` tag for the client
 * renderer to draw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Schema } from "@markdoc/markdoc";

import { Tag } from "@markdoc/markdoc";
import Prism from "prismjs";
import * as s from "remix/data-schema";

import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-diff.js";
import "prismjs/components/prism-graphql.js";
import "prismjs/components/prism-http.js";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-ruby.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-yaml.js";

/**
 * Validates the runtime attributes passed from Markdoc fence nodes.
 */
const AttributesSchema = s.object({
	content: s.string(),
	language: s.defaulted(s.string(), "plain"),
	path: s.optional(s.string()),
	title: s.optional(s.string()),
});

/**
 * Maps common code fence aliases to Prism grammar identifiers. As a plain
 * object, it doubles as the source of the supported-language type while
 * serving as a simple lookup table.
 */
const LANGUAGE_ALIASES = {
	dotenv: "plain",
	env: "plain",
	erb: "html",
	gql: "graphql",
	js: "javascript",
	/**
	 * Prism ships no `jsonc` grammar, and its JSON grammar already tokenizes
	 * both comment forms, so aliasing to `json` keeps every `wrangler.jsonc`
	 * fence highlighted.
	 */
	jsonc: "json",
	jsx: "jsx",
	md: "markdown",
	mdx: "markdown",
	py: "python",
	rb: "ruby",
	rest: "http",
	sh: "bash",
	shell: "bash",
	sql: "sql",
	text: "plain",
	ts: "typescript",
	tsx: "tsx",
	yml: "yaml",
} as const;

/**
 * Groups code fence types under the exported node name.
 */
export namespace fence {
	/**
	 * Limits normalized language values to the supported Prism identifiers.
	 */
	export type SupportedLanguage = (typeof LANGUAGE_ALIASES)[keyof typeof LANGUAGE_ALIASES];
}

/**
 * Transforms Markdoc fence nodes into `Fence` tags for client renderers.
 */
export const fence = {
	attributes: {
		language: { type: String, default: "plain" },
		path: { type: String },
		title: { type: String },
	},

	/**
	 * Normalizes fence attributes and applies Prism highlighting when available.
	 */
	transform(node) {
		let parsed = s.parse(AttributesSchema, {
			content: node.children?.[0]?.attributes?.content ?? "",
			...node.attributes,
		});

		let language = normalizeLanguage(parsed.language);
		let content = parsed.content;

		let grammar = Prism.languages[language];
		if (grammar) content = Prism.highlight(content, grammar, language);

		return new Tag("Fence", {
			content,
			language,
			path: parsed.path,
			title: parsed.title,
		});
	},
} satisfies Schema;

/**
 * Normalizes user-provided language names to the Prism identifiers used by
 * fences, checking alias membership with `Object.hasOwn` so only the table's
 * own entries can satisfy a lookup for names like `constructor` or `toString`.
 *
 * @param language - Raw language value from markdown
 * @returns The aliased Prism identifier, or the lowercased input unchanged
 * when no alias applies — Prism highlights it when a grammar is registered
 * under that exact name, and the fence renders as plain text otherwise.
 */
export function normalizeLanguage(language: string): fence.SupportedLanguage {
	let lang = language.toLowerCase();
	if (Object.hasOwn(LANGUAGE_ALIASES, lang)) {
		return LANGUAGE_ALIASES[lang as keyof typeof LANGUAGE_ALIASES];
	}
	return lang as fence.SupportedLanguage;
}
