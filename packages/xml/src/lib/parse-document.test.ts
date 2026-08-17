import { isFailure, isSuccess } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { parseDocument } from "./parse-document";

describe("parseDocument", () => {
	test("parses RSS-like XML into plain document data", () => {
		let result = parseDocument(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
	<channel>
		<title>Feed</title>
		<item>
			<description><![CDATA[Hello <strong>world</strong>]]></description>
			<content:encoded><![CDATA[<p>Markup</p>]]></content:encoded>
		</item>
	</channel>
</rss>`);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data).toEqual({
				declaration: { version: "1.0", encoding: "UTF-8" },
				root: {
					name: "rss",
					attributes: {
						version: "2.0",
						"xmlns:content": "http://purl.org/rss/1.0/modules/content/",
					},
					children: [
						{
							name: "channel",
							attributes: {},
							children: [
								{ name: "title", attributes: {}, children: ["Feed"] },
								{
									name: "item",
									attributes: {},
									children: [
										{
											name: "description",
											attributes: {},
											children: ["Hello <strong>world</strong>"],
										},
										{
											name: "content:encoded",
											attributes: {},
											children: ["<p>Markup</p>"],
										},
									],
								},
							],
						},
					],
				},
			});
		}
	});

	test("returns a failure for malformed XML", () => {
		let result = parseDocument("<rss><channel></rss>");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toContain("Opening and ending tag mismatch");
		}
	});
});
