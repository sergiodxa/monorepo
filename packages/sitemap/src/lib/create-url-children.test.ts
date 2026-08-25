/**
 * Exercises createURLChildren's node ordering per the sitemap protocol.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createURLChildren } from "./create-url-children";

describe("createURLChildren", () => {
	test("returns only loc when no optional fields are present", () => {
		let children = createURLChildren({ loc: new URL("https://example.com/page") });

		expect(children).toEqual([{ name: "loc", children: ["https://example.com/page"] }]);
	});

	test("returns sitemap nodes in protocol order", () => {
		let updatedAt = new Date("2024-01-15T12:30:00.000Z");
		let children = createURLChildren({
			loc: new URL("https://example.com/page"),
			updatedAt,
			frequency: "monthly",
			priority: 0.8,
		});

		expect(children).toEqual([
			{ name: "loc", children: ["https://example.com/page"] },
			{ name: "lastmod", children: ["2024-01-15T12:30:00.000Z"] },
			{ name: "changefreq", children: ["monthly"] },
			{ name: "priority", children: ["0.8"] },
		]);
	});
});
