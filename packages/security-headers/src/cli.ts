#!/usr/bin/env node
/**
 * The `sdxc-security-headers` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, which loads only when that command runs. Exit codes: 0 done,
 * 1 the audit found a missing or weak header, 2 usage, an unreachable page or an invalid policy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { SECURITY_HEADERS_COMMANDS } from "./cli-contract.js";

/** The `sdxc-security-headers` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({
	name: "sdxc-security-headers",
	commands: SECURITY_HEADERS_COMMANDS,
});

cli.map(
	SECURITY_HEADERS_COMMANDS.audit,
	lazy(() => import("./cli-audit.js")),
);
cli.map(
	SECURITY_HEADERS_COMMANDS.csp.parse,
	lazy(() => import("./cli-csp-parse.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
