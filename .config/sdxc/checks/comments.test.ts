/**
 * The monorepo-comments check: ADR citations in any workspace, and app references in packages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { inspect } from "./comments.js";

describe("inspect", () => {
	test("finds an ADR citation in an app's comment", () => {
		let source = "/** Retries twice (ADR-012). */\nexport let RETRIES = 2;\n";
		expect(inspect("apps/web/app/services/retry.ts", source)).toEqual([
			{ line: 1, message: "cites an ADR" },
		]);
	});

	test("leaves ADR text in strings alone", () => {
		expect(inspect("apps/web/app/x.ts", 'export let TITLE = "ADR-012";\n')).toEqual([]);
	});

	test("finds a package comment naming an app and an import from one", () => {
		let source = [
			"/** Lifted from apps/blog. */",
			'import { db } from "../../../apps/blog/app/db.js";',
			'import { user } from "~/app/models/user";',
		].join("\n");
		expect(inspect("packages/feed/src/a.ts", source).map((found) => found.message)).toEqual([
			"names an app",
			"imports ../../../apps/blog/app/db.js from an app",
			"imports ~/app/models/user from an app",
		]);
	});

	test("reads the kit's app template as an app", () => {
		let source = 'import { cli } from "~/app/initializers/cli";\n';
		expect(inspect("packages/kit/templates/app/app/commands/about.ts", source)).toEqual([]);
	});
});
