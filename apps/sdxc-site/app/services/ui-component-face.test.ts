/**
 * Covers the schematic faces the `@sdxc/ui` explorer serves: every catalogue slug draws
 * a PNG, and an unknown slug still gets the surface-card fallback rather than throwing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFont } from "@sdxc/font";
import { describe, expect, test } from "vitest";

import { listComponents } from "~/app/services/components";
import {
	COMPONENT_FACE_SIZE,
	hasComponentFace,
	renderComponentFace,
} from "~/app/services/ui-component-face";

/** The bundled faces, read from disk as the Worker receives them as data modules. */
function fonts() {
	let load = (name: string) => {
		let result = parseFont(readFileSync(join(import.meta.dirname, "../../resources/fonts", name)));
		if (result.status === "failure") throw result.error;
		return result.data;
	};
	return {
		regular: load("inter-regular.ttf.bin"),
		semibold: load("inter-semibold.ttf.bin"),
		mono: load("jetbrains-mono-regular.ttf.bin"),
	};
}

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
		let faceFonts = fonts();

		for (let entry of components) {
			expect(hasComponentFace(entry.slug)).toBe(true);
			let bytes = await renderComponentFace(entry.slug, faceFonts);
			expect(isPng(bytes)).toBe(true);
			expect(bytes.byteLength).toBeGreaterThan(200);
		}
	});

	test("falls back to a surface card for an unknown slug", async () => {
		expect(hasComponentFace("not-a-component")).toBe(false);
		let bytes = await renderComponentFace("not-a-component", fonts());
		expect(isPng(bytes)).toBe(true);
	});

	test("keeps the face on the published pixel size", () => {
		expect(COMPONENT_FACE_SIZE).toEqual({ width: 320, height: 200 });
	});
});
