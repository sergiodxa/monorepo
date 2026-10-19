/**
 * The app's command line. `app/commands/index.ts` declares its commands and each handler is
 * mapped here through `lazy()`, so a run imports only the command it reaches; `sdxc make
 * command` adds the mapping. It runs on Bun, outside the Worker, started by `bootstrap/cli.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobEnqueuer } from "@sdxc/jobs";

import { createCLI, lazy } from "@sdxc/cli";
import { models } from "@sdxc/data-model/cli";
import { Database, database } from "@sdxc/database-middleware/cli";
import i18n from "@sdxc/i18n/middleware/cli";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware/cli";
import mail from "@sdxc/mail/middleware/cli";
import { PrintTransport } from "@sdxc/mail/print";
import { trace } from "@sdxc/trace-context/middleware/cli";

import commandset from "~/app/commands";
import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { FALLBACK_LANGUAGE, RESOURCES, SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";
import { openLocalDatabase } from "~/app/initializers/local-database";
import { logger } from "~/app/initializers/logger";
import { models as registry } from "~/app/models";

import manifest from "../../package.json" with { type: "json" };

/**
 * The app's logger with each command's record written to stderr as one JSON line, so stdout
 * holds only what the command prints and can be piped.
 */
const COMMAND_LOGGER = createLogger({
	...logger.options,
	sink: (record) => process.stderr.write(`${JSON.stringify(record)}\n`),
});

/**
 * Where a model callback's follow-up jobs go during a command: the queue lives in the Worker, so
 * each job is printed to stderr as one JSON line naming it and its payload, for the operator to
 * enqueue or ignore.
 */
const commandJobs: JobEnqueuer = {
	async enqueue(job, ...input) {
		process.stderr.write(`${JSON.stringify({ unsent: job.name, input: input[0] })}\n`);
	},
	async enqueueMany(job, inputs) {
		for (let input of inputs) {
			process.stderr.write(`${JSON.stringify({ unsent: job.name, input })}\n`);
		}
	},
};

/**
 * The command line `bootstrap/cli.ts` runs and a command's test invokes. A command reads the
 * local database as `ctx.db` and its models as `ctx.models`, prints the email it sends to stderr
 * through `ctx.email`, and writes its output in the language `LANG` names through `ctx.intl`.
 */
export const cli = createCLI({
	name: manifest.name,
	commands: commandset,
	middleware: [
		log(COMMAND_LOGGER),
		trace(),
		database(openLocalDatabase),
		models(registry, (ctx) => ({ db: ctx.require(Database), jobs: commandJobs })),
		mail({
			transport: (ctx) => new PrintTransport({ write: (text) => ctx.stderr(text) }),
			from: MAIL_FROM,
			replyTo: MAIL_REPLY_TO,
		}),
		i18n({
			resources: RESOURCES,
			supportedLanguages: SUPPORTED_LANGUAGES,
			fallbackLanguage: FALLBACK_LANGUAGE,
		}),
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
	commandset.typegen,
	lazy(() => import("~/app/commands/typegen")),
);
