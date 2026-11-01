/**
 * The `send` handler: reads a subscription file and a VAPID pair from a file or the environment,
 * then makes one `WebPush.send`, so a developer can check a stored subscription and their keys
 * end to end. The private key never travels through argv.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { HandlerContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";

import { createCommand, exit, success } from "@sdxc/cli";
import { failure, isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import { WEB_PUSH_COMMANDS } from "./cli-contract.js";

import type { VapidKeyPair, WebPushErrorCode } from "./index.js";

import { SUBSCRIPTION_SCHEMA, WebPush } from "./index.js";

/** The `{ publicKey, privateKey }` file `vapid keygen --json` writes; other keys are ignored. */
const KEYS_SCHEMA = s.object({ publicKey: s.string(), privateKey: s.string() });

/** Failures decided from the command's own input, which exit 2 like any unreadable input. */
const INPUT_CODES: ReadonlySet<WebPushErrorCode> = new Set<WebPushErrorCode>([
	"invalid-subscription",
	"invalid-vapid",
	"invalid-options",
	"payload-too-large",
]);

/** The context `send` runs with. */
type SendContext = HandlerContext<typeof WEB_PUSH_COMMANDS.send>;

/**
 * Reads a path relative to the run's directory, or stdin for `-`; a terminal on stdin is an
 * error, so the command never waits on a person typing JSON.
 *
 * @param ctx - The running command, for its `cwd` and stdin.
 * @param path - The path as typed.
 * @param what - What the file holds, for the error line.
 */
async function readInput(
	ctx: SendContext,
	path: string,
	what: string,
): Promise<Result<string, Error>> {
	if (path === "-") {
		if (ctx.stdin.isTTY) return failure(new Error(`No ${what}: pass a path or pipe it on stdin`));
		return success(await ctx.stdin.text());
	}
	try {
		return success(await readFile(resolve(ctx.cwd, path), "utf8"));
	} catch (error) {
		return failure(new Error(`Could not read the ${what} at ${path}`, { cause: error }));
	}
}

/**
 * Parses JSON text against a schema, naming the file's role and the first issue on failure.
 *
 * @param text - The file's contents.
 * @param schema - What the contents must be.
 * @param what - What the file holds, for the error line.
 */
function parseJson<Output>(
	text: string,
	schema: Schema<unknown, Output>,
	what: string,
): Result<Output, Error> {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return failure(new Error(`The ${what} is not JSON`));
	}
	let parsed = s.parseSafe(schema, value);
	if (parsed.success) return success(parsed.value);
	let issue = parsed.issues[0];
	let at = issue?.path?.length ? ` at ${issue.path.map(String).join(".")}` : "";
	return failure(new Error(`The ${what} is invalid${at}: ${issue?.message ?? "unknown issue"}`));
}

/**
 * The pair from `--keys-file` when given, else from the two named environment variables.
 *
 * @param ctx - The running command, for its flags and environment.
 */
async function readKeys(ctx: SendContext): Promise<Result<VapidKeyPair, Error>> {
	if (ctx.flags.keysFile !== undefined) {
		let text = await readInput(ctx, ctx.flags.keysFile, "keys file");
		if (isFailure(text)) return text;
		return parseJson(text.data, KEYS_SCHEMA, "keys file");
	}
	let publicKey = ctx.env[ctx.flags.publicKeyEnv];
	let privateKey = ctx.env[ctx.flags.privateKeyEnv];
	if (!publicKey || !privateKey) {
		return failure(
			new Error(
				`No VAPID keys: pass --keys-file, or set ${ctx.flags.publicKeyEnv} and ${ctx.flags.privateKeyEnv}`,
			),
		);
	}
	return success({ publicKey, privateKey });
}

/**
 * Sends one notification and reports the push service's answer. Exits 0 on a `2xx`, 1 when the
 * push service refused or could not be reached, and 2 when the subscription, keys or options are
 * unreadable or invalid, which the library decides before any request.
 */
export default createCommand(WEB_PUSH_COMMANDS.send, async (ctx) => {
	let text = await readInput(ctx, ctx.arguments.subscription, "subscription");
	if (isFailure(text)) return exit(2, text.error.message);
	let subscription = parseJson(text.data, SUBSCRIPTION_SCHEMA, "subscription");
	if (isFailure(subscription)) return exit(2, subscription.error.message);
	let keys = await readKeys(ctx);
	if (isFailure(keys)) return exit(2, keys.error.message);

	let push = new WebPush({ vapid: { ...keys.data, subject: ctx.flags.subject } });
	let sent = await push.send(subscription.data, ctx.flags.payload, {
		ttl: ctx.flags.ttl,
		urgency: ctx.flags.urgency,
		topic: ctx.flags.topic,
	});

	if (!isFailure(sent)) {
		if (ctx.flags.json) ctx.stdout(`${JSON.stringify({ sent: true, status: sent.data.status })}\n`);
		else ctx.stdout(`Sent: the push service answered ${sent.data.status}\n`);
		return success();
	}

	let error = sent.error;
	let code = INPUT_CODES.has(error.code) ? 2 : 1;
	if (!ctx.flags.json) return exit(code, `${error.message} (${error.code})`);
	let report = {
		sent: false,
		code: error.code,
		retryable: error.retryable,
		host: error.host,
		status: error.status,
		retryAfter: error.retryAfter,
	};
	ctx.stdout(`${JSON.stringify(report)}\n`);
	return exit(code);
});
