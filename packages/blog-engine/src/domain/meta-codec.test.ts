import { describe, expect, test } from "bun:test";

import type { SelectPostMeta } from "../database/schema";

import type { PostTypeDefinition } from "./post-type";

import { createMetaCodec, decodeFieldValue, encodeFieldValue } from "./meta-codec";

const DEFINITION: PostTypeDefinition = {
	id: "pt_test",
	name: "note",
	path: "notes",
	label: "Notes",
	description: "",
	builtin: false,
	visible: true,
	fields: [
		{ key: "body", label: "Body", kind: "markdown", required: true },
		{ key: "featured", label: "Featured", kind: "boolean", required: false },
		{ key: "tags", label: "Tags", kind: "tags", required: false },
		{ key: "link", label: "Link", kind: "url", required: false },
	],
};

function asRows(pairs: Array<{ key: string; value: string }>): SelectPostMeta[] {
	return pairs.map((pair, index) => ({
		id: `m${index}`,
		post_id: "p1",
		key: pair.key,
		value: pair.value,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
	}));
}

describe("encodeFieldValue / decodeFieldValue", () => {
	test("boolean encodes to 1/0 and decodes back", () => {
		expect(encodeFieldValue("boolean", true)).toBe("1");
		expect(encodeFieldValue("boolean", false)).toBe("0");
		expect(decodeFieldValue("boolean", "1")).toBe(true);
		expect(decodeFieldValue("boolean", "0")).toBe(false);
	});

	test("tags encode to a JSON array and decode back", () => {
		expect(encodeFieldValue("tags", ["a", "b"])).toBe('["a","b"]');
		expect(decodeFieldValue("tags", '["a","b"]')).toEqual(["a", "b"]);
		expect(decodeFieldValue("tags", "not json")).toEqual([]);
	});

	test("text-like kinds pass through as strings", () => {
		expect(encodeFieldValue("markdown", "# Hi")).toBe("# Hi");
		expect(decodeFieldValue("url", "https://example.com")).toBe("https://example.com");
	});
});

describe("createMetaCodec", () => {
	test("round-trips a full metadata object", () => {
		let codec = createMetaCodec(DEFINITION);
		let rows = codec.serialize({
			title: "Hello",
			body: "# Heading",
			featured: true,
			tags: ["x", "y"],
			link: "https://example.com",
		});
		let meta = codec.deserialize(asRows(rows));

		expect(meta.title).toBe("Hello");
		expect(meta.body).toBe("# Heading");
		expect(meta.featured).toBe(true);
		expect(meta.tags).toEqual(["x", "y"]);
		expect(meta.link).toBe("https://example.com");
	});

	test("omits undefined fields on serialize and defaults title on deserialize", () => {
		let codec = createMetaCodec(DEFINITION);
		let rows = codec.serialize({ title: "Only title" });
		expect(rows).toEqual([{ key: "title", value: "Only title" }]);

		let meta = codec.deserialize(asRows([]));
		expect(meta.title).toBe("");
	});

	test("ignores unknown stored keys (append-only field evolution)", () => {
		let codec = createMetaCodec(DEFINITION);
		let meta = codec.deserialize(asRows([{ key: "removed_field", value: "stale" }]));
		expect("removed_field" in meta).toBe(false);
	});
});
