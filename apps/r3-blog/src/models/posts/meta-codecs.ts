import type { Post } from "~/models/post";
import type { ArticlePost } from "~/models/posts/article";
import type { GlossaryPost } from "~/models/posts/glossary";
import type { LikePost } from "~/models/posts/like";
import type { TutorialPost } from "~/models/posts/tutorial";
import type * as schema from "~/schema";

let META_ROWS_KEY_ORDER = {
	article: ["slug", "title", "locale", "content", "excerpt", "canonical_url"],
	tutorial: ["title", "slug", "excerpt", "content", "tags"],
	like: ["title", "url"],
	glossary: ["slug", "term", "title", "definition"],
} as const;

function valueByKey(rows: Array<schema.SelectPostMeta>, key: string): string | undefined {
	let sortedRows = [...rows].sort((a, b) => {
		let keyCompare = String(a.key).localeCompare(String(b.key));
		if (keyCompare !== 0) return keyCompare;

		let updatedCompare = String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
		if (updatedCompare !== 0) return updatedCompare;

		let createdCompare = String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
		if (createdCompare !== 0) return createdCompare;

		return String(a.id).localeCompare(String(b.id));
	});

	for (let row of sortedRows) {
		if (row.key === key) return row.value;
	}

	return undefined;
}

function rowsFromKeyValues(
	keys: ReadonlyArray<string>,
	values: Record<string, string | undefined>,
): Array<{ key: string; value: string }> {
	let rows: Array<{ key: string; value: string }> = [];

	for (let key of keys) {
		let value = values[key];
		if (typeof value === "undefined") continue;
		rows.push({ key, value });
	}

	return rows;
}

function parseTags(raw: string | undefined): Array<string> {
	if (!raw) return [];

	try {
		let parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		let tags: Array<string> = [];
		for (let value of parsed) {
			if (typeof value !== "string") continue;
			let normalized = value.trim();
			if (!normalized) continue;
			if (tags.includes(normalized)) continue;
			tags.push(normalized);
		}

		return tags;
	} catch {
		let normalized = raw.trim();
		if (!normalized) return [];
		return [normalized];
	}
}

function serializeTags(input: TutorialPost.Meta["tags"]): string | undefined {
	if (typeof input === "undefined") return undefined;

	let source = Array.isArray(input) ? input : [input];
	let tags: Array<string> = [];

	for (let value of source) {
		if (typeof value !== "string") continue;
		let normalized = value.trim();
		if (!normalized) continue;
		if (tags.includes(normalized)) continue;
		tags.push(normalized);
	}

	if (tags.length === 0) return undefined;

	return JSON.stringify(tags);
}

export let articleMetaCodec: Post.MetaCodec<ArticlePost.Meta> = {
	serialize(meta) {
		return rowsFromKeyValues(META_ROWS_KEY_ORDER.article, {
			slug: meta.slug,
			title: meta.title,
			locale: meta.locale,
			content: meta.content,
			excerpt: meta.excerpt,
			canonical_url: meta.canonical_url,
		});
	},
	deserialize(rows) {
		return {
			slug: valueByKey(rows, "slug") ?? "",
			title: valueByKey(rows, "title") ?? "",
			locale: valueByKey(rows, "locale") ?? "en",
			content: valueByKey(rows, "content") ?? "",
			excerpt: valueByKey(rows, "excerpt"),
			canonical_url: valueByKey(rows, "canonical_url"),
		};
	},
};

export let tutorialMetaCodec: Post.MetaCodec<TutorialPost.Meta> = {
	serialize(meta) {
		return rowsFromKeyValues(META_ROWS_KEY_ORDER.tutorial, {
			title: meta.title,
			slug: meta.slug,
			excerpt: meta.excerpt,
			content: meta.content,
			tags: serializeTags(meta.tags),
		});
	},
	deserialize(rows) {
		let tags = parseTags(valueByKey(rows, "tags"));
		return {
			title: valueByKey(rows, "title") ?? "",
			slug: valueByKey(rows, "slug") ?? "",
			excerpt: valueByKey(rows, "excerpt") ?? "",
			content: valueByKey(rows, "content") ?? "",
			tags: tags.length > 0 ? tags : undefined,
		};
	},
};

export let likeMetaCodec: Post.MetaCodec<LikePost.Meta> = {
	serialize(meta) {
		return rowsFromKeyValues(META_ROWS_KEY_ORDER.like, {
			title: meta.title,
			url: meta.url,
		});
	},
	deserialize(rows) {
		return {
			title: valueByKey(rows, "title") ?? "",
			url: valueByKey(rows, "url") ?? "",
		};
	},
};

export let glossaryMetaCodec: Post.MetaCodec<GlossaryPost.Meta> = {
	serialize(meta) {
		return rowsFromKeyValues(META_ROWS_KEY_ORDER.glossary, {
			slug: meta.slug,
			term: meta.term,
			title: meta.title,
			definition: meta.definition,
		});
	},
	deserialize(rows) {
		return {
			slug: valueByKey(rows, "slug") ?? "",
			term: valueByKey(rows, "term") ?? "",
			title: valueByKey(rows, "title"),
			definition: valueByKey(rows, "definition") ?? "",
		};
	},
};
