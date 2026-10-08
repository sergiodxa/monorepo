/**
 * The `@sdxc/mcp` adapter: one ability both hides a tool from `tools/list`
 * and refuses a call to it, and a tool middleware checks an ability against
 * the call's validated arguments.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyRequestContext, CallToolResult, ToolContext, ToolMiddleware } from "@sdxc/mcp";

import { ForbiddenError } from "@sdxc/mcp";

import type { Access } from "./access.js";
import type { AnyAbility, ContextOf, FieldOf } from "./catalog.js";

import { checkLoaded } from "./access.js";
import { setDecision } from "./log.js";
import { CurrentAccess } from "./middleware/router.js";

/** The access the MCP route bound, or none. */
function accessOf(ctx: AnyRequestContext): Access | undefined {
	return ctx.get(CurrentAccess) as Access | undefined;
}

/**
 * Makes a tool available exactly when a claim allows it. `@sdxc/mcp` checks
 * it on `tools/list` and again on `tools/call`, so the claim hides the tool and
 * refuses it. `available` is synchronous: the route's `access` lists the claim
 * under `load`.
 *
 * @param ability A claim, checked with no context.
 * @returns The `available` predicate, to spread into a tool's action.
 * @example mcp.tools.map(toolset.articles.create, { ...guard(abilities.agent.write), handler })
 */
export function guard<A extends AnyAbility>(
	ability: [ContextOf<A>] extends [undefined] ? A : never,
): { available(ctx: AnyRequestContext): boolean } {
	return {
		available(ctx) {
			return accessOf(ctx)?.can(ability as AnyAbility) ?? false;
		},
	};
}

/** What `requireToolAbility` takes. */
export type RequireToolAbilityOptions<A extends AnyAbility, Input> = ([ContextOf<A>] extends [
	undefined,
]
	? { context?: never }
	: {
			/** Loads the check's context from the call, `null` for a record that does not exist. */
			context: (ctx: ToolContext<Input>) => ContextOf<A> | null | Promise<ContextOf<A> | null>;
		}) & {
	/** Checks one field of the ability. */
	field?: FieldOf<A>;
	/**
	 * The message a `notFound` refusal answers with, which the model reads.
	 * @default "Not found"
	 */
	notFound?: string;
};

/**
 * Checks an ability after a call's arguments validate. A `notFound` refusal,
 * or a loader answering `null`, answers as the tool's own "no such" error, so
 * a hidden record and a missing one read alike; a `forbidden` one as `ForbiddenError`.
 *
 * @param ability The ability the tool performs.
 * @param options The context loader, a field, and the not-found message.
 * @returns The tool middleware.
 * @example requireToolAbility(abilities.monitor.run, { context: async (ctx) => ({ monitor: await find(ctx.input.id) }) })
 */
export function requireToolAbility<A extends AnyAbility, Input = Record<string, unknown>>(
	ability: A,
	...[options]: [ContextOf<A>] extends [undefined]
		? [options?: RequireToolAbilityOptions<A, Input>]
		: [options: RequireToolAbilityOptions<A, Input>]
): ToolMiddleware<Input> {
	return async (ctx, next) => {
		let access = accessOf(ctx);
		if (access === undefined) {
			throw new ForbiddenError(`${ability.name}: no access is bound for this request`);
		}

		let loader = options?.context as ((ctx: ToolContext<Input>) => unknown) | undefined;
		let loaded = loader === undefined ? undefined : await loader(ctx);
		if (loaded === null) return noSuch(options?.notFound);

		await access.load(ability);
		let decision = checkLoaded(access, ability, loaded, options?.field);
		setDecision(decision);
		if (decision.allowed) return next();

		if (decision.as === "notFound") return noSuch(options?.notFound);
		let reason = decision.cause === "denied" && decision.reason ? `: ${decision.reason}` : "";
		throw new ForbiddenError(`${ability.name} is not permitted${reason}`);
	};
}

/** The tool's own "no such" answer, which the model reads as a failed call. */
function noSuch(message = "Not found"): CallToolResult {
	return { content: [{ type: "text", text: message }], isError: true };
}
