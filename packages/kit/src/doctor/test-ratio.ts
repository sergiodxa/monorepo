/**
 * The `test-ratio` check: the code-to-test ratio from `sdxc stats` stays at or above
 * `doctor.testRatio.min` (default 0.3 → `1:0.3`), so agents keep writing tests with the code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { projectStats } from "../stats.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/**
 * Warns when `tests / code` is below the configured minimum. A project with no app code skips.
 */
export const testRatioCheck: Check = {
	name: "test-ratio",
	async run(context): Promise<CheckResult> {
		let min = context.config.doctor.testRatio.min;
		let stats = await projectStats(context.root);
		if (stats.code === 0) return skipped("No app code to compare with tests");
		let ratio = stats.tests / stats.code;
		if (ratio >= min) {
			return passed(`Code to test ratio is 1:${ratio.toFixed(1)} (min 1:${min.toFixed(1)})`);
		}
		return {
			status: "warn",
			message: `Code to test ratio is 1:${ratio.toFixed(1)}, below 1:${min.toFixed(1)}`,
			findings: [`code ${stats.code}, tests ${stats.tests}`],
			fix: `Add tests beside the code, or lower doctor.testRatio.min in .config/sdxc.jsonc`,
		};
	},
};
