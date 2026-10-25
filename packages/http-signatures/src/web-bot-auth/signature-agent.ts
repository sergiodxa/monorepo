/**
 * The `Signature-Agent` field of Web Bot Auth: a Dictionary naming, per signature, the
 * https URL a verifier resolves to the signer's keys, with the discovery `type` that
 * resolves it. The legacy bare String form reads as a single member.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { SF } from "@sdxc/structured-fields";

import { failure, isFailure, success } from "@sdxc/result";
import { parse, stringify, Token } from "@sdxc/structured-fields";

import { HttpSignatureError } from "../errors.js";

/** The discovery mechanism used when a member names none. */
export const DEFAULT_AGENT_TYPE = "directory";

/** Where one signer's keys are found. */
export interface SignatureAgent {
	/** An https URL: the directory's origin, or a JWK Set or client metadata document URL. */
	uri: string;
	/** `directory`, `jwks_uri` or `cimd`; any other value is one this verifier cannot resolve. */
	type: string;
}

/**
 * Reads `Signature-Agent` as members keyed by their label. Every member must be an https
 * URI String with an optional Token `type`; any other member fails the whole field, which
 * the draft allows a verifier to ignore.
 *
 * @param text - The field value.
 * @param legacyLabel - The member key a bare String reads under, or `null` to refuse that form.
 * @returns The members, or `malformed`.
 * @example parseSignatureAgent('sig1="https://bot.example.com"')
 */
export function parseSignatureAgent(
	text: string,
	legacyLabel: string | null = null,
): Result<Record<string, SignatureAgent>, HttpSignatureError> {
	if (text.trimStart().startsWith('"')) {
		if (legacyLabel === null) return failure(malformed("Signature-Agent is a bare String"));
		let item = parse(text, "item");
		if (isFailure(item)) return failure(malformed("Signature-Agent is not a String"));
		let agent = toAgent(item.data);
		if (isFailure(agent)) return agent;
		return success({ [legacyLabel]: agent.data });
	}

	let dictionary = parse(text, "dictionary");
	if (isFailure(dictionary)) return failure(malformed("Signature-Agent is not a Dictionary"));

	let agents: Record<string, SignatureAgent> = {};
	for (let [key, member] of Object.entries(dictionary.data)) {
		if ("items" in member) return failure(malformed(`Signature-Agent ${key} is a list`));
		let agent = toAgent(member);
		if (isFailure(agent)) return agent;
		agents[key] = agent.data;
	}
	return success(agents);
}

/**
 * Writes `Signature-Agent` in the Dictionary form signers must send, leaving `type` out
 * when it is the default `directory`.
 *
 * @param agents - The members, keyed by label.
 * @returns The field value, or `malformed` for a label or URI with no representation.
 * @example stringifySignatureAgent({ sig1: { uri: "https://bot.example.com", type: "directory" } })
 */
export function stringifySignatureAgent(
	agents: Record<string, SignatureAgent>,
): Result<string, HttpSignatureError> {
	let members: Record<string, SF.ItemInput> = {};
	for (let [key, agent] of Object.entries(agents)) {
		members[key] = {
			value: agent.uri,
			params: agent.type === DEFAULT_AGENT_TYPE ? {} : { type: new Token(agent.type) },
		};
	}
	let text = stringify(members, "dictionary");
	if (isFailure(text)) return failure(malformed(text.error.message));
	return success(text.data);
}

/**
 * One member read as an agent: an https URI String, with a Token `type` or the default.
 *
 * @param item - The member.
 */
function toAgent(item: SF.Item): Result<SignatureAgent, HttpSignatureError> {
	if (typeof item.value !== "string" || !URL.canParse(item.value)) {
		return failure(malformed("A Signature-Agent member is not a URI String"));
	}
	if (new URL(item.value).protocol !== "https:") {
		return failure(malformed("A Signature-Agent member is not an https URI"));
	}

	let type = item.params.type;
	if (type !== undefined && !(type instanceof Token)) {
		return failure(malformed("A Signature-Agent type is not a Token"));
	}
	return success({ uri: item.value, type: type?.value ?? DEFAULT_AGENT_TYPE });
}

/**
 * A `malformed` failure.
 *
 * @param message - What is wrong.
 */
function malformed(message: string): HttpSignatureError {
	return new HttpSignatureError("malformed", message);
}
