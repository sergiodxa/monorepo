/**
 * Markdown as an email body, and the highlighted code block it renders fences with.
 *
 * They are behind their own entry point because they are the only part of this package
 * with a parser and a highlighter under them, and most mail has neither: an app that
 * sends alerts should not carry Markdoc and Prism into its bundle to do it. Importing
 * `@pkg/mail` gets the layout kit; importing `@pkg/mail/markdown` opts into the rest.
 *
 * Both build a component tree rather than an HTML string, which is the whole reason
 * neither could be a thin wrapper over an existing renderer. Markdoc renders to HTML,
 * Prism highlights to HTML, and `remix/ui` escapes a text node, so a string of markup
 * would arrive in the inbox as its own source. The tree is walked here instead, and
 * every node comes out as a component from the kit with its styles already inline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderableTreeNode, Tag } from "@markdoc/markdoc";
import type { Handle, RemixNode } from "remix/ui";

import Markdoc from "@markdoc/markdoc";
import Prism from "prismjs";

import { CODE_COLOR, CodeInline, Heading, Hr, Img, Link, MONO_FAMILY, Text } from "./components";

import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-diff.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-yaml.js";

/** Fence languages named by an alias Prism does not register under. */
const ALIASES: Record<string, string> = {
	js: "javascript",
	jsonc: "json",
	md: "markdown",
	sh: "bash",
	shell: "bash",
	ts: "typescript",
	yml: "yaml",
};

/**
 * The colour of each kind of token, and the class that recolours it in dark mode.
 *
 * Prism emits dozens of token types and an email needs none of that resolution — a
 * reader is skimming a fenced block in a notification, not editing it. They collapse to
 * six buckets, which is enough for code to read as code and few enough that the dark
 * half stays six rules in the layout's stylesheet.
 */
const TOKENS: Record<string, { color: string; class: string }> = {
	comment: { color: "#6a737d", class: "mail-tok-comment" },
	keyword: { color: "#d73a49", class: "mail-tok-keyword" },
	string: { color: "#032f62", class: "mail-tok-string" },
	number: { color: "#005cc5", class: "mail-tok-number" },
	function: { color: "#6f42c1", class: "mail-tok-function" },
	punctuation: { color: "#24292e", class: "mail-tok-punctuation" },
};

/** Which bucket a Prism token type falls in, or none for the ones left unpainted. */
function bucket(type: string): (typeof TOKENS)[string] | undefined {
	if (type === "comment" || type === "prolog" || type === "doctype" || type === "cdata") {
		return TOKENS.comment;
	}
	if (type === "keyword" || type === "atrule" || type === "important" || type === "selector") {
		return TOKENS.keyword;
	}
	if (type === "string" || type === "char" || type === "attr-value" || type === "regex") {
		return TOKENS.string;
	}
	if (type === "number" || type === "boolean" || type === "constant" || type === "symbol") {
		return TOKENS.number;
	}
	if (type === "function" || type === "class-name" || type === "tag" || type === "attr-name") {
		return TOKENS.function;
	}
	if (type === "punctuation" || type === "operator") return TOKENS.punctuation;
	return undefined;
}

/** Flattens a Prism token's content, which nests to whatever depth the grammar needed. */
function tokenText(content: string | Prism.Token | (string | Prism.Token)[]): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.map(tokenText).join("");
	return tokenText(content.content);
}

/** One highlighted run, as a coloured span or as bare text when nothing paints it. */
function highlight(tokens: (string | Prism.Token)[]): RemixNode {
	return tokens.map((token, index) => {
		if (typeof token === "string") return token;

		let text = tokenText(token.content);
		let painted = bucket(token.type);
		if (!painted) return text;

		return (
			<span key={index} class={painted.class} style={`color:${painted.color};`}>
				{text}
			</span>
		);
	});
}

export namespace CodeBlock {
	/** Props accepted by {@link CodeBlock}. */
	export interface Props {
		/** The code, as written. */
		code: string;
		/** Language to highlight as; an unknown one renders unpainted rather than failing. */
		language?: string;
	}
}

/**
 * A fenced block of code, highlighted, inside a single-cell table.
 *
 * The table is what gives the block its fill. A `<pre>` with a background is a block
 * element with a background, and Outlook paints those to the width of the text rather
 * than the width of the column, so a two-line snippet arrives as two ragged stripes.
 *
 * Long lines wrap instead of scrolling, because an inbox has no horizontal scrollbar to
 * offer and a line that overflows is a line the reader cannot get to.
 *
 * @example <CodeBlock language="bash" code="bun run deploy" />
 */
export function CodeBlock(handle: Handle<CodeBlock.Props>) {
	return () => {
		let { code, language } = handle.props;
		let name = language ? (ALIASES[language] ?? language) : undefined;
		let grammar = name ? Prism.languages[name] : undefined;
		let content = grammar ? highlight(Prism.tokenize(code, grammar)) : code;

		return (
			<table
				role="presentation"
				width="100%"
				cellPadding="0"
				cellSpacing="0"
				style="width:100%;margin:0 0 16px;border-collapse:collapse;"
			>
				<tbody>
					<tr>
						<td
							class="mail-code"
							style={`padding:12px 16px;border-radius:6px;background-color:${CODE_COLOR};`}
						>
							<pre
								style={`margin:0;padding:0;font-family:${MONO_FAMILY};font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;`}
							>
								{content}
							</pre>
						</td>
					</tr>
				</tbody>
			</table>
		);
	};
}

/** A Markdoc node that is a tag rather than a string or a nullish gap. */
function isTag(node: RenderableTreeNode): node is Tag {
	return typeof node === "object" && node !== null && "name" in node;
}

/** The text under a node, for the places markdown allows markup and an email does not. */
function textOf(node: RenderableTreeNode): string {
	if (node === null || node === undefined || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (isTag(node)) return (node.children ?? []).map(textOf).join("");
	return "";
}

/** Reads an attribute that should be a string, for a tree whose attributes are `any`. */
function attr(tag: Tag, name: string): string | undefined {
	let value = tag.attributes?.[name];
	return typeof value === "string" ? value : undefined;
}

/**
 * Turns one Markdoc node into email components.
 *
 * The mapping is deliberately lossy. Markdown can express things an inbox cannot lay
 * out, and the honest response to those is to render the content in a form that reads
 * rather than a form that half-works: a table becomes its rows as lines, and a nested
 * list flattens by one level rather than relying on indentation clients disagree about.
 */
function convert(node: RenderableTreeNode, key: number): RemixNode {
	if (node === null || node === undefined || typeof node === "boolean") return null;
	if (typeof node === "string" || typeof node === "number") return node;
	if (Array.isArray(node)) return node.map(convert);
	if (!isTag(node)) return null;

	let children = (node.children ?? []).map(convert);

	switch (node.name) {
		case "h1":
			return <Heading key={key}>{children}</Heading>;
		case "h2":
			return (
				<Heading key={key} level={2}>
					{children}
				</Heading>
			);
		// Markdown goes six deep and the kit stops at three, which is as many sizes as fit
		// inside a card before the smallest is body copy again.
		case "h3":
		case "h4":
		case "h5":
		case "h6":
			return (
				<Heading key={key} level={3}>
					{children}
				</Heading>
			);

		case "p":
			return <Text key={key}>{children}</Text>;

		case "a": {
			let href = attr(node, "href");
			if (!href) return children;
			return (
				<Link key={key} href={href}>
					{children}
				</Link>
			);
		}

		case "strong":
			return (
				<strong key={key} style="font-weight:600;">
					{children}
				</strong>
			);
		case "em":
			return (
				<em key={key} style="font-style:italic;">
					{children}
				</em>
			);
		case "s":
			return (
				<s key={key} style="text-decoration:line-through;">
					{children}
				</s>
			);

		case "code":
			return <CodeInline key={key}>{children}</CodeInline>;

		case "pre":
			return <CodeBlock key={key} code={textOf(node)} language={attr(node, "data-language")} />;

		case "hr":
			return <Hr key={key} />;

		case "img": {
			let src = attr(node, "src");
			if (!src) return null;
			return <Img key={key} src={src} alt={attr(node, "alt") ?? ""} gap={16} />;
		}

		case "ul":
			return (
				<ul key={key} style="margin:0 0 16px;padding:0 0 0 20px;list-style-type:disc;">
					{children}
				</ul>
			);

		// A real `<ol>` rather than a `<ul>` styled with decimal markers, because the text
		// part reads the element and not the style: the styled version numbers correctly in
		// the inbox and comes out as five identical bullets for anyone reading the other half.
		case "ol":
			return (
				<ol key={key} style="margin:0 0 16px;padding:0 0 0 20px;list-style-type:decimal;">
					{children}
				</ol>
			);

		case "li":
			// The bullet is a real list marker and the copy inside it is not a paragraph:
			// markdown wraps loose list items in `<p>`, and a paragraph's bottom margin turns
			// a five-item list into five separated blocks.
			return (
				<li key={key} style="margin:0 0 6px;font-family:inherit;line-height:1.6;">
					{(node.children ?? []).map((child, index) =>
						isTag(child) && child.name === "p"
							? (child.children ?? []).map(convert)
							: convert(child, index),
					)}
				</li>
			);

		case "blockquote":
			return (
				<blockquote
					key={key}
					class="mail-rule"
					style="margin:0 0 16px;padding:0 0 0 16px;border-left:3px solid #e4e4e7;"
				>
					{children}
				</blockquote>
			);

		// Everything markdown can produce that has no email-safe counterpart keeps its
		// content and loses its box, which is always more readable than the alternative.
		default:
			return children;
	}
}

export namespace Markdown {
	/** Props accepted by {@link Markdown}. */
	export interface Props {
		/** The markdown source. */
		children: string;
	}
}

/**
 * Renders markdown as an email body, using the layout kit for every element.
 *
 * The source is parsed here rather than taken pre-parsed, because a caller holding a
 * Markdoc tree would need this package's parser to have produced it and that is the
 * dependency the subpath exists to contain.
 *
 * @example <Markdown>{`# Release notes\n\nWe shipped **digests**.`}</Markdown>
 */
export function Markdown(handle: Handle<Markdown.Props>) {
	return () => {
		let tree = Markdoc.transform(Markdoc.parse(handle.props.children));
		return <>{convert(tree, 0)}</>;
	};
}
