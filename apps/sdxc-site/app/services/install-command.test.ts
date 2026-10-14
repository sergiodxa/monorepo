/**
 * Covers the rewrite from one authored npm command into each manager's dialect, which
 * is what lets a page carry a single install line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { installVariants } from "~/app/services/install-command";

describe("installVariants", () => {
	test("keeps the authored line for npm", () => {
		expect(installVariants("npm add @sdxc/http").npm).toBe("npm add @sdxc/http");
	});

	test("spells every other manager's add verb", () => {
		let variants = installVariants("npm install @sdxc/http");

		expect(variants.pnpm).toBe("pnpm add @sdxc/http");
		expect(variants.yarn).toBe("yarn add @sdxc/http");
		expect(variants.bun).toBe("bun add @sdxc/http");
	});

	test("carries several packages across", () => {
		expect(installVariants("npm add @sdxc/result @sdxc/response").bun).toBe(
			"bun add @sdxc/result @sdxc/response",
		);
	});

	test("normalises the dev-dependency flag", () => {
		expect(installVariants("npm install --save-dev @sdxc/spec").pnpm).toBe(
			"pnpm add -D @sdxc/spec",
		);
	});

	test("passes a verb that is not an install through", () => {
		expect(installVariants("npm run build").yarn).toBe("yarn run build");
	});
});
