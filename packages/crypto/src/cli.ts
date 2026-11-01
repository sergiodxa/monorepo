#!/usr/bin/env node
/**
 * The `sdxc-crypto` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, loaded only when that command runs. Exit codes: 0 done, 1 a
 * verification found a mismatch, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { CRYPTO_COMMANDS } from "./cli-contract.js";

/** The `sdxc-crypto` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-crypto", commands: CRYPTO_COMMANDS });

cli.map(
	CRYPTO_COMMANDS.token,
	lazy(() => import("./cli-token.js")),
);
cli.map(
	CRYPTO_COMMANDS.hash,
	lazy(() => import("./cli-hash.js")),
);
cli.map(
	CRYPTO_COMMANDS.hmac,
	lazy(() => import("./cli-hmac.js")),
);
cli.map(
	CRYPTO_COMMANDS.totp,
	lazy(() => import("./cli-totp.js")),
);
cli.map(
	CRYPTO_COMMANDS.scrypt.hash,
	lazy(() => import("./cli-scrypt-hash.js")),
);
cli.map(
	CRYPTO_COMMANDS.scrypt.verify,
	lazy(() => import("./cli-scrypt-verify.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
