/**
 * Covers the command-line mail middleware run through a real CLI: the app's identity on every
 * message, a transport resolved from the run's context, the deferred queue sent after the
 * handler, and a failed deferred send failing the run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { command, commands, createCLI, success } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { failure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { MailCommandOptions } from "./cli.js";
import type { NormalizedMessage, SentMessage, Transport } from "./types.js";

import mail, { CurrentMailer } from "./cli.js";
import { MailError } from "./errors.js";
import { MemoryTransport } from "./memory.js";

const SENDER = { email: "no-reply@example.com", name: "Example" };

/** The message every command in these tests sends. */
const MESSAGE = { to: { email: "ada@example.com" }, subject: "Welcome", text: "Hi Ada" };

/** A transport whose provider rejects every message. */
class RejectingTransport implements Transport {
	async send(_message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		return failure(new MailError("The provider rejected the message."));
	}
}

/** A CLI that sends now with `send`, after the handler with `later`, and checks its key. */
function createApp(transport: MailCommandOptions["transport"]) {
	let contract = commands({ send: command({}), later: command({}), key: command({}) });
	let cli = createCLI({
		name: "app",
		commands: contract,
		middleware: [mail({ transport, from: SENDER })],
	});
	cli.map(contract.send, async (ctx) => {
		let sent = await ctx.email.send(MESSAGE);
		ctx.stdout(`${isSuccess(sent)}\n`);
		return success();
	});
	cli.map(contract.later, (ctx) => {
		ctx.email.later(MESSAGE);
		ctx.stdout(`queued ${ctx.email.pending}\n`);
		return success();
	});
	cli.map(contract.key, (ctx) => {
		ctx.stdout(`${ctx.get(CurrentMailer) === ctx.email}\n`);
		return success();
	});
	return cli;
}

describe("mail command middleware", () => {
	test("sends with the app's identity through the transport it was given", async () => {
		let transport = new MemoryTransport();

		let run = await invoke(createApp(transport), ["send"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("true\n");
		expect(transport.last?.from).toEqual(SENDER);
		expect(transport.last?.subject).toBe("Welcome");
	});

	test("resolves a transport factory from the run's context", async () => {
		let local = new MemoryTransport();
		let remote = new MemoryTransport();
		let cli = createApp((ctx) => (ctx.env.REMOTE === "1" ? remote : local));

		await invoke(cli, ["send"], { env: { REMOTE: "1" } });

		expect(remote.messages).toHaveLength(1);
		expect(local.messages).toHaveLength(0);
	});

	test("sends what the handler queued once it returns", async () => {
		let transport = new MemoryTransport();

		let run = await invoke(createApp(transport), ["later"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("queued 1\n");
		expect(transport.messages).toHaveLength(1);
	});

	test("fails the run when a queued message is rejected", async () => {
		let run = await invoke(createApp(new RejectingTransport()), ["later"]);

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("The provider rejected the message.");
	});

	test("publishes under the key the router entry shares", async () => {
		let run = await invoke(createApp(new MemoryTransport()), ["key"]);

		expect(run.stdout).toBe("true\n");
	});
});
