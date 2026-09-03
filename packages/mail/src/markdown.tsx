/**
 * Markdown as an email body, and the highlighted code block it renders fences with.
 *
 * A separate entry point keeps Markdoc and the highlighter out of mail bundles that
 * carry no markdown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderableTreeNode, Tag } from "@markdoc/markdoc";
import type { Token } from "@sdxc/highlight";
import type { Handle, RemixNode } from "remix/ui";

import Markdoc from "@markdoc/markdoc";
import { tokenize } from "@sdxc/highlight";
import { fence } from "@sdxc/highlight/markdoc";

import { CODE_COLOR, CodeInline, Heading, Hr, Img, Link, MONO_FAMILY, Text } from "./components.js";

/**
 * The colour of each token type, and the class that recolours it in dark mode.
 *
 * Six colours for twenty types, because an inbox reads at a glance and every
 * colour spent here is another rule the dark-mode stylesheet has to carry.
 */
const TOKENS: Record<Token.Type, { color: string; class: string } | undefined> = {
	comment: { color: "#6a737d", class: "mail-tok-comment" },
	keyword: { color: "#d73a49", class: "mail-tok-keyword" },
	operator: { color: "#24292e", class: "mail-tok-punctuation" },
	punctuation: { color: "#24292e", class: "mail-tok-punctuation" },
	string: { color: "#032f62", class: "mail-tok-string" },
	regex: { color: "#032f62", class: "mail-tok-string" },
	"attr-value": { color: "#032f62", class: "mail-tok-string" },
	builtin: { color: "#032f62", class: "mail-tok-string" },
	number: { color: "#005cc5", class: "mail-tok-number" },
	boolean: { color: "#005cc5", class: "mail-tok-number" },
	constant: { color: "#005cc5", class: "mail-tok-number" },
	property: { color: "#005cc5", class: "mail-tok-number" },
	function: { color: "#6f42c1", class: "mail-tok-function" },
	"class-name": { color: "#6f42c1", class: "mail-tok-function" },
	tag: { color: "#6f42c1", class: "mail-tok-function" },
	"attr-name": { color: "#6f42c1", class: "mail-tok-function" },
	variable: { color: "#6f42c1", class: "mail-tok-function" },
	inserted: { color: "#22863a", class: "mail-tok-inserted" },
	deleted: { color: "#b31d28", class: "mail-tok-deleted" },
	plain: undefined,
};

/** One highlighted run, as a coloured span or as bare text where nothing paints it. */
function highlight(tokens: Token[]): RemixNode {
	return tokens.map((token, index) => {
		let painted = TOKENS[token.type];
		if (!painted) return token.value;

		return (
			<span key={index} class={painted.class} style={`color:${painted.color};`}>
				{token.value}
			</span>
		);
	});
}

export namespace CodeBlock {
	/** Props accepted by {@link CodeBlock}. */
	export interface Props {
		code: string;
		/** Language to highlight as; an unknown one still renders, left unpainted. */
		language?: string;
		/** Already-highlighted runs, as the fence node produces them. */
		tokens?: Token[];
	}
}

/**
 * A fenced block of code, highlighted, inside a single-cell table.
 *
 * The table keeps the block's background solid in Outlook, which paints a `<pre>`
 * no wider than its text, so long lines wrap since an inbox offers no scrollbar.
 *
 * @example <CodeBlock language="bash" code="bun run deploy" />
 */
export function CodeBlock(handle: Handle<CodeBlock.Props>) {
	return () => {
		let { code, language, tokens } = handle.props;
		let content = highlight(tokens ?? tokenize(code, language ?? "plain"));

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

/** A Markdoc tag node, distinct from the string and nullish values `RenderableTreeNode` also allows. */
function isTag(node: RenderableTreeNode): node is Tag {
	return typeof node === "object" && node !== null && "name" in node;
}

/** Flattens a node's markup down to plain text, for attributes like `alt` that accept text only. */
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
 * Content an inbox cannot lay out still renders, in whatever form reads: an
 * ordered list becomes a real `<ol>`, so its plain-text conversion numbers each item.
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

		case "Fence": {
			let tokens = node.attributes?.tokens;
			return (
				<CodeBlock
					key={key}
					code={textOf(node)}
					language={attr(node, "language")}
					tokens={Array.isArray(tokens) ? (tokens as Token[]) : undefined}
				/>
			);
		}

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

		case "ol":
			return (
				<ol key={key} style="margin:0 0 16px;padding:0 0 0 20px;list-style-type:decimal;">
					{children}
				</ol>
			);

		case "li":
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
 * Parsing happens here because a pre-parsed Markdoc tree would still depend on this
 * package's parser to produce it, the exact dependency the subpath exists to contain.
 *
 * @example <Markdown>{`# Release notes\n\nWe shipped **digests**.`}</Markdown>
 */
export function Markdown(handle: Handle<Markdown.Props>) {
	return () => {
		let tree = Markdoc.transform(Markdoc.parse(handle.props.children), { nodes: { fence } });
		return <>{convert(tree, 0)}</>;
	};
}
