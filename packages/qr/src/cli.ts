#!/usr/bin/env node
/**
 * The `sdxc-qr` command-line program: the contract in `cli-contract.ts` with `encode` mapped
 * onto its handler, which loads only when it runs. Exit codes: 0 written, 1 the text does not
 * fit or the file could not be written, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { QR_COMMANDS } from "./cli-contract.js";

/** The `sdxc-qr` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-qr", commands: QR_COMMANDS });

cli.map(
	QR_COMMANDS.encode,
	lazy(() => import("./cli-encode.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
