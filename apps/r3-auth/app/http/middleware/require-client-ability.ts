/**
 * Decides a client ability for the client a `:clientId` route names, before the handler
 * runs. A refusal returns the admin to that client's detail page, which offers only the
 * actions they may take, instead of an error page for a button they could not have seen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeniedHandler } from "@sdxc/authz/middleware/router";
import type { Middleware } from "remix/router";

import { requireAbility } from "@sdxc/authz/middleware/router";
import { redirect } from "@sdxc/http/response";

import abilities from "~/app/authz/abilities";
import { answerRefusal } from "~/app/http/middleware/access";
import routes from "~/routes/web";

/** Both client abilities, which check the same context. */
type ClientAbility = typeof abilities.admin.client.update | typeof abilities.admin.client.delete;

/**
 * Sends a refused admin back to the client's detail page. A request with no client id
 * gets the app's answer, the 404 page.
 */
const backToClient: DeniedHandler = (ctx, decision) => {
	let clientId: unknown = ctx.params.clientId;
	if (decision.as === "notFound" || typeof clientId !== "string") {
		return answerRefusal(ctx, decision);
	}
	return redirect(routes.admin.client.index.href({ clientId }), {
		status: redirect.Status.SeeOther,
	});
};

/**
 * Requires `ability` on the route's client. The context carries only the id, so a missing
 * client still reaches the handler, which renders its own not-found answer, and nothing
 * is published for the handler to read back.
 *
 * @param ability `admin.client.update` or `admin.client.delete`.
 * @returns The middleware deciding it.
 * @example middleware: [requireClientAbility(abilities.admin.client.update)]
 */
export function requireClientAbility(ability: ClientAbility): Middleware {
	return requireAbility(ability, {
		context: (ctx) => {
			let clientId: unknown = ctx.params.clientId;
			return typeof clientId === "string" ? { client: { id: clientId } } : null;
		},
		onDenied: backToClient,
	});
}

export default requireClientAbility;
