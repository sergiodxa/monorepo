#!/usr/bin/env node
/**
 * The `sdxc-http-signatures` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, which loads only when that command runs. Exit codes: 0
 * done, 1 a signature that does not verify, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { HTTP_SIGNATURES_COMMANDS } from "./cli-contract.js";

/** The `sdxc-http-signatures` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-http-signatures", commands: HTTP_SIGNATURES_COMMANDS });

cli.map(
	HTTP_SIGNATURES_COMMANDS.sign,
	lazy(() => import("./cli-sign.js")),
);
cli.map(
	HTTP_SIGNATURES_COMMANDS.verify,
	lazy(() => import("./cli-verify.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
