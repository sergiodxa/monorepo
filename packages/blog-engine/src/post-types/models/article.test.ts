/**
 * Unit tests for the built-in `article` post type: the seeded field definitions
 * and the metadata codec round-trip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createMetaCodec } from "../../posts/models/meta-codec.js";

import type { ArticleMeta } from "./article.js";

import { ARTICLE_FIELDS } from "./article.js";
import { ARTICLE_DEFINITION } from "./article.js";

describe("built-in article type", () => {
	test("seeded fields match the ArticleMeta interface", () => {
		let keys = ARTICLE_FIELDS.map((field) => field.key).sort();
		expect(keys).toEqual(["content", "excerpt"]);
		let content = ARTICLE_FIELDS.find((field) => field.key === "content");
		let excerpt = ARTICLE_FIELDS.find((field) => field.key === "excerpt");
		expect(content).toMatchObject({ kind: "markdown", required: true });
		expect(excerpt).toMatchObject({ kind: "textarea", required: false });
	});

	test("the article codec round-trips a typed ArticleMeta", () => {
		let codec = createMetaCodec(ARTICLE_DEFINITION);
		let input: ArticleMeta = { title: "Post", excerpt: "Short", content: "# Body" };
		let meta = codec.deserialize(
			codec.serialize(input).map((pair, index) => ({
				id: `m${index}`,
				post_id: "p1",
				key: pair.key,
				value: pair.value,
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
			})),
		);
		expect(meta.title).toBe("Post");
		expect(meta.excerpt).toBe("Short");
		expect(meta.content).toBe("# Body");
	});
});
