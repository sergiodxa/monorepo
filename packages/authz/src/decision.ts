/**
 * What a check answers and the errors the package reports: a `Decision` is
 * plain data, so it crosses an RPC boundary intact, and `Forbidden` carries one
 * for code mapping a refusal to a response without throwing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeniedAs } from "./catalog.js";

/** A grant's stable name: its `id`, or its position like `roles.editor.1`. */
export type GrantId = string;

/** A check that passed, naming every grant that allowed it. */
export interface Allowed {
	ability: string;
	allowed: true;
	grants: GrantId[];
}

/**
 * A check no held role allows (`ungranted`), or that the `within` ceiling
 * refuses (`outOfScope`).
 */
export interface Ungranted {
	ability: string;
	allowed: false;
	cause: "ungranted" | "outOfScope";
	as: DeniedAs;
}

/** A check a guard refused, carrying that guard's reason. */
export interface Denied {
	ability: string;
	allowed: false;
	cause: "denied";
	as: DeniedAs;
	/** The stable code the guard reports, like `entitlement:reports`. */
	reason?: string;
	/** Every guard that matched. */
	grants: GrantId[];
}

/**
 * Why one grant could not be decided, copied out of the expression failure as
 * plain fields so a decision survives structured cloning across RPC.
 */
export interface ConditionFailure {
	grant: GrantId;
	message: string;
	/** The failing node inside the grant's condition, empty for its root. */
	path: string;
	/** The context path that resolved to nothing, like `billing` or `actor.id`. */
	missing?: string;
	/** The operand types a comparison refused, like `["string", "boolean"]`. */
	mismatch?: readonly [string, string];
}

/** A check some condition could not decide: a missing, unloaded or mistyped fact. */
export interface Undecidable {
	ability: string;
	allowed: false;
	cause: "error";
	as: DeniedAs;
	errors: ConditionFailure[];
}

/** What a check answers. */
export type Decision = Allowed | Ungranted | Denied | Undecidable;

/** A refusal of any cause. */
export type Refusal = Exclude<Decision, Allowed>;

/** Where a policy failed to compile, for the person editing it. */
export interface AuthzErrorOptions {
	/** The grant at fault, like `roles.editor.1` or `guards.tenant`. */
	grant?: string;
	/** The node at fault inside the grant, like `when.of.1`. */
	path?: string;
	cause?: unknown;
}

/** A policy that does not compile, naming the grant and the node at fault. */
export class AuthzError extends Error {
	override readonly name = "AuthzError";
	readonly grant?: string;
	readonly path?: string;

	/**
	 * @param message What is wrong, phrased for the policy's author.
	 * @param options Where it is wrong.
	 */
	constructor(message: string, options: AuthzErrorOptions = {}) {
		super(message, { cause: options.cause });
		if (options.grant !== undefined) this.grant = options.grant;
		if (options.path !== undefined) this.path = options.path;
	}
}

/** A refused check, delivered inside a `Failure` by `access.authorize`. */
export class Forbidden extends Error {
	override readonly name = "Forbidden";
	readonly decision: Refusal;

	/** @param decision The refusal, whose cause and reason pick the response. */
	constructor(decision: Refusal) {
		super(`${decision.ability} refused (${decision.cause})`);
		this.decision = decision;
	}
}
