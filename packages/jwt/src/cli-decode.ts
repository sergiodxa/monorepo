/**
 * The `sdxc-jwt decode` handler: prints a token's header and claims as the token presents them,
 * with no key and no checks, for reading a token before deciding how to verify it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JWT_COMMANDS } from "./cli-contract.js";
import { decodeToken, formatToken, readToken } from "./cli-input.js";

export default createCommand(JWT_COMMANDS.decode, async (ctx) => {
	let token = await readToken(ctx.arguments.token, ctx);
	if (isFailure(token)) return token;
	let decoded = decodeToken(token.data);
	if (isFailure(decoded)) return decoded;
	ctx.stdout(ctx.flags.json ? `${JSON.stringify(decoded.data)}\n` : formatToken(decoded.data));
	return success();
});
