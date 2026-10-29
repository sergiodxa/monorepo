/**
 * The site's command line. `app/commands/index.ts` declares its commands and each handler is
 * mapped here through `lazy()`, so a run imports only the command it reaches; `sdxc make
 * command` adds the mapping. It runs on Bun, outside the Worker, started by `bootstrap/cli.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware/cli";
import { trace } from "@sdxc/trace-context/middleware/cli";

import commandset from "~/app/commands";
import { logger } from "~/app/initializers/logger";

import manifest from "../../package.json" with { type: "json" };

/**
 * The site's logger with each command's record written to stderr as one JSON line, so stdout
 * holds only what the command prints and can be piped.
 */
const COMMAND_LOGGER = createLogger({
	...logger.options,
	sink: (record) => process.stderr.write(`${JSON.stringify(record)}\n`),
});

/** The command line `bootstrap/cli.ts` runs and a command's test invokes. */
export const cli = createCLI({
	name: manifest.name,
	commands: commandset,
	middleware: [log(COMMAND_LOGGER), trace()],
});

cli.map(
	commandset.about,
	lazy(() => import("~/app/commands/about")),
);
cli.map(
	commandset.deploy,
	lazy(() => import("~/app/commands/deploy")),
);
cli.map(
	commandset.typegen,
	lazy(() => import("~/app/commands/typegen")),
);
