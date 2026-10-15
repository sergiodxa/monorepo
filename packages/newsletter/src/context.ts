/**
 * The context key the router and command-line middleware publish the newsletter under, so code
 * that reads it by key reaches the same list whichever host it runs in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextKey } from "remix/router";

import type { Newsletter } from "./contract.js";

/** The list the current invocation subscribes readers to, installed as `ctx.newsletter`. */
export const CurrentNewsletter: { defaultValue?: Newsletter } = createContextKey<Newsletter>();
