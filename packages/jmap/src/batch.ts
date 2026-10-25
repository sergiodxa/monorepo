/**
 * A JMAP request under construction: method calls added in order, each typed by the
 * `Methods` registry and able to take arguments from an earlier call's result, with
 * `using` filled from the capabilities the called methods belong to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ArgumentsOf, MethodName } from "./methods.js";
import type { Id, Invocation } from "./types.js";

import { CAPABILITIES, capabilitiesOf } from "./capabilities.js";
import { ResultReference } from "./reference.js";

/** Arguments where any member may instead be a reference to an earlier call's result. */
export type Referable<Arguments> = {
	[Key in keyof Arguments]: Arguments[Key] | ResultReference;
};

/** The Request object a batch sends. */
export interface JMAPRequestObject {
	using: string[];
	methodCalls: Invocation[];
	createdIds?: Record<Id, Id>;
}

/** How a batch starts. */
export interface BatchOptions {
	/** Capabilities to name beyond those of the methods it calls, such as a vendor extension's. */
	using?: readonly string[];
	/** Creation ids an earlier request assigned, which this one's `"#"` references may name. */
	createdIds?: Record<Id, Id>;
}

/** How one call is added. */
export interface CallOptions {
	/** The call id; the default is the call's position in the batch, `"0"`, `"1"`… */
	id?: string;
}

/**
 * One method call in a batch. Read its response from the batch's response with it, or pass
 * `ref()` as an argument to a later call to chain them in one round trip.
 *
 * @template Name - The method called.
 */
export class Call<Name extends MethodName = MethodName> {
	readonly id: string;
	readonly name: Name;

	/**
	 * @param id - The call id.
	 * @param name - The method name.
	 */
	constructor(id: string, name: Name) {
		this.id = id;
		this.name = name;
	}

	/**
	 * A reference to part of this call's response, for a later call's argument. `name` reads
	 * another response this call produced, such as the implicit `Email/set` of an `Email/copy`.
	 *
	 * @param path - A JSON Pointer (`"/ids"`), or segments to escape into one.
	 * @param name - The response name; the method name by default.
	 * @example batch.call("Email/get", { accountId, ids: query.ref("/ids") });
	 */
	ref(path: string | readonly (string | number)[], name: string = this.name): ResultReference {
		return new ResultReference(this.id, name, path);
	}
}

/**
 * Method calls for one API request, processed by the server in the order they were added.
 *
 * @example
 * let batch = new Batch();
 * let query = batch.call("Email/query", { accountId, limit: 10 });
 * let emails = batch.call("Email/get", { accountId, ids: query.ref("/ids") });
 */
export class Batch {
	readonly #using: Set<string>;
	readonly #calls: Invocation[] = [];
	readonly #createdIds: Record<Id, Id> | undefined;

	/** @param options - Extra capabilities and inherited creation ids. */
	constructor(options: BatchOptions = {}) {
		this.#using = new Set([CAPABILITIES.core, ...(options.using ?? [])]);
		this.#createdIds = options.createdIds;
	}

	/** The number of calls added. */
	get size(): number {
		return this.#calls.length;
	}

	/**
	 * Adds a call. An argument set to a `ResultReference` is sent as `"#" + name`, and an
	 * `undefined` one is left out, so it takes its default.
	 *
	 * @param name - The method.
	 * @param args - Its arguments.
	 * @param options - The call id.
	 * @returns The call, to read its response or reference its result.
	 */
	call<Name extends MethodName>(
		name: Name,
		args: Referable<ArgumentsOf<Name>>,
		options: CallOptions = {},
	): Call<Name> {
		let id = options.id ?? String(this.#calls.length);
		let wire: Record<string, unknown> = {};
		for (let [key, value] of Object.entries(args as Record<string, unknown>)) {
			if (value instanceof ResultReference) wire[`#${key}`] = value.toJSON();
			else if (value !== undefined) wire[key] = value;
		}
		for (let capability of capabilitiesOf(name)) this.#using.add(capability);
		this.#calls.push([name, wire, id]);
		return new Call(id, name);
	}

	/** The Request object, as `JSON.stringify` writes it. */
	toJSON(): JMAPRequestObject {
		let request: JMAPRequestObject = {
			using: [...this.#using],
			methodCalls: this.#calls.map(([name, args, id]) => [name, args, id]),
		};
		if (this.#createdIds !== undefined) request.createdIds = { ...this.#createdIds };
		return request;
	}
}
