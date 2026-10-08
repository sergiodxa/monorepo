/**
 * Parses and serializes the three RFC 9421 fields, `Signature-Input`, `Signature` and
 * `Accept-Signature`, all Structured Field Dictionaries keyed by signature label. Parameter
 * order survives a round trip, because the signature base serializes it as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { SF } from "@sdxc/structured-fields";

import { failure, isFailure, success } from "@sdxc/result";
import { parse, stringify } from "@sdxc/structured-fields";

import type {
	AcceptSignature,
	AcceptSignatureParameters,
	Component,
	ComponentParameters,
	SignatureInput,
	SignatureParameters,
} from "./types.js";

import { HttpSignatureError } from "./errors.js";

/** Component parameters that carry no value: present means `true`. */
const FLAG_PARAMETERS = new Set(["sf", "bs", "req", "tr"]);

/** Component parameters that carry a String. */
const STRING_PARAMETERS = new Set(["key", "name"]);

/** Signature parameters that carry a String, in `Signature-Input` and `Accept-Signature` alike. */
const STRING_SIGNATURE_PARAMETERS = new Set(["nonce", "alg", "keyid", "tag"]);

/** Signature parameters that carry a time: an Integer in `Signature-Input`, a flag in `Accept-Signature`. */
const TIME_SIGNATURE_PARAMETERS = new Set(["created", "expires"]);

/** A `Signature-Input` member read for verification, with its inner list as it serializes. */
export interface ReadSignatureInput {
	input: SignatureInput;
	/** The canonical inner list, which is the value of the `@signature-params` line. */
	serialized: string;
}

/**
 * Parses `Signature-Input` into its members keyed by label. Parameters the registry does
 * not define are left out of `params`.
 *
 * @param text - The field value.
 * @returns The members, or `malformed` for text that is not a Dictionary of Inner Lists of
 *   component identifiers.
 * @example parseSignatureInput('sig1=("@method" "@target-uri");created=1618884473;keyid="k"')
 */
export function parseSignatureInput(
	text: string,
): Result<Record<string, SignatureInput>, HttpSignatureError> {
	let read = readSignatureInput(text);
	if (isFailure(read)) return read;
	return success(
		Object.fromEntries(Object.entries(read.data).map(([label, member]) => [label, member.input])),
	);
}

/**
 * Parses `Signature-Input` and keeps each member's canonical serialization, which carries
 * every parameter the sender wrote, known or not.
 *
 * @param text - The field value.
 */
export function readSignatureInput(
	text: string,
): Result<Record<string, ReadSignatureInput>, HttpSignatureError> {
	let dictionary = parseDictionary(text, "Signature-Input");
	if (isFailure(dictionary)) return dictionary;

	let entries: Array<[string, ReadSignatureInput]> = [];
	for (let [label, member] of Object.entries(dictionary.data)) {
		if (!("items" in member)) return failure(malformed(`Signature-Input ${label} is not a list`));

		let components = toComponents(member.items);
		if (isFailure(components)) return components;

		let params = toSignatureParameters(member.params);
		if (isFailure(params)) return params;

		let serialized = stringify([member], "list");
		if (isFailure(serialized)) return failure(malformed(serialized.error.message));

		entries.push([
			label,
			{ input: { components: components.data, params: params.data }, serialized: serialized.data },
		]);
	}
	return success(Object.fromEntries(entries));
}

/**
 * Serializes `Signature-Input` members keyed by label.
 *
 * @param inputs - The members.
 * @returns The field text, or `malformed` for a label, name or parameter with no
 *   Structured Field representation.
 * @example stringifySignatureInput({ sig1: { components: [{ name: "@method" }], params: { keyid: "k" } } })
 */
export function stringifySignatureInput(
	inputs: Record<string, SignatureInput>,
): Result<string, HttpSignatureError> {
	let members: Record<string, SF.InnerListInput> = {};
	for (let [label, input] of Object.entries(inputs)) {
		members[label] = {
			items: input.components.map(fromComponent),
			params: fromSignatureParameters(input.params),
		};
	}
	return serializeDictionary(members);
}

/**
 * Serializes one member's inner list, the value of its `@signature-params` line.
 *
 * @param input - The member.
 */
export function serializeSignatureParams(
	input: SignatureInput,
): Result<string, HttpSignatureError> {
	let text = stringify(
		[{ items: input.components.map(fromComponent), params: fromSignatureParameters(input.params) }],
		"list",
	);
	if (isFailure(text)) return failure(malformed(text.error.message));
	return text;
}

/**
 * Parses `Signature` into signature bytes keyed by label.
 *
 * @param text - The field value.
 * @returns The signatures, or `malformed` for a member that is not a Byte Sequence.
 * @example parseSignature("sig1=:dGVzdA==:")
 */
export function parseSignature(
	text: string,
): Result<Record<string, Uint8Array>, HttpSignatureError> {
	let dictionary = parseDictionary(text, "Signature");
	if (isFailure(dictionary)) return dictionary;

	let entries: Array<[string, Uint8Array]> = [];
	for (let [label, member] of Object.entries(dictionary.data)) {
		if (!("value" in member) || !(member.value instanceof Uint8Array)) {
			return failure(malformed(`Signature ${label} is not a byte sequence`));
		}
		entries.push([label, member.value]);
	}
	return success(Object.fromEntries(entries));
}

/**
 * Serializes signature bytes keyed by label.
 *
 * @param signatures - The signatures.
 * @returns The field text, or `malformed` for a label that is not a Structured Field key.
 * @example stringifySignature({ sig1: bytes }) // success("sig1=:…:")
 */
export function stringifySignature(
	signatures: Record<string, Uint8Array>,
): Result<string, HttpSignatureError> {
	return serializeDictionary(signatures);
}

/**
 * Parses `Accept-Signature`, the signatures a server asks for (RFC 9421 §5.1).
 *
 * @param text - The field value.
 * @returns The requests keyed by label, or `malformed`.
 * @example parseAcceptSignature('sig1=("@method" "@target-uri");created;keyid="k"')
 */
export function parseAcceptSignature(
	text: string,
): Result<Record<string, AcceptSignature>, HttpSignatureError> {
	let dictionary = parseDictionary(text, "Accept-Signature");
	if (isFailure(dictionary)) return dictionary;

	let entries: Array<[string, AcceptSignature]> = [];
	for (let [label, member] of Object.entries(dictionary.data)) {
		if (!("items" in member)) {
			return failure(malformed(`Accept-Signature ${label} is not a list`));
		}

		let components = toComponents(member.items);
		if (isFailure(components)) return components;

		let params: AcceptSignatureParameters = {};
		for (let [name, value] of Object.entries(member.params)) {
			if (TIME_SIGNATURE_PARAMETERS.has(name)) {
				if (value !== true) return failure(malformed(`Accept-Signature ${name} carries a value`));
				params[name as "created" | "expires"] = true;
			} else if (STRING_SIGNATURE_PARAMETERS.has(name)) {
				if (typeof value !== "string") return failure(malformed(`${name} is not a string`));
				params[name as "nonce" | "alg" | "keyid" | "tag"] = value;
			}
		}
		entries.push([label, { components: components.data, params }]);
	}
	return success(Object.fromEntries(entries));
}

/**
 * Serializes `Accept-Signature` requests keyed by label.
 *
 * @param requests - The requested signatures.
 * @returns The field text, or `malformed`.
 * @example stringifyAcceptSignature({ sig1: { components: [{ name: "@method" }], params: { created: true } } })
 */
export function stringifyAcceptSignature(
	requests: Record<string, AcceptSignature>,
): Result<string, HttpSignatureError> {
	let members: Record<string, SF.InnerListInput> = {};
	for (let [label, request] of Object.entries(requests)) {
		let params: SF.Parameters = {};
		for (let [name, value] of Object.entries(request.params)) {
			if (value !== undefined && value !== false) params[name] = value;
		}
		members[label] = { items: request.components.map(fromComponent), params };
	}
	return serializeDictionary(members);
}

/**
 * The text a component identifier serializes to, `"@query-param";name="Pet"` for example,
 * which starts its signature base line.
 *
 * @param component - The covered component.
 */
export function serializeIdentifier(component: Component): Result<string, HttpSignatureError> {
	let text = stringify(fromComponent(component), "item");
	if (isFailure(text)) return failure(malformed(text.error.message));
	return text;
}

/**
 * Reads the items of an Inner List as component identifiers. Field names must be
 * lowercase, and an unknown component parameter fails, as RFC 9421 §2.5 requires.
 *
 * @param items - The inner list's items.
 */
function toComponents(items: SF.Item[]): Result<Component[], HttpSignatureError> {
	let components: Component[] = [];
	for (let item of items) {
		if (typeof item.value !== "string") return failure(malformed("A component is not a string"));
		if (!item.value.startsWith("@") && item.value !== item.value.toLowerCase()) {
			return failure(malformed(`Component ${item.value} is not lowercase`));
		}

		let params: ComponentParameters = {};
		for (let [name, value] of Object.entries(item.params)) {
			if (FLAG_PARAMETERS.has(name) && value === true) {
				params[name as "sf" | "bs" | "req" | "tr"] = true;
			} else if (STRING_PARAMETERS.has(name) && typeof value === "string") {
				params[name as "key" | "name"] = value;
			} else {
				return failure(malformed(`Component ${item.value} has an unknown parameter ${name}`));
			}
		}

		components.push(
			Object.keys(params).length > 0 ? { name: item.value, params } : { name: item.value },
		);
	}
	return success(components);
}

/**
 * Reads the parameters of a `Signature-Input` member, keeping their order.
 *
 * @param params - The inner list's parameters.
 */
function toSignatureParameters(
	params: SF.Parameters,
): Result<SignatureParameters, HttpSignatureError> {
	let read: SignatureParameters = {};
	for (let [name, value] of Object.entries(params)) {
		if (TIME_SIGNATURE_PARAMETERS.has(name)) {
			if (typeof value !== "number" || !Number.isInteger(value)) {
				return failure(malformed(`${name} is not an integer`));
			}
			read[name as "created" | "expires"] = new Date(value * 1000);
		} else if (STRING_SIGNATURE_PARAMETERS.has(name)) {
			if (typeof value !== "string") return failure(malformed(`${name} is not a string`));
			read[name as "nonce" | "alg" | "keyid" | "tag"] = value;
		}
	}
	return success(read);
}

/**
 * Writes signature parameters in their order, times as whole seconds.
 *
 * @param params - The parameters.
 */
function fromSignatureParameters(params: SignatureParameters): SF.Parameters {
	let written: SF.Parameters = {};
	for (let [name, value] of Object.entries(params)) {
		if (value instanceof Date) written[name] = Math.floor(value.getTime() / 1000);
		else if (typeof value === "string") written[name] = value;
	}
	return written;
}

/**
 * Writes a component identifier as a String Item with its parameters in order.
 *
 * @param component - The component.
 */
function fromComponent(component: Component): SF.ItemInput {
	let params: SF.Parameters = {};
	for (let [name, value] of Object.entries(component.params ?? {})) {
		if (value !== undefined && value !== false) params[name] = value;
	}
	return { value: component.name, params };
}

/**
 * Parses a Dictionary field, reporting a grammar error as `malformed`.
 *
 * @param text - The field value.
 * @param field - The field name, for the message.
 */
function parseDictionary(text: string, field: string): Result<SF.Dictionary, HttpSignatureError> {
	let parsed = parse(text, "dictionary");
	if (isFailure(parsed)) {
		return failure(
			new HttpSignatureError("malformed", `Malformed ${field}: ${parsed.error.message}`, {
				cause: parsed.error,
			}),
		);
	}
	return parsed;
}

/**
 * Serializes a Dictionary field, reporting a value with no representation as `malformed`.
 *
 * @param members - The members.
 */
function serializeDictionary(
	members: Record<string, SF.MemberInput>,
): Result<string, HttpSignatureError> {
	let text = stringify(members, "dictionary");
	if (isFailure(text)) return failure(malformed(text.error.message));
	return text;
}

/**
 * A `malformed` failure.
 *
 * @param message - What is wrong.
 */
function malformed(message: string): HttpSignatureError {
	return new HttpSignatureError("malformed", message);
}
