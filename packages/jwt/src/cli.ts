#!/usr/bin/env node
/**
 * The `sdxc-jwt` command-line program: the contract in `cli-contract.ts` with each command mapped
 * onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 an invalid
 * token, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { JWT_COMMANDS } from "./cli-contract.js";

/** The `sdxc-jwt` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-jwt", commands: JWT_COMMANDS });

cli.map(
	JWT_COMMANDS.decode,
	lazy(() => import("./cli-decode.js")),
);
cli.map(
	JWT_COMMANDS.verify,
	lazy(() => import("./cli-verify.js")),
);
cli.map(
	JWT_COMMANDS.sign,
	lazy(() => import("./cli-sign.js")),
);
cli.map(
	JWT_COMMANDS.keygen,
	lazy(() => import("./cli-keygen.js")),
);
cli.map(
	JWT_COMMANDS.jwks,
	lazy(() => import("./cli-jwks.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
