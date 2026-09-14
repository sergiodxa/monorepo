/**
 * The `Flags` context key both middlewares publish a client to, so a route
 * handler and a job handler read `ctx.flags` the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextKey } from "remix/router";

import type { Client } from "../core/client.js";

/**
 * The client the current request or job evaluates through, for a handler that
 * reads it by key rather than through the installed `flags` property. The type
 * is written out because an exported key needs a nameable type to reach a
 * published declaration file.
 */
export const Flags: { defaultValue?: Client } = createContextKey<Client>();
