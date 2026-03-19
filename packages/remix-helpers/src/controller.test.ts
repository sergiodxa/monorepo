import { describe, expect, test } from "bun:test";

import type { Controller } from "@remix-run/fetch-router";
import type { Route } from "@remix-run/fetch-router/routes";

import controller from "./controller";

describe(controller.name, () => {
	test("returns the same controller object reference", () => {
		type Routes = {
			index: Route<"GET", "/posts">;
			show: Route<"GET", "/posts/:id">;
		};

		let handlers = {
			async index(_ctx: unknown) {
				return new Response("index");
			},
			async show(_ctx: unknown) {
				return new Response("show");
			},
		} as Controller<Routes>;

		let wrapped = controller<Routes>(handlers);
		let typed: Controller<Routes> = wrapped;

		expect(wrapped).toBe(handlers);
		expect(typed).toBe(handlers);
	});
});
