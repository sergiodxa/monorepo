/**
 * Holds the landing page examples to the package APIs they advertise: a job
 * reads `ctx.db`, and a rate-limit denial comes from `@sdxc/rate-limit`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { readContent } from "~/app/services/content";

const HOME = readFileSync(
	fileURLToPath(new URL("../../resources/content/home.md", import.meta.url)),
	"utf8",
);

describe("landing home.md", () => {
	test("parses under the content vocabulary", () => {
		let result = readContent(HOME);
		expect(isFailure(result)).toBe(false);
	});

	test("jobs example reads the database as ctx.db", () => {
		expect(HOME).toMatch(/Job\.find\(ctx\.db,/);
		expect(HOME).not.toMatch(/ctx\.database/);
	});

	test("rate limit example uses @sdxc/rate-limit tooManyRequests", () => {
		expect(HOME).toMatch(/import \{ tooManyRequests \} from "@sdxc\/rate-limit"/);
		expect(HOME).not.toMatch(/toSeconds\(adapter\.window\)/);
	});
});
