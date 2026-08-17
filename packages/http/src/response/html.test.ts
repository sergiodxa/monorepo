import { describe, expect, test } from "vitest";

import * as ContentType from "../content-type";

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
} from "./html";

describe("content-type", () => {
	test("ok sets HTML content-type", () => {
		let res = ok("<h1>Hello</h1>");
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
	});

	test("created sets HTML content-type", () => {
		let res = created("<p>Created</p>");
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
	});

	test("accepted sets HTML content-type", () => {
		let res = accepted("<p>Accepted</p>");
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
	});

	test("badRequest sets HTML content-type", () => {
		let res = badRequest("<p>Bad Request</p>");
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
	});

	test("unauthorized sets HTML content-type", () => {
		let res = unauthorized("<p>Unauthorized</p>");
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
	});

	test("notFound sets HTML content-type", () => {
		let res = notFound("<h1>Not Found</h1>");
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
	});

	test("internalServerError sets HTML content-type", () => {
		let res = internalServerError("<h1>Server Error</h1>");
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
	});
});

describe("2xx success", () => {
	test("ok returns 200 with HTML body", async () => {
		let res = ok("<h1>Hello</h1>");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("<h1>Hello</h1>");
	});

	test("created returns 201 with HTML body", async () => {
		let res = created("<p>Created</p>");
		expect(res.status).toBe(201);
		expect(await res.text()).toBe("<p>Created</p>");
	});

	test("accepted returns 202 with HTML body", async () => {
		let res = accepted("<p>Accepted</p>");
		expect(res.status).toBe(202);
		expect(await res.text()).toBe("<p>Accepted</p>");
	});
});

describe("4xx client errors", () => {
	test("badRequest returns 400 with HTML body", async () => {
		let res = badRequest("<p>Bad Request</p>");
		expect(res.status).toBe(400);
		expect(await res.text()).toBe("<p>Bad Request</p>");
	});

	test("unauthorized returns 401 with HTML body", async () => {
		let res = unauthorized("<p>Unauthorized</p>");
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("<p>Unauthorized</p>");
	});

	test("paymentRequired returns 402 with HTML body", async () => {
		let res = paymentRequired("<p>Payment Required</p>");
		expect(res.status).toBe(402);
		expect(await res.text()).toBe("<p>Payment Required</p>");
	});

	test("forbidden returns 403 with HTML body", async () => {
		let res = forbidden("<p>Forbidden</p>");
		expect(res.status).toBe(403);
		expect(await res.text()).toBe("<p>Forbidden</p>");
	});

	test("notFound returns 404 with HTML body", async () => {
		let res = notFound("<h1>Page Not Found</h1>");
		expect(res.status).toBe(404);
		expect(await res.text()).toBe("<h1>Page Not Found</h1>");
	});

	test("methodNotAllowed returns 405 with HTML body", async () => {
		let res = methodNotAllowed("<p>Method Not Allowed</p>");
		expect(res.status).toBe(405);
		expect(await res.text()).toBe("<p>Method Not Allowed</p>");
	});

	test("notAcceptable returns 406 with HTML body", async () => {
		let res = notAcceptable("<p>Not Acceptable</p>");
		expect(res.status).toBe(406);
		expect(await res.text()).toBe("<p>Not Acceptable</p>");
	});

	test("conflict returns 409 with HTML body", async () => {
		let res = conflict("<p>Conflict</p>");
		expect(res.status).toBe(409);
		expect(await res.text()).toBe("<p>Conflict</p>");
	});

	test("gone returns 410 with HTML body", async () => {
		let res = gone("<p>Gone</p>");
		expect(res.status).toBe(410);
		expect(await res.text()).toBe("<p>Gone</p>");
	});

	test("preconditionFailed returns 412 with HTML body", async () => {
		let res = preconditionFailed("<p>Precondition Failed</p>");
		expect(res.status).toBe(412);
		expect(await res.text()).toBe("<p>Precondition Failed</p>");
	});

	test("payloadTooLarge returns 413 with HTML body", async () => {
		let res = payloadTooLarge("<p>Payload Too Large</p>");
		expect(res.status).toBe(413);
		expect(await res.text()).toBe("<p>Payload Too Large</p>");
	});

	test("unsupportedMediaType returns 415 with HTML body", async () => {
		let res = unsupportedMediaType("<p>Unsupported Media Type</p>");
		expect(res.status).toBe(415);
		expect(await res.text()).toBe("<p>Unsupported Media Type</p>");
	});

	test("unprocessableEntity returns 422 with HTML body", async () => {
		let res = unprocessableEntity("<p>Unprocessable Entity</p>");
		expect(res.status).toBe(422);
		expect(await res.text()).toBe("<p>Unprocessable Entity</p>");
	});

	test("tooManyRequests returns 429 with HTML body", async () => {
		let res = tooManyRequests("<p>Too Many Requests</p>");
		expect(res.status).toBe(429);
		expect(await res.text()).toBe("<p>Too Many Requests</p>");
	});
});

describe("5xx server errors", () => {
	test("internalServerError returns 500 with HTML body", async () => {
		let res = internalServerError("<h1>Server Error</h1>");
		expect(res.status).toBe(500);
		expect(await res.text()).toBe("<h1>Server Error</h1>");
	});

	test("notImplemented returns 501 with HTML body", async () => {
		let res = notImplemented("<p>Not Implemented</p>");
		expect(res.status).toBe(501);
		expect(await res.text()).toBe("<p>Not Implemented</p>");
	});

	test("badGateway returns 502 with HTML body", async () => {
		let res = badGateway("<p>Bad Gateway</p>");
		expect(res.status).toBe(502);
		expect(await res.text()).toBe("<p>Bad Gateway</p>");
	});

	test("serviceUnavailable returns 503 with HTML body", async () => {
		let res = serviceUnavailable("<p>Service Unavailable</p>");
		expect(res.status).toBe(503);
		expect(await res.text()).toBe("<p>Service Unavailable</p>");
	});

	test("gatewayTimeout returns 504 with HTML body", async () => {
		let res = gatewayTimeout("<p>Gateway Timeout</p>");
		expect(res.status).toBe(504);
		expect(await res.text()).toBe("<p>Gateway Timeout</p>");
	});
});

describe("custom headers", () => {
	test("ok accepts custom headers", () => {
		let res = ok("<p>Test</p>", { headers: { "X-Custom": "value" } });
		expect(res.headers.get("X-Custom")).toBe("value");
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
	});

	test("created accepts custom headers", () => {
		let res = created("<p>Test</p>", {
			headers: { "X-Request-Id": "123" },
		});
		expect(res.headers.get("X-Request-Id")).toBe("123");
	});

	test("notFound accepts custom headers", () => {
		let res = notFound("<p>Test</p>", {
			headers: { "Cache-Control": "no-store" },
		});
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	test("internalServerError accepts custom headers", () => {
		let res = internalServerError("<p>Test</p>", {
			headers: { "X-Error-Id": "err-456" },
		});
		expect(res.headers.get("X-Error-Id")).toBe("err-456");
	});

	test("badRequest accepts custom headers", () => {
		let res = badRequest("<p>Test</p>", {
			headers: { "X-Validation-Error": "true" },
		});
		expect(res.headers.get("X-Validation-Error")).toBe("true");
	});

	test("unauthorized accepts custom headers", () => {
		let res = unauthorized("<p>Test</p>", {
			headers: { "WWW-Authenticate": "Bearer" },
		});
		expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
	});

	test("tooManyRequests accepts custom headers", () => {
		let res = tooManyRequests("<p>Test</p>", {
			headers: { "Retry-After": "3600" },
		});
		expect(res.headers.get("Retry-After")).toBe("3600");
	});

	test("serviceUnavailable accepts custom headers", () => {
		let res = serviceUnavailable("<p>Test</p>", {
			headers: { "Retry-After": "300" },
		});
		expect(res.headers.get("Retry-After")).toBe("300");
	});
});
