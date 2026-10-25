/**
 * The `stack-imports` check over fixture apps and the finder it runs per module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { findStackImports, stackImportsCheck } from "./stack-imports.js";

afterEach(removeFixtures);

describe("findStackImports", () => {
	test("finds imports, re-exports and dynamic imports of replaced libraries", () => {
		let source = [
			'import { z } from "zod";',
			'import { useState } from "react";',
			'export { Link } from "react-router";',
			'import { html } from "remix/html-template";',
			'let tw = await import("tailwindcss/plugin");',
		].join("\n");
		expect(findStackImports("a.ts", source).map((found) => found.message)).toEqual([
			"imports zod; use remix/data-schema",
			"imports react; use remix/component",
			"imports react-router; use remix/component",
			"imports remix/html-template; use remix/component JSX rendered on the server",
			"imports tailwindcss/plugin; use css() mixins",
		]);
	});

	test("accepts the stack's libraries and look-alike names", () => {
		let source = [
			'import * as s from "remix/data-schema";',
			'import { css } from "remix/component";',
			'import zodiac from "zodiac";',
		].join("\n");
		expect(findStackImports("a.ts", source)).toEqual([]);
	});
});

describe("stackImportsCheck", () => {
	test("warns on a test that imports a replaced library", async () => {
		let context = await fixture({ "app/services/run.test.ts": 'import { z } from "zod";\n' });
		let result = await stackImportsCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			"app/services/run.test.ts:1: imports zod; use remix/data-schema",
		]);
	});
});
