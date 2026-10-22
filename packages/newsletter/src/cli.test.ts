/**
 * Covers the command-line newsletter middleware run through a real CLI: the configured list
 * published to a command, a provider resolved from the run's context, and the key the router
 * entry shares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, createCLI, success } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { parseEmailAddress } from "@sdxc/email-address";
import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vite-plus/test";

import type { NewsletterCommandOptions } from "./cli.js";

import newsletter, { CurrentNewsletter } from "./cli.js";
import { MemoryNewsletter } from "./memory.js";

/** A CLI that subscribes an address by hand and checks the key it publishes under. */
function createApp(provider: NewsletterCommandOptions["provider"]) {
	let contract = commands({
		subscribe: command({ arguments: { email: argument(s.string()) } }),
		key: command({}),
	});
	let cli = createCLI({ name: "app", commands: contract, middleware: [newsletter({ provider })] });
	cli.map(contract.subscribe, async (ctx) => {
		let email = parseEmailAddress(ctx.arguments.email);
		if (isFailure(email)) return email;
		let outcome = await ctx.newsletter.subscribers.subscribe({ email: email.data });
		if (isFailure(outcome)) return outcome;
		ctx.stdout(`${outcome.data.subscriber.email}\n`);
		return success();
	});
	cli.map(contract.key, (ctx) => {
		ctx.stdout(`${ctx.get(CurrentNewsletter) === ctx.newsletter}\n`);
		return success();
	});
	return cli;
}

describe("newsletter command middleware", () => {
	test("subscribes an address through the configured list", async () => {
		let list = new MemoryNewsletter({ confirmation: "single" });

		let run = await invoke(createApp(list), ["subscribe", "reader@example.com"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("reader@example.com\n");
		let email = unwrap(parseEmailAddress("reader@example.com"));
		expect(unwrap(await list.subscribers.find({ email })).status).toBe("active");
	});

	test("resolves a provider factory from the run's context", async () => {
		let lists = { a: new MemoryNewsletter(), b: new MemoryNewsletter() };
		let cli = createApp((ctx) => (ctx.env.LIST === "b" ? lists.b : lists.a));

		await invoke(cli, ["subscribe", "reader@example.com"], { env: { LIST: "b" } });

		let email = unwrap(parseEmailAddress("reader@example.com"));
		expect(isFailure(await lists.a.subscribers.find({ email }))).toBe(true);
		expect(isFailure(await lists.b.subscribers.find({ email }))).toBe(false);
	});

	test("publishes under the key the router entry shares", async () => {
		let run = await invoke(createApp(new MemoryNewsletter()), ["key"]);

		expect(run.stdout).toBe("true\n");
	});
});
