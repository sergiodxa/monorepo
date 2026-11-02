/**
 * Guards the immutable cache policy for Vite's fingerprinted assets.
 * Other header rules remain independent, so adding one leaves this regression
 * focused on the policy repeat visits rely on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";

import { expect, test } from "vitest";

test("fingerprinted assets are cached immutably for a year", async () => {
	let source = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
	let assetRule = /^\/assets\/\*[ \t]*\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$))*)/m.exec(source)?.[1];

	expect(assetRule).toMatch(
		/^[ \t]+Cache-Control:[ \t]*public, max-age=31536000, immutable[ \t]*\r?$/m,
	);
});
