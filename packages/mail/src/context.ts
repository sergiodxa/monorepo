/**
 * The context key the router and command-line middleware publish the mailer under, so code that
 * reads it by key sends through the same mailer whichever host it runs in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextKey } from "remix/router";

import type { Mailer } from "./mailer.js";

/** The mailer the current invocation sends through, installed as `ctx.email`. */
export const CurrentMailer: { defaultValue?: Mailer } = createContextKey<Mailer>();
