#!/usr/bin/env node
/**
 * The `sdxc-semver` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, loaded only when that command runs. Exit codes: 0 done, 1 `valid`
 * found an invalid version, 2 usage or input that is not a version.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { SEMVER_COMMANDS } from "./cli-contract.js";

/** The `sdxc-semver` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-semver", commands: SEMVER_COMMANDS });

cli.map(
	SEMVER_COMMANDS.valid,
	lazy(() => import("./cli-valid.js")),
);
cli.map(
	SEMVER_COMMANDS.compare,
	lazy(() => import("./cli-compare.js")),
);
cli.map(
	SEMVER_COMMANDS.sort,
	lazy(() => import("./cli-sort.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
