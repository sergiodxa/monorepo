/**
 * Renders a parsed document into Remix UI nodes. It lives behind its own entry
 * point so a bundle that only parses never pays for the UI runtime, and a view
 * composes the result into markup it owns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/* @jsxImportSource remix/ui */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import type { Markdown } from "../index.js";

import { Fence } from "./fence.js";

/** A component a caller supplies for a tag name, or for one of the nodes it may take over. */
export type MarkdownComponent = {
	/**
	 * Written as a method so a component that names the props it reads —
	 * `Handle<{ type: string; children: RemixNode }>` — is accepted here, which is
	 * how a caller writes one.
	 */
	component(handle: Handle<{ children: RemixNode; [key: string]: unknown }>): () => RemixNode;
}["component"];

/** Options for {@link toRemix}. */
export interface RemixOptions {
	/** Keyed by tag name, or by a node type a caller wants to draw itself. */
	components?: Record<string, MarkdownComponent>;
}

/**
 * The fields that describe a node's place in the tree rather than its content,
 * so a component takes over a node with the same props a tag's own attributes
 * would have given it.
 */
const STRUCTURAL_FIELDS = new Set(["type", "children", "position", "attributes"]);

/**
 * @param node - Any node, so a caller can render a fragment of a document
 * @param options - Components for the tags the document uses
 * @returns Remix output for that subtree
 * @example <article>{toRemix(props.document)}</article>
 */
export function toRemix(node: Markdown.Node, options: RemixOptions = {}): RemixNode {
	return renderNode(node, options);
}

/**
 * The recursion every other helper goes through, so a component a caller
 * supplied wins over the built-in drawing for the same node wherever it sits.
 */
function renderNode(node: Markdown.Node, options: RemixOptions): RemixNode {
	if (node.type === "footnoteDefinition") return null;

	let Custom = componentFor(node, options.components);
	if (Custom) {
		return <Custom {...componentProps(node)}>{renderChildren(childrenOf(node), options)}</Custom>;
	}

	switch (node.type) {
		case "document": {
			return (
				<>
					{renderChildren(node.children, options)}
					{renderFootnotes(node, options)}
				</>
			);
		}

		case "heading":
			return renderHeading(node, options);

		case "paragraph":
			return <p mix={[css({ margin: "0 0 1rem" })]}>{renderChildren(node.children, options)}</p>;

		case "code":
			return (
				<Fence
					tokens={codeTokens(node)}
					content={node.content}
					language={node.language ?? "plain"}
					path={stringAttribute(node.attributes.path)}
					title={stringAttribute(node.attributes.title)}
				/>
			);

		case "list": {
			if (node.ordered) {
				return (
					<ol start={node.start} mix={[css({ margin: "0 0 1rem", paddingLeft: "1.25rem" })]}>
						{renderChildren(node.children, options)}
					</ol>
				);
			}
			return (
				<ul mix={[css({ margin: "0 0 1rem", paddingLeft: "1.25rem" })]}>
					{renderChildren(node.children, options)}
				</ul>
			);
		}

		case "listItem":
			return (
				<li mix={[css({ marginBottom: "0.4rem" })]}>
					{typeof node.checked === "boolean" && (
						<input
							type="checkbox"
							checked={node.checked}
							disabled
							mix={[css({ marginRight: "0.4rem" })]}
						/>
					)}
					{renderChildren(node.children, options)}
				</li>
			);

		case "blockquote":
			return (
				<blockquote
					mix={[
						css({
							margin: "0 0 1rem",
							padding: "0 0 0 1rem",
							borderLeft: "3px solid var(--ui-neutral-border-strong)",
							color: "var(--ui-neutral-fg)",
						}),
					]}
				>
					{renderChildren(node.children, options)}
				</blockquote>
			);

		case "alert":
			return (
				<aside
					data-kind={node.kind}
					mix={[
						css({
							margin: "0 0 1rem",
							padding: "0.75rem 1rem",
							borderLeft: "3px solid var(--ui-neutral-border-strong)",
							borderRadius: "0.25rem",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							color: "var(--ui-neutral-fg)",
						}),
					]}
				>
					{renderChildren(node.children, options)}
				</aside>
			);

		case "table":
			return renderTable(node, options);

		case "tableRow":
			return renderRow(node, [], options);

		case "tableCell":
			return renderCell(node, false, null, options);

		case "thematicBreak":
			return (
				<hr
					mix={[
						css({ margin: "2rem 0", border: 0, borderTop: "1px solid var(--ui-neutral-border)" }),
					]}
				/>
			);

		case "html":
		case "inlineHtml":
			return node.value;

		case "tag":
			return renderChildren(node.children, options);

		case "text":
			return node.value;

		case "emphasis":
			return <em>{renderChildren(node.children, options)}</em>;

		case "strong":
			return <strong>{renderChildren(node.children, options)}</strong>;

		case "strikethrough":
			return <s>{renderChildren(node.children, options)}</s>;

		case "inlineCode":
			return (
				<code
					mix={[
						css({
							fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
							fontSize: "0.9em",
							padding: "0.125rem 0.3rem",
							borderRadius: "0.25rem",
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						}),
					]}
				>
					{node.value}
				</code>
			);

		case "link":
			return (
				<a
					href={node.href}
					title={node.title}
					mix={[
						css({
							color: "var(--ui-primary-fg)",
							textDecoration: "underline",
							textUnderlineOffset: "0.15em",
						}),
					]}
				>
					{renderChildren(node.children, options)}
				</a>
			);

		case "image":
			return <img src={node.src} alt={plainText(node.children)} title={node.title} />;

		case "softBreak":
			return "\n";

		case "hardBreak":
			return <br />;

		case "footnoteReference":
			return (
				<sup>
					<a
						id={`fnref-${node.identifier}`}
						href={`#fn-${node.identifier}`}
						mix={[
							css({
								color: "var(--ui-primary-fg)",
								textDecoration: "underline",
								textUnderlineOffset: "0.15em",
							}),
						]}
					>
						{node.identifier}
					</a>
				</sup>
			);

		case "variable":
			return `{% $${node.name} %}`;
	}
}

/** Renders a run of nodes in order, which is what every parent does with its children. */
function renderChildren(nodes: readonly Markdown.Node[], options: RemixOptions): RemixNode {
	return nodes.map((child) => renderNode(child, options));
}

/** A node's children, or nothing for the leaves that hold a value instead. */
function childrenOf(node: Markdown.Node): readonly Markdown.Node[] {
	if ("children" in node) return node.children;
	return [];
}

/** A tag's own name selects its component, and any other node its type does. */
function componentFor(
	node: Markdown.Node,
	components?: Record<string, MarkdownComponent>,
): MarkdownComponent | undefined {
	if (!components) return undefined;
	if (node.type === "tag" && components[node.name]) return components[node.name];
	return components[node.type];
}

/**
 * What a component receives besides its children: the node's own content fields
 * and the attributes an annotation wrote, flattened into one bag so a component
 * reads `props.type` for a callout the way the source wrote it.
 */
function componentProps(node: Markdown.Node): Record<string, unknown> {
	let attributes = "attributes" in node ? node.attributes : {};
	let props: Record<string, unknown> = {};

	for (let [key, value] of Object.entries(node)) {
		if (STRUCTURAL_FIELDS.has(key)) continue;
		if (key === "name" && node.type === "tag") continue;
		props[key] = value;
	}

	return { ...props, ...attributes };
}

/** Attributes hold numbers and booleans too, and only a string is a path or a title. */
function stringAttribute(value: string | number | boolean | undefined): string | undefined {
	if (typeof value === "string") return value;
	return undefined;
}

/**
 * Painted runs ride on the node as a field another package attaches, so they are
 * read as unknown and narrowed here rather than imported, which keeps this entry
 * point free of a syntax highlighter.
 */
function codeTokens(node: Markdown.Code): Fence.Token[] {
	let tokens = (node as { tokens?: unknown }).tokens;
	if (!Array.isArray(tokens)) return [];
	return tokens.filter(isToken);
}

/** Guards the painted runs, so a malformed field draws the raw source instead of throwing. */
function isToken(value: unknown): value is Fence.Token {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as { type?: unknown; value?: unknown };
	return typeof candidate.type === "string" && typeof candidate.value === "string";
}

/** The six levels differ only in their spacing and size, which is why they are written out. */
function renderHeading(node: Markdown.Heading, options: RemixOptions): RemixNode {
	let id = stringAttribute(node.attributes.id);
	let className = stringAttribute(node.attributes.class);
	let children = renderChildren(node.children, options);

	if (node.level === 1) {
		return (
			<h1
				id={id}
				class={className}
				mix={[
					css({
						color: "var(--ui-neutral-fg-emphasis)",
						fontWeight: 700,
						lineHeight: 1.2,
						margin: "0 0 1rem",
						fontSize: "2.25rem",
					}),
				]}
			>
				{children}
			</h1>
		);
	}

	if (node.level === 2) {
		return (
			<h2
				id={id}
				class={className}
				mix={[
					css({
						color: "var(--ui-neutral-fg-emphasis)",
						fontWeight: 700,
						lineHeight: 1.2,
						margin: "2rem 0 1rem",
						fontSize: "1.875rem",
					}),
				]}
			>
				{children}
			</h2>
		);
	}

	if (node.level === 3) {
		return (
			<h3
				id={id}
				class={className}
				mix={[
					css({
						color: "var(--ui-neutral-fg-emphasis)",
						fontWeight: 700,
						lineHeight: 1.2,
						margin: "1.75rem 0 0.75rem",
						fontSize: "1.5rem",
					}),
				]}
			>
				{children}
			</h3>
		);
	}

	if (node.level === 4) {
		return (
			<h4
				id={id}
				class={className}
				mix={[
					css({
						color: "var(--ui-neutral-fg-emphasis)",
						fontWeight: 700,
						lineHeight: 1.2,
						margin: "1.5rem 0 0.75rem",
						fontSize: "1.25rem",
					}),
				]}
			>
				{children}
			</h4>
		);
	}

	if (node.level === 5) {
		return (
			<h5
				id={id}
				class={className}
				mix={[
					css({
						color: "var(--ui-neutral-fg-emphasis)",
						fontWeight: 700,
						lineHeight: 1.2,
						margin: "1.25rem 0 0.5rem",
						fontSize: "1.125rem",
					}),
				]}
			>
				{children}
			</h5>
		);
	}

	return (
		<h6
			id={id}
			class={className}
			mix={[
				css({
					color: "var(--ui-neutral-fg-emphasis)",
					fontWeight: 700,
					lineHeight: 1.2,
					margin: "1.25rem 0 0.5rem",
					fontSize: "1rem",
				}),
			]}
		>
			{children}
		</h6>
	);
}

/**
 * Splits the rows at the one the delimiter row marked, so the header lands in a
 * `<thead>` and everything else in a `<tbody>`. The table itself stays unstyled
 * for an ancestor to own its sizing, scrolling and borders.
 */
function renderTable(node: Markdown.Table, options: RemixOptions): RemixNode {
	let header = node.children.filter((row) => row.header);
	let body = node.children.filter((row) => !row.header);

	return (
		<table>
			{header.length > 0 && (
				<thead mix={[css({ backgroundColor: "var(--ui-neutral-bg-tint)" })]}>
					{header.map((row) => renderRow(row, node.align, options))}
				</thead>
			)}
			{body.length > 0 && <tbody>{body.map((row) => renderRow(row, node.align, options))}</tbody>}
		</table>
	);
}

/** Each cell takes the alignment of the column it sits in, which the table carries once. */
function renderRow(
	node: Markdown.TableRow,
	align: Markdown.Table["align"],
	options: RemixOptions,
): RemixNode {
	return (
		<tr mix={[css({ borderBottom: "1px solid var(--ui-neutral-border)" })]}>
			{node.children.map((cell, index) =>
				renderCell(cell, node.header, align[index] ?? null, options),
			)}
		</tr>
	);
}

/** A header row's cells are the table's column headings, so they carry the scope a reader needs. */
function renderCell(
	node: Markdown.TableCell,
	header: boolean,
	align: "left" | "center" | "right" | null,
	options: RemixOptions,
): RemixNode {
	let children = renderChildren(node.children, options);
	let mix = align ? [css({ textAlign: align })] : undefined;

	if (header) return <th mix={mix}>{children}</th>;
	return <td mix={mix}>{children}</td>;
}

/**
 * Draws every definition the document holds as one trailing list, which is where
 * a footnote belongs however deep in the prose its body was written.
 */
function renderFootnotes(node: Markdown.Document, options: RemixOptions): RemixNode {
	let definitions = collectFootnotes(node, []);
	if (definitions.length === 0) return null;

	return (
		<ol
			mix={[
				css({
					margin: "2rem 0 0",
					paddingLeft: "1.25rem",
					borderTop: "1px solid var(--ui-neutral-border)",
					paddingTop: "1rem",
					fontSize: "0.875rem",
				}),
			]}
		>
			{definitions.map((definition) => (
				<li id={`fn-${definition.identifier}`} mix={[css({ marginBottom: "0.4rem" })]}>
					{renderChildren(definition.children, options)}
				</li>
			))}
		</ol>
	);
}

/** Gathers definitions in document order, so the trailing list reads the way the source wrote it. */
function collectFootnotes(
	node: Markdown.Node,
	found: Markdown.FootnoteDefinition[],
): Markdown.FootnoteDefinition[] {
	if (node.type === "footnoteDefinition") {
		found.push(node);
		return found;
	}

	for (let child of childrenOf(node)) collectFootnotes(child, found);
	return found;
}

/** An image's alternative text is inline content in the source and an attribute in the markup. */
function plainText(nodes: readonly Markdown.Node[]): string {
	return nodes.map(textOf).join("");
}

/** Reads the prose out of one node, breaks becoming the space they stand for. */
function textOf(node: Markdown.Node): string {
	if (node.type === "text" || node.type === "inlineCode" || node.type === "inlineHtml") {
		return node.value;
	}
	if (node.type === "softBreak" || node.type === "hardBreak") return " ";
	if (node.type === "variable") return `{% $${node.name} %}`;
	return plainText(childrenOf(node));
}
