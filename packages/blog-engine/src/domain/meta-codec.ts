import type { Post } from "./post";
import type { PostTypeDefinition, FieldKind } from "./post-type";

/**
 * Domain metadata for a post: an implicit `title` plus one entry per defined
 * field. Field values are decoded to their native type (string, boolean, string[]).
 */
export interface PostMetaValues {
	title: string;
	[key: string]: unknown;
}

/** Encodes a native field value to its `post_meta.value` (TEXT) storage form. */
export function encodeFieldValue(kind: FieldKind, value: unknown): string {
	switch (kind) {
		case "boolean":
			return value ? "1" : "0";
		case "tags":
			return JSON.stringify(Array.isArray(value) ? value : []);
		default:
			return value === undefined || value === null ? "" : String(value);
	}
}

/** Decodes a stored `post_meta.value` back to its native field value. */
export function decodeFieldValue(kind: FieldKind, raw: string): unknown {
	switch (kind) {
		case "boolean":
			return raw === "1";
		case "tags":
			try {
				let parsed: unknown = JSON.parse(raw);
				return Array.isArray(parsed) ? (parsed as string[]) : [];
			} catch {
				return [];
			}
		default:
			return raw;
	}
}

/**
 * Derives a runtime {@link Post.MetaCodec} from a post-type definition. This is
 * the generalization of r3-blog's hand-written per-type codecs: the field
 * definitions drive serialization, deserialization, forms, and validation.
 * @param definition - The post type whose fields shape the metadata.
 * @returns A codec mapping {@link PostMetaValues} to/from `post_meta` rows.
 */
export function createMetaCodec(definition: PostTypeDefinition): Post.MetaCodec<PostMetaValues> {
	return {
		serialize(meta) {
			let rows: Array<{ key: string; value: string }> = [];
			if (meta.title !== undefined) rows.push({ key: "title", value: String(meta.title) });
			for (let field of definition.fields) {
				let value = meta[field.key];
				if (value === undefined) continue;
				rows.push({ key: field.key, value: encodeFieldValue(field.kind, value) });
			}
			return rows;
		},
		deserialize(rows) {
			let byKey = new Map(rows.map((row) => [row.key, row.value]));
			let meta: PostMetaValues = { title: byKey.get("title") ?? "" };
			for (let field of definition.fields) {
				let raw = byKey.get(field.key);
				if (raw !== undefined) meta[field.key] = decodeFieldValue(field.kind, raw);
			}
			return meta;
		},
	};
}
