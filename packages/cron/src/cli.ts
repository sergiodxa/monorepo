#!/usr/bin/env node
/**
 * The `sdxc-cron` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the
 * expression `validate` checked is invalid, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { CRON_COMMANDS } from "./cli-contract.js";

/** The `sdxc-cron` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-cron", commands: CRON_COMMANDS });

cli.map(
	CRON_COMMANDS.next,
	lazy(() => import("./cli-next.js")),
);
cli.map(
	CRON_COMMANDS.describe,
	lazy(() => import("./cli-describe.js")),
);
cli.map(
	CRON_COMMANDS.validate,
	lazy(() => import("./cli-validate.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
