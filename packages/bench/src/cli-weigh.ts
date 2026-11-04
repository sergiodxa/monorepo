/**
 * The `sdxc-bench weigh` handler: builds an entry and checks its gzipped size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { BENCH_COMMANDS } from "./cli-contract.js";
import { assertWeight, weigh } from "./weigh.js";

/**
 * Prints minified and gzipped bytes, or under `--json` the weight object.
 * Exits 1 when the build fails or a declared budget is exceeded.
 */
export default createCommand(BENCH_COMMANDS.weigh, async (ctx) => {
	let entry = ctx.arguments.entry;
	let root = ctx.flags.root ?? process.cwd();
	let measured = await weigh(entry, root);

	if (isFailure(measured)) {
		if (ctx.flags.json) {
			ctx.stdout(`${JSON.stringify({ ok: false, entry, error: measured.error.message })}\n`);
			return exit(1);
		}
		return exit(1, measured.error.message);
	}

	let weight = measured.data;
	let maxGzipped = ctx.flags.maxGzipped === undefined ? undefined : Number(ctx.flags.maxGzipped);
	let maxMinified = ctx.flags.maxMinified === undefined ? undefined : Number(ctx.flags.maxMinified);

	if (maxGzipped !== undefined) {
		if (!Number.isFinite(maxGzipped) || maxGzipped < 0) {
			return exit(2, `--max-gzipped must be a non-negative number of bytes`);
		}
		let checked = assertWeight(
			weight,
			{
				maxGzipped,
				maxMinified:
					maxMinified !== undefined && Number.isFinite(maxMinified) ? maxMinified : undefined,
			},
			entry,
		);
		if (isFailure(checked)) {
			if (ctx.flags.json) {
				ctx.stdout(
					`${JSON.stringify({
						ok: false,
						entry,
						weight,
						maxGzipped,
						maxMinified: maxMinified ?? null,
						error: checked.error.message,
					})}\n`,
				);
				return exit(1);
			}
			return exit(1, checked.error.message);
		}
	}

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ ok: true, entry, weight })}\n`);
	} else {
		ctx.stdout(`${entry}: ${weight.minified} bytes minified, ${weight.gzipped} bytes gzipped\n`);
	}
	return success();
});
