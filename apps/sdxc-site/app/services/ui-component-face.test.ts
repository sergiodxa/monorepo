/**
 * Covers the HIG-style faces the `@sdxc/ui` explorer serves: every catalogue slug draws
 * a PNG, and an unknown slug still gets the elevated-card fallback rather than throwing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { listComponents } from "~/app/services/components";
import {
	COMPONENT_FACE_SIZE,
	hasComponentFace,
	renderComponentFace,
} from "~/app/services/ui-component-face";

/** Whether the buffer opens with the PNG signature. */
function isPng(bytes: Uint8Array): boolean {
	return (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	);
}

describe("renderComponentFace", () => {
	test("draws a PNG for every published component", async () => {
		let components = await listComponents();
		expect(components.length).toBeGreaterThan(50);

		for (let entry of components) {
			expect(hasComponentFace(entry.slug)).toBe(true);
			let bytes = await renderComponentFace(entry.slug);
			expect(isPng(bytes)).toBe(true);
			expect(bytes.byteLength).toBeGreaterThan(200);
		}
	});

	test("falls back to an elevated card for an unknown slug", async () => {
		expect(hasComponentFace("not-a-component")).toBe(false);
		let bytes = await renderComponentFace("not-a-component");
		expect(isPng(bytes)).toBe(true);
	});

	test("keeps the face on the published pixel size", () => {
		expect(COMPONENT_FACE_SIZE).toEqual({ width: 320, height: 200 });
	});
});
