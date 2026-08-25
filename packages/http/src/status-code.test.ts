/**
 * Tests for the StatusCode constants, verifying each code's numeric status
 * and status text and that all codes satisfy the StatusCode type.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { StatusCode as StatusCodeType } from "./status-code";

import * as StatusCode from "./status-code";

describe("1xx informational", () => {
	test("Continue has status 100", () => {
		expect(StatusCode.Continue.status).toBe(100);
		expect(StatusCode.Continue.statusText).toBe("Continue");
	});

	test("SwitchingProtocols has status 101", () => {
		expect(StatusCode.SwitchingProtocols.status).toBe(101);
		expect(StatusCode.SwitchingProtocols.statusText).toBe("Switching Protocols");
	});
});

describe("2xx success", () => {
	test("Ok has status 200", () => {
		expect(StatusCode.Ok.status).toBe(200);
		expect(StatusCode.Ok.statusText).toBe("OK");
	});

	test("Created has status 201", () => {
		expect(StatusCode.Created.status).toBe(201);
		expect(StatusCode.Created.statusText).toBe("Created");
	});

	test("Accepted has status 202", () => {
		expect(StatusCode.Accepted.status).toBe(202);
		expect(StatusCode.Accepted.statusText).toBe("Accepted");
	});

	test("NoContent has status 204", () => {
		expect(StatusCode.NoContent.status).toBe(204);
		expect(StatusCode.NoContent.statusText).toBe("No Content");
	});

	test("ResetContent has status 205", () => {
		expect(StatusCode.ResetContent.status).toBe(205);
		expect(StatusCode.ResetContent.statusText).toBe("Reset Content");
	});

	test("PartialContent has status 206", () => {
		expect(StatusCode.PartialContent.status).toBe(206);
		expect(StatusCode.PartialContent.statusText).toBe("Partial Content");
	});
});

describe("3xx redirection", () => {
	test("MultipleChoices has status 300", () => {
		expect(StatusCode.MultipleChoices.status).toBe(300);
		expect(StatusCode.MultipleChoices.statusText).toBe("Multiple Choices");
	});

	test("MovedPermanently has status 301", () => {
		expect(StatusCode.MovedPermanently.status).toBe(301);
		expect(StatusCode.MovedPermanently.statusText).toBe("Moved Permanently");
	});

	test("Found has status 302", () => {
		expect(StatusCode.Found.status).toBe(302);
		expect(StatusCode.Found.statusText).toBe("Found");
	});

	test("SeeOther has status 303", () => {
		expect(StatusCode.SeeOther.status).toBe(303);
		expect(StatusCode.SeeOther.statusText).toBe("See Other");
	});

	test("NotModified has status 304", () => {
		expect(StatusCode.NotModified.status).toBe(304);
		expect(StatusCode.NotModified.statusText).toBe("Not Modified");
	});

	test("TemporaryRedirect has status 307", () => {
		expect(StatusCode.TemporaryRedirect.status).toBe(307);
		expect(StatusCode.TemporaryRedirect.statusText).toBe("Temporary Redirect");
	});

	test("PermanentRedirect has status 308", () => {
		expect(StatusCode.PermanentRedirect.status).toBe(308);
		expect(StatusCode.PermanentRedirect.statusText).toBe("Permanent Redirect");
	});
});

describe("4xx client errors", () => {
	test("BadRequest has status 400", () => {
		expect(StatusCode.BadRequest.status).toBe(400);
		expect(StatusCode.BadRequest.statusText).toBe("Bad Request");
	});

	test("Unauthorized has status 401", () => {
		expect(StatusCode.Unauthorized.status).toBe(401);
		expect(StatusCode.Unauthorized.statusText).toBe("Unauthorized");
	});

	test("PaymentRequired has status 402", () => {
		expect(StatusCode.PaymentRequired.status).toBe(402);
		expect(StatusCode.PaymentRequired.statusText).toBe("Payment Required");
	});

	test("Forbidden has status 403", () => {
		expect(StatusCode.Forbidden.status).toBe(403);
		expect(StatusCode.Forbidden.statusText).toBe("Forbidden");
	});

	test("NotFound has status 404", () => {
		expect(StatusCode.NotFound.status).toBe(404);
		expect(StatusCode.NotFound.statusText).toBe("Not Found");
	});

	test("MethodNotAllowed has status 405", () => {
		expect(StatusCode.MethodNotAllowed.status).toBe(405);
		expect(StatusCode.MethodNotAllowed.statusText).toBe("Method Not Allowed");
	});

	test("NotAcceptable has status 406", () => {
		expect(StatusCode.NotAcceptable.status).toBe(406);
		expect(StatusCode.NotAcceptable.statusText).toBe("Not Acceptable");
	});

	test("ProxyAuthRequired has status 407", () => {
		expect(StatusCode.ProxyAuthRequired.status).toBe(407);
		expect(StatusCode.ProxyAuthRequired.statusText).toBe("Proxy Authentication Required");
	});

	test("RequestTimeout has status 408", () => {
		expect(StatusCode.RequestTimeout.status).toBe(408);
		expect(StatusCode.RequestTimeout.statusText).toBe("Request Timeout");
	});

	test("Conflict has status 409", () => {
		expect(StatusCode.Conflict.status).toBe(409);
		expect(StatusCode.Conflict.statusText).toBe("Conflict");
	});

	test("Gone has status 410", () => {
		expect(StatusCode.Gone.status).toBe(410);
		expect(StatusCode.Gone.statusText).toBe("Gone");
	});

	test("LengthRequired has status 411", () => {
		expect(StatusCode.LengthRequired.status).toBe(411);
		expect(StatusCode.LengthRequired.statusText).toBe("Length Required");
	});

	test("PreconditionFailed has status 412", () => {
		expect(StatusCode.PreconditionFailed.status).toBe(412);
		expect(StatusCode.PreconditionFailed.statusText).toBe("Precondition Failed");
	});

	test("PayloadTooLarge has status 413", () => {
		expect(StatusCode.PayloadTooLarge.status).toBe(413);
		expect(StatusCode.PayloadTooLarge.statusText).toBe("Payload Too Large");
	});

	test("URITooLong has status 414", () => {
		expect(StatusCode.URITooLong.status).toBe(414);
		expect(StatusCode.URITooLong.statusText).toBe("URI Too Long");
	});

	test("UnsupportedMediaType has status 415", () => {
		expect(StatusCode.UnsupportedMediaType.status).toBe(415);
		expect(StatusCode.UnsupportedMediaType.statusText).toBe("Unsupported Media Type");
	});

	test("RangeNotSatisfiable has status 416", () => {
		expect(StatusCode.RangeNotSatisfiable.status).toBe(416);
		expect(StatusCode.RangeNotSatisfiable.statusText).toBe("Range Not Satisfiable");
	});

	test("ExpectationFailed has status 417", () => {
		expect(StatusCode.ExpectationFailed.status).toBe(417);
		expect(StatusCode.ExpectationFailed.statusText).toBe("Expectation Failed");
	});

	test("ImATeapot has status 418", () => {
		expect(StatusCode.ImATeapot.status).toBe(418);
		expect(StatusCode.ImATeapot.statusText).toBe("I'm a teapot");
	});

	test("UnprocessableEntity has status 422", () => {
		expect(StatusCode.UnprocessableEntity.status).toBe(422);
		expect(StatusCode.UnprocessableEntity.statusText).toBe("Unprocessable Entity");
	});

	test("TooEarly has status 425", () => {
		expect(StatusCode.TooEarly.status).toBe(425);
		expect(StatusCode.TooEarly.statusText).toBe("Too Early");
	});

	test("UpgradeRequired has status 426", () => {
		expect(StatusCode.UpgradeRequired.status).toBe(426);
		expect(StatusCode.UpgradeRequired.statusText).toBe("Upgrade Required");
	});

	test("PreconditionRequired has status 428", () => {
		expect(StatusCode.PreconditionRequired.status).toBe(428);
		expect(StatusCode.PreconditionRequired.statusText).toBe("Precondition Required");
	});

	test("TooManyRequests has status 429", () => {
		expect(StatusCode.TooManyRequests.status).toBe(429);
		expect(StatusCode.TooManyRequests.statusText).toBe("Too Many Requests");
	});

	test("RequestHeaderFieldsTooLarge has status 431", () => {
		expect(StatusCode.RequestHeaderFieldsTooLarge.status).toBe(431);
		expect(StatusCode.RequestHeaderFieldsTooLarge.statusText).toBe(
			"Request Header Fields Too Large",
		);
	});

	test("UnavailableForLegalReasons has status 451", () => {
		expect(StatusCode.UnavailableForLegalReasons.status).toBe(451);
		expect(StatusCode.UnavailableForLegalReasons.statusText).toBe("Unavailable For Legal Reasons");
	});
});

describe("5xx server errors", () => {
	test("InternalServerError has status 500", () => {
		expect(StatusCode.InternalServerError.status).toBe(500);
		expect(StatusCode.InternalServerError.statusText).toBe("Internal Server Error");
	});

	test("NotImplemented has status 501", () => {
		expect(StatusCode.NotImplemented.status).toBe(501);
		expect(StatusCode.NotImplemented.statusText).toBe("Not Implemented");
	});

	test("BadGateway has status 502", () => {
		expect(StatusCode.BadGateway.status).toBe(502);
		expect(StatusCode.BadGateway.statusText).toBe("Bad Gateway");
	});

	test("ServiceUnavailable has status 503", () => {
		expect(StatusCode.ServiceUnavailable.status).toBe(503);
		expect(StatusCode.ServiceUnavailable.statusText).toBe("Service Unavailable");
	});

	test("GatewayTimeout has status 504", () => {
		expect(StatusCode.GatewayTimeout.status).toBe(504);
		expect(StatusCode.GatewayTimeout.statusText).toBe("Gateway Timeout");
	});

	test("HTTPVersionNotSupported has status 505", () => {
		expect(StatusCode.HTTPVersionNotSupported.status).toBe(505);
		expect(StatusCode.HTTPVersionNotSupported.statusText).toBe("HTTP Version Not Supported");
	});
});

describe("StatusCode type", () => {
	test("constants satisfy StatusCode type", () => {
		let statusCode: StatusCodeType = StatusCode.Ok;
		expect(statusCode.status).toBe(200);
		expect(statusCode.statusText).toBe("OK");
	});

	test("all status codes satisfy StatusCode type", () => {
		let codes: StatusCodeType[] = [
			StatusCode.Continue,
			StatusCode.SwitchingProtocols,
			StatusCode.Ok,
			StatusCode.Created,
			StatusCode.Accepted,
			StatusCode.NoContent,
			StatusCode.ResetContent,
			StatusCode.PartialContent,
			StatusCode.MultipleChoices,
			StatusCode.MovedPermanently,
			StatusCode.Found,
			StatusCode.SeeOther,
			StatusCode.NotModified,
			StatusCode.TemporaryRedirect,
			StatusCode.PermanentRedirect,
			StatusCode.BadRequest,
			StatusCode.Unauthorized,
			StatusCode.PaymentRequired,
			StatusCode.Forbidden,
			StatusCode.NotFound,
			StatusCode.MethodNotAllowed,
			StatusCode.NotAcceptable,
			StatusCode.ProxyAuthRequired,
			StatusCode.RequestTimeout,
			StatusCode.Conflict,
			StatusCode.Gone,
			StatusCode.LengthRequired,
			StatusCode.PreconditionFailed,
			StatusCode.PayloadTooLarge,
			StatusCode.URITooLong,
			StatusCode.UnsupportedMediaType,
			StatusCode.RangeNotSatisfiable,
			StatusCode.ExpectationFailed,
			StatusCode.ImATeapot,
			StatusCode.UnprocessableEntity,
			StatusCode.TooEarly,
			StatusCode.UpgradeRequired,
			StatusCode.PreconditionRequired,
			StatusCode.TooManyRequests,
			StatusCode.RequestHeaderFieldsTooLarge,
			StatusCode.UnavailableForLegalReasons,
			StatusCode.InternalServerError,
			StatusCode.NotImplemented,
			StatusCode.BadGateway,
			StatusCode.ServiceUnavailable,
			StatusCode.GatewayTimeout,
			StatusCode.HTTPVersionNotSupported,
		];

		for (let code of codes) {
			expect(typeof code.status).toBe("number");
			expect(typeof code.statusText).toBe("string");
		}
	});
});
