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

/** Builds the monorepo CLI; handlers load through `lazy()` so a run imports only the command it reaches. */
export function createMonorepoCLI() {
	let cli = createCLI({
		name: "monorepo",
		commands: commandset,
	});
	cli.map(
		commandset.doctor,
		lazy(() => import("./commands/doctor.js")),
	);
	cli.map(
		commandset.release,
		lazy(() => import("./commands/release.js")),
	);
	cli.map(
		commandset.release.bootstrap,
		lazy(() => import("./commands/release-bootstrap.js")),
	);
	cli.map(
		commandset.release["check-commits"],
		lazy(() => import("./commands/release-check-commits.js")),
	);
	cli.map(
		commandset.package.create,
		lazy(() => import("./commands/package-create.js")),
	);
	cli.map(
		commandset.app.register,
		lazy(() => import("./commands/app-register.js")),
	);
	return cli;
}

/** The monorepo CLI singleton for `bun run cli` / `sdxc run`. */
export const cli = createMonorepoCLI();

if (import.meta.main) {
	process.exitCode = await cli.run(process.argv.slice(2));
}
