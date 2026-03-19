import { describe, expect, test } from "bun:test";

import type { Middleware } from "@remix-run/fetch-router";

import middleware from "./middleware";

describe(middleware.name, () => {
	test("returns the same middleware function reference", () => {
		let fn = ((ctx) => {
			return new Response(ctx.method);
		}) as Middleware<"GET", { id: string }>;

		let wrapped = middleware<"GET", { id: string }, Middleware<"GET", { id: string }>>(fn);
		let typed: Middleware<"GET", { id: string }> = wrapped;

		expect(wrapped).toBe(fn);
		expect(typed).toBe(fn);
	});
});
