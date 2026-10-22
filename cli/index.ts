/**
 * The monorepo command line: release, doctor, and package/app wiring. Started by
 * `bun run cli` and, with `run.entry` set to this file, by `sdxc run`. `@sdxc/cli` does not
 * prescribe a path; this repository keeps the CLI under `cli/` rather than `bootstrap/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import commandset from "./commands/index.js";

/** The monorepo CLI; handlers load through `lazy()` so a run imports only the command it reaches. */
export const cli = createCLI({
	name: "monorepo",
	commands: commandset,
});

cli.map(
	commandset.doctor,
	lazy(() => import("./commands/doctor.js")),
);

process.exitCode = await cli.run(process.argv.slice(2));
