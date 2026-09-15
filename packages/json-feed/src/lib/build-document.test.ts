/**
 * Tests what reaches a published document: which fields are written, in which
 * order, and which are left out because they carry nothing to read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildDocument } from "./build-document.js";

describe("buildDocument", () => {
	test("writes the version this package implements when a feed declares none", () => {
		expect(buildDocument({ title: "Example" }, [])).toEqual({
			version: "https://jsonfeed.org/version/1.1",
			title: "Example",
			items: [],
		});
	});

	test("keeps the version a feed already declares", () => {
		let document = buildDocument({ version: "https://jsonfeed.org/version/1", title: "Old" }, []);

		expect(document.version).toBe("https://jsonfeed.org/version/1");
	});

	test("orders the fields as the format lists them, with the items last", () => {
		let document = buildDocument(
			{ title: "Example", language: "en", homePageUrl: "https://example.com" },
			[{ id: "1", title: "Post", url: "https://example.com/1" }],
		);

		expect(Object.keys(document)).toEqual([
			"version",
			"title",
			"home_page_url",
			"language",
			"items",
		]);
		expect(Object.keys(document.items[0] ?? {})).toEqual(["id", "url", "title"]);
	});

	test("leaves out an empty string and an empty list", () => {
		let document = buildDocument({ title: "Example", description: "", hubs: [] }, [
			{ id: "1", summary: "", tags: [] },
		]);

		expect(document).toEqual({
			version: "https://jsonfeed.org/version/1.1",
			title: "Example",
			items: [{ id: "1" }],
		});
	});

	test("writes an expired flag either way, since a reader acts on both", () => {
		expect(buildDocument({ title: "Example", expired: false }, []).expired).toBe(false);
		expect(buildDocument({ title: "Example", expired: true }, []).expired).toBe(true);
	});

	test("drops an author naming nobody and a hub missing half its definition", () => {
		let document = buildDocument(
			{
				title: "Example",
				authors: [{ name: "Jane" }, {}],
				hubs: [
					{ type: "WebSub", url: "https://hub.example.com" },
					{ type: "WebSub", url: "" },
				],
			},
			[],
		);

		expect(document.authors).toEqual([{ name: "Jane" }]);
		expect(document.hubs).toEqual([{ type: "WebSub", url: "https://hub.example.com" }]);
	});

	test("drops an attachment with nowhere to download from", () => {
		let document = buildDocument({ title: "Example" }, [
			{
				id: "1",
				attachments: [
					{ url: "https://example.com/a.m4a", mimeType: "audio/x-m4a" },
					{ url: "", mimeType: "audio/x-m4a" },
				],
			},
		]);

		expect(document.items[0]?.attachments).toEqual([
			{ url: "https://example.com/a.m4a", mime_type: "audio/x-m4a" },
		]);
	});

	test("copies extension objects rather than sharing them with the feed", () => {
		let extension = { about: "https://example.com/docs", tags: ["one"] };
		let document = buildDocument({ title: "Example", _blue_shed: extension }, []);

		extension.tags.push("two");

		expect(document["_blue_shed"]).toEqual({ about: "https://example.com/docs", tags: ["one"] });
	});
});
