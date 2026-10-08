/**
 * Compiles a policy against its catalog: every grant's abilities, fields and
 * condition are checked and indexed per ability, so a check walks only the
 * grants covering it. Every mistake a policy can hold surfaces here, by grant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExpressionError } from "@sdxc/expression";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { AbilityGroup, AnyAbility, DeniedAs } from "./catalog.js";
import type { FactDefinitions, Grant } from "./grants.js";
import type { CompiledCondition, Condition } from "./language.js";

import { isAbility } from "./catalog.js";
import { AuthzError } from "./decision.js";
import { language } from "./language.js";

/** A role as a policy writes it: a list of allows, or one that inherits others. */
export type RoleDefinition =
	| readonly Grant[]
	| { readonly inherits?: readonly string[]; readonly grants: readonly Grant[] };

/** A policy's definition with its names erased, as the compiler reads it. */
export interface PolicyDefinition {
	facts?: FactDefinitions;
	conditions?: Readonly<Record<string, Condition>>;
	everyone?: readonly Grant[];
	roles?: Readonly<Record<string, RoleDefinition>>;
	guards?: readonly Grant[];
}

/** One grant, ready to evaluate. */
export interface CompiledGrant {
	id: string;
	effect: "allow" | "deny";
	condition: CompiledCondition | undefined;
	/** The fact roots its condition reads, which must be loaded to evaluate it. */
	facts: ReadonlySet<string>;
	/** Every field when `undefined`. */
	fields: ReadonlySet<string> | undefined;
	reason: string | undefined;
	as: DeniedAs | undefined;
}

/** The grants covering one ability. */
export interface AbilityIndex {
	ability: AnyAbility;
	guards: CompiledGrant[];
	everyone: CompiledGrant[];
	roles: ReadonlyMap<string, CompiledGrant[]>;
}

/** A compiled policy. */
export interface CompiledPolicy {
	facts: FactDefinitions;
	abilities: ReadonlyMap<string, AbilityIndex>;
	/** Every grant, in definition order, for coverage. */
	grants: readonly CompiledGrant[];
	/** Every path under each fact root some condition reads, relative to the root. */
	factPaths: ReadonlyMap<string, ReadonlySet<string>>;
}

/** A grant with its id and where it sits, before compiling. */
interface Located {
	id: string;
	grant: Grant;
	role?: string;
}

/**
 * Compiles a policy.
 *
 * @param catalog The catalog its grants name.
 * @param definition The policy as written.
 * @returns The compiled policy, or the first mistake found, naming its grant.
 */
export function compilePolicy(
	catalog: object,
	definition: PolicyDefinition,
): Result<CompiledPolicy, AuthzError> {
	let leaves = new Map<string, AnyAbility>();
	let groups = new Map<string, string[]>();
	index(catalog as AbilityGroup, "", leaves, groups);

	let facts = definition.facts ?? {};
	for (let ability of leaves.values()) {
		for (let key of ability.keys) {
			if (Object.hasOwn(facts, key)) {
				return failure(
					new AuthzError(`${ability.name}'s context key "${key}" is also a declared fact`),
				);
			}
		}
	}

	let conditions = definition.conditions ?? {};
	for (let name of Object.keys(conditions)) {
		let compiled = language().compile({ op: "condition", name }, { references: conditions });
		if (isFailure(compiled)) return failure(conditionError(compiled.error, `conditions.${name}`));
	}

	let located = locate(definition);
	if (isFailure(located)) return located;

	let seen = new Set<string>();
	for (let { id } of located.data) {
		if (seen.has(id))
			return failure(new AuthzError(`Two grants share the id "${id}"`, { grant: id }));
		seen.add(id);
	}

	let compiled = new Map<string, { grant: CompiledGrant; covers: Set<string>; role?: string }>();
	let factPaths = new Map<string, Set<string>>();
	for (let { id, grant, role } of located.data) {
		let one = compileGrant(id, grant, { leaves, groups, facts, conditions, factPaths });
		if (isFailure(one)) return one;
		compiled.set(id, { ...one.data, ...(role === undefined ? {} : { role }) });
	}

	let roles = resolveRoles(definition.roles ?? {}, located.data);
	if (isFailure(roles)) return roles;

	let abilities = new Map<string, AbilityIndex>();
	for (let [name, ability] of leaves) {
		abilities.set(name, { ability, guards: [], everyone: [], roles: new Map() });
	}
	for (let { id } of located.data) {
		let entry = compiled.get(id);
		if (entry === undefined || entry.role !== undefined) continue;
		for (let name of entry.covers) {
			let target = abilities.get(name) as AbilityIndex;
			(entry.grant.effect === "deny" ? target.guards : target.everyone).push(entry.grant);
		}
	}
	for (let [role, ids] of roles.data) {
		for (let id of ids) {
			let entry = compiled.get(id) as { grant: CompiledGrant; covers: Set<string> };
			for (let name of entry.covers) {
				let target = (abilities.get(name) as AbilityIndex).roles as Map<string, CompiledGrant[]>;
				let list = target.get(role) ?? [];
				list.push(entry.grant);
				target.set(role, list);
			}
		}
	}

	return success({
		facts,
		abilities,
		grants: [...compiled.values()].map((entry) => entry.grant),
		factPaths,
	});
}

/** Indexes every leaf by name, and every group by name with the leaves under it. */
function index(
	group: AbilityGroup,
	prefix: string,
	leaves: Map<string, AnyAbility>,
	groups: Map<string, string[]>,
): string[] {
	let under: string[] = [];
	for (let [key, node] of Object.entries(group)) {
		if (isAbility(node)) {
			leaves.set(node.name, node);
			under.push(node.name);
			continue;
		}
		let names = index(node, `${prefix}${key}.`, leaves, groups);
		groups.set(`${prefix}${key}`, names);
		under.push(...names);
	}
	return under;
}

/** Names every grant by its id or its position, checking each sits where its effect belongs. */
function locate(definition: PolicyDefinition): Result<Located[], AuthzError> {
	let located: Located[] = [];
	let place = (grant: Grant, position: string, effect: Grant["effect"], role?: string) => {
		let id = grant.id ?? position;
		if (grant.effect !== effect) {
			let where = effect === "deny" ? "guards" : "roles and everyone";
			let article = grant.effect === "allow" ? "An" : "A";
			return new AuthzError(`${article} ${grant.effect} grant cannot sit in ${where}`, {
				grant: id,
			});
		}
		located.push({ id, grant, ...(role === undefined ? {} : { role }) });
		return undefined;
	};

	for (let [index, grant] of (definition.everyone ?? []).entries()) {
		let error = place(grant, `everyone.${index}`, "allow");
		if (error) return failure(error);
	}
	for (let [role, defined] of Object.entries(definition.roles ?? {})) {
		let grants = "grants" in defined ? defined.grants : defined;
		for (let [index, grant] of grants.entries()) {
			let error = place(grant, `roles.${role}.${index}`, "allow", role);
			if (error) return failure(error);
		}
	}
	for (let [index, grant] of (definition.guards ?? []).entries()) {
		let error = place(grant, `guards.${index}`, "deny");
		if (error) return failure(error);
	}

	return success(located);
}

/** What compiling one grant reads. */
interface Scope {
	leaves: ReadonlyMap<string, AnyAbility>;
	groups: ReadonlyMap<string, string[]>;
	facts: FactDefinitions;
	conditions: Readonly<Record<string, Condition>>;
	factPaths: Map<string, Set<string>>;
}

/** Compiles one grant: what it covers, its fields, and its condition. */
function compileGrant(
	id: string,
	grant: Grant,
	scope: Scope,
): Result<{ grant: CompiledGrant; covers: Set<string> }, AuthzError> {
	let covers = new Set<string>();
	for (let name of [grant.ability].flat()) {
		let names = expand(name, scope);
		if (names === undefined) {
			return failure(new AuthzError(`"${name}" names nothing in the catalog`, { grant: id }));
		}
		for (let each of names) covers.add(each);
	}
	for (let name of grant.except ?? []) {
		let names = expand(name, scope);
		if (names === undefined) {
			return failure(
				new AuthzError(`except "${name}" names nothing in the catalog`, { grant: id }),
			);
		}
		for (let each of names) covers.delete(each);
	}

	let covered = [...covers].map((name) => scope.leaves.get(name) as AnyAbility);

	for (let field of grant.fields ?? []) {
		let lacking = covered.find((ability) => !ability.fields.includes(field));
		if (lacking !== undefined) {
			return failure(
				new AuthzError(`${lacking.name} declares no field "${field}"`, {
					grant: id,
					path: "fields",
				}),
			);
		}
	}

	let condition: CompiledCondition | undefined;
	let facts = new Set<string>();
	if (grant.when !== undefined) {
		let compiled = language().compile(grant.when, { references: scope.conditions });
		if (isFailure(compiled)) return failure(conditionError(compiled.error, id, "when"));
		condition = compiled.data;

		for (let path of language().paths(condition)) {
			let root = rootOf(path);
			if (Object.hasOwn(scope.facts, root)) {
				facts.add(root);
				if (path !== root) {
					let paths = scope.factPaths.get(root) ?? new Set();
					paths.add(path.slice(root.length + 1));
					scope.factPaths.set(root, paths);
				}
				continue;
			}
			let lacking = covered.find((ability) => !ability.keys.includes(root));
			if (lacking !== undefined) {
				return failure(
					new AuthzError(
						`Reads "${path}", but "${root}" is neither a declared fact nor in ${lacking.name}'s context`,
						{ grant: id, path: "when" },
					),
				);
			}
		}

		let guarded = guardedRoots(condition);
		for (let root of unguardedReads(condition)) {
			if (scope.facts[root]?.optional !== true || guarded.has(root)) continue;
			return failure(
				new AuthzError(
					`Reads the optional fact "${root}" without testing exists(ctx.${root}) in an enclosing "all"`,
					{ grant: id, path: "when" },
				),
			);
		}
	}

	return success({
		covers,
		grant: {
			id,
			effect: grant.effect,
			condition,
			facts,
			fields: grant.fields === undefined ? undefined : new Set(grant.fields),
			reason: grant.effect === "deny" ? grant.reason : undefined,
			as: grant.effect === "deny" ? grant.as : undefined,
		},
	});
}

/** Every leaf a name covers: itself, a group's leaves, or all of them for `*`. */
function expand(name: string, scope: Scope): readonly string[] | undefined {
	if (name === "*") return [...scope.leaves.keys()];
	if (scope.leaves.has(name)) return [name];
	return scope.groups.get(name);
}

/** The first segment of a dotted path. */
function rootOf(path: string): string {
	let dot = path.indexOf(".");
	return dot === -1 ? path : path.slice(0, dot);
}

/** A compiled node, read structurally. */
interface Node {
	op: string;
	of?: Node | Node[];
	field?: unknown;
	path?: unknown;
}

/**
 * The roots a condition reads through anything but `exists`: those reads fail
 * on an absent root, so an optional one must be tested first.
 */
function unguardedReads(node: Node, into: Set<string> = new Set()): Set<string> {
	if (node.op === "exists") return into;
	if (Array.isArray(node.of)) for (let member of node.of) unguardedReads(member, into);
	else if (node.of !== undefined) unguardedReads(node.of, into);
	if (typeof node.field === "string") into.add(rootOf(node.field));
	if (typeof node.path === "string") into.add(rootOf(node.path));
	return into;
}

/**
 * The roots a condition tests before anything else reads them: an `exists`
 * of the root itself, alone or as a member of the outermost `all`, through
 * references.
 */
function guardedRoots(node: Node): Set<string> {
	let top = unwrap(node);
	let members = top.op === "all" && Array.isArray(top.of) ? top.of.map(unwrap) : [top];
	let roots = new Set<string>();
	for (let member of members) {
		if (member.op === "exists" && typeof member.field === "string" && !member.field.includes(".")) {
			roots.add(member.field);
		}
	}
	return roots;
}

/** Follows references down to the condition they name. */
function unwrap(node: Node): Node {
	let current = node;
	while (current.op === "condition" && current.of !== undefined && !Array.isArray(current.of)) {
		current = current.of;
	}
	return current;
}

/** Reports a condition that does not compile at its grant and node. */
function conditionError(error: ExpressionError, grant: string, prefix?: string): AuthzError {
	let path = [prefix, error.path].filter((part) => part !== undefined && part !== "").join(".");
	return new AuthzError(error.message, {
		grant,
		...(path === "" ? {} : { path }),
		cause: error,
	});
}

/**
 * Resolves each role's effective grants: its own and every inherited role's,
 * each grant once, refusing an unknown or cyclic inheritance.
 */
function resolveRoles(
	roles: Readonly<Record<string, RoleDefinition>>,
	located: readonly Located[],
): Result<Map<string, Set<string>>, AuthzError> {
	let own = new Map<string, string[]>();
	for (let role of Object.keys(roles)) own.set(role, []);
	for (let { id, role } of located) if (role !== undefined) own.get(role)?.push(id);

	let resolved = new Map<string, Set<string>>();
	let visit = (role: string, chain: string[]): Result<Set<string>, AuthzError> => {
		let done = resolved.get(role);
		if (done !== undefined) return success(done);
		if (chain.includes(role)) {
			return failure(
				new AuthzError(`Role inheritance cycles: ${[...chain, role].join(" → ")}`, {
					grant: `roles.${role}`,
				}),
			);
		}

		let ids = new Set(own.get(role));
		let defined = roles[role] as RoleDefinition;
		for (let parent of "grants" in defined ? (defined.inherits ?? []) : []) {
			if (!Object.hasOwn(roles, parent)) {
				return failure(
					new AuthzError(`Role "${role}" inherits "${parent}", which does not exist`, {
						grant: `roles.${role}`,
					}),
				);
			}
			let inherited = visit(parent, [...chain, role]);
			if (isFailure(inherited)) return inherited;
			for (let id of inherited.data) ids.add(id);
		}

		resolved.set(role, ids);
		return success(ids);
	};

	for (let role of Object.keys(roles)) {
		let one = visit(role, []);
		if (isFailure(one)) return one;
	}
	return success(resolved);
}
