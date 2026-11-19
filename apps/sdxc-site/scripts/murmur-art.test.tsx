/**
 * Holds Murmur's art files to the code that draws them: every album, playlist, genre and artist has a file, and
 * each file matches what the scene renders today, so a change to the art fails until the files
 * are written again with `MURMUR_ART_WRITE=1 vp test run apps/sdxc-site/scripts/murmur-art`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { ART_DIR, renderArt, writeArt } from "./murmur-art";

describe("Murmur's art files", () => {
	test("hold exactly what the scenes render, one file per picture", async () => {
		let files = await renderArt();
		if (process.env.MURMUR_ART_WRITE === "1") writeArt(files);
		expect(readdirSync(ART_DIR).sort()).toEqual([...files.keys()].sort());
		for (let [name, svg] of files) {
			expect(readFileSync(join(ART_DIR, name), "utf8"), name).toBe(svg);
		}
	});

	test("are standalone SVG documents an <img> can draw", async () => {
		for (let svg of (await renderArt()).values()) {
			expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
			expect(svg).not.toContain("var(--");
		}
	});
});
