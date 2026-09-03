/**
 * HTML response helpers, one per HTTP status code, pairing an HTML body with
 * its matching status and status text.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { html } from "../response.js";
import * as StatusCode from "../status-code.js";

type Init = Omit<ResponseInit, "status" | "statusText">;

/**
 * Creates an HTML response with HTTP 200 OK status.
 * Use for successful requests that return HTML content.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 200 status
 * @example
 * return ok("<h1>Welcome</h1>");
 * @example
 * return ok(renderHomePage(), { headers: { "Cache-Control": "max-age=3600" } });
 */
export function ok(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.Ok });
}

/**
 * Creates an HTML response with HTTP 201 Created status.
 * Use for successful resource creation that returns HTML confirmation.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 201 status
 * @example
 * return created("<h1>Account Created</h1>");
 * @example
 * return created(renderSuccessPage({ message: "Your account has been created" }));
 */
export function created(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.Created });
}

/**
 * Creates an HTML response with HTTP 202 Accepted status.
 * Use when a request has been accepted for processing but not yet completed.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 202 status
 * @example
 * return accepted("<h1>Request Accepted</h1>");
 * @example
 * return accepted(renderProcessingPage({ jobId: "123" }));
 */
export function accepted(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.Accepted });
}

/**
 * Creates an HTML response with HTTP 400 Bad Request status.
 * Use when the request is malformed or contains invalid data.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 400 status
 * @example
 * return badRequest("<h1>Bad Request</h1>");
 * @example
 * return badRequest(renderErrorPage({ code: 400, message: "Invalid input" }));
 */
export function badRequest(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.BadRequest });
}

/**
 * Creates an HTML response with HTTP 401 Unauthorized status.
 * Use when authentication is required but missing or invalid.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 401 status
 * @example
 * return unauthorized("<h1>Please Log In</h1>");
 * @example
 * return unauthorized(renderLoginPage({ redirect: "/dashboard" }));
 */
export function unauthorized(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.Unauthorized });
}

/**
 * Creates an HTML response with HTTP 402 Payment Required status.
 * Use when payment is required to access the requested resource.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 402 status
 * @example
 * return paymentRequired("<h1>Payment Required</h1>");
 * @example
 * return paymentRequired(renderPaywallPage({ feature: "premium" }));
 */
export function paymentRequired(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.PaymentRequired });
}

/**
 * Creates an HTML response with HTTP 403 Forbidden status.
 * Use when the user lacks permission to access the resource.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 403 status
 * @example
 * return forbidden("<h1>Access Denied</h1>");
 * @example
 * return forbidden(renderErrorPage({ code: 403, message: "You don't have permission" }));
 */
export function forbidden(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.Forbidden });
}

/**
 * Creates an HTML response with HTTP 404 Not Found status.
 * Use for rendering custom "not found" pages.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 404 status
 * @example
 * return notFound("<h1>Page Not Found</h1>");
 * @example
 * return notFound(renderErrorPage({ code: 404, message: "Not Found" }));
 */
export function notFound(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.NotFound });
}

/**
 * Creates an HTML response with HTTP 405 Method Not Allowed status.
 * Use when the HTTP method is not supported for the requested resource.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 405 status
 * @example
 * return methodNotAllowed("<h1>Method Not Allowed</h1>");
 * @example
 * return methodNotAllowed(renderErrorPage({ code: 405, message: "POST not supported" }));
 */
export function methodNotAllowed(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.MethodNotAllowed });
}

/**
 * Creates an HTML response with HTTP 406 Not Acceptable status.
 * Use when the server cannot produce a response matching acceptable values.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 406 status
 * @example
 * return notAcceptable("<h1>Not Acceptable</h1>");
 * @example
 * return notAcceptable(renderErrorPage({ code: 406, message: "Cannot produce requested format" }));
 */
export function notAcceptable(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.NotAcceptable });
}

/**
 * Creates an HTML response with HTTP 409 Conflict status.
 * Use when the request conflicts with the current state of the resource.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 409 status
 * @example
 * return conflict("<h1>Conflict</h1>");
 * @example
 * return conflict(renderErrorPage({ code: 409, message: "Resource already exists" }));
 */
export function conflict(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.Conflict });
}

/**
 * Creates an HTML response with HTTP 410 Gone status.
 * Use when the resource is no longer available and will not return.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 410 status
 * @example
 * return gone("<h1>Resource Gone</h1>");
 * @example
 * return gone(renderErrorPage({ code: 410, message: "This page has been permanently removed" }));
 */
export function gone(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.Gone });
}

/**
 * Creates an HTML response with HTTP 412 Precondition Failed status.
 * Use when preconditions in request headers are not met.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 412 status
 * @example
 * return preconditionFailed("<h1>Precondition Failed</h1>");
 * @example
 * return preconditionFailed(renderErrorPage({ code: 412, message: "ETag mismatch" }));
 */
export function preconditionFailed(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.PreconditionFailed });
}

/**
 * Creates an HTML response with HTTP 413 Payload Too Large status.
 * Use when the request payload exceeds server limits.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 413 status
 * @example
 * return payloadTooLarge("<h1>File Too Large</h1>");
 * @example
 * return payloadTooLarge(renderErrorPage({ code: 413, message: "Maximum file size is 10MB" }));
 */
export function payloadTooLarge(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.PayloadTooLarge });
}

/**
 * Creates an HTML response with HTTP 415 Unsupported Media Type status.
 * Use when the request content type is not supported.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 415 status
 * @example
 * return unsupportedMediaType("<h1>Unsupported Media Type</h1>");
 * @example
 * return unsupportedMediaType(renderErrorPage({ code: 415, message: "Only JSON is accepted" }));
 */
export function unsupportedMediaType(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.UnsupportedMediaType });
}

/**
 * Creates an HTML response with HTTP 422 Unprocessable Entity status.
 * Use when the request is well-formed but contains semantic errors.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 422 status
 * @example
 * return unprocessableEntity("<h1>Validation Error</h1>");
 * @example
 * return unprocessableEntity(renderFormErrors({ errors: validationErrors }));
 */
export function unprocessableEntity(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.UnprocessableEntity });
}

/**
 * Creates an HTML response with HTTP 429 Too Many Requests status.
 * Use when the user has exceeded rate limits.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 429 status
 * @example
 * return tooManyRequests("<h1>Too Many Requests</h1>");
 * @example
 * return tooManyRequests(renderErrorPage({ code: 429, message: "Please try again later" }));
 */
export function tooManyRequests(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.TooManyRequests });
}

/**
 * Creates an HTML response with HTTP 500 Internal Server Error status.
 * Use for unexpected server errors when rendering error pages.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 500 status
 * @example
 * return internalServerError("<h1>Something Went Wrong</h1>");
 * @example
 * return internalServerError(renderErrorPage({ code: 500, message: "Internal Server Error" }));
 */
export function internalServerError(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.InternalServerError });
}

/**
 * Creates an HTML response with HTTP 501 Not Implemented status.
 * Use when the server does not support the requested functionality.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 501 status
 * @example
 * return notImplemented("<h1>Not Implemented</h1>");
 * @example
 * return notImplemented(renderErrorPage({ code: 501, message: "Feature coming soon" }));
 */
export function notImplemented(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.NotImplemented });
}

/**
 * Creates an HTML response with HTTP 502 Bad Gateway status.
 * Use when an upstream server returns an invalid response.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 502 status
 * @example
 * return badGateway("<h1>Bad Gateway</h1>");
 * @example
 * return badGateway(renderErrorPage({ code: 502, message: "Upstream server error" }));
 */
export function badGateway(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.BadGateway });
}

/**
 * Creates an HTML response with HTTP 503 Service Unavailable status.
 * Use when the server is temporarily unavailable (maintenance, overload).
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 503 status
 * @example
 * return serviceUnavailable("<h1>Service Unavailable</h1>");
 * @example
 * return serviceUnavailable(renderMaintenancePage({ estimatedTime: "2 hours" }));
 */
export function serviceUnavailable(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.ServiceUnavailable });
}

/**
 * Creates an HTML response with HTTP 504 Gateway Timeout status.
 * Use when an upstream server fails to respond in time.
 * @param body - The HTML string to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with HTML body and 504 status
 * @example
 * return gatewayTimeout("<h1>Gateway Timeout</h1>");
 * @example
 * return gatewayTimeout(renderErrorPage({ code: 504, message: "Request timed out" }));
 */
export function gatewayTimeout(body: string, init?: Init): Response {
	return html(body, { ...init, ...StatusCode.GatewayTimeout });
}
