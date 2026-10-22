/**
 * How the `env` check reads its two files: bindings from `cloudflare.config.ts` source, with
 * comments and prose left out, and the keys a `.env` file assigns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { declaredBindings, exampleKeys } from "./env.js";

describe("declaredBindings", () => {
	test("reads every binding, quoted keys and conditional spreads included", () => {
		let source = [
			"env: {",
			'\tDB: bindings.d1({ name: "app" }),',
			'\t"QUOTED_SECRET": bindings.secret(),',
			"\t...(dev ? { LOCAL_TOKEN: bindings.secret() } : {}),",
			'\tSITE: bindings.text("App"),',
			"}",
		].join("\n");

		expect([...declaredBindings(source)]).toEqual([
			["DB", "d1"],
			["QUOTED_SECRET", "secret"],
			["LOCAL_TOKEN", "secret"],
			["SITE", "text"],
		]);
	});

	test("leaves out bindings written inside comments", () => {
		let source = [
			"/** Declare one like `TOKEN: bindings.secret()`. */",
			"// OLD: bindings.secret(),",
			"KEPT: bindings.secret(), // see https://example.com",
		].join("\n");

		expect([...declaredBindings(source).keys()]).toEqual(["KEPT"]);
	});
});

describe("exampleKeys", () => {
	test("reads assignments and skips comments and blank lines", () => {
		let source =
			"# A comment\n\nSESSION_SECRET=dev\nexport API_KEY=\n  SPACED = value\n#COMMENTED=1\n";

		expect([...exampleKeys(source)]).toEqual(["SESSION_SECRET", "API_KEY", "SPACED"]);
	});
});
