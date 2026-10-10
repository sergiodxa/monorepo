/**
 * The board's models, bound per request and per job so a handler reads `ctx.models` instead
 * of passing the database to every call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModels } from "@sdxc/data-model";

import { Postings } from "./posting";

export const models = createModels({ postings: Postings });
