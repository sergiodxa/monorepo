/**
 * Markdown as an email body, and the highlighted code block it renders fences with.
 *
 * A separate entry point keeps the highlighter out of mail bundles that carry no markdown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Token } from "@sdxc/highlight";
import type {} from "@sdxc/highlight/markdown";
import type { Markdown as Ast } from "@sdxc/markdown";
import type { Handle, RemixNode } from "remix/ui";

import { tokenize } from "@sdxc/highlight";

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

/** Hairline colour around a data table's cells, matching the kit's own rules. */
const TABLE_BORDER_COLOR = "#e4e4e7";

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
		/** Already-highlighted runs, as a painted document carries them. */
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

/** An image's alternative text is inline content in the source and an attribute in the markup. */
function textOf(nodes: Array<Ast.Block | Ast.Inline>): string {
	return nodes.map(textOfNode).join("");
}

/** Reads the prose out of one node, a break becoming the space it stands for. */
function textOfNode(node: Ast.Block | Ast.Inline): string {
	switch (node.type) {
		case "text":
		case "inlineCode":
		case "inlineHtml":
		case "html":
			return node.value;
		case "code":
			return node.content;
		case "softBreak":
		case "hardBreak":
			return " ";
		case "variable":
			return `{% $${node.name} %}`;
		case "footnoteReference":
			return `[${node.identifier}]`;
		case "thematicBreak":
			return "";
		default:
			return textOf([...node.children]);
	}
}

/** Renders a run of nodes in order, which is what every parent does with its children. */
function children(nodes: Array<Ast.Block | Ast.Inline>): RemixNode {
	return nodes.map(convert);
}

/** Each cell takes the alignment of the column it sits in, which the table carries once. */
function convertRow(node: Ast.TableRow, key: number, align: Ast.Table["align"]): RemixNode {
	return (
		<tr key={key}>
			{node.children.map((cell, index) =>
				convertCell(cell, index, node.header, align[index] ?? null),
			)}
		</tr>
	);
}

/** A header row's cells are the column headings, so they carry the weight a reader scans for. */
function convertCell(
	node: Ast.TableCell,
	key: number,
	header: boolean,
	align: "left" | "center" | "right" | null,
): RemixNode {
	let style = `padding:8px 12px;border:1px solid ${TABLE_BORDER_COLOR};font-family:inherit;font-size:14px;line-height:1.4;text-align:${align ?? "left"};vertical-align:top;`;

	if (header) {
		return (
			<th key={key} class="mail-rule" style={`${style}font-weight:600;`}>
				{children(node.children)}
			</th>
		);
	}

	return (
		<td key={key} class="mail-rule" style={style}>
			{children(node.children)}
		</td>
	);
}

/**
 * Turns one node into email components.
 *
 * Content an inbox cannot lay out still renders, in whatever form reads: an
 * ordered list becomes a real `<ol>`, so its plain-text conversion numbers each item.
 */
function convert(node: Ast.Block | Ast.Inline, key: number): RemixNode {
	switch (node.type) {
		case "heading": {
			if (node.level === 1) return <Heading key={key}>{children(node.children)}</Heading>;
			if (node.level === 2) {
				return (
					<Heading key={key} level={2}>
						{children(node.children)}
					</Heading>
				);
			}
			return (
				<Heading key={key} level={3}>
					{children(node.children)}
				</Heading>
			);
		}

		case "paragraph":
			return <Text key={key}>{children(node.children)}</Text>;

		case "code":
			return (
				<CodeBlock key={key} code={node.content} language={node.language} tokens={node.tokens} />
			);

		case "list": {
			if (node.ordered) {
				return (
					<ol
						key={key}
						start={node.start}
						style="margin:0 0 16px;padding:0 0 0 20px;list-style-type:decimal;"
					>
						{children(node.children)}
					</ol>
				);
			}
			return (
				<ul key={key} style="margin:0 0 16px;padding:0 0 0 20px;list-style-type:disc;">
					{children(node.children)}
				</ul>
			);
		}

		case "listItem":
			return (
				<li key={key} style="margin:0 0 6px;font-family:inherit;line-height:1.6;">
					{node.children.map((child, index) =>
						child.type === "paragraph" ? children(child.children) : convert(child, index),
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
					{children(node.children)}
				</blockquote>
			);

		case "alert":
			return (
				<blockquote
					key={key}
					class="mail-rule"
					style="margin:0 0 16px;padding:0 0 0 16px;border-left:3px solid #e4e4e7;"
				>
					<Text size={13} muted>
						{node.kind.toUpperCase()}
					</Text>
					{children(node.children)}
				</blockquote>
			);

		case "table":
			return (
				<table
					key={key}
					width="100%"
					cellPadding="0"
					cellSpacing="0"
					style="width:100%;margin:0 0 16px;border-collapse:collapse;"
				>
					<tbody>{node.children.map((row, index) => convertRow(row, index, node.align))}</tbody>
				</table>
			);

		case "tableRow":
			return convertRow(node, key, []);

		case "tableCell":
			return convertCell(node, key, false, null);

		case "thematicBreak":
			return <Hr key={key} />;

		case "html":
		case "inlineHtml":
			return node.value;

		case "footnoteDefinition":
			return (
				<div key={key} style="margin:0 0 16px;font-family:inherit;font-size:14px;line-height:1.6;">
					<strong style="font-weight:600;">{`[${node.identifier}] `}</strong>
					{children(node.children)}
				</div>
			);

		case "tag":
			return children([...node.children]);

		case "text":
			return node.value;

		case "emphasis":
			return (
				<em key={key} style="font-style:italic;">
					{children(node.children)}
				</em>
			);

		case "strong":
			return (
				<strong key={key} style="font-weight:600;">
					{children(node.children)}
				</strong>
			);

		case "strikethrough":
			return (
				<s key={key} style="text-decoration:line-through;">
					{children(node.children)}
				</s>
			);

		case "inlineCode":
			return <CodeInline key={key}>{node.value}</CodeInline>;

		case "link":
			return (
				<Link key={key} href={node.href}>
					{children(node.children)}
				</Link>
			);

		case "image":
			return <Img key={key} src={node.src} alt={textOf(node.children)} gap={16} />;

		case "softBreak":
			return "\n";

		case "hardBreak":
			return <br key={key} />;

		case "footnoteReference":
			return <sup key={key} style="font-size:0.75em;line-height:1;">{`[${node.identifier}]`}</sup>;

		case "variable":
			return `{% $${node.name} %}`;
	}
}

export namespace Markdown {
	/** Props accepted by {@link Markdown}. */
	export interface Props {
		/** The document to render; its code blocks arrive painted when the caller painted them. */
		document: Ast.Document;
	}
}

/**
 * Renders a parsed document as an email body, using the layout kit for every element.
 *
 * The document arrives parsed, so a caller holding one pays for no parser here, and the
 * same tree an inbox receives is the tree a page renders.
 *
 * @example <Markdown document={notes} />
 */
export function Markdown(handle: Handle<Markdown.Props>) {
	return () => <>{children(handle.props.document.children)}</>;
}
