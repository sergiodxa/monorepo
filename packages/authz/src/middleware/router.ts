/**
 * The `remix/router` adapter: `access` binds the request's principal as
 * `ctx.access`, and `requireAbility` loads what an ability needs and decides
 * before the handler runs, answering a refusal through the app's `onDenied`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ContextValue, Middleware, RequestContext } from "remix/router";

import { forbidden, notFound } from "@sdxc/http/response/html";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { AnyAbility, ContextOf, FieldOf, LoadTarget } from "../catalog.js";
import type { Refusal } from "../decision.js";
import type { FactLoader } from "../facts.js";
import type { FactValue } from "../grants.js";
import type { AnyPolicy, FactsOf, RegisteredAccess, RegisteredPolicy } from "../policy.js";

import { checkLoaded } from "../access.js";
import { isFactLoader } from "../facts.js";
import { recordDecision, setDecision } from "../log.js";

/**
 * Declared in an imported module rather than an ambient declaration, so a
 * project types `ctx.access` by importing this adapter.
 */
declare module "remix/router" {
	interface RequestContext {
		/** The request's principal, bound by the nearest `access` middleware. */
		access: RegisteredAccess;
	}
}

/** A request context whatever its params and entries. */
// oxlint-disable-next-line typescript/no-explicit-any -- installed on routes whose shapes it cannot know
type AnyContext = RequestContext<any, any>;

/**
 * The access the nearest `access` middleware bound, for code reading it by
 * key. The type is written out because an exported key needs a nameable type
 * to reach a published declaration file.
 */
export const CurrentAccess: { defaultValue?: RegisteredAccess } =
	createContextKey<RegisteredAccess>();

/** Answers a refused request: a page, a problem document, a redirect. */
export type DeniedHandler = (ctx: AnyContext, decision: Refusal) => Response | Promise<Response>;

/** Where `access` leaves its responder for `requireAbility`. */
const Responder = createContextKey<DeniedHandler>();

/** How `access` takes a fact: a value, a function of the request, or a loader. */
export type RouterFactSource<T> = T | ((ctx: AnyContext) => T | Promise<T>) | FactLoader<T>;

/** Roles given at once, or read off the request. */
export type RouterRoleSource =
	| readonly string[]
	| ((ctx: AnyContext) => readonly string[] | Promise<readonly string[]>);

/** What one installation of `access` binds. */
export interface AccessOptions<P extends AnyPolicy = RegisteredPolicy> {
	/**
	 * The roles held. A function runs once, on the first check that needs them.
	 * @default []
	 */
	roles?: RouterRoleSource;
	/** Roles whose grants cap every check, like a token's scope. */
	within?: RouterRoleSource;
	/** The facts conditions read; a function or loader runs once, when a check needs it. */
	facts?: { [K in keyof FactsOf<P>]?: RouterFactSource<FactValue<FactsOf<P>[K]>> };
	/** Abilities to load before the handler runs, for code that checks synchronously. */
	load?: readonly LoadTarget[];
	/**
	 * Answers every refusal `requireAbility` reaches on this surface. Without
	 * one, a refusal answers a bare `403` or `404`.
	 */
	onDenied?: DeniedHandler;
}

/**
 * Binds the request's principal as `ctx.access`, typed on every request context
 * by this module's augmentation, so a controller's context stays assignable to
 * helpers taking a plain `RequestContext`. A later install replaces it,
 * so the pages, the API and the MCP endpoint each bind their own principal;
 * nothing loads until a check needs it.
 *
 * @param policy The app's policy.
 * @param options Roles, ceiling, facts, abilities to load, and the refusal responder.
 * @returns The middleware publishing `ctx.access`.
 * @example access(policy, { roles: (ctx) => [ctx.membership.role], onDenied: renderDenied })
 */
export function access<P extends AnyPolicy = RegisteredPolicy>(
	policy: P,
	options: AccessOptions<P> = {},
): Middleware {
	return async (ctx, next) => {
		let facts: Record<string, unknown> = {};
		for (let [root, source] of Object.entries(options.facts ?? {})) {
			facts[root] =
				typeof source === "function" && !isFactLoader(source)
					? () => (source as (ctx: AnyContext) => unknown)(ctx)
					: source;
		}

		let bound = policy.for({
			roles: roleSource(options.roles, ctx) ?? [],
			...(options.within === undefined ? {} : { within: roleSource(options.within, ctx) }),
			facts,
			context: ctx,
			onDecision: recordDecision,
		});
		if (isFailure(bound)) {
			currentLog()?.fail(bound.error);
			return new Response("Internal Server Error", { status: 500 });
		}

		ctx.set(CurrentAccess, bound.data as RegisteredAccess, { property: "access" });
		if (options.onDenied !== undefined) ctx.set(Responder, options.onDenied);
		if (options.load !== undefined) await bound.data.load(...options.load);

		return next();
	};
}

/** Binds a role source to the request. */
function roleSource(
	source: RouterRoleSource | undefined,
	ctx: AnyContext,
): readonly string[] | (() => readonly string[] | Promise<readonly string[]>) | undefined {
	if (typeof source !== "function") return source;
	return () => source(ctx);
}

/** Loads the context an ability's check passes, `null` for a record that does not exist. */
export type ContextLoader<C> = (ctx: AnyContext) => C | null | Promise<C | null>;

/** What `requireAbility` takes: a loader for a contextual ability, and how to answer. */
export type RequireAbilityOptions<A extends AnyAbility> = ([ContextOf<A>] extends [undefined]
	? { context?: never }
	: { context: ContextLoader<ContextOf<A>> }) & {
	/** Checks one field of the ability instead of the ability as a whole. */
	field?: FieldOf<A>;
	/** Answers this route's refusals, in place of the responder `access` installed. */
	onDenied?: DeniedHandler;
};

/**
 * Loads what an ability needs and decides before the handler runs, so a
 * refused request is never validated or acted on. The loaded context is
 * published under the ability itself, read with `ctx.get(ability)` (typed
 * through the ability, `undefined` before this middleware ran); a loader
 * answering `null` answers exactly like a `notFound` refusal.
 *
 * @param ability The ability the route performs.
 * @param options Its context loader, a field, and a responder for this route.
 * @returns The middleware deciding the ability.
 * @example requireAbility(abilities.monitor.update, { context: async (ctx) => ({ monitor: await find(ctx) }) })
 */
export function requireAbility<A extends AnyAbility>(
	ability: A,
	...[options]: [ContextOf<A>] extends [undefined]
		? [options?: RequireAbilityOptions<A>]
		: [options: RequireAbilityOptions<A>]
): Middleware {
	return async (ctx, next) => {
		let access = ctx.get(CurrentAccess);
		if (access === undefined) {
			currentLog()?.fail(
				new Error(`requireAbility(${ability.name}) needs the access middleware before it`),
			);
			return new Response("Internal Server Error", { status: 500 });
		}

		let respond = options?.onDenied ?? ctx.get(Responder) ?? answer;
		let loader = options?.context as ContextLoader<ContextOf<A>> | undefined;
		let loaded = loader === undefined ? undefined : await loader(ctx);
		if (loaded === null) {
			let missing: Refusal = {
				ability: ability.name,
				allowed: false,
				cause: "ungranted",
				as: "notFound",
			};
			setDecision(missing);
			return respond(ctx, missing);
		}

		await access.load(ability);
		let decision = checkLoaded(access, ability, loaded, options?.field);
		setDecision(decision);
		if (!decision.allowed) return respond(ctx, decision);

		ctx.set(ability, loaded as ContextValue<A>);
		return next();
	};
}

/** The answer without a responder: a bare page whose status tells the two refusals apart. */
function answer(_ctx: AnyContext, decision: Refusal): Response {
	return decision.as === "notFound" ? notFound("Not Found") : forbidden("Forbidden");
}
