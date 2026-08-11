/**
 * Unit tests for `marker.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { marker } from "./marker";

describe("marker", () => {
	test("emits an '&::marker' block around the input's declarations", async () => {
		expect(await serialize(marker(p(4)))).toContain("&::marker {");
		expect(await declarations(marker(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
