import { describe, expect, test } from "bun:test";
import { Location } from "@pkg/location";
import { data } from "react-router";
import {
	badRequest,
	forbidden,
	notFound,
	ok,
	paymentRequired,
	redirect,
	unauthorized,
	unprocessableEntity,
} from "./index";

describe("ok", () => {
	test("merges input with ok: true", () => {
		let result = ok({ message: "Success" });

		expect(result).toBeDefined();
		expect(result.init).toBeDefined();
		expect(result.init?.status).toBe(200);
	});

	test("accepts custom headers", () => {
		let result = ok(
			{ data: "test" },
			{
				headers: {
					"Cache-Control": "max-age=3600",
				},
			},
		);

		expect(result.init?.headers).toEqual({ "Cache-Control": "max-age=3600" });
		expect(result.init?.status).toBe(200);
	});

	test("creates data response matching raw data() call", () => {
		let manual = data({ message: "Test", ok: true }, { status: 200 });
		let helper = ok({ message: "Test" });

		expect(helper.init?.status).toBe(manual.init?.status);
	});
});

describe("redirect", () => {
	test("creates Response with status 307 for string path", () => {
		let response = redirect("/login");

		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe("/login");
	});

	test("works with URL object", () => {
		let url = new URL("https://example.com/dashboard");
		let response = redirect(url);

		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe("https://example.com/dashboard");
	});

	test("works with Location object", () => {
		let location = new Location({
			pathname: "/search",
			search: "q=test&page=1",
		});
		let response = redirect(location);

		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe("/search?q=test&page=1");
	});

	test("accepts custom redirect status codes", () => {
		expect(redirect("/path", { status: redirect.Status.SeeOther }).status).toBe(303);
		expect(redirect("/path", { status: redirect.Status.Temporary }).status).toBe(307);
		expect(redirect("/path", { status: redirect.Status.Permanent }).status).toBe(308);
	});

	test("accepts numeric status codes", () => {
		expect(redirect("/path", { status: 303 }).status).toBe(303);
		expect(redirect("/path", { status: 307 }).status).toBe(307);
		expect(redirect("/path", { status: 308 }).status).toBe(308);
	});

	test("defaults to 307 when no status provided", () => {
		let response = redirect("/path");
		expect(response.status).toBe(307);
	});

	test("merges custom headers", () => {
		let response = redirect("/login", {
			headers: {
				"Set-Cookie": "session=; Max-Age=0",
			},
		});

		expect(response.headers.get("Set-Cookie")).toBe("session=; Max-Age=0");
		expect(response.headers.get("Location")).toBe("/login");
	});

	test("has null body", async () => {
		let response = redirect("/path");
		let text = await response.text();

		expect(text).toBe("");
	});

	test("throws for invalid input", () => {
		// @ts-expect-error Testing runtime behavior
		expect(() => redirect(123)).toThrow("Invalid redirect target");

		// @ts-expect-error Testing runtime behavior
		expect(() => redirect(null)).toThrow("Invalid redirect target");
	});
});

describe("error response helpers", () => {
	test("badRequest returns status 400", () => {
		let result = badRequest({ error: "Invalid input" });

		expect(result.init?.status).toBe(400);
	});

	test("unauthorized returns status 401", () => {
		let result = unauthorized({ error: "Auth required" });

		expect(result.init?.status).toBe(401);
	});

	test("paymentRequired returns status 402", () => {
		let result = paymentRequired({ error: "Payment required" });

		expect(result.init?.status).toBe(402);
	});

	test("forbidden returns status 403", () => {
		let result = forbidden({ error: "Access denied" });

		expect(result.init?.status).toBe(403);
	});

	test("notFound returns status 404", () => {
		let result = notFound({ error: "Not found" });

		expect(result.init?.status).toBe(404);
	});

	test("unprocessableEntity returns status 422", () => {
		let result = unprocessableEntity({ errors: { email: "Invalid" } });

		expect(result.init?.status).toBe(422);
	});
});

describe("custom headers on error responses", () => {
	test("badRequest accepts custom headers", () => {
		let result = badRequest(
			{ error: "Bad" },
			{
				headers: { "X-Custom": "value" },
			},
		);

		expect(result.init?.headers).toEqual({ "X-Custom": "value" });
	});

	test("notFound accepts custom headers", () => {
		let result = notFound(
			{ error: "Missing" },
			{
				headers: { "Cache-Control": "no-cache" },
			},
		);

		expect(result.init?.headers).toEqual({ "Cache-Control": "no-cache" });
	});
});

describe("status code consistency", () => {
	test("all helpers return correct HTTP status codes", () => {
		let statusTests = [
			{ fn: ok, args: [{ data: "test" }], expected: 200 },
			{ fn: badRequest, args: [{ error: "test" }], expected: 400 },
			{ fn: unauthorized, args: [{ error: "test" }], expected: 401 },
			{ fn: paymentRequired, args: [{ error: "test" }], expected: 402 },
			{ fn: forbidden, args: [{ error: "test" }], expected: 403 },
			{ fn: notFound, args: [{ error: "test" }], expected: 404 },
			{ fn: unprocessableEntity, args: [{ error: "test" }], expected: 422 },
		] as const;

		for (let { fn, args, expected } of statusTests) {
			// @ts-expect-error Dynamic function call for testing
			let result = fn(...args);
			expect(result.init?.status).toBe(expected);
		}
	});

	test("redirect defaults to 307 and accepts other 3xx codes", () => {
		expect(redirect("/a").status).toBe(307);
		expect(redirect("/c", { status: 303 }).status).toBe(303);
		expect(redirect("/d", { status: 307 }).status).toBe(307);
		expect(redirect("/e", { status: 308 }).status).toBe(308);
	});
});

describe("React Router data() integration", () => {
	test("helpers produce same structure as manual data() calls", () => {
		let manual = data({ message: "Test", ok: true }, { status: 200 });

		let helper = ok({ message: "Test" });

		expect(typeof helper).toBe(typeof manual);
		expect(helper.init).toBeDefined();
		expect(manual.init).toBeDefined();
	});

	test("error helpers match manual data() structure", () => {
		let manual = data({ error: "Test", ok: false }, { status: 400 });
		let helper = badRequest({ error: "Test" });

		expect(typeof helper).toBe(typeof manual);
		expect(helper.init?.status).toBe(manual.init?.status);
	});
});

describe("redirect.Status enum", () => {
	test("enum values match HTTP status codes", () => {
		expect(redirect.Status.SeeOther).toBe(303);
		expect(redirect.Status.Temporary).toBe(307);
		expect(redirect.Status.Permanent).toBe(308);
	});

	test("can be used with redirect function", () => {
		let response = redirect("/path", { status: redirect.Status.Permanent });
		expect(response.status).toBe(308);
	});
});
