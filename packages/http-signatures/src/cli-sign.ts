/**
 * The `sdxc-http-signatures sign` handler: builds a request from the method, URL, headers and
 * body given, signs it, and prints the headers signing wrote (or a curl command sending the
 * whole request), so a signature can be checked against a verifier by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, EXIT_CODES, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { Component } from "./types.js";

import { HTTP_SIGNATURES_COMMANDS } from "./cli-contract.js";
import { parseComponents, parseHeaders, readBytes, readKeyText } from "./cli-input.js";
import { importSignatureKey } from "./key.js";
import { sign } from "./sign.js";

/** Methods a `Request` refuses a body for. */
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

/**
 * A header name in the casing people write it, `signature-input` as `Signature-Input`.
 *
 * @param name - The lowercase name `Headers` answers.
 */
function displayName(name: string): string {
	return name.replaceAll(/(^|-)([a-z])/g, (_, dash: string, letter: string) => {
		return `${dash}${letter.toUpperCase()}`;
	});
}

/**
 * Quotes a word for a POSIX shell.
 *
 * @param word - Any text.
 */
function shellQuote(word: string): string {
	return `'${word.replaceAll("'", "'\\''")}'`;
}

/**
 * The components `--components` lists, as names alone for cavage, which covers header names
 * and pseudo-headers such as `(request-target)` only.
 *
 * @param values - The `--components` values.
 * @param scheme - The scheme signing.
 */
function readComponents(
	values: string[],
	scheme: "rfc9421" | "draft-cavage",
): Result<Array<string | Component> | undefined, ExitError> {
	if (values.length === 0) return success(undefined);
	let parsed = parseComponents(values);
	if (isFailure(parsed) || scheme === "rfc9421") return parsed;
	if (parsed.data.some((component) => component.params)) {
		return exit(EXIT_CODES.usage, "draft-cavage covers header names only, without parameters");
	}
	return success(parsed.data.map((component) => component.name));
}

/**
 * A curl command that sends the signed request with every header it carries. A body from a
 * file is sent from that file; one piped on stdin is written into the command.
 *
 * @param request - The signed request.
 * @param body - The body bytes, `null` without a body.
 * @param bodyFile - Where the body came from.
 */
function curlCommand(request: Request, body: Uint8Array | null, bodyFile?: string): string {
	let words = ["curl", "-X", request.method, shellQuote(request.url)];
	for (let [name, value] of request.headers) {
		words.push("-H", shellQuote(`${displayName(name)}: ${value}`));
	}
	if (body !== null) {
		let data =
			bodyFile === undefined || bodyFile === "-" ? new TextDecoder().decode(body) : `@${bodyFile}`;
		words.push("--data-binary", shellQuote(data));
	}
	return `${words.join(" ")}\n`;
}

export default createCommand(HTTP_SIGNATURES_COMMANDS.sign, async (ctx) => {
	let { keyFile, keyEnv, keyId, alg, scheme, header, bodyFile, curl, json } = ctx.flags;
	if ((keyFile === undefined) === (keyEnv === undefined)) {
		return usage("Pass exactly one of --key-file <path> or --key-env <name>");
	}
	if (keyFile === "-" && bodyFile === "-") {
		return usage("Only one of the key and the body can come from stdin");
	}
	if (curl && json) return usage("Pass at most one of --curl and --json");

	let method = ctx.arguments.method.toUpperCase();
	let url = URL.parse(ctx.arguments.url);
	if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
		return usage(`Expected an absolute http(s) URL; got ${ctx.arguments.url}`);
	}
	let headers = parseHeaders(header);
	if (isFailure(headers)) return headers;
	let components = readComponents(ctx.flags.components, scheme);
	if (isFailure(components)) return components;

	let body: Uint8Array<ArrayBuffer> | null = null;
	if (bodyFile !== undefined) {
		if (BODYLESS_METHODS.has(method)) return usage(`A ${method} request cannot carry a body`);
		let read = await readBytes(bodyFile, ctx);
		if (isFailure(read)) return read;
		body = read.data;
	}

	let keyText = await readKeyText({ keyFile, keyEnv }, ctx);
	if (isFailure(keyText)) return keyText;
	let privateKey = await importSignatureKey(keyText.data.text, { usage: "sign", algorithm: alg });
	if (isFailure(privateKey)) {
		return exit(EXIT_CODES.usage, `Cannot use ${keyText.data.source}: ${privateKey.error.message}`);
	}

	let request = new Request(url, { method, headers: headers.data, body });
	let signed = await sign(request, {
		scheme,
		key: { id: keyId, privateKey: privateKey.data },
		body: body ?? undefined,
		components: components.data,
		label: ctx.flags.label,
		tag: ctx.flags.tag,
		nonce: ctx.flags.nonce,
	});
	if (isFailure(signed)) {
		return exit(EXIT_CODES.usage, `Cannot sign (${signed.error.code}): ${signed.error.message}`);
	}

	if (curl) {
		ctx.stdout(curlCommand(signed.data, body, bodyFile));
		return success();
	}
	let written = [...signed.data.headers].filter(([name, value]) => {
		return request.headers.get(name) !== value;
	});
	if (json) {
		ctx.stdout(
			`${JSON.stringify({
				scheme,
				method,
				url: signed.data.url,
				headers: Object.fromEntries(written),
			})}\n`,
		);
		return success();
	}
	ctx.stdout(written.map(([name, value]) => `${displayName(name)}: ${value}\n`).join(""));
	return success();
});
