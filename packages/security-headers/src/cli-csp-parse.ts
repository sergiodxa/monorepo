/**
 * The `csp parse` handler: reads a Content-Security-Policy value from the argument or stdin
 * with `parse` and prints each policy's directives, under the typed names the package uses, or
 * the parsed policies as JSON. A value outside the CSP grammar exits 2 with its position.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { CSP } from "./csp.js";

import { SECURITY_HEADERS_COMMANDS } from "./cli-contract.js";
import { parse } from "./csp.js";

/**
 * One directive per line; directives the model does not carry are marked as such.
 *
 * @param policy - One parsed policy
 */
function lines(policy: CSP.Parsed): string {
	let modelled = Object.entries(policy.directives).map(([name, value]) =>
		`${name} ${[value].flat().join(" ")}`.trimEnd(),
	);
	let unknown = Object.entries(policy.unknown).map(
		([name, values]) => `${name} ${values.join(" ")} (not modelled)`,
	);
	return [...modelled, ...unknown].map((line) => `${line}\n`).join("");
}

/** Prints the directives of every policy in the value, numbered when there are several. */
export default createCommand(SECURITY_HEADERS_COMMANDS.csp.parse, async (ctx) => {
	let value = ctx.arguments.policy === "-" ? await ctx.stdin.text() : ctx.arguments.policy;
	let parsed = parse(value.trim());
	if (isFailure(parsed)) return exit(2, parsed.error.message);

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify(parsed.data, null, 2)}\n`);
		return success();
	}
	let policies = parsed.data;
	ctx.stdout(
		policies
			.map((policy, index) =>
				policies.length > 1 ? `Policy ${index + 1}\n${lines(policy)}` : lines(policy),
			)
			.join("\n"),
	);
	return success();
});
