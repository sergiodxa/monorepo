import { describe, expect, test } from "vitest";

import { buildDocument } from "./build-document";

describe("buildDocument", () => {
	test("builds the RSS XML document shape with namespaces and items", () => {
		let document = buildDocument(
			{
				title: "Feed",
				description: "Description",
				link: "https://example.com",
				atomLink: {
					href: "https://example.com/feed.xml",
					rel: "self",
					type: "application/rss+xml",
				},
				dcCreator: "Editor",
				namespaces: { media: "http://search.yahoo.com/mrss/" },
				extensions: [
					{
						name: "media:rating",
						attributes: { scheme: "urn:simple" },
						children: ["adult"],
					},
				],
			},
			[
				{
					title: "Post",
					description: "Summary",
					guid: { value: "tag:example.com,2026:1", isPermaLink: false },
					contentEncoded: "<p>Full content</p>",
					slashComments: 5,
				},
			],
		);

		expect(document).toEqual({
			declaration: { version: "1.0", encoding: "UTF-8" },
			root: {
				name: "rss",
				attributes: {
					version: "2.0",
					"xmlns:media": "http://search.yahoo.com/mrss/",
					"xmlns:atom": "http://www.w3.org/2005/Atom",
					"xmlns:content": "http://purl.org/rss/1.0/modules/content/",
					"xmlns:dc": "http://purl.org/dc/elements/1.1/",
					"xmlns:slash": "http://purl.org/rss/1.0/modules/slash/",
				},
				children: [
					{
						name: "channel",
						attributes: {},
						children: [
							{ name: "title", attributes: {}, children: ["Feed"] },
							{ name: "link", attributes: {}, children: ["https://example.com"] },
							{ name: "description", attributes: {}, children: ["Description"] },
							{
								name: "atom:link",
								attributes: {
									href: "https://example.com/feed.xml",
									rel: "self",
									type: "application/rss+xml",
								},
								children: [],
							},
							{ name: "dc:creator", attributes: {}, children: ["Editor"] },
							{
								name: "media:rating",
								attributes: { scheme: "urn:simple" },
								children: ["adult"],
							},
							{
								name: "item",
								attributes: {},
								children: [
									{ name: "title", attributes: {}, children: ["Post"] },
									{ name: "description", attributes: {}, children: ["Summary"] },
									{
										name: "guid",
										attributes: { isPermaLink: "false" },
										children: ["tag:example.com,2026:1"],
									},
									{ name: "content:encoded", attributes: {}, children: ["<p>Full content</p>"] },
									{ name: "slash:comments", attributes: {}, children: ["5"] },
								],
							},
						],
					},
				],
			},
		});
	});
});
