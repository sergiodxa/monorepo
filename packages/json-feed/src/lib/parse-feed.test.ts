/**
 * Tests how a document that got a field wrong reads, since JSON Feed asks a
 * reader to recover from one rather than refuse the whole feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseFeed } from "./parse-feed.js";

/** Wraps a document's own fields around the two the parser requires. */
function document(fields: Record<string, unknown>): Record<string, unknown> {
	return { version: "https://jsonfeed.org/version/1.1", title: "Example", items: [], ...fields };
}

describe("parseFeed", () => {
	test("reads a minimal feed", () => {
		let result = parseFeed(document({}));
		if (isFailure(result)) throw result.error;

		expect(result.data.feed).toEqual({
			version: "https://jsonfeed.org/version/1.1",
			title: "Example",
		});
		expect(result.data.items).toEqual([]);
	});

	test("refuses a value that is not an object", () => {
		let result = parseFeed(["item"]);

		expect(isFailure(result) && result.error.message).toBe("Expected a JSON Feed object.");
	});

	test("refuses JSON that declares no JSON Feed version", () => {
		let result = parseFeed({ title: "Example", items: [] });

		expect(isFailure(result) && result.error.message).toBe("Expected a JSON Feed version URL.");
	});

	test("discards an item without a usable id, as the format insists", () => {
		let result = parseFeed(
			document({
				items: [
					{ id: "1", content_text: "Kept" },
					{ content_text: "Discarded" },
					{ id: "", content_text: "Discarded" },
					"not an object",
					{ id: 2, content_text: "Coerced" },
				],
			}),
		);
		if (isFailure(result)) throw result.error;

		expect(result.data.items.map((item) => item.id)).toEqual(["1", "2"]);
	});

	test("skips a field the document typed the wrong way", () => {
		let result = parseFeed(
			document({
				description: 12,
				expired: "yes",
				hubs: { type: "WebSub" },
				items: [{ id: "1", title: ["Hello"], tags: "updates", attachments: {} }],
			}),
		);
		if (isFailure(result)) throw result.error;

		expect(result.data.feed.description).toBeUndefined();
		expect(result.data.feed.expired).toBeUndefined();
		expect(result.data.feed.hubs).toBeUndefined();
		expect(result.data.items[0]).toEqual({ id: "1" });
	});

	test("keeps an expired feed's flag, since a reader acts on it", () => {
		let result = parseFeed(document({ expired: true }));
		if (isFailure(result)) throw result.error;

		expect(result.data.feed.expired).toBe(true);
	});

	test("keeps the hubs and authors that carry what the format requires", () => {
		let result = parseFeed(
			document({
				authors: [{ name: "Jane" }, {}, { avatar: "https://example.com/a.png" }, "Jane"],
				hubs: [
					{ type: "WebSub", url: "https://hub.example.com" },
					{ type: "WebSub" },
					{ url: "https://hub.example.com" },
				],
			}),
		);
		if (isFailure(result)) throw result.error;

		expect(result.data.feed.authors).toEqual([
			{ name: "Jane" },
			{ avatar: "https://example.com/a.png" },
		]);
		expect(result.data.feed.hubs).toEqual([{ type: "WebSub", url: "https://hub.example.com" }]);
	});

	test("keeps an attachment that names no media type, and reads a size written as text", () => {
		let result = parseFeed(
			document({
				items: [
					{
						id: "1",
						attachments: [
							{ url: "https://example.com/a.m4a", size_in_bytes: "1024" },
							{ mime_type: "audio/mpeg" },
						],
					},
				],
			}),
		);
		if (isFailure(result)) throw result.error;

		expect(result.data.items[0]?.attachments).toEqual([
			{ url: "https://example.com/a.m4a", sizeInBytes: 1024 },
		]);
	});

	test("carries extension objects through from the feed and from an item", () => {
		let result = parseFeed(
			document({
				_blue_shed: { about: "https://example.com/docs", explicit: false },
				items: [{ id: "1", _blue_shed: { rating: 5 } }],
			}),
		);
		if (isFailure(result)) throw result.error;

		expect(result.data.feed["_blue_shed"]).toEqual({
			about: "https://example.com/docs",
			explicit: false,
		});
		expect(result.data.items[0]?.["_blue_shed"]).toEqual({ rating: 5 });
	});
});
