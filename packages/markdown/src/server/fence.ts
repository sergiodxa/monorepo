/**
 * The Markdoc node for fenced code blocks: it normalizes the language written on
 * the fence to a Prism grammar identifier, highlights the body when a grammar
 * answers to that name, and emits a `Fence` tag the client renderer draws. The
 * alias table is a plain object rather than a schema because it is never
 * validated against — it is only read as a lookup and as the source of the
 * supported-language type.
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
 * Maps common code fence aliases to Prism grammar identifiers.
 */
const LANGUAGE_ALIASES = {
	dotenv: "plain",
	env: "plain",
	erb: "html",
	gql: "graphql",
	js: "javascript",
	/* Prism ships no `jsonc` grammar, and its JSON one already tokenizes both
	comment forms, so the alias is the whole fix. Without it every ```jsonc fence —
	which is every `wrangler.jsonc` listing — falls through untokenized and renders
	as one undifferentiated run of plain text. */
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
 * Normalizes user-provided language names to the Prism identifiers used by fences.
 *
 * @param language - Raw language value from markdown
 * @returns Normalized language identifier used for highlighting
 */
export function normalizeLanguage(language: string): fence.SupportedLanguage {
	let lang = language.toLowerCase();
	/* The language comes off the fence, so it is user input indexing an object:
	`hasOwn` rather than `in` keeps a fence tagged `constructor` or `toString` from
	resolving to something off `Object.prototype` instead of an alias. */
	if (Object.hasOwn(LANGUAGE_ALIASES, lang)) {
		return LANGUAGE_ALIASES[lang as keyof typeof LANGUAGE_ALIASES];
	}
	/* A language with no alias is already the identifier Prism would be asked for,
	so it passes through: either a grammar is registered under that exact name and
	the fence highlights, or none is and the fence renders as plain text. */
	return lang as fence.SupportedLanguage;
}
