/**
 * Every model the board reads and writes through, by the name a handler reaches it under:
 * `ctx.models.postings` on a request, a job or a command, bound to that run's database, so a
 * handler never passes the database to a call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModels } from "@sdxc/data-model";

import { Postings } from "./posting";

/** The board's models; `sdxc make model <name>` registers one here. */
export default createModels({ postings: Postings });
