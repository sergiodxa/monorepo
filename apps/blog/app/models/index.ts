/**
 * The blog's models, bound per request and per job as `ctx.models`. Each entry imports its
 * module on first use, so an invocation evaluates only the models it touches, the way routes
 * load only the controllers a request reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModels } from "@sdxc/data-model";

export const models = createModels({
	users: () => import("./users"),
});
