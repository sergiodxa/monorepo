#!/usr/bin/env node
/**
 * The `sdxc-ci` command-line program: the contract in `cli-contract.ts` with each command mapped
 * onto its handler, loaded only when that command runs. Exit codes: 0 done, 1 a failed run or a
 * missing signoff, 2 usage, an unloadable script, or GitHub out of reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { CI_COMMANDS } from "./cli-contract.js";

/** The `sdxc-ci` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-ci", commands: CI_COMMANDS });

cli.map(
	CI_COMMANDS.run,
	lazy(() => import("./cli-run.js")),
);
cli.map(
	CI_COMMANDS.list,
	lazy(() => import("./cli-list.js")),
);
cli.map(
	CI_COMMANDS.signoff,
	lazy(() => import("./cli-signoff.js")),
);
cli.map(
	CI_COMMANDS.verify,
	lazy(() => import("./cli-verify.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
