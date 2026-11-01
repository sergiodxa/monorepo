#!/usr/bin/env node
/**
 * The `sdxc-ip` command-line program: the contract in `cli-contract.ts` with each command mapped
 * onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the address
 * is outside the range, 2 usage or text that is not an address or a range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { IP_COMMANDS } from "./cli-contract.js";

/** The `sdxc-ip` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-ip", commands: IP_COMMANDS });

cli.map(
	IP_COMMANDS.classify,
	lazy(() => import("./cli-classify.js")),
);
cli.map(
	IP_COMMANDS.contains,
	lazy(() => import("./cli-contains.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
