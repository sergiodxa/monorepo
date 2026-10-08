/**
 * Builds the bytes a signature is computed over: the RFC 9421 §2.5 signature base and the
 * draft-cavage-12 §2.3 signing string. Signer and verifier both call these, so a request
 * signs and verifies over exactly the same text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { SF } from "@sdxc/structured-fields";

import { failure, isFailure, success } from "@sdxc/result";
import { parse, stringify } from "@sdxc/structured-fields";

import type { Component } from "../types.js";

import { HttpSignatureError } from "../errors.js";
import { serializeIdentifier } from "../fields.js";

/** The parts of a request a signature can cover. */
export interface Message {
	method: string;
	url: URL;
	headers: Headers;
}

/** Characters the form-urlencoded serializer leaves as they are (WHATWG URL §5.2). */
const FORM_SAFE = /[A-Za-z0-9*\-._]/;

/** UTF-8 encoder for percent-encoding query parameter names and values. */
const ENCODER = new TextEncoder();

/**
 * Pseudo-headers whose value comes from a signature parameter, which draft-cavage-12 §2.3
 * forbids for the `rsa`, `hmac` and `ecdsa` algorithm names.
 */
const TIME_PSEUDO_HEADERS = new Set(["(created)", "(expires)"]);

/**
 * The RFC 9421 signature base: one `"<identifier>": <value>` line per covered component,
 * then the `@signature-params` line.
 *
 * @param message - The request.
 * @param components - The covered components, in order.
 * @param signatureParams - The serialized inner list of the `Signature-Input` member.
 * @returns The base, or `malformed` for a repeated component or a covered
 *   `@signature-params`, `missing-component`, or `unsupported-component`.
 */
export function signatureBase(
	message: Message,
	components: Component[],
	signatureParams: string,
): Result<string, HttpSignatureError> {
	let lines: string[] = [];
	let seen = new Set<string>();

	for (let component of components) {
		let identifier = serializeIdentifier(component);
		if (isFailure(identifier)) return identifier;
		if (seen.has(identifier.data)) {
			return failure(new HttpSignatureError("malformed", `${identifier.data} is covered twice`));
		}
		seen.add(identifier.data);

		let value = componentValue(message, component);
		if (isFailure(value)) return value;
		lines.push(`${identifier.data}: ${value.data}`);
	}

	lines.push(`"@signature-params": ${signatureParams}`);
	return success(lines.join("\n"));
}

/**
 * The value of one covered component of a request.
 *
 * @param message - The request.
 * @param component - The component.
 */
function componentValue(
	message: Message,
	component: Component,
): Result<string, HttpSignatureError> {
	let params = component.params ?? {};
	if (params.req || params.tr || params.bs) {
		return failure(unsupported(`${component.name} with req, tr or bs`));
	}
	if (component.name.startsWith("@")) return derivedValue(message, component);

	let value = message.headers.get(component.name);
	if (value === null) return failure(missing(component.name));
	if (params.key !== undefined) return dictionaryMember(component.name, value, params.key);
	if (params.sf) return reserialize(component.name, value);
	return success(value);
}

/**
 * The value of a derived component (RFC 9421 §2.2) of a request.
 *
 * @param message - The request.
 * @param component - A component whose name starts with `@`.
 */
function derivedValue(message: Message, component: Component): Result<string, HttpSignatureError> {
	let { url } = message;
	switch (component.name) {
		case "@method":
			return success(message.method);
		case "@target-uri":
			return success(url.href);
		case "@authority":
			return success(url.host.toLowerCase());
		case "@scheme":
			return success(url.protocol.slice(0, -1).toLowerCase());
		case "@request-target":
			return success(`${url.pathname}${url.search}`);
		case "@path":
			return success(url.pathname === "" ? "/" : url.pathname);
		case "@query":
			return success(url.search === "" ? "?" : url.search);
		case "@query-param":
			return queryParam(url, component.params?.name);
		case "@signature-params":
			return failure(new HttpSignatureError("malformed", "@signature-params cannot be covered"));
		default:
			return failure(unsupported(component.name));
	}
}

/**
 * The value of one named query parameter, decoded and re-encoded the way RFC 9421 §2.2.8
 * requires. A name that occurs more than once cannot be covered.
 *
 * @param url - The request URL.
 * @param name - The encoded parameter name the component identifier carries.
 */
function queryParam(url: URL, name: string | undefined): Result<string, HttpSignatureError> {
	if (name === undefined) {
		return failure(new HttpSignatureError("malformed", "@query-param needs a name"));
	}

	let values = [...url.searchParams]
		.filter(([key]) => formEncode(key) === name)
		.map(([, value]) => value);
	if (values.length === 0) return failure(missing(`@query-param ${name}`));
	if (values.length > 1) {
		return failure(new HttpSignatureError("malformed", `@query-param ${name} repeats`));
	}
	return success(formEncode(values[0] ?? ""));
}

/**
 * Percent-encodes text with the form-urlencoded set, writing a space as `%20`, which is the
 * encoding RFC 9421 §2.2.8's examples use.
 *
 * @param text - A decoded name or value.
 */
function formEncode(text: string): string {
	let out = "";
	for (let byte of ENCODER.encode(text)) {
		let char = String.fromCharCode(byte);
		out += FORM_SAFE.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
	}
	return out;
}

/**
 * One Dictionary member of a field, serialized strictly (RFC 9421 §2.1.2).
 *
 * @param field - The field name.
 * @param value - The field value.
 * @param key - The member key.
 */
function dictionaryMember(
	field: string,
	value: string,
	key: string,
): Result<string, HttpSignatureError> {
	let parsed = parse(value, "dictionary");
	if (isFailure(parsed)) return failure(notStructured(field));

	let member = parsed.data[key];
	if (member === undefined) return failure(missing(`${field} member ${key}`));
	return serializeMember(field, member);
}

/**
 * A field re-serialized strictly as a Structured Field (RFC 9421 §2.1.1). A List is tried
 * first, then a Dictionary: where both grammars accept a value they serialize it alike.
 *
 * @param field - The field name.
 * @param value - The field value.
 */
function reserialize(field: string, value: string): Result<string, HttpSignatureError> {
	let list = parse(value, "list");
	if (!isFailure(list)) return serialize(field, stringify(list.data, "list"));

	let dictionary = parse(value, "dictionary");
	if (!isFailure(dictionary)) return serialize(field, stringify(dictionary.data, "dictionary"));
	return failure(notStructured(field));
}

/**
 * Serializes one member on its own: an Item as an Item, an Inner List as a one-member List.
 *
 * @param field - The field name.
 * @param member - The member.
 */
function serializeMember(field: string, member: SF.Member): Result<string, HttpSignatureError> {
	return "items" in member
		? serialize(field, stringify([member], "list"))
		: serialize(field, stringify(member, "item"));
}

/**
 * Maps a serializer failure to `malformed`.
 *
 * @param field - The field name.
 * @param text - The serializer's result.
 */
function serialize(field: string, text: Result<string, Error>): Result<string, HttpSignatureError> {
	return isFailure(text) ? failure(notStructured(field)) : text;
}

/**
 * The draft-cavage-12 signing string: one `name: value` line per covered header or
 * pseudo-header. `host` falls back to the URL's authority, because a `Request` built for
 * `fetch` carries no `Host` header.
 *
 * @param message - The request.
 * @param headers - Covered lowercase names, in order.
 * @param params - The signature's algorithm name and times.
 * @returns The signing string, `missing-component`, or `malformed` for `(created)` or
 *   `(expires)` without its parameter or under an `rsa`/`hmac`/`ecdsa` algorithm name.
 */
export function signingString(
	message: Message,
	headers: string[],
	params: { algorithm: string; created: Date | null; expires: Date | null },
): Result<string, HttpSignatureError> {
	let lines: string[] = [];

	for (let name of headers) {
		if (TIME_PSEUDO_HEADERS.has(name) && /^(?:rsa|hmac|ecdsa)/.test(params.algorithm)) {
			return failure(
				new HttpSignatureError("malformed", `${name} cannot be covered under ${params.algorithm}`),
			);
		}

		if (name === "(request-target)") {
			lines.push(
				`${name}: ${message.method.toLowerCase()} ${message.url.pathname}${message.url.search}`,
			);
		} else if (name === "(created)" || name === "(expires)") {
			let time = name === "(created)" ? params.created : params.expires;
			if (time === null) {
				return failure(new HttpSignatureError("malformed", `${name} has no parameter`));
			}
			lines.push(`${name}: ${Math.floor(time.getTime() / 1000)}`);
		} else {
			let value = message.headers.get(name) ?? (name === "host" ? message.url.host : null);
			if (value === null) return failure(missing(name));
			lines.push(`${name}: ${value}`);
		}
	}

	return success(lines.join("\n"));
}

/**
 * A `missing-component` failure.
 *
 * @param name - What is absent.
 */
function missing(name: string): HttpSignatureError {
	return new HttpSignatureError("missing-component", `The request has no ${name}`);
}

/**
 * An `unsupported-component` failure.
 *
 * @param name - The component.
 */
function unsupported(name: string): HttpSignatureError {
	return new HttpSignatureError(
		"unsupported-component",
		`${name} cannot be derived from a request`,
	);
}

/**
 * A `malformed` failure for a field that should be a Structured Field.
 *
 * @param field - The field name.
 */
function notStructured(field: string): HttpSignatureError {
	return new HttpSignatureError("malformed", `${field} is not a Structured Field`);
}

/**
 * The covered parts of a request, its URL without the fragment a request never sends.
 *
 * @param request - The request.
 * @param headers - The headers to read, when they differ from the request's own.
 */
export function messageOf(request: Request, headers: Headers = request.headers): Message {
	let url = new URL(request.url);
	url.hash = "";
	return { method: request.method, url, headers };
}
