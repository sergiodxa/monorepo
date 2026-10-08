/**
 * The builders a policy is written with: `allow` and `deny` return plain JSON
 * grants, so a policy can be stored, diffed and validated, and `fact` declares
 * a root conditions read beyond the check context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeniedAs } from "./catalog.js";
import type { Condition } from "./language.js";

/** What every grant may carry. */
interface GrantBase<N extends string> {
	/** A stable name for decisions, logs, coverage and diffs; positional otherwise. */
	id?: string;
	/** A leaf, a group, `*`, or a list of them. */
	ability: N | readonly N[];
	/** Abilities removed from a group grant. */
	except?: readonly N[];
	/** Holds for every check when omitted. */
	when?: Condition;
	/** Narrows the grant to these fields of the abilities it covers. */
	fields?: readonly string[];
}

/** A grant that allows: inside a role, or in `everyone`. */
export interface AllowGrant<N extends string = string> extends GrantBase<N> {
	effect: "allow";
}

/** A guard: the only refusal a policy writes, applying to every invocation. */
export interface DenyGrant<N extends string = string> extends GrantBase<N> {
	effect: "deny";
	/** The stable code a refusal reports, like `entitlement:reports`. */
	reason?: string;
	/** How this refusal answers, overriding the ability's `deniedAs`. */
	as?: DeniedAs;
}

/** Either kind of grant. */
export type Grant<N extends string = string> = AllowGrant<N> | DenyGrant<N>;

/** What `allow` takes beside the abilities; `E` names the exceptions. */
export type AllowOptions<E extends string> = Omit<AllowGrant<E>, "effect" | "ability">;

/** What `deny` takes beside the abilities; `E` names the exceptions. */
export type DenyOptions<E extends string> = Omit<DenyGrant<E>, "effect" | "ability">;

/**
 * Allows abilities, under a condition when one is given.
 *
 * @param ability A leaf, a group, `*`, or a list of them.
 * @param options Its id, condition, fields and exceptions.
 * @example allow("article.update", { when: { op: "condition", name: "owner" }, fields: ["title"] })
 */
export function allow<const N extends string, const E extends string = never>(
	ability: N | readonly N[],
	options: AllowOptions<E> = {},
): AllowGrant<N | E> {
	return { ...options, effect: "allow", ability };
}

/**
 * Refuses abilities whenever the condition holds, whatever role is held.
 *
 * @param ability A leaf, a group, `*`, or a list of them.
 * @param options Its id, condition, reason, answer and fields.
 * @example deny("reports.export", { id: "plan", when, reason: "entitlement:reports" })
 */
export function deny<const N extends string, const E extends string = never>(
	ability: N | readonly N[],
	options: DenyOptions<E> = {},
): DenyGrant<N | E> {
	return { ...options, effect: "deny", ability };
}

/**
 * A root conditions may read beyond the check context.
 *
 * @template T Its value.
 * @template O Whether it may be absent, which is how a guest is bound.
 */
export interface FactDefinition<T = unknown, O extends boolean = boolean> {
	readonly optional: O;
	/** Type-only: the fact's value. */
	readonly Type?: T;
}

/** Every fact a policy declares, by root. */
export interface FactDefinitions {
	readonly [root: string]: FactDefinition;
}

/**
 * Declares a fact root. An optional one may be bound as absent, and every
 * condition reading it must test `exists(ctx.<root>)` first.
 *
 * @param options Whether the fact may be absent.
 * @example fact<Actor>({ optional: true })
 */
export function fact<T>(options: { optional: true }): FactDefinition<T, true>;
export function fact<T>(options?: { optional?: false }): FactDefinition<T, false>;
export function fact(options: { optional?: boolean } = {}): FactDefinition {
	return { optional: options.optional === true };
}

/** The value a fact root binds to: absent allowed for an optional root. */
export type FactValue<D> =
	D extends FactDefinition<infer T, infer O> ? (O extends true ? T | undefined : T) : never;

/** Every fact's value, by root. */
export type FactValues<F extends FactDefinitions> = { [K in keyof F]: FactValue<F[K]> };
