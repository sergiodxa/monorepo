/**
 * Shared public-facing post rendering primitives: list items, publish dates, and the
 * field renderers that turn a post's typed metadata into markup per field kind
 * (markdown, url, boolean, tags, …). Reused by the feed, type index, and post views.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle } from "remix/ui";

import { MarkdownView } from "@pkg/markdown/client/remix";

import type { PostTypeDefinition } from "../../post-types/models/post-type";
import type { PostMetaValues } from "../../posts/models/meta-codec";

import { parseMarkdown } from "../markdown";

import * as s from "./styles";

/** A summary row for post list views. */
export interface PostListItem {
	title: string;
	href: string;
	publishedAt: string | null;
	excerpt: string;
}

/**
 * Derives a short excerpt for a post: the first non-empty text/textarea field value
 * in field order (used by list views, feeds, and RSS descriptions).
 * @param definition - The post type whose fields are scanned.
 * @param meta - The post's decoded metadata.
 * @returns The first suitable field value, or `""` when none qualifies.
 */
export function excerptFor(definition: PostTypeDefinition, meta: PostMetaValues): string {
	for (let field of definition.fields) {
		if (field.kind === "textarea" || field.kind === "text") {
			let value = meta[field.key];
			if (typeof value === "string" && value.trim()) return value;
		}
	}
	return "";
}

/**
 * Renders a publish date as a localized `<time>` element, or a "Draft" note when the
 * date is null.
 * @param handle - Component handle exposing `publishedAt`.
 * @returns A render function producing the date markup.
 */
export function PostDate(handle: Handle<{ publishedAt: string | null }>) {
	return () => {
		let { publishedAt } = handle.props;
		if (publishedAt === null) return <span mix={[s.meta]}>Draft</span>;
		let ts = Date.parse(publishedAt);
		if (Number.isNaN(ts)) return <span mix={[s.meta]} />;
		let date = new Date(ts);
		let label = date.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" });
		return (
			<time mix={[s.meta]} datetime={date.toISOString()}>
				{label}
			</time>
		);
	};
}

/**
 * Renders a list of posts, or a "No posts yet." note when empty.
 * @param handle - Component handle exposing the `items` to render.
 * @returns A render function producing the list markup.
 */
export function PostList(handle: Handle<{ items: PostListItem[] }>) {
	return () => {
		let { items } = handle.props;
		if (items.length === 0) return <p mix={[s.meta]}>No posts yet.</p>;
		return (
			<ul mix={[s.postList]}>
				{items.map((item) => (
					<li mix={[s.postListItem]} key={item.href}>
						<a href={item.href}>{item.title}</a> <PostDate publishedAt={item.publishedAt} />
						{item.excerpt && <p>{item.excerpt}</p>}
					</li>
				))}
			</ul>
		);
	};
}

/**
 * Renders a single field value according to its kind (markdown, url, boolean, tags,
 * or plain text).
 * @param handle - Component handle exposing the field `kind` and `value`.
 * @returns A render function producing the value markup.
 */
export function FieldValue(handle: Handle<{ kind: string; value: unknown }>) {
	return () => {
		let { kind, value } = handle.props;
		if (kind === "markdown") {
			let content = parseMarkdown(typeof value === "string" ? value : "");
			return content ? <MarkdownView content={content} /> : <></>;
		}
		if (kind === "url") {
			let url = String(value ?? "");
			return url ? <a href={url}>{url}</a> : <></>;
		}
		if (kind === "boolean") return <span mix={[s.meta]}>{value ? "Yes" : "No"}</span>;
		if (kind === "tags") {
			let tags = Array.isArray(value) ? value : [];
			return (
				<>
					{tags.map((t) => (
						<span mix={[s.tag]} key={String(t)}>
							{String(t)}{" "}
						</span>
					))}
				</>
			);
		}
		return <p>{String(value ?? "")}</p>;
	};
}

/**
 * Renders every defined field of a post in order (the title is rendered separately by
 * the caller).
 * @param handle - Component handle exposing the type `definition` and post `meta`.
 * @returns A render function producing the fields markup.
 */
export function PostFields(
	handle: Handle<{ definition: PostTypeDefinition; meta: PostMetaValues }>,
) {
	return () => {
		let { definition, meta } = handle.props;
		return (
			<>
				{definition.fields.map((field) => (
					<div key={field.key}>
						<FieldValue kind={field.kind} value={meta[field.key]} />
					</div>
				))}
			</>
		);
	};
}
