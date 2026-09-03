/**
 * JSON response helpers, one per HTTP status code, pairing a JSON body with
 * its matching status and status text.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "../response.js";
import * as StatusCode from "../status-code.js";

type Init = Omit<ResponseInit, "status" | "statusText">;

/**
 * Creates a JSON response with HTTP 200 OK status.
 * Use for successful requests that return data.
 * @param body - The JSON data to send
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 200 status
 * @example
 * return ok({ user: { id: 1, name: "John" } });
 * @example
 * return ok({ message: "Operation successful" }, { headers: { "X-Custom": "value" } });
 */
export function ok<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.Ok });
}

/**
 * Creates a JSON response with HTTP 201 Created status.
 * Use when a new resource has been successfully created.
 * @param body - The JSON data to send (typically the created resource)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 201 status
 * @example
 * return created({ id: 123, name: "New Item" });
 * @example
 * return created({ user: newUser }, { headers: { Location: `/users/${newUser.id}` } });
 */
export function created<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.Created });
}

/**
 * Creates a JSON response with HTTP 202 Accepted status.
 * Use when a request has been accepted for processing but not yet completed.
 * @param body - The JSON data to send (typically processing status)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 202 status
 * @example
 * return accepted({ jobId: "abc123", status: "processing" });
 * @example
 * return accepted({ message: "Request queued", estimatedTime: "5 minutes" });
 */
export function accepted<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.Accepted });
}

/**
 * Creates a JSON response with HTTP 400 Bad Request status.
 * Use when the request is malformed or contains invalid data.
 * @param body - The JSON data to send (typically error details)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 400 status
 * @example
 * return badRequest({ error: "Invalid email format" });
 * @example
 * return badRequest({ errors: [{ field: "email", message: "Required" }] });
 */
export function badRequest<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.BadRequest });
}

/**
 * Creates a JSON response with HTTP 401 Unauthorized status.
 * Use when authentication is required but missing or invalid.
 * @param body - The JSON data to send (typically error message)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 401 status
 * @example
 * return unauthorized({ error: "Invalid credentials" });
 * @example
 * return unauthorized({ error: "Token expired", code: "TOKEN_EXPIRED" });
 */
export function unauthorized<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.Unauthorized });
}

/**
 * Creates a JSON response with HTTP 402 Payment Required status.
 * Use when payment is required to access the resource.
 * @param body - The JSON data to send (typically payment details)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 402 status
 * @example
 * return paymentRequired({ error: "Subscription required" });
 * @example
 * return paymentRequired({ error: "Credit limit exceeded", upgradeUrl: "/billing" });
 */
export function paymentRequired<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.PaymentRequired });
}

/**
 * Creates a JSON response with HTTP 403 Forbidden status.
 * Use when the user is authenticated but lacks permission.
 * @param body - The JSON data to send (typically error message)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 403 status
 * @example
 * return forbidden({ error: "Access denied" });
 * @example
 * return forbidden({ error: "Admin privileges required", requiredRole: "admin" });
 */
export function forbidden<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.Forbidden });
}

/**
 * Creates a JSON response with HTTP 404 Not Found status.
 * Use when the requested resource does not exist.
 * @param body - The JSON data to send (typically error message)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 404 status
 * @example
 * return notFound({ error: "User not found" });
 * @example
 * return notFound({ error: "Post not found", id: postId });
 */
export function notFound<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.NotFound });
}

/**
 * Creates a JSON response with HTTP 405 Method Not Allowed status.
 * Use when the HTTP method is not supported for the resource.
 * @param body - The JSON data to send (typically allowed methods)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 405 status
 * @example
 * return methodNotAllowed({ error: "POST not allowed", allowed: ["GET", "PUT"] });
 * @example
 * return methodNotAllowed({ error: "Method not supported" });
 */
export function methodNotAllowed<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.MethodNotAllowed });
}

/**
 * Creates a JSON response with HTTP 406 Not Acceptable status.
 * Use when the server cannot produce a response matching the Accept headers.
 * @param body - The JSON data to send (typically available formats)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 406 status
 * @example
 * return notAcceptable({ error: "Cannot produce requested format" });
 * @example
 * return notAcceptable({ available: ["application/json", "text/html"] });
 */
export function notAcceptable<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.NotAcceptable });
}

/**
 * Creates a JSON response with HTTP 409 Conflict status.
 * Use when the request conflicts with the current state of the resource.
 * @param body - The JSON data to send (typically conflict details)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 409 status
 * @example
 * return conflict({ error: "Email already exists" });
 * @example
 * return conflict({ error: "Version mismatch", currentVersion: 5 });
 */
export function conflict<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.Conflict });
}

/**
 * Creates a JSON response with HTTP 410 Gone status.
 * Use when the resource existed but has been permanently removed.
 * @param body - The JSON data to send (typically removal info)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 410 status
 * @example
 * return gone({ error: "Resource has been deleted" });
 * @example
 * return gone({ error: "API version deprecated", migrateUrl: "/v2" });
 */
export function gone<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.Gone });
}

/**
 * Creates a JSON response with HTTP 412 Precondition Failed status.
 * Use when a precondition header (If-Match, etc.) evaluates to false.
 * @param body - The JSON data to send (typically precondition details)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 412 status
 * @example
 * return preconditionFailed({ error: "ETag mismatch" });
 * @example
 * return preconditionFailed({ error: "Resource modified", currentETag: "abc123" });
 */
export function preconditionFailed<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.PreconditionFailed });
}

/**
 * Creates a JSON response with HTTP 413 Payload Too Large status.
 * Use when the request body exceeds the server's size limit.
 * @param body - The JSON data to send (typically size limits)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 413 status
 * @example
 * return payloadTooLarge({ error: "File too large", maxSize: "10MB" });
 * @example
 * return payloadTooLarge({ error: "Request body exceeds limit" });
 */
export function payloadTooLarge<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.PayloadTooLarge });
}

/**
 * Creates a JSON response with HTTP 415 Unsupported Media Type status.
 * Use when the request Content-Type is not supported.
 * @param body - The JSON data to send (typically supported types)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 415 status
 * @example
 * return unsupportedMediaType({ error: "Content-Type not supported" });
 * @example
 * return unsupportedMediaType({ supported: ["application/json", "multipart/form-data"] });
 */
export function unsupportedMediaType<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.UnsupportedMediaType });
}

/**
 * Creates a JSON response with HTTP 422 Unprocessable Entity status.
 * Use when the request is well-formed but contains semantic errors.
 * @param body - The JSON data to send (typically validation errors)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 422 status
 * @example
 * return unprocessableEntity({ errors: { email: "Invalid format" } });
 * @example
 * return unprocessableEntity({ error: "Start date must be before end date" });
 */
export function unprocessableEntity<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.UnprocessableEntity });
}

/**
 * Creates a JSON response with HTTP 429 Too Many Requests status.
 * Use when the client has exceeded the rate limit.
 * @param body - The JSON data to send (typically rate limit info)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 429 status
 * @example
 * return tooManyRequests({ error: "Rate limit exceeded", retryAfter: 60 });
 * @example
 * return tooManyRequests({ error: "Too many requests", limit: 100, window: "1h" });
 */
export function tooManyRequests<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.TooManyRequests });
}

/**
 * Creates a JSON response with HTTP 500 Internal Server Error status.
 * Use when an unexpected server error occurs.
 * @param body - The JSON data to send (typically generic error message)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 500 status
 * @example
 * return internalServerError({ error: "Something went wrong" });
 * @example
 * return internalServerError({ error: "Internal error", requestId: "abc123" });
 */
export function internalServerError<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.InternalServerError });
}

/**
 * Creates a JSON response with HTTP 501 Not Implemented status.
 * Use when the server does not support the requested functionality.
 * @param body - The JSON data to send (typically feature status)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 501 status
 * @example
 * return notImplemented({ error: "Feature not implemented" });
 * @example
 * return notImplemented({ error: "Coming soon", plannedRelease: "Q2 2024" });
 */
export function notImplemented<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.NotImplemented });
}

/**
 * Creates a JSON response with HTTP 502 Bad Gateway status.
 * Use when an upstream server returned an invalid response.
 * @param body - The JSON data to send (typically upstream error info)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 502 status
 * @example
 * return badGateway({ error: "Upstream server error" });
 * @example
 * return badGateway({ error: "Invalid response from payment provider" });
 */
export function badGateway<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.BadGateway });
}

/**
 * Creates a JSON response with HTTP 503 Service Unavailable status.
 * Use when the server is temporarily unavailable (maintenance, overload).
 * @param body - The JSON data to send (typically availability info)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 503 status
 * @example
 * return serviceUnavailable({ error: "Service under maintenance" });
 * @example
 * return serviceUnavailable({ error: "Server overloaded", retryAfter: 300 });
 */
export function serviceUnavailable<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.ServiceUnavailable });
}

/**
 * Creates a JSON response with HTTP 504 Gateway Timeout status.
 * Use when an upstream server did not respond in time.
 * @param body - The JSON data to send (typically timeout info)
 * @param init - Optional response options (headers, etc.)
 * @returns A Response with JSON body and 504 status
 * @example
 * return gatewayTimeout({ error: "Upstream server timeout" });
 * @example
 * return gatewayTimeout({ error: "Database connection timeout", timeout: "30s" });
 */
export function gatewayTimeout<T>(body: T, init?: Init): Response {
	return json(body, { ...init, ...StatusCode.GatewayTimeout });
}
