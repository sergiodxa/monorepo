/**
 * The `sdxc-sitemap validate` handler: checks one sitemap with `Sitemap.validate`, against the
 * host it is served from when it was fetched. A protocol problem is the finding the check
 * exists for, so it exits 1; only input that cannot be read exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SITEMAP_COMMANDS } from "./cli-contract.js";
import { readSitemapInput } from "./cli-input.js";

import { Sitemap } from "./index.js";

/**
 * Prints `name: ok`, or each problem's message on stderr; `--json` prints
 * `{ valid, problems }` on stdout in both cases.
 */
export default createCommand(SITEMAP_COMMANDS.validate, async (ctx) => {
	let input = await readSitemapInput(ctx, ctx.arguments.source);
	if (isFailure(input)) return input;

	let { name, source, location } = input.data;
	let problems = Sitemap.validate(source, { location });
	let valid = problems.length === 0;

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ valid, problems })}\n`);
		return valid ? success() : exit(1);
	}

	if (valid) {
		ctx.stdout(`${name}: ok\n`);
		return success();
	}

	ctx.stderr(problems.map((problem) => `${name}: ${problem.message}\n`).join(""));
	return exit(1);
});
