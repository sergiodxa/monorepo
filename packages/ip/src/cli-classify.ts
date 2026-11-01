/**
 * The `sdxc-ip classify` handler: parses the address and prints its version, canonical text,
 * IANA special-purpose classification and any IPv4 it carries, as aligned lines or as JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { IP_COMMANDS } from "./cli-contract.js";
import { readAddress } from "./cli-input.js";

/**
 * Classifies the address; `--json` prints `{ address, version, classification, public,
 * embeddedIPv4 }`, with `embeddedIPv4` null outside the IPv4-mapped, NAT64 and 6to4 prefixes.
 * Text that is not an address exits 2.
 */
export default createCommand(IP_COMMANDS.classify, async (ctx) => {
	let parsed = await readAddress(ctx.arguments.address, ctx.stdin);
	if (isFailure(parsed)) return parsed;

	let ip = parsed.data;
	let report = {
		address: ip.toString(),
		version: ip.version,
		classification: ip.classification,
		public: ip.isPublic,
		embeddedIPv4: ip.embeddedIPv4?.toString() ?? null,
	};

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
		return success();
	}

	let lines = [
		`address         ${report.address}`,
		`version         ${report.version}`,
		`classification  ${report.classification}`,
		`public          ${report.public ? "yes" : "no"}`,
	];
	if (report.embeddedIPv4 !== null) lines.push(`embedded IPv4   ${report.embeddedIPv4}`);
	ctx.stdout(`${lines.join("\n")}\n`);
	return success();
});
