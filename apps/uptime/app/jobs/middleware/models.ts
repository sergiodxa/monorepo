/**
 * Publishes uptime's models to every job as `ctx.models`, bound to the database the job's
 * `database()` middleware opened, so a job handler reads models the way a route does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { models as publishModels } from "@sdxc/data-model/jobs";

import { Database } from "~/app/jobs/middleware/database";
import { enqueuer } from "~/app/lib/queue";
import { models as registry } from "~/app/models";

/**
 * Creates the middleware; list it after `database()`, whose database it binds to.
 *
 * @example createJobDispatcher({ middleware: [database(), models()] });
 */
export function models() {
	return publishModels(registry, (ctx) => ({ db: ctx.require(Database), jobs: enqueuer }));
}
