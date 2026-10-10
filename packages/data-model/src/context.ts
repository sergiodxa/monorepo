/**
 * The context key a host publishes a bound registry under, shared by the router and job
 * middleware, so code that reads models by key finds them whichever host it runs in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextKey } from "remix/router";

import type { AnyBoundModels } from "./types.js";

/**
 * The bound registry the current invocation reads models from, for code that reads it by key
 * rather than through the installed property. The type is written out because an exported key
 * needs a nameable type to reach a published declaration file.
 */
export const Models: { defaultValue?: AnyBoundModels } = createContextKey<AnyBoundModels>();
