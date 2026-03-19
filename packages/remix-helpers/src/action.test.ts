import { describe, expect, test } from "bun:test";

import type { Action } from "@remix-run/fetch-router";
import type { Route } from "@remix-run/fetch-router/routes";

import action from "./action";

describe(action.name, () => {
	test("returns the same action function reference", () => {
		type FeedRoute = Route<"GET", "/feed">;

		let handler = (async (_ctx: unknown) => {
			return new Response("ok");
		}) as Action<"GET", "/feed">;

		let wrapped = action<FeedRoute>(handler);
		let typed: Action<"GET", "/feed"> = wrapped;

		expect(wrapped).toBe(handler);
		expect(typed).toBe(handler);
	});
});
