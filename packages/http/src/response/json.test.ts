/**
 * Tests for the JSON response helpers, covering the status, body, and
 * custom-header behavior of each status-code function.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
	notAcceptable,
	notFound,
	notImplemented,
	ok,
	payloadTooLarge,
	paymentRequired,
	preconditionFailed,
	serviceUnavailable,
	tooManyRequests,
	unauthorized,
	unprocessableEntity,
	unsupportedMediaType,
} from "./json";

describe("2xx success", () => {
	test("ok returns 200 with JSON body", async () => {
		let res = ok({ message: "Success" });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ message: "Success" });
	});

	test("ok accepts custom headers", () => {
		let res = ok({ data: "test" }, { headers: { "X-Custom": "value" } });
		expect(res.headers.get("X-Custom")).toBe("value");
	});

	test("created returns 201 with JSON body", async () => {
		let res = created({ id: "123" });
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ id: "123" });
	});

	test("created accepts custom headers", () => {
		let res = created({ id: "123" }, { headers: { Location: "/users/123" } });
		expect(res.headers.get("Location")).toBe("/users/123");
	});

	test("accepted returns 202 with JSON body", async () => {
		let res = accepted({ jobId: "456" });
		expect(res.status).toBe(202);
		expect(await res.json()).toEqual({ jobId: "456" });
	});

	test("accepted accepts custom headers", () => {
		let res = accepted({ jobId: "456" }, { headers: { "X-Job-Status": "queued" } });
		expect(res.headers.get("X-Job-Status")).toBe("queued");
	});
});

describe("4xx client errors", () => {
	test("badRequest returns 400 with JSON body", async () => {
		let res = badRequest({ error: "Invalid input" });
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "Invalid input" });
	});

	test("badRequest accepts custom headers", () => {
		let res = badRequest({ error: "Bad" }, { headers: { "X-Request-Id": "123" } });
		expect(res.headers.get("X-Request-Id")).toBe("123");
	});

	test("unauthorized returns 401 with JSON body", async () => {
		let res = unauthorized({ error: "Auth required" });
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "Auth required" });
	});

	test("unauthorized accepts custom headers", () => {
		let res = unauthorized(
			{ error: "Auth required" },
			{ headers: { "WWW-Authenticate": "Bearer" } },
		);
		expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
	});

	test("paymentRequired returns 402 with JSON body", async () => {
		let res = paymentRequired({ error: "Subscription required" });
		expect(res.status).toBe(402);
		expect(await res.json()).toEqual({ error: "Subscription required" });
	});

	test("paymentRequired accepts custom headers", () => {
		let res = paymentRequired(
			{ error: "Payment needed" },
			{ headers: { "X-Upgrade-Url": "/billing" } },
		);
		expect(res.headers.get("X-Upgrade-Url")).toBe("/billing");
	});

	test("forbidden returns 403 with JSON body", async () => {
		let res = forbidden({ error: "Access denied" });
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: "Access denied" });
	});

	test("forbidden accepts custom headers", () => {
		let res = forbidden({ error: "Forbidden" }, { headers: { "X-Required-Role": "admin" } });
		expect(res.headers.get("X-Required-Role")).toBe("admin");
	});

	test("notFound returns 404 with JSON body", async () => {
		let res = notFound({ error: "Not found" });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "Not found" });
	});

	test("notFound accepts custom headers", () => {
		let res = notFound({ error: "Not found" }, { headers: { "X-Resource-Type": "user" } });
		expect(res.headers.get("X-Resource-Type")).toBe("user");
	});

	test("methodNotAllowed returns 405 with JSON body", async () => {
		let res = methodNotAllowed({ error: "POST not allowed" });
		expect(res.status).toBe(405);
		expect(await res.json()).toEqual({ error: "POST not allowed" });
	});

	test("methodNotAllowed accepts custom headers", () => {
		let res = methodNotAllowed({ error: "Method not allowed" }, { headers: { Allow: "GET, PUT" } });
		expect(res.headers.get("Allow")).toBe("GET, PUT");
	});

	test("notAcceptable returns 406 with JSON body", async () => {
		let res = notAcceptable({ error: "Cannot produce requested format" });
		expect(res.status).toBe(406);
		expect(await res.json()).toEqual({
			error: "Cannot produce requested format",
		});
	});

	test("notAcceptable accepts custom headers", () => {
		let res = notAcceptable(
			{ error: "Not acceptable" },
			{ headers: { "X-Available-Formats": "json, xml" } },
		);
		expect(res.headers.get("X-Available-Formats")).toBe("json, xml");
	});

	test("conflict returns 409 with JSON body", async () => {
		let res = conflict({ error: "Email already exists" });
		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: "Email already exists" });
	});

	test("conflict accepts custom headers", () => {
		let res = conflict({ error: "Conflict" }, { headers: { "X-Conflict-Field": "email" } });
		expect(res.headers.get("X-Conflict-Field")).toBe("email");
	});

	test("gone returns 410 with JSON body", async () => {
		let res = gone({ error: "Resource has been deleted" });
		expect(res.status).toBe(410);
		expect(await res.json()).toEqual({ error: "Resource has been deleted" });
	});

	test("gone accepts custom headers", () => {
		let res = gone({ error: "Gone" }, { headers: { "X-Deleted-At": "2024-01-01" } });
		expect(res.headers.get("X-Deleted-At")).toBe("2024-01-01");
	});

	test("preconditionFailed returns 412 with JSON body", async () => {
		let res = preconditionFailed({ error: "ETag mismatch" });
		expect(res.status).toBe(412);
		expect(await res.json()).toEqual({ error: "ETag mismatch" });
	});

	test("preconditionFailed accepts custom headers", () => {
		let res = preconditionFailed(
			{ error: "Precondition failed" },
			{ headers: { ETag: '"abc123"' } },
		);
		expect(res.headers.get("ETag")).toBe('"abc123"');
	});

	test("payloadTooLarge returns 413 with JSON body", async () => {
		let res = payloadTooLarge({ error: "File too large" });
		expect(res.status).toBe(413);
		expect(await res.json()).toEqual({ error: "File too large" });
	});

	test("payloadTooLarge accepts custom headers", () => {
		let res = payloadTooLarge({ error: "Too large" }, { headers: { "X-Max-Size": "10MB" } });
		expect(res.headers.get("X-Max-Size")).toBe("10MB");
	});

	test("unsupportedMediaType returns 415 with JSON body", async () => {
		let res = unsupportedMediaType({ error: "Content-Type not supported" });
		expect(res.status).toBe(415);
		expect(await res.json()).toEqual({ error: "Content-Type not supported" });
	});

	test("unsupportedMediaType accepts custom headers", () => {
		let res = unsupportedMediaType(
			{ error: "Unsupported" },
			{ headers: { Accept: "application/json" } },
		);
		expect(res.headers.get("Accept")).toBe("application/json");
	});

	test("unprocessableEntity returns 422 with JSON body", async () => {
		let res = unprocessableEntity({ errors: { email: "Invalid format" } });
		expect(res.status).toBe(422);
		expect(await res.json()).toEqual({ errors: { email: "Invalid format" } });
	});

	test("unprocessableEntity accepts custom headers", () => {
		let res = unprocessableEntity(
			{ error: "Validation failed" },
			{ headers: { "X-Validation-Errors": "2" } },
		);
		expect(res.headers.get("X-Validation-Errors")).toBe("2");
	});

	test("tooManyRequests returns 429 with JSON body", async () => {
		let res = tooManyRequests({ error: "Rate limit exceeded" });
		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({ error: "Rate limit exceeded" });
	});

	test("tooManyRequests accepts custom headers", () => {
		let res = tooManyRequests({ error: "Too many requests" }, { headers: { "Retry-After": "60" } });
		expect(res.headers.get("Retry-After")).toBe("60");
	});
});

describe("5xx server errors", () => {
	test("internalServerError returns 500 with JSON body", async () => {
		let res = internalServerError({ error: "Server error" });
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: "Server error" });
	});

	test("internalServerError accepts custom headers", () => {
		let res = internalServerError(
			{ error: "Internal error" },
			{ headers: { "X-Request-Id": "abc123" } },
		);
		expect(res.headers.get("X-Request-Id")).toBe("abc123");
	});

	test("notImplemented returns 501 with JSON body", async () => {
		let res = notImplemented({ error: "Feature not implemented" });
		expect(res.status).toBe(501);
		expect(await res.json()).toEqual({ error: "Feature not implemented" });
	});

	test("notImplemented accepts custom headers", () => {
		let res = notImplemented(
			{ error: "Not implemented" },
			{ headers: { "X-Planned-Release": "Q2 2024" } },
		);
		expect(res.headers.get("X-Planned-Release")).toBe("Q2 2024");
	});

	test("badGateway returns 502 with JSON body", async () => {
		let res = badGateway({ error: "Upstream server error" });
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: "Upstream server error" });
	});

	test("badGateway accepts custom headers", () => {
		let res = badGateway(
			{ error: "Bad gateway" },
			{ headers: { "X-Upstream-Service": "payment-api" } },
		);
		expect(res.headers.get("X-Upstream-Service")).toBe("payment-api");
	});

	test("serviceUnavailable returns 503 with JSON body", async () => {
		let res = serviceUnavailable({ error: "Service under maintenance" });
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: "Service under maintenance" });
	});

	test("serviceUnavailable accepts custom headers", () => {
		let res = serviceUnavailable({ error: "Unavailable" }, { headers: { "Retry-After": "300" } });
		expect(res.headers.get("Retry-After")).toBe("300");
	});

	test("gatewayTimeout returns 504 with JSON body", async () => {
		let res = gatewayTimeout({ error: "Upstream server timeout" });
		expect(res.status).toBe(504);
		expect(await res.json()).toEqual({ error: "Upstream server timeout" });
	});

	test("gatewayTimeout accepts custom headers", () => {
		let res = gatewayTimeout({ error: "Timeout" }, { headers: { "X-Timeout-Duration": "30s" } });
		expect(res.headers.get("X-Timeout-Duration")).toBe("30s");
	});
});
