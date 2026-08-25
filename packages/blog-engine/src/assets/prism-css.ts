/**
 * The Prism syntax-highlighting stylesheet as a string constant, self-served at
 * `/assets/prism.css`. A compact light theme keyed to the token classes prismjs
 * emits, kept in TypeScript so hosts need no build-pipeline cooperation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Prism syntax-highlighting CSS shipped as a TypeScript string constant and
 * self-served by the engine at `/assets/prism.css`, so hosts need no build-pipeline
 * cooperation. A compact light theme keyed to the token classes prismjs emits.
 */
export const PRISM_CSS = `
code[class*="language-"], pre[class*="language-"] {
	color: #24292e;
	background: none;
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	font-size: 0.9em;
	line-height: 1.5;
	tab-size: 2;
	white-space: pre;
	word-spacing: normal;
	word-break: normal;
}
pre[class*="language-"] { padding: 1em; margin: 0.5em 0; overflow: auto; border-radius: 0.375rem; }
:not(pre) > code[class*="language-"] { padding: 0.1em 0.3em; border-radius: 0.3em; }
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6a737d; }
.token.punctuation { color: #24292e; }
.token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted { color: #005cc5; }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #032f62; }
.token.operator, .token.entity, .token.url { color: #d73a49; }
.token.atrule, .token.attr-value, .token.keyword { color: #d73a49; }
.token.function, .token.class-name { color: #6f42c1; }
.token.regex, .token.important, .token.variable { color: #e36209; }
.token.important, .token.bold { font-weight: bold; }
.token.italic { font-style: italic; }
`;

/** A stable content hash for cache-busting the prism stylesheet URL. */
export const PRISM_CSS_VERSION = "1";
