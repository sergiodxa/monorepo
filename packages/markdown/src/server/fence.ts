import { type Schema, Tag } from "@markdoc/markdoc";
import Prism from "prismjs";
import { z } from "zod";

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
const AttributesSchema = z.object({
	content: z.string(),
	language: z.string().default("plain"),
	path: z.string().optional(),
	title: z.string().optional(),
});

/**
 * Maps common code fence aliases to Prism grammar identifiers.
 */
const LanguageAliasesSchema = z.object({
	dotenv: z.literal("plain"),
	env: z.literal("plain"),
	erb: z.literal("html"),
	gql: z.literal("graphql"),
	js: z.literal("javascript"),
	/* Prism ships no `jsonc` grammar, and its JSON one already tokenizes both
	comment forms, so the alias is the whole fix. Without it every ```jsonc fence —
	which is every `wrangler.jsonc` listing — falls through untokenized and renders
	as one undifferentiated run of plain text. */
	jsonc: z.literal("json"),
	jsx: z.literal("jsx"),
	md: z.literal("markdown"),
	mdx: z.literal("markdown"),
	py: z.literal("python"),
	rb: z.literal("ruby"),
	rest: z.literal("http"),
	sh: z.literal("bash"),
	shell: z.literal("bash"),
	sql: z.literal("sql"),
	text: z.literal("plain"),
	ts: z.literal("typescript"),
	tsx: z.literal("tsx"),
	yml: z.literal("yaml"),
});

/**
 * Groups code fence types under the exported node name.
 */
export namespace fence {
	/**
	 * Limits normalized language values to the supported Prism identifiers.
	 */
	export type SupportedLanguage = z.output<typeof LanguageAliasesSchema>[keyof z.infer<
		typeof LanguageAliasesSchema
	>];
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
		let parsed = AttributesSchema.parse({
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
	let lang = language.toLowerCase() as keyof z.input<typeof LanguageAliasesSchema>;
	let result = LanguageAliasesSchema.shape[lang];
	if (result) return result.value;
	return (lang as fence.SupportedLanguage) ?? "plain";
}
