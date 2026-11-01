#!/usr/bin/env node
/**
 * The `sdxc-email-address` command-line program: the contract in `cli-contract.ts` with
 * `check` mapped onto its handler, which loads only when it runs. Exit codes: 0 every address
 * passes, 1 one is invalid, disposable or without a mail server, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { EMAIL_ADDRESS_COMMANDS } from "./cli-contract.js";

/** The `sdxc-email-address` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-email-address", commands: EMAIL_ADDRESS_COMMANDS });

cli.map(
	EMAIL_ADDRESS_COMMANDS.check,
	lazy(() => import("./cli-check.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
