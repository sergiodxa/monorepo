/* @jsxImportSource remix/ui */

/**
 * Converts a Markdoc render tree into Remix UI elements, mapping each tag
 * name to its styled Remix output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

import { createElement, css } from "remix/ui";

import { Fence } from "./fence.js";

import type { MarkdownView } from "./index.js";

type RenderableTreeNode = unknown;

interface Tag {
	$$mdtype?: string;
	name?: string;
	attributes?: Record<string, unknown>;
	children?: Array<RenderableTreeNode>;
}

type CSSProps = Parameters<typeof css>[0];

const STYLES = {
	heading: { color: "var(--ui-neutral-fg-emphasis)", fontWeight: 700, lineHeight: 1.2 },
	paragraph: { margin: "0 0 1rem" },
	list: { margin: "0 0 1rem", paddingLeft: "1.25rem" },
	inlineCode: {
		fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
		fontSize: "0.9em",
		padding: "0.125rem 0.3rem",
		borderRadius: "0.25rem",
		backgroundColor: "var(--ui-neutral-bg-tint-hover)",
	},
};

/**
 * Narrows a render node to a Markdoc tag before attribute inspection.
 */
function isTag(node: RenderableTreeNode): node is Tag {
	if (!node || typeof node !== "object" || Array.isArray(node)) return false;
	return (node as { $$mdtype?: string }).$$mdtype === "Tag";
}

function getTagName(node: Tag): string {
	return String((node as { name?: string }).name ?? "");
}

/**
 * Reads a Markdoc attribute that has to render as text. Attribute values are
 * arbitrary scalars, so a table, object or array reaching a string coercion would
 * be painted into the document as `[object Object]`; those fall back instead.
 * @param value Attribute value as Markdoc parsed it.
 * @param fallback Text used when the value cannot be rendered as itself.
 * @returns The attribute as text, or `fallback`.
 */
function textAttribute(value: unknown, fallback: string): string {
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	return fallback;
}

function getTagAttributes(node: Tag): Record<string, unknown> {
	return ((node as { attributes?: Record<string, unknown> }).attributes ?? {}) as Record<
		string,
		unknown
	>;
}

/**
 * Normalizes missing tag children to an empty array for recursive rendering.
 */
function getTagChildren(node: Tag): Array<RenderableTreeNode> {
	let children = (node as { children?: Array<RenderableTreeNode> }).children;
	if (!children) return [];
	return children;
}

/**
 * Rewrites deprecated Remix UI `css` attributes into `mix` entries.
 */
function getRemixProps(attrs: Record<string, unknown>): Record<string, unknown> {
	if (!("css" in attrs)) return attrs;

	let { css: cssValue, mix, ...rest } = attrs;
	let nextMix = Array.isArray(mix) ? [...mix] : typeof mix === "undefined" ? [] : [mix];

	if (isCSSProps(cssValue)) nextMix.push(css(cssValue));

	return { ...rest, mix: nextMix };
}

function isCSSProps(value: unknown): value is CSSProps {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively renders Markdoc nodes into Remix components and primitives.
 * Table elements render unstyled here so an ancestor component owns their
 * sizing, scrolling, and borders instead of two conflicting layouts.
 *
 * @param node - Current render node to convert into Remix output
 * @param components - Optional custom tag renderers keyed by tag name
 * @returns Remix output for the current subtree
 */
function renderChild(
	node: RenderableTreeNode,
	components?: MarkdownView.Props["components"],
): RemixNode {
	if (node === null || typeof node === "undefined" || typeof node === "boolean") return null;
	if (typeof node === "string" || typeof node === "number") return node;

	if (Array.isArray(node)) {
		return node.map((item) => renderChild(item, components));
	}

	if (!isTag(node)) return null;

	let tagName = getTagName(node);
	let attrs = getTagAttributes(node);
	let children = getTagChildren(node).map((item) => renderChild(item, components));

	let Custom = components?.[tagName];
	if (Custom) {
		return <Custom {...attrs}>{children}</Custom>;
	}

	if (tagName === "Fence") {
		return (
			<Fence
				content={textAttribute(attrs.content, "")}
				language={textAttribute(attrs.language, "plain")}
				path={typeof attrs.path === "string" ? attrs.path : undefined}
				title={typeof attrs.title === "string" ? attrs.title : undefined}
			/>
		);
	}

	if (tagName === "h1") {
		return (
			<h1 mix={[css({ ...STYLES.heading, margin: "0 0 1rem", fontSize: "2.25rem" })]}>
				{children}
			</h1>
		);
	}

	if (tagName === "h2") {
		return (
			<h2 mix={[css({ ...STYLES.heading, margin: "2rem 0 1rem", fontSize: "1.875rem" })]}>
				{children}
			</h2>
		);
	}

	if (tagName === "h3") {
		return (
			<h3 mix={[css({ ...STYLES.heading, margin: "1.75rem 0 0.75rem", fontSize: "1.5rem" })]}>
				{children}
			</h3>
		);
	}

	if (tagName === "h4") {
		return (
			<h4 mix={[css({ ...STYLES.heading, margin: "1.5rem 0 0.75rem", fontSize: "1.25rem" })]}>
				{children}
			</h4>
		);
	}

	if (tagName === "h5") {
		return (
			<h5 mix={[css({ ...STYLES.heading, margin: "1.25rem 0 0.5rem", fontSize: "1.125rem" })]}>
				{children}
			</h5>
		);
	}

	if (tagName === "h6") {
		return (
			<h6 mix={[css({ ...STYLES.heading, margin: "1.25rem 0 0.5rem", fontSize: "1rem" })]}>
				{children}
			</h6>
		);
	}

	if (tagName === "p") return <p mix={[css(STYLES.paragraph)]}>{children}</p>;

	if (tagName === "a") {
		return (
			<a
				href={textAttribute(attrs.href, "")}
				target={typeof attrs.target === "string" ? attrs.target : undefined}
				rel={typeof attrs.rel === "string" ? attrs.rel : undefined}
				mix={[
					css({
						color: "var(--ui-primary-fg)",
						textDecoration: "underline",
						textUnderlineOffset: "0.15em",
					}),
				]}
			>
				{children}
			</a>
		);
	}

	if (tagName === "em") return <em>{children}</em>;

	if (tagName === "strong") return <strong>{children}</strong>;

	if (tagName === "blockquote") {
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
				{children}
			</blockquote>
		);
	}

	if (tagName === "code") return <code mix={[css(STYLES.inlineCode)]}>{children}</code>;

	if (tagName === "pre") {
		return (
			<pre
				mix={[
					css({
						margin: "0 0 1rem",
						overflowX: "auto",
						borderRadius: "0.5rem",
						border: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				{children}
			</pre>
		);
	}

	if (tagName === "ul") return <ul mix={[css(STYLES.list)]}>{children}</ul>;

	if (tagName === "ol") return <ol mix={[css(STYLES.list)]}>{children}</ol>;

	if (tagName === "li") return <li mix={[css({ marginBottom: "0.4rem" })]}>{children}</li>;

	if (tagName === "hr") {
		return (
			<hr
				mix={[
					css({ margin: "2rem 0", border: 0, borderTop: "1px solid var(--ui-neutral-border)" }),
				]}
			/>
		);
	}

	if (tagName === "br") return <br />;

	if (tagName === "table") return <table>{children}</table>;

	if (tagName === "thead")
		return <thead mix={[css({ backgroundColor: "var(--ui-neutral-bg-tint)" })]}>{children}</thead>;

	if (tagName === "tbody") return <tbody>{children}</tbody>;

	if (tagName === "tr")
		return <tr mix={[css({ borderBottom: "1px solid var(--ui-neutral-border)" })]}>{children}</tr>;

	if (tagName === "th") return <th>{children}</th>;

	if (tagName === "td") return <td>{children}</td>;

	return createElement(
		tagName,
		getRemixProps(attrs),
		...getTagChildren(node).map((item) => renderChild(item, components)),
	);
}

/**
 * Converts a Markdoc AST into Remix nodes using the default renderer map.
 *
 * @param content - Markdoc AST returned by the server parser
 * @param components - Optional custom tag renderers keyed by tag name
 * @returns Remix output for the full markdown document
 */
export function renderToRemix(
	content: RenderableTreeNode,
	components?: MarkdownView.Props["components"],
): RemixNode {
	return renderChild(content, components);
}
