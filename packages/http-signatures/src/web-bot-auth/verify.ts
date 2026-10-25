/**
 * Verifies an incoming Web Bot Auth signature: the profile's tag, lifetime and coverage,
 * then the key the covered `Signature-Agent` member publishes, fetched as a stranger's
 * URL through `@sdxc/outbound` and cached, and selected by its RFC 7638 thumbprint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";
import type { DirectoryKey } from "@sdxc/well-known/http-message-signatures-directory";

import { toMs } from "@sdxc/duration";
import { JWK } from "@sdxc/jwt";
import { follow, readText, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";
import {
	MEDIA_TYPE,
	NAME,
	parse as parseDirectory,
} from "@sdxc/well-known/http-message-signatures-directory";

import type { ReadSignatureInput } from "../fields.js";
import type { Component } from "../types.js";

import { HttpSignatureError } from "../errors.js";
import { parseSignature, readSignatureInput } from "../fields.js";
import { verifyWith } from "../lib/algorithms.js";
import { messageOf, signatureBase } from "../lib/base.js";
import { toBytes } from "../lib/bytes.js";

import type { SignatureAgent } from "./signature-agent.js";

import { algorithmOfJwk, importVerificationKey } from "./key.js";
import { WEB_BOT_AUTH_TAG } from "./sign.js";
import { parseSignatureAgent } from "./signature-agent.js";

/** Bounds a verifier applies unless the caller sets its own. */
const DEFAULTS = {
	clockSkew: "1 minute",
	maxLifetime: "24 hours",
	timeout: "5 seconds",
	maxBytes: 64 * 1024,
	maxKeys: 16,
	cacheTtl: "1 hour",
} as const;

/** The shortest and longest a fetched directory is cached, whatever its `max-age` says. */
const CACHE_TTL_BOUNDS = { min: 60, max: 86_400 };

/** The prefix every cached directory is stored under, before its identifier URL. */
export const DIRECTORY_CACHE_PREFIX = "web-bot-auth:";

/** How a Web Bot Auth signature is verified. */
export interface WebBotAuthVerifyOptions {
	/**
	 * Holds fetched directories under `web-bot-auth:<identifier>` for their `max-age`,
	 * bounded to between a minute and a day. Without one, every call fetches.
	 */
	cache?: Cache;
	/** The label to verify; by default the first signed label tagged `web-bot-auth`. */
	label?: string;
	/** Components the signature must cover beyond the profile's, such as `["@method", "@path"]`. */
	components?: string[];
	/** @default new Date() */
	now?: Date;
	/** @default "1 minute" */
	clockSkew?: DurationInput;
	/** The longest `expires - created` accepted. @default "24 hours" */
	maxLifetime?: DurationInput;
	/** Accept the legacy bare String `Signature-Agent`. @default true */
	legacy?: boolean;
	/** The directory fetch's deadline. @default "5 seconds" */
	timeout?: DurationInput;
	/** The largest directory read. @default 65536 */
	maxBytes?: number;
	/** The most keys a directory may hold. @default 16 */
	maxKeys?: number;
	/** Refuse a directory host whose DNS answers a non-public address. @default false */
	resolve?: boolean;
}

/** What a verified Web Bot Auth signature establishes. */
export interface WebBotAuthVerified {
	label: string;
	keyid: string;
	/**
	 * The URL the key was resolved from, which identifies the agent: the well-known
	 * directory URL for a `directory` member, else the member's URL without query or fragment.
	 */
	agent: string;
	created: Date;
	expires: Date;
	/** Covered components in order, parameters appended (`signature-agent;key="sig1"`). */
	components: string[];
}

/** A signature member read with its label and coverage. */
interface Candidate {
	label: string;
	member: ReadSignatureInput;
	signature: Uint8Array;
}

/**
 * Verifies the Web Bot Auth signature on a request. It fails, in this order, when the
 * signature is missing or untagged, lacks `keyid`, `created` or `expires`, covers neither
 * `@authority` nor `@target-uri` nor its `Signature-Agent` member, is outside its lifetime,
 * names an agent that does not resolve to a key with that thumbprint, or does not verify.
 *
 * @param request - The incoming request.
 * @param options - The cache, required coverage and bounds.
 * @returns The agent URL and signature details, or a failure whose code names the check.
 * @example await verifyWebBotAuth(request, { cache, components: ["@method", "@path"] })
 */
export async function verifyWebBotAuth(
	request: Request,
	options: WebBotAuthVerifyOptions = {},
): Promise<Result<WebBotAuthVerified, HttpSignatureError>> {
	let candidate = readCandidate(request, options.label);
	if (isFailure(candidate)) return candidate;
	let { label, member, signature } = candidate.data;
	let { components, params } = member.input;

	if (params.keyid === undefined || params.created === undefined || params.expires === undefined) {
		return failure(malformed("A Web Bot Auth signature carries keyid, created and expires"));
	}

	let agentComponent = checkCoverage(components, options.components ?? []);
	if (isFailure(agentComponent)) return agentComponent;

	let fresh = checkLifetime(params.created, params.expires, options);
	if (isFailure(fresh)) return fresh;

	let message = messageOf(request);
	let base = signatureBase(message, components, member.serialized);
	if (isFailure(base)) return base;

	let agent = readAgent(request.headers, agentComponent.data, label, options.legacy ?? true);
	if (isFailure(agent)) return agent;

	let source = resolveSource(agent.data);
	if (isFailure(source)) return source;

	let keys = await directoryKeys(source.data, options);
	if (isFailure(keys)) return keys;

	let now = (options.now ?? new Date()).getTime() / 1000;
	let jwk = await selectKey(keys.data, params.keyid, now);
	if (jwk === null) {
		return failure(unavailable(`${source.data.identifier} publishes no key ${params.keyid}`));
	}

	let algorithm = algorithmOfJwk(jwk, params.alg);
	if (algorithm === null || (params.alg !== undefined && algorithm !== params.alg)) {
		return failure(
			new HttpSignatureError("unsupported-algorithm", "The declared alg does not fit the key"),
		);
	}
	let key = await importVerificationKey(jwk, algorithm);
	if (isFailure(key)) return key;

	let verified = await verifyWith(algorithm, key.data, signature, toBytes(base.data));
	if (isFailure(verified)) return verified;

	return success({
		label,
		keyid: params.keyid,
		agent: source.data.identifier,
		created: params.created,
		expires: params.expires,
		components: components.map(describe),
	});
}

/**
 * The signature to verify: the requested label, else the first signed one tagged
 * `web-bot-auth`, so a request carrying other signatures beside it still verifies.
 *
 * @param request - The request.
 * @param wanted - The caller's label.
 */
function readCandidate(
	request: Request,
	wanted: string | undefined,
): Result<Candidate, HttpSignatureError> {
	let inputText = request.headers.get("signature-input");
	let signatureText = request.headers.get("signature");
	if (inputText === null || signatureText === null) {
		return failure(new HttpSignatureError("unsigned", "The request carries no signature"));
	}

	let inputs = readSignatureInput(inputText);
	if (isFailure(inputs)) return inputs;
	let signatures = parseSignature(signatureText);
	if (isFailure(signatures)) return signatures;

	let labels = wanted === undefined ? Object.keys(inputs.data) : [wanted];
	for (let label of labels) {
		let member = inputs.data[label];
		let signature = signatures.data[label];
		if (member?.input.params.tag !== WEB_BOT_AUTH_TAG || signature === undefined) continue;
		return success({ label, member, signature });
	}
	return failure(new HttpSignatureError("unsigned", "No signature is tagged web-bot-auth"));
}

/**
 * Fails unless the signature covers `@authority` or `@target-uri`, one `Signature-Agent`
 * member (or the whole legacy field), and every component the caller requires.
 *
 * @param components - The covered components.
 * @param required - The caller's extra components.
 * @returns The covered `signature-agent` component.
 */
function checkCoverage(
	components: Component[],
	required: string[],
): Result<Component, HttpSignatureError> {
	let names = components.map(({ name }) => name);
	let missing = required.filter((name) => !names.includes(name));
	if (!names.includes("@authority") && !names.includes("@target-uri")) {
		missing.unshift("@authority or @target-uri");
	}

	let agent = components.find(({ name }) => name === "signature-agent");
	if (agent === undefined) missing.push("signature-agent");

	if (agent === undefined || missing.length > 0) {
		return failure(
			new HttpSignatureError(
				"insufficient-coverage",
				`The signature leaves out ${missing.join(", ")}`,
			),
		);
	}
	return success(agent);
}

/**
 * Fails when the signature is dated in the future, has expired, or claims a lifetime
 * longer than `maxLifetime`, each allowing `clockSkew`.
 *
 * @param created - The `created` parameter.
 * @param expires - The `expires` parameter.
 * @param options - The caller's bounds.
 */
function checkLifetime(
	created: Date,
	expires: Date,
	options: WebBotAuthVerifyOptions,
): Result<void, HttpSignatureError> {
	let now = (options.now ?? new Date()).getTime();
	let skew = toMs(options.clockSkew ?? DEFAULTS.clockSkew);

	if (expires.getTime() <= created.getTime()) {
		return failure(malformed("The signature expires before it is created"));
	}
	if (created.getTime() > now + skew) return failure(stale("The signature is dated in the future"));
	if (now > expires.getTime() + skew) return failure(stale("The signature has expired"));
	if (expires.getTime() - created.getTime() > toMs(options.maxLifetime ?? DEFAULTS.maxLifetime)) {
		return failure(stale("The signature is valid for longer than allowed"));
	}
	return success(undefined);
}

/**
 * The covered `Signature-Agent` member: the Dictionary member the component's `key`
 * names, or the legacy bare String when the component has no `key`.
 *
 * @param headers - The request headers.
 * @param component - The covered `signature-agent` component.
 * @param label - The signature label, which a legacy String reads under.
 * @param legacy - Whether the bare String form is accepted.
 */
function readAgent(
	headers: Headers,
	component: Component,
	label: string,
	legacy: boolean,
): Result<SignatureAgent, HttpSignatureError> {
	let text = headers.get("signature-agent");
	if (text === null) {
		return failure(
			new HttpSignatureError("missing-component", "The request has no Signature-Agent"),
		);
	}

	let key = component.params?.key;
	if (key === undefined && !legacy) {
		return failure(
			new HttpSignatureError(
				"insufficient-coverage",
				"The signature covers no Signature-Agent member",
			),
		);
	}

	let agents = parseSignatureAgent(text, key === undefined ? label : null);
	if (isFailure(agents)) return agents;
	let agent = agents.data[key ?? label];
	if (agent === undefined) {
		return failure(
			new HttpSignatureError("missing-component", `Signature-Agent has no member ${key ?? label}`),
		);
	}
	return success(agent);
}

/** Where an agent's keys are fetched from, and the identifier they are attributed to. */
interface KeySource {
	url: string;
	identifier: string;
	accept: string;
}

/**
 * The URL an agent member resolves through: a `directory` origin's well-known URI, or a
 * `jwks_uri` as sent, identified without its query or fragment.
 *
 * @param agent - The covered member.
 * @returns The source, or `key-unavailable` for a type this verifier cannot resolve or a
 *   `directory` member that is not a bare origin, both of which the draft says to ignore.
 */
function resolveSource(agent: SignatureAgent): Result<KeySource, HttpSignatureError> {
	let url = new URL(agent.uri);

	if (agent.type === "directory") {
		let bare =
			(url.pathname === "/" || url.pathname === "") && url.search === "" && url.hash === "";
		if (!bare || url.username !== "" || url.password !== "" || !agent.uri.startsWith(url.origin)) {
			return failure(unavailable(`The directory agent ${agent.uri} is not an origin`));
		}
		let identifier = new URL(`/.well-known/${NAME}`, url.origin).href;
		return success({ url: identifier, identifier, accept: MEDIA_TYPE });
	}

	if (agent.type === "jwks_uri") {
		let identifier = new URL(url);
		identifier.search = "";
		identifier.hash = "";
		return success({
			url: agent.uri,
			identifier: identifier.href,
			accept: "application/jwk-set+json, application/json",
		});
	}

	return failure(unavailable(`Signature-Agent type ${agent.type} is not supported`));
}

/** What a cached directory holds. */
interface CachedDirectory {
	keys: DirectoryKey[];
}

/**
 * The keys a source publishes: the cached copy, else a fetch that follows no redirect,
 * accepts only a 200, and stays within the size, key-count and time bounds.
 *
 * @param source - Where to fetch.
 * @param options - The cache and bounds.
 */
async function directoryKeys(
	source: KeySource,
	options: WebBotAuthVerifyOptions,
): Promise<Result<DirectoryKey[], HttpSignatureError>> {
	let cacheKey = `${DIRECTORY_CACHE_PREFIX}${source.identifier}`;
	let cached = options.cache ? await options.cache.read<CachedDirectory>(cacheKey) : null;
	if (cached && !isFailure(cached) && cached.data !== null) {
		return success(cached.data.keys as DirectoryKey[]);
	}

	let followed = await follow(source.url, {
		headers: { accept: source.accept },
		maxRedirects: 0,
		timeout: options.timeout ?? DEFAULTS.timeout,
		...(options.resolve !== undefined && { resolve: options.resolve }),
	});
	if (isFailure(followed)) {
		return failure(unavailable(`Cannot fetch ${source.url}`, followed.error));
	}

	let { response } = followed.data;
	if (response.status !== 200) {
		release(response.body);
		return failure(unavailable(`${source.url} answered ${response.status}`));
	}

	let text = await readText(response, { maxBytes: options.maxBytes ?? DEFAULTS.maxBytes });
	if (isFailure(text)) return failure(unavailable(`Cannot read ${source.url}`, text.error));

	let directory = parseDirectory(text.data.text);
	if (isFailure(directory)) {
		return failure(unavailable(`${source.url} is not a key directory`, directory.error));
	}
	if (directory.data.keys.length > (options.maxKeys ?? DEFAULTS.maxKeys)) {
		return failure(unavailable(`${source.url} publishes too many keys`));
	}

	let keys = directory.data.keys;
	await options.cache?.write<CachedDirectory>(cacheKey, { keys }, { ttl: cacheTtl(response) });
	return success(keys);
}

/**
 * How long to cache a directory: its `max-age`, else an hour, kept between a minute and
 * a day so a stale key never outlives a day and a busy agent is fetched at most a minute apart.
 *
 * @param response - The directory response.
 * @returns Whole seconds.
 */
function cacheTtl(response: Response): number {
	let match = /(?:^|,)\s*max-age\s*=\s*(\d+)/i.exec(response.headers.get("cache-control") ?? "");
	let seconds = match?.[1] === undefined ? toMs(DEFAULTS.cacheTtl) / 1000 : Number(match[1]);
	return Math.min(Math.max(seconds, CACHE_TTL_BOUNDS.min), CACHE_TTL_BOUNDS.max);
}

/**
 * The key whose RFC 7638 thumbprint is `keyid` and whose `nbf`/`exp` window includes now.
 * The thumbprint is computed rather than read from `kid`, so a mislabelled directory never
 * hands over another key.
 *
 * @param keys - The directory's keys.
 * @param keyid - The signature's `keyid`.
 * @param now - The current time in epoch seconds.
 */
async function selectKey(
	keys: DirectoryKey[],
	keyid: string,
	now: number,
): Promise<DirectoryKey | null> {
	for (let key of keys) {
		if (key.nbf !== undefined && now < key.nbf) continue;
		if (key.exp !== undefined && now >= key.exp) continue;
		let { kid: _kid, ...material } = key;
		let thumbprint = await JWK.thumbprint(material);
		if (!isFailure(thumbprint) && thumbprint.data === keyid) return key;
	}
	return null;
}

/**
 * A component as `WebBotAuthVerified.components` lists it.
 *
 * @param component - A covered component.
 */
function describe(component: Component): string {
	let params = Object.entries(component.params ?? {})
		.map(([name, value]) => (value === true ? `;${name}` : `;${name}="${value}"`))
		.join("");
	return `${component.name}${params}`;
}

/**
 * A `key-unavailable` failure.
 *
 * @param message - Why no key was found.
 * @param cause - The underlying failure.
 */
function unavailable(message: string, cause?: Error): HttpSignatureError {
	return new HttpSignatureError("key-unavailable", message, cause ? { cause } : undefined);
}

/**
 * A `malformed` failure.
 *
 * @param message - What is wrong.
 */
function malformed(message: string): HttpSignatureError {
	return new HttpSignatureError("malformed", message);
}

/**
 * A `stale-signature` failure.
 *
 * @param message - Which bound it crossed.
 */
function stale(message: string): HttpSignatureError {
	return new HttpSignatureError("stale-signature", message);
}
