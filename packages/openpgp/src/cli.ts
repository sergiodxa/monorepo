#!/usr/bin/env node
/**
 * The `sdxc-openpgp` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 a
 * bad or unknown signature, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { OPENPGP_COMMANDS } from "./cli-contract.js";

/** The `sdxc-openpgp` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-openpgp", commands: OPENPGP_COMMANDS });

cli.map(
	OPENPGP_COMMANDS.sign,
	lazy(() => import("./cli-sign.js")),
);
cli.map(
	OPENPGP_COMMANDS.verify,
	lazy(() => import("./cli-verify.js")),
);
cli.map(
	OPENPGP_COMMANDS.inspect,
	lazy(() => import("./cli-inspect.js")),
);
cli.map(
	OPENPGP_COMMANDS.keygen,
	lazy(() => import("./cli-keygen.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
