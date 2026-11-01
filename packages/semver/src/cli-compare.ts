/**
 * The `sdxc-semver compare` handler: prints the precedence of one version against another as
 * `-1`, `0` or `1`, so a shell script can branch on the line without parsing versions itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SEMVER_COMMANDS } from "./cli-contract.js";
import { compare } from "./compare.js";
import { parse } from "./parse.js";

/**
 * Prints the sign of the comparison and exits 0 whatever the order. Either side that is not
 * a version exits 2 naming it, since an order against non-version text answers nothing useful.
 */
export default createCommand(SEMVER_COMMANDS.compare, (ctx) => {
	let { a, b } = ctx.arguments;

	for (let text of [a, b]) {
		let parsed = parse(text);
		if (isFailure(parsed)) return exit(2, parsed.error.message);
	}

	ctx.stdout(`${Math.sign(compare(a, b))}\n`);
	return success();
});
