/**
 * Holds the patched jsQR loader to loading without touching the disk, since the test files
 * that read QR symbols back load it at the same time on separate threads and a shared file
 * one of them is still writing hands the other an empty module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test, vi } from "vitest";

describe("patched jsQR", () => {
	test("loads a working decoder while every write to disk fails", async () => {
		vi.doMock("node:fs", async (original) => {
			let fs = await original<typeof import("node:fs")>();
			let refuse = () => {
				throw new Error("disk is read-only in this test");
			};
			return {
				...fs,
				default: { ...fs, writeFileSync: refuse, mkdirSync: refuse },
				writeFileSync: refuse,
				mkdirSync: refuse,
			};
		});
		let { default: jsQR } = await import("./jsqr.js");

		expect(typeof jsQR).toBe("function");
		expect(jsQR(new Uint8ClampedArray(4 * 21 * 21).fill(255), 21, 21)).toBeNull();
	});
});
