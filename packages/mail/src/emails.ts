/**
 * The email registry's declarations: `emails({ … })` names every email an app sends and the
 * schema of the props each one is built from. Importing the declarations costs the schemas
 * alone, so a controller or a job sends an email without loading the module that renders it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

/** Tells a declared email from a group of them, both being plain objects. */
const LEAF = Symbol.for("@sdxc/mail.email");

/** Tells a named declaration, as `emails()` returns it, from anything else a mailer receives. */
const DECLARATION = Symbol.for("@sdxc/mail.declaration");

/**
 * One email as `email()` declares it, before `emails()` gives it the name its path spells.
 *
 * @template Schema - The schema of the props the email is built from.
 */
export interface EmailLeaf<Schema extends StandardSchemaV1> {
	readonly [LEAF]: true;
	readonly props: Schema;
}

// oxlint-disable-next-line typescript/no-explicit-any -- leaves vary by schema
type AnyEmailLeaf = EmailLeaf<any>;

/** The tree `emails()` takes: emails and groups of emails, nested to any depth. */
export interface EmailTree {
	[key: string]: AnyEmailLeaf | EmailTree;
}

/**
 * A declared email: its name, which a queued delivery carries, and the schema its props are
 * validated against before it renders or enters a queue.
 *
 * @template Schema - The schema of the props the email is built from.
 */
export interface EmailDeclaration<Schema extends StandardSchemaV1 = StandardSchemaV1> {
	readonly [DECLARATION]: true;
	/** The email's path in the tree, joined with dots (`teams.invite`); stable while a delivery waits in a queue. */
	readonly name: string;
	readonly props: Schema;
}

/** A declaration whatever its props, for the places that hold any of them. */
// oxlint-disable-next-line typescript/no-explicit-any -- declarations vary by schema
export type AnyEmailDeclaration = EmailDeclaration<any>;

/**
 * The map `emails()` returns, with every leaf replaced by its named declaration.
 *
 * @template Tree - The tree the map was built from.
 */
export type EmailMap<Tree> = {
	[Key in keyof Tree]: Tree[Key] extends EmailLeaf<infer Schema>
		? EmailDeclaration<Schema>
		: EmailMap<Tree[Key]>;
};

/** The props a caller passes to send one email, before its schema parses them. */
export type EmailPropsInput<Declaration> =
	Declaration extends EmailDeclaration<infer Schema> ? StandardSchemaV1.InferInput<Schema> : never;

/** The props an email's template receives, as its schema parsed them. */
export type EmailPropsOutput<Declaration> =
	Declaration extends EmailDeclaration<infer Schema> ? StandardSchemaV1.InferOutput<Schema> : never;

/**
 * Declares one email by the schema of its props. Any Standard Schema works; the props must be
 * plain JSON when the email is queued, since a queued delivery travels as JSON.
 *
 * @param options - The schema the props are validated against.
 * @returns A leaf for {@link emails} to name.
 * @example email({ props: s.object({ team: s.string(), url: s.string() }) })
 */
export function email<Schema extends StandardSchemaV1>(options: {
	props: Schema;
}): EmailLeaf<Schema> {
	return { [LEAF]: true, props: options.props };
}

/**
 * Names every email in `tree` by its path, so `emails({ teams: { invite } })` declares
 * `teams.invite`.
 *
 * @param tree - The emails and groups of emails the app sends.
 * @returns The same tree with each leaf turned into its named declaration.
 * @example export default emails({ welcome: email({ props: s.object({ name: s.string() }) }) });
 */
export function emails<const Tree extends EmailTree>(tree: Tree): EmailMap<Tree> {
	return build(tree, "") as EmailMap<Tree>;
}

/** Walks one level of the tree, prefixing every name with the path that reached it. */
function build(tree: EmailTree, prefix: string): Record<string, unknown> {
	let map: Record<string, unknown> = {};
	for (let [key, value] of Object.entries(tree)) {
		let name = prefix === "" ? key : `${prefix}.${key}`;
		map[key] = isLeaf(value) ? declare(name, value) : build(value, name);
	}
	return map;
}

/** Reports whether a tree entry is an email rather than a group of them. */
function isLeaf(value: AnyEmailLeaf | EmailTree): value is AnyEmailLeaf {
	return LEAF in value;
}

/** The declaration of one leaf under the name its path spells. */
function declare(name: string, leaf: AnyEmailLeaf): AnyEmailDeclaration {
	return { [DECLARATION]: true, name, props: leaf.props };
}

/**
 * Reports whether a value is a declared email rather than a message or an email object, which
 * is how one `send()` takes either.
 *
 * @param value - Whatever a mailer received.
 * @returns `true` for a declaration `emails()` returned.
 */
export function isEmailDeclaration(value: unknown): value is AnyEmailDeclaration {
	return typeof value === "object" && value !== null && DECLARATION in value;
}
