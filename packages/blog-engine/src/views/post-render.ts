import type { PostMetaValues } from "../domain/meta-codec";
import type { PostTypeDefinition } from "../domain/post-type";

import { attr, escape } from "./html";
import { renderMarkdown } from "./markdown";

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

/** Renders a `<time>` for a publish date, or a "Draft"/"Scheduled" note. */
export function renderDate(publishedAt: string | null): string {
	if (publishedAt === null) return `<span class="blog-meta">Draft</span>`;
	let ts = Date.parse(publishedAt);
	if (Number.isNaN(ts)) return "";
	let iso = new Date(ts).toISOString();
	let label = new Date(ts).toLocaleDateString("en", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	return `<time class="blog-meta" datetime="${attr(iso)}">${escape(label)}</time>`;
}

/** Renders a post list as HTML. */
export function renderPostList(items: PostListItem[]): string {
	if (items.length === 0) return `<p class="blog-meta">No posts yet.</p>`;
	let rows = items
		.map(
			(item) =>
				`<li><a href="${attr(item.href)}">${escape(item.title)}</a> ${renderDate(item.publishedAt)}` +
				(item.excerpt ? `<p>${escape(item.excerpt)}</p>` : "") +
				`</li>`,
		)
		.join("");
	return `<ul class="blog-list">${rows}</ul>`;
}

/** Renders one field value to HTML according to its kind. */
export function renderFieldValue(kind: string, value: unknown): string {
	switch (kind) {
		case "markdown":
			return renderMarkdown(typeof value === "string" ? value : "");
		case "url": {
			let url = String(value ?? "");
			return url ? `<a href="${attr(url)}">${escape(url)}</a>` : "";
		}
		case "boolean":
			return value ? `<span class="blog-meta">Yes</span>` : `<span class="blog-meta">No</span>`;
		case "tags": {
			let tags = Array.isArray(value) ? value : [];
			return tags.map((tag) => `<span class="blog-tag">${escape(tag)}</span>`).join(" ");
		}
		case "textarea":
		case "text":
		default:
			return `<p>${escape(value)}</p>`;
	}
}

/** Renders every defined field of a post (title handled separately by the caller). */
export function renderFields(definition: PostTypeDefinition, meta: PostMetaValues): string {
	return definition.fields
		.map(
			(field) =>
				`<div class="blog-field blog-field-${attr(field.key)}">${renderFieldValue(field.kind, meta[field.key])}</div>`,
		)
		.join("");
}
