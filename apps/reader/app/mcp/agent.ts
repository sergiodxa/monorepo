/**
 * The credential every agent request is answered under: it reads the presented token,
 * asks the reader's own object what that token may do right now, and publishes the answer
 * for the tools and resources below it.
 *
 * Nothing is cached between the row and the request, which is what makes a revocation take
 * effect on the next call and a cancelled subscription stop working the same day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyRequestContext, ToolMiddleware } from "@sdxc/mcp";
import type { Middleware, RequestContext } from "remix/router";

import { ForbiddenError } from "@sdxc/mcp";
import { getContext } from "remix/middleware/async-context";
import { createContextKey } from "remix/router";

import type { Tier } from "~/app/lib/entitlement";
import type { AgentScope } from "~/database/schema";
import type { UserStore } from "~/database/user-do";

import { readAgentToken } from "~/app/mcp/token";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** Who the request is for, what it may do, and what the account is entitled to. */
export interface AgentIdentity {
	/** The reader's OIDC subject, which named the object this request was answered from. */
	subject: string;
	tokenId: string;
	scope: AgentScope;
	tier: Tier;
}

/**
 * The verified agent behind the current request, published by {@link requireAgent} before
 * any tool or resource runs.
 */
export const Agent = createContextKey<AgentIdentity>();

/** The scheme a refusal names, so a client that tried OAuth gets something it can report. */
const CHALLENGE = "Bearer";

/** How a bearer credential arrives, with the scheme matched however it was capitalized. */
const BEARER = /^Bearer\s+(.+)$/i;

/**
 * The verified agent a context carries.
 *
 * Absent means the credential middleware did not run, which is a mistake in how the route
 * was assembled rather than news about the caller, so it is raised where it was made.
 *
 * @param ctx - The request, tool call or resource read asking who it is for.
 */
export function agentOf(ctx: AnyRequestContext | RequestContext): AgentIdentity {
	let identity = ctx.get(Agent);
	if (identity === undefined) {
		throw new Error("requireAgent must run before anything reads the agent behind a request");
	}

	return identity;
}

/** Whether the current credential may write, which is what hides the five writing tools. */
export function mayWrite(ctx: AnyRequestContext): boolean {
	return agentOf(ctx).scope === "write";
}

/**
 * Refuses a writing tool a read-scoped credential reached anyway.
 *
 * `available` already hides those tools, so reaching this means a client is working from a
 * list it kept — the backstop that keeps a stale list from becoming a write.
 */
export function requireWriteScope(): ToolMiddleware {
	return (ctx, next) => {
		if (!mayWrite(ctx)) throw new ForbiddenError("This token may only read.");
		return next();
	};
}

/** The verified agent, for code holding no context of its own. */
export function currentAgent(): AgentIdentity {
	return agentOf(getContext());
}

/**
 * The JSON body a refusal carries, in the two fields an OAuth client already reads.
 *
 * @param status - The status to answer with.
 * @param error - The machine-readable code.
 * @param description - The sentence a person debugging this reads.
 * @param headers - Anything the status itself requires, such as a challenge.
 */
function refuse(
	status: number,
	error: string,
	description: string,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify({ error, error_description: description }), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

/** The token a request presented, or `null` for one carrying no bearer credential. */
function presented(ctx: RequestContext): string | null {
	let header = ctx.request.headers.get("Authorization");
	if (header === null) return null;

	let found = BEARER.exec(header.trim());
	return found?.[1]?.trim() ?? null;
}

/**
 * Answers a refusal the reader's own object reported, in the status each reason deserves.
 *
 * A token this deployment no longer honours is a credential problem and answers `401`; an
 * account whose plan does not carry this is a payment one and answers `403` naming the
 * page to fix it on, since a server that merely listed nothing would read as broken; a
 * spent day answers `429`, which is what a client backs off on.
 *
 * @param ctx - The request being refused, read for its dictionary.
 * @param reason - What the object said.
 */
function refusal(ctx: RequestContext, reason: string): Response {
	if (reason === "tier") {
		return refuse(
			403,
			"insufficient_plan",
			ctx.i18next.t("agent.refused.tier", { url: routes.settings.href() }),
		);
	}

	if (reason === "budget") {
		return refuse(429, "quota_exhausted", ctx.i18next.t("agent.refused.budget"));
	}

	return refuse(401, "invalid_token", ctx.i18next.t(`agent.refused.${reason}`), {
		"WWW-Authenticate": CHALLENGE,
	});
}

/**
 * Authenticates one agent request and publishes what it may do.
 *
 * The token names itself, so the subject comes out of a signature verify rather than out
 * of a table: a value this deployment did not sign is refused before any object is woken.
 * What the token may do is then read from that reader's own rows, which is the only place
 * the scope, the expiry, the revocation and the tier are ever read from.
 *
 * It carries no pointer to protected-resource metadata, because publishing a flow nobody
 * can complete turns a clear refusal into a confusing one.
 */
export let requireAgent: Middleware = async (ctx, next) => {
	let raw = presented(ctx);

	if (raw === null) {
		ctx.log.warn("mcp.refused", { reason: "no-token" });
		return refuse(401, "invalid_request", ctx.i18next.t("agent.refused.missing"), {
			"WWW-Authenticate": CHALLENGE,
		});
	}

	let credential = await readAgentToken(raw);

	if (credential === null) {
		ctx.log.warn("mcp.refused", { reason: "bad-signature" });
		return refuse(401, "invalid_token", ctx.i18next.t("agent.refused.signature"), {
			"WWW-Authenticate": CHALLENGE,
		});
	}

	let allowed: UserStore.AgentAuthorization = await userStore(credential.subject).authorizeAgent(
		credential.tokenId,
	);

	if (!allowed.ok) {
		ctx.log.warn("mcp.refused", { reason: allowed.reason });
		return refusal(ctx, allowed.reason);
	}

	ctx.set(Agent, {
		subject: credential.subject,
		tokenId: credential.tokenId,
		scope: allowed.scope,
		tier: allowed.tier,
	});

	ctx.log.note("mcp.authorized", {
		tokenId: credential.tokenId,
		scope: allowed.scope,
		tier: allowed.tier,
	});

	return await next();
};

export default requireAgent;
