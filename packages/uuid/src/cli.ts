#!/usr/bin/env node
/**
 * The `sdxc-uuid` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, loaded only when that command runs. Exit codes: 0 done, 1 the UUID
 * is invalid, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { UUID_COMMANDS } from "./cli-contract.js";

/** The `sdxc-uuid` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-uuid", commands: UUID_COMMANDS });

cli.map(
	UUID_COMMANDS.v4,
	lazy(() => import("./cli-v4.js")),
);
cli.map(
	UUID_COMMANDS.v7,
	lazy(() => import("./cli-v7.js")),
);
cli.map(
	UUID_COMMANDS.validate,
	lazy(() => import("./cli-validate.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
