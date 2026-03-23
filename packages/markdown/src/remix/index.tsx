import type { RenderableTreeNode, RenderableTreeNodes, Tag } from "@markdoc/markdoc";
import type { RemixNode } from "remix/component";

import { cn } from "@pkg/cn";

import { Fence } from "./fence.js";

export namespace MarkdownView {
	export type Content = RenderableTreeNodes;

	export type Component = () => (
		props: Record<string, unknown> & { children?: RemixNode },
	) => RemixNode;

	export interface Props {
		content: Content;
		className?: cn.ClassName;
		components?: Record<string, Component>;
	}
}

let headingStyles = {
	color: "#171717",
	fontWeight: 700,
	lineHeight: 1.2,
};

let paragraphStyles = {
	margin: "0 0 1rem",
};

let listStyles = {
	margin: "0 0 1rem",
	paddingLeft: "1.25rem",
};

let inlineCodeStyles = {
	fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
	fontSize: "0.9em",
	padding: "0.125rem 0.3rem",
	borderRadius: "0.25rem",
	backgroundColor: "#f5f5f5",
};

function isTag(node: RenderableTreeNode): node is Tag {
	if (!node || typeof node !== "object" || Array.isArray(node)) return false;
	return (node as { $$mdtype?: string }).$$mdtype === "Tag";
}

function getTagName(node: Tag): string {
	return String((node as { name?: string }).name ?? "");
}

function getTagAttributes(node: Tag): Record<string, unknown> {
	return ((node as { attributes?: Record<string, unknown> }).attributes ?? {}) as Record<
		string,
		unknown
	>;
}

function getTagChildren(node: Tag): Array<RenderableTreeNode> {
	let children = (node as { children?: Array<RenderableTreeNode> }).children;
	if (!children) return [];
	return children;
}

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
		let Component = Custom();
		return Component({ ...attrs, children });
	}

	if (tagName === "Fence") {
		let Component = Fence();
		return Component({
			content: String(attrs.content ?? ""),
			language: String(attrs.language ?? "plain"),
			path: typeof attrs.path === "string" ? attrs.path : undefined,
			title: typeof attrs.title === "string" ? attrs.title : undefined,
		});
	}

	if (tagName === "h1") {
		return <h1 css={{ ...headingStyles, margin: "0 0 1rem", fontSize: "2.25rem" }}>{children}</h1>;
	}

	if (tagName === "h2") {
		return (
			<h2 css={{ ...headingStyles, margin: "2rem 0 1rem", fontSize: "1.875rem" }}>{children}</h2>
		);
	}

	if (tagName === "h3") {
		return (
			<h3 css={{ ...headingStyles, margin: "1.75rem 0 0.75rem", fontSize: "1.5rem" }}>
				{children}
			</h3>
		);
	}

	if (tagName === "h4") {
		return (
			<h4 css={{ ...headingStyles, margin: "1.5rem 0 0.75rem", fontSize: "1.25rem" }}>
				{children}
			</h4>
		);
	}

	if (tagName === "h5") {
		return (
			<h5 css={{ ...headingStyles, margin: "1.25rem 0 0.5rem", fontSize: "1.125rem" }}>
				{children}
			</h5>
		);
	}

	if (tagName === "h6") {
		return (
			<h6 css={{ ...headingStyles, margin: "1.25rem 0 0.5rem", fontSize: "1rem" }}>{children}</h6>
		);
	}

	if (tagName === "p") return <p css={paragraphStyles}>{children}</p>;

	if (tagName === "a") {
		return (
			<a
				href={String(attrs.href ?? "")}
				target={typeof attrs.target === "string" ? attrs.target : undefined}
				rel={typeof attrs.rel === "string" ? attrs.rel : undefined}
				css={{ color: "#0c4a6e", textDecoration: "underline", textUnderlineOffset: "0.15em" }}
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
				css={{
					margin: "0 0 1rem",
					padding: "0 0 0 1rem",
					borderLeft: "3px solid #d4d4d4",
					color: "#404040",
				}}
			>
				{children}
			</blockquote>
		);
	}

	if (tagName === "code") return <code css={inlineCodeStyles}>{children}</code>;

	if (tagName === "pre") {
		return (
			<pre
				css={{
					margin: "0 0 1rem",
					overflowX: "auto",
					borderRadius: "0.5rem",
					border: "1px solid #e5e5e5",
				}}
			>
				{children}
			</pre>
		);
	}

	if (tagName === "ul") return <ul css={listStyles}>{children}</ul>;

	if (tagName === "ol") return <ol css={listStyles}>{children}</ol>;

	if (tagName === "li") return <li css={{ marginBottom: "0.4rem" }}>{children}</li>;

	if (tagName === "hr") {
		return <hr css={{ margin: "2rem 0", border: 0, borderTop: "1px solid #e5e5e5" }} />;
	}

	if (tagName === "br") return <br />;

	if (tagName === "table") {
		return (
			<div css={{ overflowX: "auto", marginBottom: "1rem" }}>
				<table css={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
					{children}
				</table>
			</div>
		);
	}

	if (tagName === "thead") return <thead css={{ backgroundColor: "#f5f5f5" }}>{children}</thead>;

	if (tagName === "tbody") return <tbody>{children}</tbody>;

	if (tagName === "tr") return <tr css={{ borderBottom: "1px solid #e5e5e5" }}>{children}</tr>;

	if (tagName === "th") {
		return <th css={{ textAlign: "left", padding: "0.6rem", fontWeight: 600 }}>{children}</th>;
	}

	if (tagName === "td") return <td css={{ padding: "0.6rem" }}>{children}</td>;

	return <div>{children}</div>;
}

export function renderToRemix(
	content: MarkdownView.Content,
	components?: MarkdownView.Props["components"],
): RemixNode {
	return renderChild(content as RenderableTreeNode, components);
}

export function MarkdownView() {
	return ({ content, className, components }: MarkdownView.Props) => {
		return (
			<div
				className={cn(className)}
				css={{
					color: "#262626",
					fontSize: "1rem",
					lineHeight: 1.7,
					maxWidth: "85ch",
				}}
			>
				{renderToRemix(content, components)}
			</div>
		);
	};
}
