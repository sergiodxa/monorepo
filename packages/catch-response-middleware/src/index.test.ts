/**
 * Tests for `catchResponse()`, driven through a real `remix/router` rather than a
 * stand-in for its middleware runner, since the whole point is what the router
 * itself does with a thrown value.
 *
 * The contract has two halves: any `Response` thrown downstream becomes the
 * request's response no matter how deep the throw site is, and everything else
 * thrown reaches the runtime unchanged. The ordering tests pin the consequence
 * users get wrong — a middleware above the throw site never resumes, so only the
 * middleware installed above this one still observes the recovered response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { forbidden, notFound, redirect } from "@sdxc/response";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test } from "vitest";

import { catchResponse } from "./index";

/**
 * Stands in for an auth helper: throws from three frames below the handler, with
 * no access to the request context, which is the reason the middleware exists.
 */
function currentUser(): { id: string } {
	return loadUser();
}

function loadUser(): { id: string } {
	return requireSession();
}

function requireSession(): never {
	throw redirect("/login", { status: redirect.Status.SeeOther });
}

/** Builds a fresh signed cookie and in-memory store per test so sessions never leak between them. */
function createSessionSetup() {
	return {
		cookie: createCookie("test-session", { secrets: ["test-secret"] }),
		storage: createMemorySessionStorage(),
	};
}

function findSessionCookie(response: Response): string | undefined {
	return response.headers.getSetCookie().find((value) => value.startsWith("test-session="));
}

describe(catchResponse, () => {
	test("answers the request with a Response thrown by the handler", async () => {
		let router = createRouter({ middleware: [catchResponse()] });
		router.get("/", () => {
			throw redirect("/login", { status: redirect.Status.SeeOther });
		});

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/login");
	});

	test("re-throws a non-Response error untouched", async () => {
		let router = createRouter({ middleware: [catchResponse()] });
		router.get("/", () => {
			throw new Error("boom");
		});

		await expect(router.fetch(new Request("https://example.com/"))).rejects.toThrow("boom");
	});

	test("re-throws a thrown non-Error value untouched", async () => {
		let router = createRouter({ middleware: [catchResponse()] });
		router.get("/", () => {
			throw "boom";
		});

		await expect(router.fetch(new Request("https://example.com/"))).rejects.toBe("boom");
	});

	test("passes a returned response through untouched", async () => {
		let router = createRouter({ middleware: [catchResponse()] });
		let handled = new Response("hello", {
			status: 201,
			headers: { "Content-Type": "text/plain", "X-Marker": "kept" },
		});
		router.get("/", () => handled);

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response).toBe(handled);
		expect(response.status).toBe(201);
		expect(response.headers.get("X-Marker")).toBe("kept");
		expect(await response.text()).toBe("hello");
	});

	test("catches a Response thrown by a helper several calls below the handler", async () => {
		let router = createRouter({ middleware: [catchResponse()] });
		router.get("/", () => {
			let user = currentUser();
			return Response.json({ id: user.id });
		});

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/login");
	});

	test("catches a Response thrown by a middleware downstream of it", async () => {
		let guard: Middleware = () => {
			throw forbidden({ error: "nope" });
		};
		let router = createRouter({ middleware: [catchResponse(), guard] });
		router.get("/", () => new Response("unreachable — the guard throws first"));

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "nope", ok: false });
	});

	test("catches a thrown non-redirect error response", async () => {
		let router = createRouter({ middleware: [catchResponse()] });
		router.get("/", () => {
			throw notFound({ error: "missing" });
		});

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "missing", ok: false });
	});

	test("catches a Response thrown by a route-level middleware", async () => {
		let guard: Middleware = () => {
			throw redirect("/login", { status: redirect.Status.SeeOther });
		};
		let router = createRouter({ middleware: [catchResponse()] });
		router.get("/", {
			middleware: [guard],
			handler: () => new Response("unreachable — the guard throws first"),
		});

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response.status).toBe(303);
	});

	test("the router rejects a thrown Response when the middleware is absent", async () => {
		let thrown = redirect("/login", { status: redirect.Status.SeeOther });
		let router = createRouter();
		router.get("/", () => {
			throw thrown;
		});

		await expect(router.fetch(new Request("https://example.com/"))).rejects.toBe(thrown);
	});
});

describe("ordering relative to a response-observing middleware", () => {
	test("installed below session(), a thrown redirect still gets the session committed onto it", async () => {
		let { cookie, storage } = createSessionSetup();
		let router = createRouter({ middleware: [session(cookie, storage), catchResponse()] });
		router.get("/", (context) => {
			context.session.set("flash", "saved");
			throw redirect("/login", { status: redirect.Status.SeeOther });
		});

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/login");
		expect(findSessionCookie(response)).toBeDefined();
	});

	test("installed above session(), a thrown redirect loses the session commit", async () => {
		let { cookie, storage } = createSessionSetup();
		let router = createRouter({ middleware: [catchResponse(), session(cookie, storage)] });
		router.get("/", (context) => {
			context.session.set("flash", "saved");
			throw redirect("/login", { status: redirect.Status.SeeOther });
		});

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/login");
		expect(findSessionCookie(response)).toBeUndefined();
	});

	test("installed above session(), a returned redirect still gets the session committed", async () => {
		let { cookie, storage } = createSessionSetup();
		let router = createRouter({ middleware: [catchResponse(), session(cookie, storage)] });
		router.get("/", (context) => {
			context.session.set("flash", "saved");
			return redirect("/login", { status: redirect.Status.SeeOther });
		});

		let response = await router.fetch(new Request("https://example.com/"));

		expect(response.status).toBe(303);
		expect(findSessionCookie(response)).toBeDefined();
	});

	test("a session written before the throw survives the redirect it was committed onto", async () => {
		let { cookie, storage } = createSessionSetup();
		let router = createRouter({ middleware: [session(cookie, storage), catchResponse()] });
		router.get("/write", (context) => {
			context.session.set("flash", "saved");
			throw redirect("/login", { status: redirect.Status.SeeOther });
		});
		router.get("/read", (context) => new Response(String(context.session.get("flash"))));

		let write = await router.fetch(new Request("https://example.com/write"));
		let sessionCookie = findSessionCookie(write)?.split(";")[0];
		expect(sessionCookie).toBeDefined();

		let read = await router.fetch(
			new Request("https://example.com/read", { headers: { Cookie: sessionCookie! } }),
		);

		expect(await read.text()).toBe("saved");
	});
});
