import type { Handle } from "remix/ui";

import { MarkdownView } from "@pkg/markdown/client/remix";

import type { PostTypeDefinition } from "../../post-types/models/post-type";
import type { PostMetaValues } from "../../posts/models/meta-codec";

import { parseMarkdown } from "../markdown";

/** A summary row for post list views. */
export interface PostListItem {
	title: string;
	href: string;
	publishedAt: string | null;
	excerpt: string;
}

/** Returns a short excerpt: the first text/textarea field value in field order. */
export function excerptFor(definition: PostTypeDefinition, meta: PostMetaValues): string {
	for (let field of definition.fields) {
		if (field.kind === "textarea" || field.kind === "text") {
			let value = meta[field.key];
			if (typeof value === "string" && value.trim()) return value;
		}
	}
	return "";
}

/** Renders a publish date as `<time>`, or a "Draft" note. */
export function PostDate(handle: Handle<{ publishedAt: string | null }>) {
	return () => {
		let { publishedAt } = handle.props;
		if (publishedAt === null) return <span class="meta">Draft</span>;
		let ts = Date.parse(publishedAt);
		if (Number.isNaN(ts)) return <span class="meta" />;
		let date = new Date(ts);
		let label = date.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" });
		return (
			<time class="meta" datetime={date.toISOString()}>
				{label}
			</time>
		);
	};
}

/** Renders a list of posts. */
export function PostList(handle: Handle<{ items: PostListItem[] }>) {
	return () => {
		let { items } = handle.props;
		if (items.length === 0) return <p class="meta">No posts yet.</p>;
		return (
			<ul class="post-list">
				{items.map((item) => (
					<li key={item.href}>
						<a href={item.href}>{item.title}</a> <PostDate publishedAt={item.publishedAt} />
						{item.excerpt && <p>{item.excerpt}</p>}
					</li>
				))}
			</ul>
		);
	};
}

/** Renders a single field value according to its kind. */
export function FieldValue(handle: Handle<{ kind: string; value: unknown }>) {
	return () => {
		let { kind, value } = handle.props;
		if (kind === "markdown") {
			let content = parseMarkdown(typeof value === "string" ? value : "");
			return content ? <>{MarkdownView({ content })}</> : <></>;
		}
		if (kind === "url") {
			let url = String(value ?? "");
			return url ? <a href={url}>{url}</a> : <></>;
		}
		if (kind === "boolean") return <span class="meta">{value ? "Yes" : "No"}</span>;
		if (kind === "tags") {
			let tags = Array.isArray(value) ? value : [];
			return (
				<>
					{tags.map((tag) => (
						<span class="tag" key={String(tag)}>
							{String(tag)}{" "}
						</span>
					))}
				</>
			);
		}
		return <p>{String(value ?? "")}</p>;
	};
}

/** Renders every defined field of a post (title handled separately by the caller). */
export function PostFields(
	handle: Handle<{ definition: PostTypeDefinition; meta: PostMetaValues }>,
) {
	return () => {
		let { definition, meta } = handle.props;
		return (
			<>
				{definition.fields.map((field) => (
					<div class={`field field-${field.key}`} key={field.key}>
						<FieldValue kind={field.kind} value={meta[field.key]} />
					</div>
				))}
			</>
		);
	};
}
