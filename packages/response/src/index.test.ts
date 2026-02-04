import { describe, expect, test } from "bun:test";

import { Location } from "@pkg/location";
import { data } from "react-router";

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

describe("created", () => {
	test("returns status 201 with ok: true", () => {
		let result = created({ id: "123" });

		expect(result.init?.status).toBe(201);
	});

	test("accepts custom headers", () => {
		let result = created(
			{ id: "123" },
			{
				headers: { Location: "/users/123" },
			},
		);

		expect(result.init?.headers).toEqual({ Location: "/users/123" });
	});
});

describe("accepted", () => {
	test("returns status 202 with ok: true", () => {
		let result = accepted({ jobId: "456" });

		expect(result.init?.status).toBe(202);
	});
});

describe("noContent", () => {
	test("returns data response with status 204", () => {
		let result = noContent();

		expect(result.init?.status).toBe(204);
	});

	test("has null body per HTTP spec", () => {
		let result = noContent();

		expect(result.data).toBeNull();
	});

	test("accepts custom headers", () => {
		let result = noContent({
			headers: { "X-Custom": "value" },
		});

		expect(result.init?.headers).toEqual({ "X-Custom": "value" });
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

	test("methodNotAllowed returns status 405", () => {
		let result = methodNotAllowed({ error: "Method not allowed" });

		expect(result.init?.status).toBe(405);
	});

	test("notAcceptable returns status 406", () => {
		let result = notAcceptable({ error: "Not acceptable" });

		expect(result.init?.status).toBe(406);
	});

	test("conflict returns status 409", () => {
		let result = conflict({ error: "Resource conflict" });

		expect(result.init?.status).toBe(409);
	});

	test("gone returns status 410", () => {
		let result = gone({ error: "Resource gone" });

		expect(result.init?.status).toBe(410);
	});

	test("preconditionFailed returns status 412", () => {
		let result = preconditionFailed({ error: "Precondition failed" });

		expect(result.init?.status).toBe(412);
	});

	test("requestEntityTooLarge returns status 413", () => {
		let result = requestEntityTooLarge({ error: "Payload too large" });

		expect(result.init?.status).toBe(413);
	});

	test("unsupportedMediaType returns status 415", () => {
		let result = unsupportedMediaType({ error: "Unsupported media type" });

		expect(result.init?.status).toBe(415);
	});

	test("tooManyRequests returns status 429", () => {
		let result = tooManyRequests({ error: "Rate limit exceeded" });

		expect(result.init?.status).toBe(429);
	});

	test("internalServerError returns status 500", () => {
		let result = internalServerError({ error: "Server error" });

		expect(result.init?.status).toBe(500);
	});

	test("notImplemented returns status 501", () => {
		let result = notImplemented({ error: "Not implemented" });

		expect(result.init?.status).toBe(501);
	});

	test("badGateway returns status 502", () => {
		let result = badGateway({ error: "Bad gateway" });

		expect(result.init?.status).toBe(502);
	});

	test("serviceUnavailable returns status 503", () => {
		let result = serviceUnavailable({ error: "Service unavailable" });

		expect(result.init?.status).toBe(503);
	});

	test("gatewayTimeout returns status 504", () => {
		let result = gatewayTimeout({ error: "Gateway timeout" });

		expect(result.init?.status).toBe(504);
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
			expect(result.init?.status).toBe(expected);
		}
	});

	test("noContent returns data response with status 204", () => {
		let result = noContent();
		expect(result.init?.status).toBe(204);
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
