/**
 * The `sdxc-jwt sign` handler: signs a JSON object of claims with a key pair from a file or an
 * environment variable and prints the compact token. `exp`, `iat` and `nbf` may be durations
 * measured from now, as `new JWT(claims)` reads them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, EXIT_CODES, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import { JWT_COMMANDS } from "./cli-contract.js";
import { messageOf, parseJSON, readKeyPair, readSource } from "./cli-input.js";
import { JWT } from "./jwt.js";

/** A claim set: a JSON object, any members. */
const CLAIMS = s.record(s.string(), s.any());

export default createCommand(JWT_COMMANDS.sign, async (ctx) => {
	let source = ctx.arguments.claims;
	if (source === "-" && ctx.flags.keyFile === "-") {
		return usage("Only one of the claims and the key can come from stdin");
	}
	let pair = await readKeyPair(ctx.flags, ctx);
	if (isFailure(pair)) return pair;
	let text = await readSource(source, ctx);
	if (isFailure(text)) return text;
	let json = parseJSON(text.data, source === "-" ? "stdin" : source);
	if (isFailure(json)) return json;
	let claims = s.parseSafe(CLAIMS, json.data);
	if (!claims.success || Array.isArray(json.data)) {
		return exit(EXIT_CODES.usage, "The claims must be a JSON object");
	}
	try {
		let token = new JWT(claims.value as JWT.PayloadInput);
		ctx.stdout(`${await token.sign(pair.data.alg, [pair.data])}\n`);
		return success();
	} catch (error) {
		return exit(EXIT_CODES.usage, `Cannot sign these claims: ${messageOf(error)}`);
	}
});
