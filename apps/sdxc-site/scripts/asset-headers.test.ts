/**
 * Guards the static asset cache policy Cloudflare reads from the public directory.
 * Only Vite's fingerprinted asset namespace receives immutable caching, so HTML and
 * stable public URLs keep their own freshness policies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";

import { expect, test } from "vitest";

test("only fingerprinted assets are cached immutably for a year", async () => {
	let source = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
	let lines = source
		.trim()
		.split(/\r?\n/)
		.map((line) => line.trim());

	expect(lines).toEqual(["/assets/*", "Cache-Control: public, max-age=31536000, immutable"]);
});
