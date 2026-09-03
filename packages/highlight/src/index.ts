/**
 * Syntax highlighting: source and a language name in, tokens out, with the
 * markup form for callers that render a string instead of a component tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Token } from "./lexer.js";

import { bash } from "./grammars/bash.js";
import { css } from "./grammars/css.js";
import { diff } from "./grammars/diff.js";
import { graphql } from "./grammars/graphql.js";
import { html } from "./grammars/html.js";
import { http } from "./grammars/http.js";
import { javascript } from "./grammars/javascript.js";
import { json } from "./grammars/json.js";
import { jsx } from "./grammars/jsx.js";
import { markdown } from "./grammars/markdown.js";
import { plain } from "./grammars/plain.js";
import { python } from "./grammars/python.js";
import { ruby } from "./grammars/ruby.js";
import { sql } from "./grammars/sql.js";
import { tsx } from "./grammars/tsx.js";
import { typescript } from "./grammars/typescript.js";
import { yaml } from "./grammars/yaml.js";
import { scan } from "./lexer.js";

export type { Grammar, Rule, Token } from "./lexer.js";
export { compose, scan } from "./lexer.js";

/**
 * Every language a fence can name, by the name it registers under.
 */
export const languages: Record<string, Grammar> = {
	bash,
	css,
	diff,
	graphql,
	html,
	http,
	javascript,
	json,
	jsx,
	markdown,
	plain,
	python,
	ruby,
	sql,
	tsx,
	typescript,
	yaml,
};

/**
 * The other names a language answers to. `plain` is the destination for the
 * names that mean "do not highlight this", so they resolve to a grammar rather
 * than to nothing.
 */
const ALIASES: Record<string, string> = {
	atom: "html",
	dotenv: "plain",
	env: "plain",
	erb: "html",
	gql: "graphql",
	js: "javascript",
	/**
	 * The JSON grammar tokenizes both comment forms already, so a `wrangler.jsonc`
	 * fence highlights as JSON rather than going unpainted.
	 */
	jsonc: "json",
	mathml: "html",
	md: "markdown",
	mdx: "markdown",
	plaintext: "plain",
	py: "python",
	rb: "ruby",
	rest: "http",
	rss: "html",
	sh: "bash",
	shell: "bash",
	svg: "html",
	text: "plain",
	ts: "typescript",
	txt: "plain",
	xml: "html",
	yml: "yaml",
};

/**
 * Resolves what a fence wrote to the name a grammar answers to, lowercasing it
 * and following an alias when one applies.
 *
 * The result is a name to display and to look up, not a promise that a grammar
 * exists: an unknown language comes back unchanged, and highlights as plain.
 *
 * @param language - Language as written on the fence
 * @returns The resolved language name
 */
export function normalizeLanguage(language: string): string {
	let name = language.toLowerCase();
	return Object.hasOwn(ALIASES, name) ? (ALIASES[name] ?? name) : name;
}

/**
 * Tokenizes source as a language.
 *
 * A language with no grammar yields a single `plain` token holding the whole
 * input, so a caller renders every language the same way.
 *
 * @param code - Source to highlight
 * @param language - Language name or alias, as written on a fence
 * @returns The tokens, in source order, covering the input exactly once
 */
export function tokenize(code: string, language: string): Token[] {
	let grammar = languages[normalizeLanguage(language)];
	if (!grammar) return code.length > 0 ? [{ type: "plain", value: code }] : [];
	return scan(code, grammar);
}

/**
 * Highlights source into `<span class="token …">` markup, escaping every value
 * it writes.
 *
 * This is the form for callers that need markup. A caller rendering components
 * maps {@link tokenize} instead, and renders elements rather than a string.
 *
 * @param code - Source to highlight
 * @param language - Language name or alias, as written on a fence
 * @returns Markup safe to place inside a `<pre><code>`
 */
export function highlight(code: string, language: string): string {
	return tokenize(code, language)
		.map((token) => {
			let value = escapeMarkup(token.value);
			if (token.type === "plain") return value;
			return `<span class="token ${token.type}">${value}</span>`;
		})
		.join("");
}

/**
 * Escapes the characters that would otherwise read as markup.
 *
 * @param value - A token's text
 * @returns The text with `&`, `<` and `>` replaced by their entities
 */
function escapeMarkup(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
