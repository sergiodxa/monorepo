/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { pseudoContent } from "./pseudo-content";

describe("pseudoContent", () => {
	test("sets an empty pseudo-element content", async () => {
		// The quotes must reach the stylesheet: a bare `content: ;` is invalid
		// and the pseudo-element never gets generated.
		expect(await declarations(pseudoContent('""'))).toEqual(['content: ""']);
	});

	test("sets a quoted string content", async () => {
		expect(await declarations(pseudoContent('"→"'))).toEqual(['content: "→"']);
	});
});
