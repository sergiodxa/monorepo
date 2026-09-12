/**
 * Covers the one merge the parser does ahead of time: tags keyed by name so a
 * lookup during the walk is a map read, with `content` defaulted and an
 * attribute schema handed through untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { resolveOptions } from "./options.js";

/** The schema a tag validates its opening attributes against. */
const ATTRIBUTES = s.object({ type: s.string() });

describe("resolveOptions", () => {
	test("registers nothing when the caller declared no tags", () => {
		expect(resolveOptions({}).tags.size).toBe(0);
	});

	test("registers nothing when the caller declared an empty set of tags", () => {
		expect(resolveOptions({ tags: {} }).tags.size).toBe(0);
	});

	test("ignores the frontmatter schema, which no parsing phase reads", () => {
		expect(resolveOptions({ frontmatter: ATTRIBUTES }).tags.size).toBe(0);
	});

	test("keys every declared tag by the name the source writes", () => {
		let options = resolveOptions({ tags: { note: {}, callout: {}, video: { content: "none" } } });

		expect([...options.tags.keys()]).toEqual(["note", "callout", "video"]);
	});

	test("carries the name onto the tag, so a lookup answers with it", () => {
		expect(resolveOptions({ tags: { note: {} } }).tags.get("note")?.name).toBe("note");
	});

	test("treats a tag that says nothing as holding blocks", () => {
		expect(resolveOptions({ tags: { note: {} } }).tags.get("note")?.content).toBe("blocks");
	});

	test("keeps the content a tag declares for itself", () => {
		let options = resolveOptions({
			tags: { kbd: { content: "inline" }, video: { content: "none" }, note: { content: "blocks" } },
		});

		expect(options.tags.get("kbd")?.content).toBe("inline");
		expect(options.tags.get("video")?.content).toBe("none");
		expect(options.tags.get("note")?.content).toBe("blocks");
	});

	test("hands the attribute schema through for the phase that validates it", () => {
		let options = resolveOptions({ tags: { callout: { attributes: ATTRIBUTES } } });

		expect(options.tags.get("callout")?.attributes).toBe(ATTRIBUTES);
	});

	test("leaves the attribute schema undefined on a tag that declares none", () => {
		expect(resolveOptions({ tags: { note: {} } }).tags.get("note")?.attributes).toBeUndefined();
	});

	test("answers nothing for a name the caller never declared", () => {
		expect(resolveOptions({ tags: { note: {} } }).tags.get("callout")).toBeUndefined();
	});
});
