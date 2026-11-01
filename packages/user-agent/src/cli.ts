#!/usr/bin/env node
/**
 * The `sdxc-user-agent` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, which loads only when that command runs. Exit codes: 0
 * done, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { USER_AGENT_COMMANDS } from "./cli-contract.js";

/** The `sdxc-user-agent` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-user-agent", commands: USER_AGENT_COMMANDS });

cli.map(
	USER_AGENT_COMMANDS.parse,
	lazy(() => import("./cli-parse.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
