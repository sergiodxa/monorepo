/**
 * Tests for the HTTP response helpers, covering status codes, JSON body
 * merging, custom headers, and the redirect helper's target handling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@sdxc/location";
import { describe, expect, test } from "vitest";

import {
	accepted,
	badGateway,
	badRequest,
	conflict,
	created,
	forbidden,
	gatewayTimeout,
	gone,
	internalServerError,
	methodNotAllowed,
	noContent,
	notAcceptable,
	notFound,
	notImplemented,
	ok,
	paymentRequired,
	preconditionFailed,
	redirect,
	requestEntityTooLarge,
	serviceUnavailable,
	tooManyRequests,
	unauthorized,
	unprocessableEntity,
	unsupportedMediaType,
} from "./index";

describe("ok", () => {
	test("merges input with ok: true", async () => {
		let result = ok({ message: "Success" });

		expect(result).toBeInstanceOf(Response);
		expect(result.status).toBe(200);
		expect(await result.json()).toEqual({ message: "Success", ok: true });
	});

	test("accepts custom headers", async () => {
		let result = ok(
			{ data: "test" },
			{
				headers: {
					"Cache-Control": "max-age=3600",
				},
			},
		);

		expect(result.headers.get("Cache-Control")).toBe("max-age=3600");
		expect(result.headers.get("Content-Type")).toContain("application/json");
		expect(result.status).toBe(200);
		expect(await result.json()).toEqual({ data: "test", ok: true });
	});

	test("creates response matching raw Response.json() call", async () => {
		let manual = Response.json({ message: "Test", ok: true }, { status: 200 });
		let helper = ok({ message: "Test" });

		expect(helper.status).toBe(manual.status);
		expect(await helper.json()).toEqual(await manual.json());
	});
});

describe("created", () => {
	test("returns status 201 with ok: true", async () => {
		let result = created({ id: "123" });

		expect(result.status).toBe(201);
		expect(await result.json()).toEqual({ id: "123", ok: true });
	});

	test("accepts custom headers", async () => {
		let result = created(
			{ id: "123" },
			{
				headers: { Location: "/users/123" },
			},
		);

		expect(result.headers.get("Location")).toBe("/users/123");
		expect(await result.json()).toEqual({ id: "123", ok: true });
	});
});

describe("accepted", () => {
	test("returns status 202 with ok: true", async () => {
		let result = accepted({ jobId: "456" });

		expect(result.status).toBe(202);
		expect(await result.json()).toEqual({ jobId: "456", ok: true });
	});
});

describe("noContent", () => {
	test("returns response with status 204", () => {
		let result = noContent();

		expect(result).toBeInstanceOf(Response);
		expect(result.status).toBe(204);
	});

	test("has null body per HTTP spec", () => {
		let result = noContent();

		expect(result.body).toBeNull();
	});

	test("accepts custom headers", () => {
		let result = noContent({
			headers: { "X-Custom": "value" },
		});

		expect(result.headers.get("X-Custom")).toBe("value");
		expect(result.body).toBeNull();
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
	test("badRequest returns status 400", async () => {
		let result = badRequest({ error: "Invalid input" });

		expect(result.status).toBe(400);
		expect(await result.json()).toEqual({ error: "Invalid input", ok: false });
	});

	test("unauthorized returns status 401", async () => {
		let result = unauthorized({ error: "Auth required" });

		expect(result.status).toBe(401);
		expect(await result.json()).toEqual({ error: "Auth required", ok: false });
	});

	test("paymentRequired returns status 402", async () => {
		let result = paymentRequired({ error: "Payment required" });

		expect(result.status).toBe(402);
		expect(await result.json()).toEqual({ error: "Payment required", ok: false });
	});

	test("forbidden returns status 403", async () => {
		let result = forbidden({ error: "Access denied" });

		expect(result.status).toBe(403);
		expect(await result.json()).toEqual({ error: "Access denied", ok: false });
	});

	test("notFound returns status 404", async () => {
		let result = notFound({ error: "Not found" });

		expect(result.status).toBe(404);
		expect(await result.json()).toEqual({ error: "Not found", ok: false });
	});

	test("unprocessableEntity returns status 422", async () => {
		let result = unprocessableEntity({ errors: { email: "Invalid" } });

		expect(result.status).toBe(422);
		expect(await result.json()).toEqual({ errors: { email: "Invalid" }, ok: false });
	});

	test("methodNotAllowed returns status 405", async () => {
		let result = methodNotAllowed({ error: "Method not allowed" });

		expect(result.status).toBe(405);
		expect(await result.json()).toEqual({ error: "Method not allowed", ok: false });
	});

	test("notAcceptable returns status 406", async () => {
		let result = notAcceptable({ error: "Not acceptable" });

		expect(result.status).toBe(406);
		expect(await result.json()).toEqual({ error: "Not acceptable", ok: false });
	});

	test("conflict returns status 409", async () => {
		let result = conflict({ error: "Resource conflict" });

		expect(result.status).toBe(409);
		expect(await result.json()).toEqual({ error: "Resource conflict", ok: false });
	});

	test("gone returns status 410", async () => {
		let result = gone({ error: "Resource gone" });

		expect(result.status).toBe(410);
		expect(await result.json()).toEqual({ error: "Resource gone", ok: false });
	});

	test("preconditionFailed returns status 412", async () => {
		let result = preconditionFailed({ error: "Precondition failed" });

		expect(result.status).toBe(412);
		expect(await result.json()).toEqual({ error: "Precondition failed", ok: false });
	});

	test("requestEntityTooLarge returns status 413", async () => {
		let result = requestEntityTooLarge({ error: "Payload too large" });

		expect(result.status).toBe(413);
		expect(await result.json()).toEqual({ error: "Payload too large", ok: false });
	});

	test("unsupportedMediaType returns status 415", async () => {
		let result = unsupportedMediaType({ error: "Unsupported media type" });

		expect(result.status).toBe(415);
		expect(await result.json()).toEqual({ error: "Unsupported media type", ok: false });
	});

	test("tooManyRequests returns status 429", async () => {
		let result = tooManyRequests({ error: "Rate limit exceeded" });

		expect(result.status).toBe(429);
		expect(await result.json()).toEqual({ error: "Rate limit exceeded", ok: false });
	});

	test("internalServerError returns status 500", async () => {
		let result = internalServerError({ error: "Server error" });

		expect(result.status).toBe(500);
		expect(await result.json()).toEqual({ error: "Server error", ok: false });
	});

	test("notImplemented returns status 501", async () => {
		let result = notImplemented({ error: "Not implemented" });

		expect(result.status).toBe(501);
		expect(await result.json()).toEqual({ error: "Not implemented", ok: false });
	});

	test("badGateway returns status 502", async () => {
		let result = badGateway({ error: "Bad gateway" });

		expect(result.status).toBe(502);
		expect(await result.json()).toEqual({ error: "Bad gateway", ok: false });
	});

	test("serviceUnavailable returns status 503", async () => {
		let result = serviceUnavailable({ error: "Service unavailable" });

		expect(result.status).toBe(503);
		expect(await result.json()).toEqual({ error: "Service unavailable", ok: false });
	});

	test("gatewayTimeout returns status 504", async () => {
		let result = gatewayTimeout({ error: "Gateway timeout" });

		expect(result.status).toBe(504);
		expect(await result.json()).toEqual({ error: "Gateway timeout", ok: false });
	});
});

describe("custom headers on error responses", () => {
	test("badRequest accepts custom headers", async () => {
		let result = badRequest(
			{ error: "Bad" },
			{
				headers: { "X-Custom": "value" },
			},
		);

		expect(result.headers.get("X-Custom")).toBe("value");
		expect(result.headers.get("Content-Type")).toContain("application/json");
		expect(await result.json()).toEqual({ error: "Bad", ok: false });
	});

	test("notFound accepts custom headers", async () => {
		let result = notFound(
			{ error: "Missing" },
			{
				headers: { "Cache-Control": "no-cache" },
			},
		);

		expect(result.headers.get("Cache-Control")).toBe("no-cache");
		expect(await result.json()).toEqual({ error: "Missing", ok: false });
	});
});

describe("status code consistency", () => {
	test("all helpers return correct HTTP status codes", () => {
		let statusTests = [
			{ fn: ok, args: [{ data: "test" }], expected: 200 },
			{ fn: created, args: [{ data: "test" }], expected: 201 },
			{ fn: accepted, args: [{ data: "test" }], expected: 202 },
			{ fn: badRequest, args: [{ error: "test" }], expected: 400 },
			{ fn: unauthorized, args: [{ error: "test" }], expected: 401 },
			{ fn: paymentRequired, args: [{ error: "test" }], expected: 402 },
			{ fn: forbidden, args: [{ error: "test" }], expected: 403 },
			{ fn: notFound, args: [{ error: "test" }], expected: 404 },
			{ fn: methodNotAllowed, args: [{ error: "test" }], expected: 405 },
			{ fn: notAcceptable, args: [{ error: "test" }], expected: 406 },
			{ fn: conflict, args: [{ error: "test" }], expected: 409 },
			{ fn: gone, args: [{ error: "test" }], expected: 410 },
			{ fn: preconditionFailed, args: [{ error: "test" }], expected: 412 },
			{ fn: requestEntityTooLarge, args: [{ error: "test" }], expected: 413 },
			{ fn: unsupportedMediaType, args: [{ error: "test" }], expected: 415 },
			{ fn: unprocessableEntity, args: [{ error: "test" }], expected: 422 },
			{ fn: tooManyRequests, args: [{ error: "test" }], expected: 429 },
			{ fn: internalServerError, args: [{ error: "test" }], expected: 500 },
			{ fn: notImplemented, args: [{ error: "test" }], expected: 501 },
			{ fn: badGateway, args: [{ error: "test" }], expected: 502 },
			{ fn: serviceUnavailable, args: [{ error: "test" }], expected: 503 },
			{ fn: gatewayTimeout, args: [{ error: "test" }], expected: 504 },
		] as const;

		for (let { fn, args, expected } of statusTests) {
			// @ts-expect-error Dynamic function call for testing
			let result = fn(...args);
			expect(result.status).toBe(expected);
		}
	});

	test("success helpers merge ok: true and error helpers merge ok: false", async () => {
		expect(await ok({ data: "test" }).json()).toEqual({ data: "test", ok: true });
		expect(await created({ data: "test" }).json()).toEqual({ data: "test", ok: true });
		expect(await accepted({ data: "test" }).json()).toEqual({ data: "test", ok: true });
		expect(await badRequest({ error: "test" }).json()).toEqual({ error: "test", ok: false });
		expect(await internalServerError({ error: "test" }).json()).toEqual({
			error: "test",
			ok: false,
		});
	});

	test("noContent returns response with status 204", () => {
		let result = noContent();
		expect(result.status).toBe(204);
		expect(result.body).toBeNull();
	});

	test("redirect defaults to 307 and accepts other 3xx codes", () => {
		expect(redirect("/a").status).toBe(307);
		expect(redirect("/c", { status: 303 }).status).toBe(303);
		expect(redirect("/d", { status: 307 }).status).toBe(307);
		expect(redirect("/e", { status: 308 }).status).toBe(308);
	});
});

describe("Response integration", () => {
	test("helpers produce same structure as manual Response.json() calls", async () => {
		let manual = Response.json({ message: "Test", ok: true }, { status: 200 });
		let helper = ok({ message: "Test" });

		expect(helper).toBeInstanceOf(Response);
		expect(helper.status).toBe(manual.status);
		expect(helper.headers.get("Content-Type")).toBe(manual.headers.get("Content-Type"));
		expect(await helper.json()).toEqual(await manual.json());
	});

	test("error helpers match manual Response.json() structure", async () => {
		let manual = Response.json({ error: "Test", ok: false }, { status: 400 });
		let helper = badRequest({ error: "Test" });

		expect(helper).toBeInstanceOf(Response);
		expect(helper.status).toBe(manual.status);
		expect(await helper.json()).toEqual(await manual.json());
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
