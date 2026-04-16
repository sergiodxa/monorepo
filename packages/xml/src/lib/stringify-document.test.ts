import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";

import { stringifyDocument } from "./stringify-document";

describe("stringifyDocument", () => {
	test("serializes document data with declaration and namespaces", () => {
		let result = stringifyDocument({
			declaration: { version: "1.0", encoding: "UTF-8" },
			root: {
				name: "rss",
				attributes: {
					version: "2.0",
					"xmlns:atom": "http://www.w3.org/2005/Atom",
				},
				children: [
					{
						name: "channel",
						attributes: {},
						children: [
							{ name: "title", attributes: {}, children: ["Feed"] },
							{
								name: "atom:link",
								attributes: {
									href: "https://example.com/feed.xml",
									rel: "self",
									type: "application/rss+xml",
								},
								children: [],
							},
						],
					},
				],
			},
		});

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(result.data).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
			expect(result.data).toContain("<title>Feed</title>");
		}
	});

	test("returns a failure when a namespace prefix is missing", () => {
		let result = stringifyDocument({
			root: {
				name: "rss",
				attributes: {},
				children: [{ name: "atom:link", attributes: {}, children: [] }],
			},
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toContain("Missing namespace declaration");
		}
	});
});
