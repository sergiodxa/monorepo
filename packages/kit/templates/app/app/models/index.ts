/**
 * Every model the app reads and writes through, by the name a handler reaches it under:
 * `ctx.models.post` on a request, a job or a command, bound to that run's database. An entry
 * imports its module on first use, so a request loads only the models it touches.
 */

import { createModels } from "@sdxc/data-model";

/** The app's models; `sdxc make model <name>` registers one here. */
export default createModels({});
