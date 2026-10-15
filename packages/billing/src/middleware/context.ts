/**
 * The context key the router and command-line middleware publish the billing provider under, so
 * code that reads it by key bills against the same platform whichever host it runs in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextKey } from "remix/router";

import type { Billing } from "../core/contract.js";

/** The platform the current invocation bills against, installed as `ctx.billing`. */
export const CurrentBilling: { defaultValue?: Billing } = createContextKey<Billing>();
