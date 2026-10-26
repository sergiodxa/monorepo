/**
 * The blog's command line. `app/commands/index.ts` declares its commands and each handler is
 * mapped here through `lazy()`, so a run imports only the command it reaches; `sdxc make
 * command` adds the mapping. It runs on Bun, outside the Worker, started by `bootstrap/cli.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";
import { models } from "@sdxc/data-model/cli";
import { Database, database } from "@sdxc/database-middleware/cli";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware/cli";
import { trace } from "@sdxc/trace-context/middleware/cli";

import commandset from "~/app/commands";
import { openLocalDatabase } from "~/app/initializers/local-database";
import { logger } from "~/app/initializers/logger";
import registry from "~/app/models";

import manifest from "../../package.json" with { type: "json" };

/**
 * The blog's logger with each command's record written to stderr as one JSON line, so stdout
 * holds only what the command prints and can be piped.
 */
const COMMAND_LOGGER = createLogger({
	...logger.options,
	sink: (record) => process.stderr.write(`${JSON.stringify(record)}\n`),
});

/**
 * The command line `bootstrap/cli.ts` runs and a command's test invokes. A command reads the
 * local database as `ctx.db` and its models as `ctx.models`, bound as a request binds them.
 */
export const cli = createCLI({
	name: manifest.name,
	commands: commandset,
	middleware: [
		log(COMMAND_LOGGER),
		trace(),
		database(openLocalDatabase),
		models(registry, (ctx) => ({ db: ctx.require(Database) })),
	],
});

cli.map(
	commandset.about,
	lazy(() => import("~/app/commands/about")),
);
cli.map(
	commandset.db.console,
	lazy(() => import("~/app/commands/db/console")),
);
cli.map(
	commandset.db.migrate,
	lazy(() => import("~/app/commands/db/migrate")),
);
cli.map(
	commandset.deploy,
	lazy(() => import("~/app/commands/deploy")),
);
cli.map(
	commandset.emails.preview,
	lazy(() => import("~/app/commands/emails/preview")),
);
cli.map(
	commandset.typegen,
	lazy(() => import("~/app/commands/typegen")),
);
cli.map(
	commandset.resume.pdf,
	lazy(() => import("~/app/commands/resume/pdf")),
);
