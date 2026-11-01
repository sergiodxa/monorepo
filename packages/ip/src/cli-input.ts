/**
 * What every `sdxc-ip` command shares: reading the address from its argument or stdin and
 * parsing it, so both commands refuse the same input with the same exit 2 and message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExitError, HandlerContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit } from "@sdxc/cli";
import { isFailure, success } from "@sdxc/result";

import type { IP_COMMANDS } from "./cli-contract.js";

import { IP } from "./ip.js";

/** The stdin every command reads a `-` address from. */
type Stdin = HandlerContext<typeof IP_COMMANDS.classify>["stdin"];

/**
 * The address an argument names: the text as typed, or stdin's text trimmed for `-`. A
 * terminal on stdin exits 2, so a command never waits on a person typing.
 *
 * @param value - The argument as typed
 * @param stdin - The run's stdin, read when `value` is `-`
 * @returns The parsed address, or an exit 2 naming the rejected text
 */
export async function readAddress(value: string, stdin: Stdin): Promise<Result<IP, ExitError>> {
	let text = value;
	if (text === "-") {
		if (stdin.isTTY) return exit(2, "No address: pass one, or pipe it on stdin");
		text = (await stdin.text()).trim();
	}
	let parsed = IP.parse(text);
	if (isFailure(parsed)) return exit(2, `Not an IP address: ${JSON.stringify(text)}`);
	return success(parsed.data);
}
