/**
 * The command line's entry point, started by `bun run cli` or `sdxc run`: it runs the command
 * the arguments name and exits with its code. The Worker never imports it, so no command ships
 * in the server build.
 */

import { cli } from "~/app/initializers/cli";

process.exitCode = await cli.run(process.argv.slice(2));
