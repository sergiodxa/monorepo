import { describe, expect, test } from "bun:test";

import type { Controller } from "@remix-run/fetch-router";
import type { Route } from "@remix-run/fetch-router/routes";

import form from "./form";

describe(form.name, () => {
	test("returns the same form controller object reference", () => {
		type SetupForm = Controller<{
			index: Route<"GET", "/setup">;
			action: Route<"POST", "/setup">;
		}>;

		let handlers = {
			async index(_ctx: unknown) {
				return new Response("setup");
			},
			async action(_ctx: unknown) {
				return new Response("saved");
			},
		} as SetupForm;

		let wrapped = form<"/setup">(handlers);
		let typed: SetupForm = wrapped;

		expect(wrapped).toBe(handlers);
		expect(typed).toBe(handlers);
	});
});
