#!/usr/bin/env node
/**
 * The `sdxc-json-patch` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, which loads only when that command runs. Exit codes: 0 done,
 * 1 a patch failed to apply or is invalid, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { JSON_PATCH_COMMANDS } from "./cli-contract.js";

/** The `sdxc-json-patch` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-json-patch", commands: JSON_PATCH_COMMANDS });

cli.map(
	JSON_PATCH_COMMANDS.apply,
	lazy(() => import("./cli-apply.js")),
);
cli.map(
	JSON_PATCH_COMMANDS.diff,
	lazy(() => import("./cli-diff.js")),
);
cli.map(
	JSON_PATCH_COMMANDS.validate,
	lazy(() => import("./cli-validate.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
