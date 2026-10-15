/**
 * Covers the command-line billing middleware run through a real CLI: the configured platform
 * published to a command, a provider resolved from the run's context, and the key the router
 * entry shares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, createCLI, success } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { MemoryBilling } from "../providers/memory/index.js";

import type { BillingCommandOptions } from "./cli.js";

import billing, { CurrentBilling } from "./cli.js";

/** A CLI that creates a customer by hand and checks the key it publishes under. */
function createApp(provider: BillingCommandOptions["provider"]) {
	let contract = commands({
		customer: command({
			arguments: { externalId: argument(s.string()), email: argument(s.string()) },
		}),
		key: command({}),
	});
	let cli = createCLI({ name: "app", commands: contract, middleware: [billing({ provider })] });
	cli.map(contract.customer, async (ctx) => {
		let customer = await ctx.billing.customers.create({
			externalId: ctx.arguments.externalId,
			email: ctx.arguments.email,
		});
		if (isFailure(customer)) return customer;
		ctx.stdout(`${customer.data.externalId}\n`);
		return success();
	});
	cli.map(contract.key, (ctx) => {
		ctx.stdout(`${ctx.get(CurrentBilling) === ctx.billing}\n`);
		return success();
	});
	return cli;
}

describe("billing command middleware", () => {
	test("creates a customer through the configured platform", async () => {
		let platform = new MemoryBilling();

		let run = await invoke(createApp(platform), ["customer", "u_ada", "ada@example.com"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("u_ada\n");
		let found = unwrap(await platform.customers.find({ externalId: "u_ada" }));
		expect(found.email).toBe("ada@example.com");
	});

	test("resolves a provider factory from the run's context", async () => {
		let platforms = { test: new MemoryBilling(), live: new MemoryBilling() };
		let cli = createApp((ctx) => (ctx.env.BILLING === "live" ? platforms.live : platforms.test));

		await invoke(cli, ["customer", "u_ada", "ada@example.com"], { env: { BILLING: "live" } });

		expect(isFailure(await platforms.test.customers.find({ externalId: "u_ada" }))).toBe(true);
		expect(isFailure(await platforms.live.customers.find({ externalId: "u_ada" }))).toBe(false);
	});

	test("publishes under the key the router entry shares", async () => {
		let run = await invoke(createApp(new MemoryBilling()), ["key"]);

		expect(run.stdout).toBe("true\n");
	});
});
