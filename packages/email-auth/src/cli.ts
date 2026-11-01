#!/usr/bin/env node
/**
 * The `sdxc-email-auth` command-line program: the contract in `cli-contract.ts` with
 * `check` mapped onto its handler, which loads only when it runs. Exit codes: 0 every policy
 * holds, 1 a policy is missing or failing, 2 usage error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { EMAIL_AUTH_COMMANDS } from "./cli-contract.js";

/** The `sdxc-email-auth` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-email-auth", commands: EMAIL_AUTH_COMMANDS });

cli.map(
	EMAIL_AUTH_COMMANDS.check,
	lazy(() => import("./cli-check.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
