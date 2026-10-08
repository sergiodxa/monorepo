/**
 * `definePolicy`: additive roles, grants for everyone, guards that refuse and
 * named conditions over one catalog. Nothing compiles at module scope; the
 * first binding compiles and every later one reuses it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Access, AccessBinding } from "./access.js";
import type { AbilityGroup, AbilityName } from "./catalog.js";
import type { CompiledPolicy, PolicyDefinition } from "./compile.js";
import type { AuthzError, Decision, GrantId } from "./decision.js";
import type { AllowGrant, DenyGrant, FactDefinitions } from "./grants.js";
import type { Condition } from "./language.js";

import { bindAccess } from "./access.js";
import { compilePolicy } from "./compile.js";

/** A role: its allows, or allows plus the roles it inherits. */
export type RoleOf<N extends string, R extends string> =
	| readonly AllowGrant<N>[]
	| { readonly inherits?: readonly NoInfer<R>[]; readonly grants: readonly AllowGrant<N>[] };

/**
 * A policy as written, typed against its catalog's ability names.
 *
 * @template N The names a grant may cover.
 * @template F The facts it declares.
 * @template R Its role names.
 */
export interface PolicyOptions<N extends string, F extends FactDefinitions, R extends string> {
	/** Every root conditions read beyond the check context. */
	facts?: F;
	/** Shared conditions, referenced as `{ op: "condition", name }`. */
	conditions?: Readonly<Record<string, Condition>>;
	/** Allows that apply whatever roles are held, none included. */
	everyone?: readonly AllowGrant<N>[];
	/** Roles, each a list of allows; holding several is their union. */
	roles?: { readonly [K in R]: RoleOf<N, R> };
	/** The only refusals, applying to every invocation, admin roles included. */
	guards?: readonly DenyGrant<N>[];
}

/**
 * A defined policy.
 *
 * @template T The catalog.
 * @template F The facts it declares.
 * @template R Its role names.
 */
export interface Policy<
	T = object,
	F extends FactDefinitions = FactDefinitions,
	R extends string = string,
> {
	/** The catalog its grants name. */
	readonly catalog: T;
	/** The policy as written: plain JSON, for storing, diffing and deriving a variant. */
	readonly definition: PolicyOptions<AbilityName<T>, F, R>;
	/** Type-only: the role names, for code typing a binding's roles. */
	readonly Roles?: R;
	/**
	 * Compiles the policy, memoized, reporting the first mistake by grant: an
	 * unknown ability, field, condition, role or fact, an unguarded optional
	 * fact, an inheritance cycle or a repeated id.
	 */
	compile(): Result<void, AuthzError>;
	/**
	 * Binds roles and facts into an access that answers checks synchronously.
	 *
	 * @param binding The principal's roles, ceiling and facts.
	 * @returns The access, or the failure that keeps the policy from compiling.
	 * @example let bound = policy.for({ roles: ["member"], facts: { actor } });
	 */
	for(binding: AccessBinding<F>): Result<Access<F>, AuthzError>;
	/**
	 * The grants no decision matched: a guard matches when it refused, an allow
	 * when it granted. Run over a suite's recorded decisions, it names untested grants.
	 *
	 * @param decisions The decisions a suite recorded, through `onDecision` or `check`.
	 */
	coverage(decisions: Iterable<Decision>): Result<GrantId[], AuthzError>;
}

/** Any policy, whatever its catalog, facts and roles. */
// oxlint-disable-next-line typescript/no-explicit-any -- policies vary in every parameter
export type AnyPolicy = Policy<any, any, any>;

/** The compiled form of a policy, kept beside it. */
const COMPILED = new WeakMap<object, Result<CompiledPolicy, AuthzError>>();

/**
 * Defines a policy over a catalog. Grants are JSON and roles only allow, so
 * adding a role never removes anything; every refusal is a guard.
 *
 * @param catalog The catalog `abilities()` returned.
 * @param options Facts, conditions, `everyone`, roles and guards.
 * @example export default definePolicy(abilities, { roles: { member: [allow("article.read")] } });
 */
export function definePolicy<
	const T extends object,
	const F extends FactDefinitions = Record<never, never>,
	const R extends string = never,
>(catalog: T, options: PolicyOptions<AbilityName<T>, F, R>): Policy<T, F, R> {
	let policy: Policy<T, F, R> = {
		catalog,
		definition: options,
		compile() {
			let compiled = compiledOf(policy);
			return isFailure(compiled) ? compiled : success(undefined);
		},
		for(binding) {
			let compiled = compiledOf(policy);
			if (isFailure(compiled)) return compiled;
			return bindAccess(compiled.data, binding as AccessBinding) as Result<Access<F>, AuthzError>;
		},
		coverage(decisions) {
			let compiled = compiledOf(policy);
			if (isFailure(compiled)) return failure(compiled.error);

			let matched = new Set<string>();
			for (let decision of decisions) {
				if (decision.allowed || decision.cause === "denied") {
					for (let id of decision.grants) matched.add(id);
				}
			}
			return success(
				compiled.data.grants.map((grant) => grant.id).filter((id) => !matched.has(id)),
			);
		},
	};
	return policy;
}

/** Compiles a policy once, keeping the result beside it. */
export function compiledOf(policy: AnyPolicy): Result<CompiledPolicy, AuthzError> {
	let compiled = COMPILED.get(policy);
	if (compiled === undefined) {
		compiled = compilePolicy(
			policy.catalog as AbilityGroup,
			(policy as { definition: unknown }).definition as PolicyDefinition,
		);
		COMPILED.set(policy, compiled);
	}
	return compiled;
}

/**
 * Registers an application's policy, typing `ctx.access` and `ctx.authz`
 * wherever the adapters install them.
 *
 * @example
 * declare module "@sdxc/authz" {
 * 	interface AuthzTypes {
 * 		policy: typeof policy;
 * 	}
 * }
 */
export interface AuthzTypes {}

/** The registered policy, or any policy when none is registered. */
export type RegisteredPolicy = AuthzTypes extends { policy: infer P } ? P : AnyPolicy;

/** The facts a policy declares. */
export type FactsOf<P> = P extends Policy<object, infer F, string> ? F : FactDefinitions;

/** The access a policy binds. */
export type AccessOf<P> = Access<FactsOf<P>>;

/** The access the registered policy binds. */
export type RegisteredAccess = AccessOf<RegisteredPolicy>;
