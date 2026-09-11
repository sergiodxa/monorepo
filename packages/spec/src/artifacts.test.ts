/**
 * Tests for the artifacts directory: what a failing test writes, where it
 * lands, and why a write that cannot happen never becomes a second failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { createArtifactStore, sanitize } from "./artifacts.js";

const CREATED_DIRS: string[] = [];

afterEach(async () => {
	for (let dir of CREATED_DIRS.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function makeDir(): Promise<string> {
	let dir = await mkdtemp(join(tmpdir(), "spec-artifacts-"));
	CREATED_DIRS.push(dir);
	return dir;
}

describe(createArtifactStore, () => {
	test("writes an artifact under the directory and answers with its path", async () => {
		let dir = await makeDir();
		let store = createArtifactStore(join(dir, "run"));

		let path = await store.write("failure.txt", "what the page showed");

		expect(path).toBe(join(dir, "run", "failure.txt"));
		expect(await readFile(path ?? "", "utf8")).toBe("what the page showed");
	});

	test("writes bytes as given, so a screenshot survives the round trip", async () => {
		let dir = await makeDir();
		let store = createArtifactStore(dir);

		let path = await store.write("shot.png", new Uint8Array([137, 80, 78, 71]));

		expect(new Uint8Array(await readFile(path ?? ""))).toEqual(new Uint8Array([137, 80, 78, 71]));
	});

	test("keeps a name inside the directory, whatever the test was called", async () => {
		let dir = await makeDir();
		let store = createArtifactStore(dir);

		let path = await store.write("../../escapes/the store.png", "x");

		expect(path).toBe(join(dir, "..-..-escapes-the-store.png"));
	});

	test("answers undefined when the write cannot happen", async () => {
		let dir = await makeDir();
		/** A file where the store's directory would go, so creating it fails. */
		let blocked = join(dir, "blocked");
		await writeFile(blocked, "");
		let store = createArtifactStore(blocked);

		expect(await store.write("failure.txt", "x")).toBeUndefined();
	});
});

describe(sanitize, () => {
	test("keeps readable characters and collapses every other run to one dash", () => {
		expect(sanitize("checkout: the fund's page.png")).toBe("checkout-the-fund-s-page.png");
	});

	test("answers a usable name when nothing readable is left", () => {
		expect(sanitize("///")).toBe("artifact");
	});
});
