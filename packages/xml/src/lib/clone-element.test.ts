import { describe, expect, test } from "vitest";

import { cloneElement } from "./clone-element";

describe("cloneElement", () => {
	test("clones nested element trees", () => {
		let original = {
			name: "rss",
			attributes: { version: "2.0" },
			children: [
				{
					name: "channel",
					attributes: {},
					children: [{ name: "title", attributes: {}, children: ["Feed"] }],
				},
			],
		};

		let cloned = cloneElement(original);

		expect(cloned).toEqual(original);
		expect(cloned).not.toBe(original);
		expect(cloned.attributes).not.toBe(original.attributes);
		if (Array.isArray(cloned.children) && Array.isArray(original.children)) {
			expect(cloned.children).not.toBe(original.children);
			expect(cloned.children[0]).not.toBe(original.children[0]);
		}
	});
});
