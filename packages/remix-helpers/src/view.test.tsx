/* @jsxImportSource remix/ui */
import { describe, expect, test } from "bun:test";

import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { get, route } from "remix/fetch-router/routes";
import { Frame } from "remix/ui";

import view from "./view";

describe(view.name, () => {
	test("returns a rendered html response from a route handler", async () => {
		let routes = route({ posts: get("/posts") });
		let router = createRouter({
			middleware: [asyncContext()],
			defaultHandler() {
				return new Response("Not Found", { status: 404 });
			},
		});

		router.map(routes, {
			middleware: [],
			actions: {
				async posts() {
					return view(<main>Hello from view</main>, {
						headers: { "x-test": "1" },
						status: 201,
					});
				},
			},
		});

		let response = await router.fetch(new Request("https://example.com/posts"));
		let body = await response.text();

		expect(response.status).toBe(201);
		expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(response.headers.get("x-test")).toBe("1");
		expect(body).toContain("Hello from view");
	});

	test("renders frame content through the current router", async () => {
		let routes = route({ dashboard: get("/dashboard"), frame: get("/frame") });
		let router = createRouter({
			middleware: [asyncContext()],
			defaultHandler() {
				return new Response("Not Found", { status: 404 });
			},
		});

		router.map(routes, {
			middleware: [],
			actions: {
				async dashboard() {
					return view(
						<main>
							<h1>Dashboard</h1>
							<Frame src={routes.frame.href()} />
						</main>,
					);
				},
				async frame(ctx) {
					let cookie = ctx.request.headers.get("cookie") ?? "missing";
					let isFrame = ctx.request.headers.get("x-remix-frame") ?? "false";

					return view(
						<aside>
							<p>Sidebar</p>
							<p>Cookie: {cookie}</p>
							<p>Frame Request: {isFrame}</p>
						</aside>,
					);
				},
			},
		});

		let response = await router.fetch(
			new Request("https://example.com/dashboard", { headers: { cookie: "session=abc" } }),
		);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(body).toContain("Dashboard");
		expect(body).toContain("Sidebar");
		expect(body).toContain("Cookie: session=abc");
		expect(body).toContain("Frame Request: true");
	});
});
