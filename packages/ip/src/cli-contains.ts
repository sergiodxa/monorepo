/**
 * The `sdxc-ip contains` handler: parses a range and an address and answers membership in the
 * exit code, so a shell script can branch on it; stdout says the same for a person or as JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { IP_COMMANDS } from "./cli-contract.js";
import { readAddress } from "./cli-input.js";
import { IP } from "./ip.js";

/**
 * Exits 0 when the range holds the address and 1 when it does not; an address of the other
 * version is always outside. A malformed range, one with host bits set, or text that is not an
 * address exits 2. `--json` prints `{ range, address, contains }` with both in canonical text.
 */
export default createCommand(IP_COMMANDS.contains, async (ctx) => {
	let range = IP.Range.parse(ctx.arguments.range);
	if (isFailure(range)) {
		let reason =
			range.error.code === "host-bits-set"
				? `${JSON.stringify(ctx.arguments.range)} has bits set past its prefix; write the network's first address`
				: `Not an IP range: ${JSON.stringify(ctx.arguments.range)}`;
		return exit(2, reason);
	}

	let address = await readAddress(ctx.arguments.address, ctx.stdin);
	if (isFailure(address)) return address;

	let contains = range.data.contains(address.data);
	if (ctx.flags.json) {
		let report = { range: range.data.toString(), address: address.data.toString(), contains };
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		ctx.stdout(
			`${address.data.toString()} is ${contains ? "inside" : "outside"} ${range.data.toString()}\n`,
		);
	}
	return contains ? success() : exit(1);
});
