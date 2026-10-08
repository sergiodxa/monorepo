/**
 * The ability catalog: what a user can do, declared once with the context a
 * check of it passes, and imported alike by handlers, jobs, tools and hydrated
 * components. Declaring costs nothing beyond naming each ability.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Brands an ability so a group can tell one from a nested group. */
const ABILITY = Symbol.for("@sdxc/authz.ability");

/** The members a catalog root carries beside its groups, which no group may be named. */
const RESERVED = new Set(["list", "filter"]);

/** How a refusal answers: `forbidden`, or `notFound` when it must not reveal the thing exists. */
export type DeniedAs = "forbidden" | "notFound";

/**
 * The context a check of an ability passes, and the roots it names. The type
 * rides along for checks to read; at runtime only the keys exist.
 *
 * @template T The check context.
 */
export interface ContextDefinition<T extends object> {
	/** Every key of `T`, each once: the roots a condition may read from the check. */
	readonly keys: readonly string[];
	/** Type-only: the check context. */
	readonly Type?: T;
}

/** What an ability declares beside its name and context. */
export interface AbilityOptions<F extends string> {
	/** Every field the ability covers, which grants may narrow and handlers keep from input. */
	fields?: readonly F[];
	/**
	 * How a refusal answers when no guard says otherwise.
	 * @default "forbidden"
	 */
	deniedAs?: DeniedAs;
	/** Carried through introspection, for documentation and admin pages. */
	description?: string;
	/** Carried through introspection; `catalog.filter({ metadata })` matches on it. */
	metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Something a user does. Its identity is the object `abilities()` returned, and
 * it doubles as the context key `requireAbility` publishes the loaded context under.
 *
 * @template C The check context, `undefined` for a claim.
 * @template F The fields it covers.
 */
export interface Ability<
	C extends object | undefined = object | undefined,
	F extends string = string,
> {
	readonly [ABILITY]: true;
	/** Its keys dot-joined from the catalog root, like `article.update`. */
	readonly name: string;
	/** The roots its check context supplies, empty for a claim. */
	readonly keys: readonly string[];
	readonly fields: readonly F[];
	readonly deniedAs: DeniedAs;
	readonly description: string | undefined;
	readonly metadata: Readonly<Record<string, unknown>>;
	/** Type-only: what a check passes, and what `ctx.get(ability)` reads after `requireAbility`. */
	readonly defaultValue?: C;
}

/** Any ability, whatever its context and fields. */
// oxlint-disable-next-line typescript/no-explicit-any -- abilities vary in context and fields
export type AnyAbility = Ability<any, any>;

/** A tree of abilities, nested however the app groups them. */
export interface AbilityGroup {
	readonly [key: string]: AnyAbility | AbilityGroup;
}

/** What a catalog root answers beside its groups. */
export interface CatalogMethods {
	/** Every ability, depth first in declaration order. */
	list(): AnyAbility[];
	/**
	 * The abilities whose metadata holds every given entry, compared with `Object.is`.
	 *
	 * @example catalog.filter({ metadata: { audience: "admin" } })
	 */
	filter(query: { metadata: Readonly<Record<string, unknown>> }): AnyAbility[];
}

/** What `load` takes: an ability, a group of them, or a whole catalog. */
export type LoadTarget = AnyAbility | AbilityGroup | CatalogMethods;

/** A declared catalog: the tree `abilities()` was given, every ability named. */
export type Catalog<T extends AbilityGroup> = T & CatalogMethods;

/** Folds a union into the intersection of its members. */
export type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
	value: infer I,
) => void
	? I
	: never;

/** One member of a union, whichever the compiler orders last. */
type LastOf<U> =
	UnionToIntersection<U extends unknown ? () => U : never> extends () => infer R ? R : never;

/** A union's members as a tuple, used only for its length. */
type UnionToTuple<U, L = LastOf<U>> = [U] extends [never]
	? []
	: [...UnionToTuple<Exclude<U, L>>, L];

/** A tuple of `N` elements of type `E`. */
type Repeat<E, N extends number, Acc extends E[] = []> = Acc["length"] extends N
	? Acc
	: Repeat<E, N, [...Acc, E]>;

/** As many keys of `T` as `T` has, which `context()` makes distinct at runtime: each exactly once. */
type EveryKey<T> = Repeat<
	keyof T & string,
	Extract<UnionToTuple<keyof T & string>["length"], number>
>;

/**
 * Types the check context of an ability and names its roots, every key of `T`
 * exactly once, so compiling a policy knows which roots each ability supplies.
 *
 * @param keys Every key of `T`.
 * @throws {TypeError} When a key repeats, which leaves another key of `T` unnamed.
 * @example context<{ team: Team; invitee: Invitee }>("team", "invitee")
 */
export function context<T extends object>(...keys: EveryKey<T>): ContextDefinition<T> {
	let names = keys as readonly string[];
	if (new Set(names).size !== names.length) {
		throw new TypeError(`context() names a key twice: ${names.join(", ")}`);
	}
	return { keys: names };
}

/**
 * Declares one ability. `abilities()` names it from its position in the catalog.
 * Without a `context` it is a claim, checked with no context.
 *
 * @param options Its context, fields, refusal answer and introspection details.
 * @example ability({ context: context<{ article: Article }>("article"), deniedAs: "notFound" })
 */
export function ability<C extends object, const F extends string = never>(
	options: AbilityOptions<F> & { context: ContextDefinition<C> },
): Ability<C, F>;
export function ability<const F extends string = never>(
	options?: AbilityOptions<F>,
): Ability<undefined, F>;
export function ability(
	options: AbilityOptions<string> & { context?: ContextDefinition<object> } = {},
): AnyAbility {
	return {
		[ABILITY]: true,
		name: "",
		keys: options.context?.keys ?? [],
		fields: options.fields ?? [],
		deniedAs: options.deniedAs ?? "forbidden",
		description: options.description,
		metadata: options.metadata ?? {},
	};
}

/**
 * Declares the catalog, naming every ability by its keys dot-joined. A group is
 * any nested object, and the root also answers `list()` and `filter()`.
 *
 * @param tree Abilities and nested groups.
 * @throws {TypeError} When a key contains `.` or is `*`, which a name could not
 * tell apart, or when a root group is named `list` or `filter`.
 * @example export default abilities({ reports: { export: ability() } });
 */
export function abilities<const T extends AbilityGroup>(tree: T): Catalog<T> {
	for (let key of Object.keys(tree)) {
		if (RESERVED.has(key)) {
			throw new TypeError(`"${key}" names a catalog method and cannot name a group`);
		}
	}

	let named = nameGroup(tree, "");
	let all = [...walk(named)];

	Object.defineProperties(named, {
		list: { value: () => [...all] },
		filter: {
			value: (query: { metadata: Readonly<Record<string, unknown>> }) =>
				all.filter((each) =>
					Object.entries(query.metadata).every(([key, value]) =>
						Object.is(each.metadata[key], value),
					),
				),
		},
	});

	return Object.freeze(named) as Catalog<T>;
}

/** Copies a group with every ability under it named from `prefix`. */
function nameGroup(group: AbilityGroup, prefix: string): AbilityGroup {
	let named: Record<string, AnyAbility | AbilityGroup> = {};
	for (let [key, node] of Object.entries(group)) {
		if (key === "*" || key.includes(".")) {
			throw new TypeError(
				`"${prefix}${key}" cannot name an ability: keys may not contain "." or be "*"`,
			);
		}
		named[key] = isAbility(node)
			? Object.freeze({ ...node, name: `${prefix}${key}` })
			: nameGroup(node, `${prefix}${key}.`);
	}
	return prefix === "" ? named : Object.freeze(named);
}

/** True for a declared ability; false for a group of them. */
export function isAbility(value: unknown): value is AnyAbility {
	return typeof value === "object" && value !== null && ABILITY in value;
}

/**
 * Walks a group, or yields the one ability given.
 *
 * @param node An ability or a group.
 * @yields Every ability under it, depth first in declaration order.
 */
export function* walk(node: LoadTarget): Generator<AnyAbility> {
	if (isAbility(node)) {
		yield node;
		return;
	}
	for (let child of Object.values(node) as (AnyAbility | AbilityGroup)[]) yield* walk(child);
}

/** The names of every ability under `T`, dot-joined from `P`. */
export type LeafNames<T, P extends string = ""> = {
	[K in keyof T & string]: T[K] extends AnyAbility
		? `${P}${K}`
		: T[K] extends (...args: never[]) => unknown
			? never
			: LeafNames<T[K], `${P}${K}.`>;
}[keyof T & string];

/** The names of every group under `T`, dot-joined from `P`. */
export type GroupNames<T, P extends string = ""> = {
	[K in keyof T & string]: T[K] extends AnyAbility
		? never
		: T[K] extends (...args: never[]) => unknown
			? never
			: `${P}${K}` | GroupNames<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every name a grant may cover in catalog `T`: a leaf, a group, or `*` for all. */
export type AbilityName<T> = LeafNames<T> | GroupNames<T> | "*";

/** The check context of an ability, `undefined` for a claim. */
export type ContextOf<A> = A extends Ability<infer C, string> ? C : never;

/** The fields an ability covers. */
export type FieldOf<A> = A extends Ability<object | undefined, infer F> ? F : never;

/** Every ability in a group, as a union. */
export type AbilitiesOf<G> = G extends AnyAbility
	? G
	: {
			[K in keyof G]: G[K] extends AnyAbility
				? G[K]
				: G[K] extends (...args: never[]) => unknown
					? never
					: AbilitiesOf<G[K]>;
		}[keyof G];

/**
 * What a group's abilities answer: a boolean per ability, nested as the group
 * nests. This is what a server hands a hydrated component.
 *
 * @example let can: Decisions<typeof abilities.article> = access.decide(abilities.article, { article, org });
 */
export type Decisions<G> = {
	readonly [K in keyof G as G[K] extends (...args: never[]) => unknown
		? never
		: K]: G[K] extends AnyAbility ? boolean : Decisions<G[K]>;
};

/** What a group's claims answer: a boolean per claim, nested as the group nests. */
export type Claims<G> = {
	readonly [K in keyof G as G[K] extends (...args: never[]) => unknown
		? never
		: G[K] extends AnyAbility
			? ContextOf<G[K]> extends undefined
				? K
				: never
			: K]: G[K] extends AnyAbility ? boolean : Claims<G[K]>;
};

/** The context `decide` takes for a group: every key its abilities need. */
export type GroupContext<G> = UnionToIntersection<Exclude<ContextOf<AbilitiesOf<G>>, undefined>>;
