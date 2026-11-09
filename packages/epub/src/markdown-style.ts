/**
 * The reading stylesheet a Markdown book links before the author's own: a centered title page
 * set like a cover, readable defaults for the elements Markdown renders, and the embedded
 * font as the body face when one is given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { cssString } from "./markdown-fonts.js";

/** Where the reading stylesheet sits in the container. */
export const DEFAULT_STYLESHEET = "_book/book.css";

/** The rules every book gets, with `FONT_FAMILY` standing for the body face. */
const RULES = `body {
	font-family: FONT_FAMILY;
	line-height: 1.5;
	hyphens: auto;
	-webkit-hyphens: auto;
}

h1, h2, h3, h4, h5, h6 {
	line-height: 1.2;
	hyphens: none;
	-webkit-hyphens: none;
	page-break-after: avoid;
	break-after: avoid;
}

h2 {
	margin-top: 2em;
}

img, svg {
	max-width: 100%;
	height: auto;
}

pre {
	white-space: pre-wrap;
	font-size: 0.85em;
}

code {
	font-family: ui-monospace, Menlo, Consolas, monospace;
}

blockquote {
	margin: 1em 1.5em;
	font-style: italic;
}

table {
	border-collapse: collapse;
}

th, td {
	border-bottom: 1px solid currentColor;
	padding: 0.25em 0.5em;
}

.title-page {
	text-align: center;
	margin-top: 35%;
	page-break-before: always;
	break-before: page;
}

.title-page h1 {
	font-size: 2.6em;
	margin: 0 0 0.75em;
}

.title-page .title-page-authors {
	font-size: 1.25em;
	font-style: italic;
	margin: 0;
}

.md-footnotes {
	margin-top: 2em;
	font-size: 0.9em;
}
`;

/**
 * The reading stylesheet, with `family` as the body face before the reader's serif fallback.
 *
 * @param family - The first embedded font's family, when the book embeds one
 * @returns The stylesheet text
 */
export function defaultStylesheet(family: string | undefined): string {
	let stack = family === undefined ? "serif" : `${cssString(family)}, serif`;
	return RULES.replace("FONT_FAMILY", stack);
}
