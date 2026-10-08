/**
 * Access: a policy bound to the roles and facts of one principal, answering
 * checks synchronously. Lazy facts load through `load`, at most once each, and
 * a check reading one that has not loaded refuses instead of waiting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { ExpressionError } from "@sdxc/expression";
import { failure, isSuccess, success } from "@sdxc/result";

import type {
	AbilityGroup,
	AnyAbility,
	LoadTarget,
	Claims,
	ContextOf,
	Decisions,
	FieldOf,
	GroupContext,
} from "./catalog.js";
import type { AbilityIndex, CompiledGrant, CompiledPolicy } from "./compile.js";
import type { Decision, Refusal } from "./decision.js";
import type { FactRequest, FactSource, InvocationContext } from "./facts.js";
import type { FactDefinitions, FactValue } from "./grants.js";

import { isAbility, walk } from "./catalog.js";
import { AuthzError, Forbidden } from "./decision.js";
import { isFactLoader } from "./facts.js";
import { language } from "./language.js";

/** The arguments a check of `A` takes: a claim's field, or a context and its field. */
export type CheckArgs<A> = [ContextOf<A>] extends [undefined]
	? [field?: FieldOf<A>]
	: [context: ContextOf<A>, field?: FieldOf<A>];

/** The arguments `permittedFields` takes for `A`: its context, or nothing for a claim. */
export type ContextArgs<A> = [ContextOf<A>] extends [undefined] ? [] : [context: ContextOf<A>];

/** Roles given at once, or resolved lazily by `load`. */
export type RoleSource = readonly string[] | (() => readonly string[] | Promise<readonly string[]>);

/** How `policy.for` binds a principal. */
export interface AccessBinding<F extends FactDefinitions = FactDefinitions> {
	/**
	 * The roles held, unioned. A name the policy does not define grants nothing.
	 * @default []
	 */
	roles?: RoleSource;
	/** Roles whose grants form a ceiling every allowed check must also pass. */
	within?: RoleSource;
	/**
	 * The facts conditions read, by root. An unbound required root fails the
	 * conditions reading it; an unbound optional root reads as absent.
	 */
	facts?: { [K in keyof F]?: FactSource<FactValue<F[K]>> };
	/** Called with every decision a check reaches, for logging and coverage. */
	onDecision?: (decision: Decision) => void;
	/** The request or job this access serves, handed to fact loaders. */
	context?: InvocationContext;
}

/** How `access.as` derives an access for another scope, synchronously. */
export interface DerivedBinding<F extends FactDefinitions = FactDefinitions> {
	roles: readonly string[];
	/** Replaces the ceiling; the parent's ceiling applies when omitted. */
	within?: readonly string[];
	/** Values replacing the parent's facts for these roots. */
	facts?: { [K in keyof F]?: FactValue<F[K]> };
}

/**
 * A policy bound to one principal. Every check is synchronous; a page awaits
 * `load` for the abilities it checks before checking them.
 *
 * @template F The policy's facts.
 */
export interface Access<F extends FactDefinitions = FactDefinitions> {
	/**
	 * Resolves the roles, and every fact root the grants covering these
	 * abilities read, at most once each. It never rejects: a source that fails
	 * binds its root as unavailable.
	 *
	 * @param targets Abilities, or groups of them.
	 */
	load(...targets: LoadTarget[]): Promise<void>;
	/** Whether a check passes. A refusal of any cause answers `false`. */
	can<A extends AnyAbility>(ability: A, ...args: CheckArgs<A>): boolean;
	/** The full answer to a check. */
	check<A extends AnyAbility>(ability: A, ...args: CheckArgs<A>): Decision;
	/** A check as a `Result`, whose failure carries the refusal. */
	authorize<A extends AnyAbility>(ability: A, ...args: CheckArgs<A>): Result<void, Forbidden>;
	/**
	 * The fields this principal may touch, in the order the ability declares
	 * them; empty when the ability is refused.
	 */
	permittedFields<A extends AnyAbility>(ability: A, ...args: ContextArgs<A>): FieldOf<A>[];
	/**
	 * Answers every ability of a group for one context, each receiving the keys
	 * it declares, and claims none.
	 */
	decide<G extends AbilityGroup>(group: G, context: GroupContext<G>): Decisions<G>;
	/** Answers every claim of a group. */
	claims<G extends AbilityGroup>(group: G): Claims<G>;
	/** A synchronous access for another scope, sharing every fact already loaded. */
	as(binding: DerivedBinding<F>): Access<F>;
}

/** Where a bound value stands: ready, waiting for `load`, or failed to load. */
type SlotState<T> =
	| { status: "ready"; value: T }
	| { status: "lazy"; load: () => Promise<Result<T, Error>>; pending?: Promise<void> }
	| { status: "unavailable"; error: Error };

/** A value bound now, or loaded once on demand. */
class Slot<T> {
	#state: SlotState<T>;

	/** @param state Ready with a value, or lazy with its loader. */
	constructor(state: SlotState<T>) {
		this.#state = state;
	}

	/** The current state, for reads that must not wait. */
	get state(): SlotState<T> {
		return this.#state;
	}

	/** Loads a lazy value once; every caller shares the one load. */
	ensure(): Promise<void> {
		let state = this.#state;
		if (state.status !== "lazy") return Promise.resolve();
		state.pending ??= state.load().then(
			(result) => {
				this.#state = isSuccess(result)
					? { status: "ready", value: result.data }
					: { status: "unavailable", error: result.error };
			},
			(error: unknown) => {
				this.#state = { status: "unavailable", error: asError(error) };
			},
		);
		return state.pending;
	}
}

/** Turns anything thrown into an `Error`. */
function asError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error), { cause: error });
}

/** Binds a role source: a list at once, a function lazily. */
function roleSlot(source: RoleSource): Slot<readonly string[]> {
	if (typeof source !== "function") return new Slot({ status: "ready", value: source });
	return new Slot({
		status: "lazy",
		load: async () => success(await source()),
	});
}

/** Binds a fact source to a slot. */
function factSlot(source: unknown, request: FactRequest): Slot<unknown> {
	if (isFactLoader(source)) {
		return new Slot({ status: "lazy", load: async () => source.load(request) });
	}
	if (typeof source === "function") {
		return new Slot({
			status: "lazy",
			load: async () => success(await (source as (request: FactRequest) => unknown)(request)),
		});
	}
	if (isThenable(source)) {
		let settled = Promise.resolve(source).then(
			(value) => success(value),
			(error: unknown) => failure(asError(error)),
		);
		return new Slot({ status: "lazy", load: () => settled });
	}
	return new Slot({ status: "ready", value: source });
}

/** True for a promise or anything awaitable like one. */
function isThenable(value: unknown): value is PromiseLike<unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { then?: unknown }).then === "function"
	);
}

/** One grant's answer: `true`, `false`, or the failure that left it undecided. */
type Answer = boolean | ExpressionError;

/** A grant and its answer for one check. */
interface Outcome {
	grant: CompiledGrant;
	answer: Answer;
}

/** Every covering grant's answer for one check, before a field is picked. */
interface Evaluation {
	entry: AbilityIndex;
	guards: Outcome[];
	allows: Outcome[];
	/** `undefined` without a ceiling. */
	ceiling: Outcome[] | undefined;
	/** Set when the roles or the ceiling could not be resolved. */
	rolesError: ExpressionError | undefined;
	ceilingError: ExpressionError | undefined;
}

/** What one bound access shares with the accesses derived from it. */
interface Shared {
	compiled: CompiledPolicy;
	onDecision: ((decision: Decision) => void) | undefined;
}

/**
 * Binds a compiled policy.
 *
 * @param compiled The policy.
 * @param binding The principal's roles, ceiling and facts.
 * @returns The access, or a failure for a fact root the policy does not declare.
 */
export function bindAccess(
	compiled: CompiledPolicy,
	binding: AccessBinding,
): Result<Access, AuthzError> {
	let facts = new Map<string, Slot<unknown>>();
	for (let [root, source] of Object.entries(binding.facts ?? {})) {
		if (!Object.hasOwn(compiled.facts, root)) {
			return failure(new AuthzError(`"${root}" is not a fact this policy declares`));
		}
		let request: FactRequest = {
			root,
			paths: compiled.factPaths.get(root) ?? new Set(),
			...(binding.context === undefined ? {} : { context: binding.context }),
		};
		facts.set(root, factSlot(source, request));
	}

	return success(
		new BoundAccess(
			{ compiled, onDecision: binding.onDecision },
			facts,
			roleSlot(binding.roles ?? []),
			binding.within === undefined ? undefined : roleSlot(binding.within),
		),
	);
}

/** The access every binding returns. */
class BoundAccess implements Access {
	readonly #shared: Shared;
	readonly #facts: ReadonlyMap<string, Slot<unknown>>;
	readonly #roles: Slot<readonly string[]>;
	readonly #within: Slot<readonly string[]> | undefined;

	/**
	 * @param shared The policy and the decision hook.
	 * @param facts Every bound fact root.
	 * @param roles The roles held.
	 * @param within The ceiling, if any.
	 */
	constructor(
		shared: Shared,
		facts: ReadonlyMap<string, Slot<unknown>>,
		roles: Slot<readonly string[]>,
		within: Slot<readonly string[]> | undefined,
	) {
		this.#shared = shared;
		this.#facts = facts;
		this.#roles = roles;
		this.#within = within;
	}

	async load(...targets: LoadTarget[]): Promise<void> {
		await Promise.all([this.#roles.ensure(), this.#within?.ensure() ?? Promise.resolve()]);
		let roles = [...held(this.#roles), ...held(this.#within)];

		let roots = new Set<string>();
		for (let target of targets) {
			for (let ability of walk(target)) {
				let entry = this.#shared.compiled.abilities.get(ability.name);
				if (entry === undefined) continue;
				let grants = [...entry.guards, ...entry.everyone];
				for (let role of roles) grants.push(...(entry.roles.get(role) ?? []));
				for (let grant of grants) for (let root of grant.facts) roots.add(root);
			}
		}

		await Promise.all(
			[...roots].map((root) => this.#facts.get(root)?.ensure() ?? Promise.resolve()),
		);
	}

	can<A extends AnyAbility>(ability: A, ...args: CheckArgs<A>): boolean {
		return this.check(ability, ...args).allowed;
	}

	check<A extends AnyAbility>(ability: A, ...args: CheckArgs<A>): Decision {
		let [context, field] = split(ability, args);
		let decision = this.#decide(ability, context, field);
		this.#shared.onDecision?.(decision);
		return decision;
	}

	authorize<A extends AnyAbility>(ability: A, ...args: CheckArgs<A>): Result<void, Forbidden> {
		let decision = this.check(ability, ...args);
		return decision.allowed ? success(undefined) : failure(new Forbidden(decision));
	}

	permittedFields<A extends AnyAbility>(ability: A, ...args: ContextArgs<A>): FieldOf<A>[] {
		let evaluation = this.#evaluate(ability, args[0]);
		if (evaluation === undefined) return [];
		return permitted(evaluation) as FieldOf<A>[];
	}

	decide<G extends AbilityGroup>(group: G, context: GroupContext<G>): Decisions<G> {
		return this.#map(group, (ability) => {
			let decision = this.#decide(ability, context, undefined);
			this.#shared.onDecision?.(decision);
			return decision.allowed;
		}) as Decisions<G>;
	}

	claims<G extends AbilityGroup>(group: G): Claims<G> {
		return this.#map(group, (ability) => {
			if (ability.keys.length > 0) return undefined;
			let decision = this.#decide(ability, undefined, undefined);
			this.#shared.onDecision?.(decision);
			return decision.allowed;
		}) as Claims<G>;
	}

	as(binding: DerivedBinding): Access {
		let facts = new Map(this.#facts);
		for (let [root, value] of Object.entries(binding.facts ?? {})) {
			facts.set(root, new Slot({ status: "ready", value }));
		}
		return new BoundAccess(
			this.#shared,
			facts,
			new Slot({ status: "ready", value: binding.roles }),
			binding.within === undefined
				? this.#within
				: new Slot({ status: "ready", value: binding.within }),
		);
	}

	/** Maps every ability of a group, nested as the group nests, dropping `undefined` answers. */
	#map(group: AbilityGroup, answer: (ability: AnyAbility) => boolean | undefined): object {
		let answers: Record<string, unknown> = {};
		for (let [key, node] of Object.entries(group)) {
			if (isAbility(node)) {
				let value = answer(node);
				if (value !== undefined) answers[key] = value;
			} else {
				answers[key] = this.#map(node, answer);
			}
		}
		return answers;
	}

	/** Decides one check without reporting it. */
	#decide(ability: AnyAbility, context: unknown, field: string | undefined): Decision {
		let evaluation = this.#evaluate(ability, context);
		if (evaluation === undefined) {
			return { ability: ability.name, allowed: false, cause: "ungranted", as: ability.deniedAs };
		}
		return decide(evaluation, field);
	}

	/** Answers every grant covering an ability, or `undefined` for one the policy's catalog lacks. */
	#evaluate(ability: AnyAbility, context: unknown): Evaluation | undefined {
		let { compiled } = this.#shared;
		let entry = compiled.abilities.get(ability.name);
		if (entry === undefined || entry.ability !== ability) return undefined;

		let scope: Record<string, unknown> = {};
		for (let [root, slot] of this.#facts) {
			let state = slot.state;
			if (state.status === "ready") scope[root] = state.value;
		}
		if (typeof context === "object" && context !== null) {
			for (let key of ability.keys) scope[key] = (context as Record<string, unknown>)[key];
		}

		let answer = (grant: CompiledGrant): Outcome => ({
			grant,
			answer: this.#answer(grant, scope),
		});

		let rolesError: ExpressionError | undefined;
		let allows = [...entry.everyone];
		let roles = this.#roles.state;
		if (roles.status === "ready") allows.push(...grantsOf(entry, roles.value));
		else rolesError = unresolved("roles", roles.status);

		let ceiling: Outcome[] | undefined;
		let ceilingError: ExpressionError | undefined;
		if (this.#within !== undefined) {
			let within = this.#within.state;
			if (within.status === "ready") ceiling = grantsOf(entry, within.value).map(answer);
			else {
				ceiling = [];
				ceilingError = unresolved("within", within.status);
			}
		}

		return {
			entry,
			guards: entry.guards.map(answer),
			allows: unique(allows).map(answer),
			ceiling,
			rolesError,
			ceilingError,
		};
	}

	/** One grant's answer, failing when a fact root it reads is not ready. */
	#answer(grant: CompiledGrant, scope: Record<string, unknown>): Answer {
		if (grant.condition === undefined) return true;

		for (let root of grant.facts) {
			let slot = this.#facts.get(root);
			if (slot === undefined) {
				if (this.#shared.compiled.facts[root]?.optional === true) continue;
				return new ExpressionError(`Fact "${root}" is not bound`, { path: "when", missing: root });
			}
			let { status } = slot.state;
			if (status !== "ready") {
				let state = status === "lazy" ? "has not loaded" : "is unavailable";
				return new ExpressionError(`Fact "${root}" ${state}`, { path: "when", missing: root });
			}
		}

		let result = language().evaluate(grant.condition, scope);
		return isSuccess(result) ? result.data : result.error;
	}
}

/** The roles a slot holds, or none while it is not ready. */
function held(slot: Slot<readonly string[]> | undefined): readonly string[] {
	let state = slot?.state;
	return state?.status === "ready" ? state.value : [];
}

/** The failure every role grant answers while the roles are not resolved. */
function unresolved(what: "roles" | "within", status: "lazy" | "unavailable"): ExpressionError {
	let state = status === "lazy" ? "have not loaded" : "are unavailable";
	return new ExpressionError(`The ${what === "roles" ? "roles" : "ceiling roles"} ${state}`, {
		missing: what,
	});
}

/** The grants an ability's index holds for some roles, each once. */
function grantsOf(entry: AbilityIndex, roles: readonly string[]): CompiledGrant[] {
	return unique(roles.flatMap((role) => entry.roles.get(role) ?? []));
}

/** Keeps each grant once, in first-seen order. */
function unique(grants: CompiledGrant[]): CompiledGrant[] {
	return [...new Set(grants)];
}

/**
 * Checks an ability with a context only known at runtime, as the adapters
 * hold it after a loader ran.
 *
 * @param access The bound access.
 * @param ability Any ability.
 * @param context What its loader answered; ignored for a claim.
 * @param field The one field checked, if any.
 */
export function checkLoaded(
	access: Access,
	ability: AnyAbility,
	context: unknown,
	field: string | undefined,
): Decision {
	let args = ability.keys.length === 0 ? [field] : [context, field];
	return access.check(ability, ...(args as CheckArgs<AnyAbility>));
}

/** Splits a check's arguments into its context and field. */
function split(ability: AnyAbility, args: readonly unknown[]): [unknown, string | undefined] {
	if (ability.keys.length === 0) return [undefined, args[0] as string | undefined];
	return [args[0], args[1] as string | undefined];
}

/** Whether a grant takes part in a check for `field`. */
function applies(grant: CompiledGrant, field: string | undefined): boolean {
	return field === undefined || grant.fields === undefined || grant.fields.has(field);
}

/** True for an answer that left its grant undecided. */
function failed(outcome: Outcome): outcome is Outcome & { answer: ExpressionError } {
	return outcome.answer instanceof ExpressionError;
}

/**
 * Decides one check from its evaluation: guards first, then the allows, then
 * the ceiling, as the policy's documentation lays out.
 */
function decide(evaluation: Evaluation, field: string | undefined): Decision {
	let { entry } = evaluation;
	let ability = entry.ability;
	let name = ability.name;

	let blocking = evaluation.guards.filter(
		(outcome) =>
			outcome.answer === true &&
			(field === undefined ? outcome.grant.fields === undefined : applies(outcome.grant, field)),
	);
	if (blocking.length > 0) return denied(ability, blocking);

	let guardErrors = evaluation.guards
		.filter(failed)
		.filter((outcome) => applies(outcome.grant, field));
	if (guardErrors.length > 0) return undecidable(ability, guardErrors);

	let grants = granted(
		evaluation.allows.filter((outcome) => applies(outcome.grant, field)),
		evaluation.rolesError,
	);
	if (grants === "none") {
		return { ability: name, allowed: false, cause: "ungranted", as: ability.deniedAs };
	}
	if (!Array.isArray(grants)) {
		return {
			ability: name,
			allowed: false,
			cause: "error",
			as: ability.deniedAs,
			errors: grants.errors,
		};
	}

	let ceilingGrants: string[] = [];
	if (evaluation.ceiling !== undefined) {
		let ceiling = granted(
			evaluation.ceiling.filter((outcome) => applies(outcome.grant, field)),
			evaluation.ceilingError,
		);
		if (ceiling === "none") {
			return { ability: name, allowed: false, cause: "outOfScope", as: ability.deniedAs };
		}
		if (!Array.isArray(ceiling)) {
			return {
				ability: name,
				allowed: false,
				cause: "error",
				as: ability.deniedAs,
				errors: ceiling.errors,
			};
		}
		ceilingGrants = ceiling;
	}

	if (field === undefined && ability.fields.length > 0 && permitted(evaluation).length === 0) {
		let fieldGuards = evaluation.guards.filter((outcome) => outcome.answer === true);
		if (fieldGuards.length > 0) return denied(ability, fieldGuards);
		return { ability: name, allowed: false, cause: "ungranted", as: ability.deniedAs };
	}

	return { ability: name, allowed: true, grants: [...new Set([...grants, ...ceilingGrants])] };
}

/**
 * The ids of the allows that hold, `"none"` when nothing holds and nothing
 * failed, or the failures when nothing holds and something failed.
 */
function granted(
	outcomes: Outcome[],
	unresolvedRoles: ExpressionError | undefined,
): string[] | "none" | { errors: { grant: string; error: ExpressionError }[] } {
	let holding = outcomes.filter((outcome) => outcome.answer === true);
	if (holding.length > 0) return holding.map((outcome) => outcome.grant.id);

	let errors = outcomes.filter(failed).map((outcome) => ({
		grant: outcome.grant.id,
		error: outcome.answer,
	}));
	if (unresolvedRoles !== undefined) errors.push({ grant: "roles", error: unresolvedRoles });
	return errors.length > 0 ? { errors } : "none";
}

/** A guard refusal: `notFound` wins, and its reason comes from the guard that answered so. */
function denied(ability: AnyAbility, guards: Outcome[]): Refusal {
	let answering = (outcome: Outcome) => outcome.grant.as ?? ability.deniedAs;
	let first = guards.find((outcome) => answering(outcome) === "notFound") ?? (guards[0] as Outcome);
	return {
		ability: ability.name,
		allowed: false,
		cause: "denied",
		as: answering(first),
		...(first.grant.reason === undefined ? {} : { reason: first.grant.reason }),
		grants: guards.map((outcome) => outcome.grant.id),
	};
}

/** A refusal because some guard could not be decided. */
function undecidable(
	ability: AnyAbility,
	outcomes: (Outcome & { answer: ExpressionError })[],
): Refusal {
	return {
		ability: ability.name,
		allowed: false,
		cause: "error",
		as: ability.deniedAs,
		errors: outcomes.map((outcome) => ({ grant: outcome.grant.id, error: outcome.answer })),
	};
}

/**
 * The fields matching allows cover, narrowed by the ceiling, minus the fields
 * of matching guards; empty when the ability is refused outright.
 */
function permitted(evaluation: Evaluation): string[] {
	let { ability } = evaluation.entry;
	let guards = evaluation.guards;
	if (guards.some((outcome) => failed(outcome))) return [];
	if (guards.some((outcome) => outcome.answer === true && outcome.grant.fields === undefined)) {
		return [];
	}

	let allowed = covered(evaluation.allows, ability, evaluation.rolesError);
	if (evaluation.ceiling !== undefined) {
		let ceiling = covered(evaluation.ceiling, ability, evaluation.ceilingError);
		allowed = new Set([...allowed].filter((field) => ceiling.has(field)));
	}
	for (let outcome of guards) {
		if (outcome.answer !== true) continue;
		for (let field of outcome.grant.fields ?? []) allowed.delete(field);
	}

	return ability.fields.filter((field: string) => allowed.has(field));
}

/** The fields the holding allows cover; none when any allow or the roles failed. */
function covered(
	outcomes: Outcome[],
	ability: AnyAbility,
	error: ExpressionError | undefined,
): Set<string> {
	let fields = new Set<string>();
	if (error !== undefined && !outcomes.some((outcome) => outcome.answer === true)) return fields;
	for (let outcome of outcomes) {
		if (outcome.answer !== true) continue;
		for (let field of outcome.grant.fields ?? ability.fields) fields.add(field);
	}
	return fields;
}
