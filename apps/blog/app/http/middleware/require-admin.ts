/**
 * Keeps the CMS routes reserved for whoever `cms.open` allows, an admin: everyone else lands
 * back on the feed through a 303 See Other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { requireAbility } from "@sdxc/authz/middleware/router";
import { redirect } from "@sdxc/http/response";

import abilities from "~/app/policies/abilities";
import routes from "~/routes/web";

/** Lets a reader `cms.open` allows continue and sends every other request to the feed. */
let requireAdmin: Middleware = requireAbility(abilities.cms.open, {
	onDenied: () => redirect(routes.feed.href(), { status: redirect.Status.SeeOther }),
});

export default requireAdmin;
