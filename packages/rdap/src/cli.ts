#!/usr/bin/env node
/**
 * The `sdxc-rdap` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the
 * lookup failed or the domain expires inside the window, 2 usage or a name that is no domain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { RDAP_COMMANDS } from "./cli-contract.js";

/** The `sdxc-rdap` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-rdap", commands: RDAP_COMMANDS });

cli.map(
	RDAP_COMMANDS.lookup,
	lazy(() => import("./cli-lookup.js")),
);
cli.map(
	RDAP_COMMANDS.expires,
	lazy(() => import("./cli-expires.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
