/**
 * HTTP status code constants, each pairing a numeric status with its
 * standard status text for use as a `Response` init.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * HTTP 100 Continue status.
 * Indicates the initial part of a request has been received and the client
 * should continue with the request or ignore if already complete.
 * @example
 * return new Response(null, Continue);
 * @example
 * return Response.json({ message: "Continue sending" }, Continue);
 */
export const Continue = { status: 100, statusText: "Continue" } as const;

/**
 * HTTP 101 Switching Protocols status.
 * Indicates the server is switching to a different protocol as requested
 * by the client via the Upgrade header.
 * @example
 * return new Response(null, SwitchingProtocols);
 * @example
 * return new Response(null, { ...SwitchingProtocols, headers: { Upgrade: "websocket" } });
 */
export const SwitchingProtocols = { status: 101, statusText: "Switching Protocols" } as const;

/**
 * HTTP 200 OK status.
 * Indicates the request succeeded. The meaning varies by HTTP method:
 * GET returns the resource, POST returns the result of the action.
 * @example
 * return new Response(null, Ok);
 * @example
 * return Response.json({ data: result }, Ok);
 */
export const Ok = { status: 200, statusText: "OK" } as const;

/**
 * HTTP 201 Created status.
 * Indicates the request succeeded and a new resource was created.
 * Typically used after POST or PUT requests.
 * @example
 * return new Response(null, Created);
 * @example
 * return Response.json({ id: newUser.id }, Created);
 */
export const Created = { status: 201, statusText: "Created" } as const;

/**
 * HTTP 202 Accepted status.
 * Indicates the request has been accepted for processing but processing
 * has not been completed. Used for asynchronous operations.
 * @example
 * return new Response(null, Accepted);
 * @example
 * return Response.json({ jobId: "abc123" }, Accepted);
 */
export const Accepted = { status: 202, statusText: "Accepted" } as const;

/**
 * HTTP 204 No Content status.
 * Indicates the request succeeded but there is no content to return.
 * Commonly used for DELETE operations or updates that don't return data.
 * @example
 * return new Response(null, NoContent);
 * @example
 * await deleteUser(id); return new Response(null, NoContent);
 */
export const NoContent = { status: 204, statusText: "No Content" } as const;

/**
 * HTTP 205 Reset Content status.
 * Indicates the request succeeded and the client should reset the document
 * view. Used to clear forms after submission.
 * @example
 * return new Response(null, ResetContent);
 * @example
 * await submitForm(data); return new Response(null, ResetContent);
 */
export const ResetContent = { status: 205, statusText: "Reset Content" } as const;

/**
 * HTTP 206 Partial Content status.
 * Indicates the server is delivering only part of the resource due to a
 * range header sent by the client. Used for resumable downloads.
 * @example
 * return new Response(chunk, PartialContent);
 * @example
 * return new Response(videoChunk, { ...PartialContent, headers: { "Content-Range": "bytes 0-999/5000" } });
 */
export const PartialContent = { status: 206, statusText: "Partial Content" } as const;

/**
 * HTTP 300 Multiple Choices status.
 * Indicates multiple options for the resource. The client may choose one
 * or the server may provide a preferred option.
 * @example
 * return new Response(null, MultipleChoices);
 * @example
 * return Response.json({ options: ["/en/page", "/es/page"] }, MultipleChoices);
 */
export const MultipleChoices = { status: 300, statusText: "Multiple Choices" } as const;

/**
 * HTTP 301 Moved Permanently status.
 * Indicates the resource has been permanently moved to a new URL.
 * Search engines will update their links to the new location.
 * @example
 * return new Response(null, { ...MovedPermanently, headers: { Location: "/new-path" } });
 * @example
 * return Response.redirect("/new-url", MovedPermanently.status);
 */
export const MovedPermanently = { status: 301, statusText: "Moved Permanently" } as const;

/**
 * HTTP 302 Found status.
 * Indicates the resource temporarily resides at a different URL.
 * The client should continue using the original URL for future requests.
 * @example
 * return new Response(null, { ...Found, headers: { Location: "/temp-path" } });
 * @example
 * return Response.redirect("/temporary-url", Found.status);
 */
export const Found = { status: 302, statusText: "Found" } as const;

/**
 * HTTP 303 See Other status.
 * Indicates the response can be found at another URL using a GET request.
 * Often used after POST to redirect to a confirmation page.
 * @example
 * return new Response(null, { ...SeeOther, headers: { Location: "/success" } });
 * @example
 * return Response.redirect("/confirmation", SeeOther.status);
 */
export const SeeOther = { status: 303, statusText: "See Other" } as const;

/**
 * HTTP 304 Not Modified status.
 * Indicates the resource has not been modified since the last request.
 * Used for caching when If-Modified-Since or If-None-Match headers are sent.
 * @example
 * return new Response(null, NotModified);
 * @example
 * if (etag === request.headers.get("If-None-Match")) return new Response(null, NotModified);
 */
export const NotModified = { status: 304, statusText: "Not Modified" } as const;

/**
 * HTTP 307 Temporary Redirect status.
 * Indicates a temporary redirect that preserves the request method.
 * @example
 * return new Response(null, { ...TemporaryRedirect, headers: { Location: "/temp" } });
 * @example
 * return Response.redirect("/maintenance", TemporaryRedirect.status);
 */
export const TemporaryRedirect = { status: 307, statusText: "Temporary Redirect" } as const;

/**
 * HTTP 308 Permanent Redirect status.
 * Indicates a permanent redirect that preserves the request method.
 * @example
 * return new Response(null, { ...PermanentRedirect, headers: { Location: "/new" } });
 * @example
 * return Response.redirect("/new-api", PermanentRedirect.status);
 */
export const PermanentRedirect = { status: 308, statusText: "Permanent Redirect" } as const;

/**
 * HTTP 400 Bad Request status.
 * Indicates the server cannot process the request due to client error,
 * such as malformed syntax or invalid parameters.
 * @example
 * return new Response(null, BadRequest);
 * @example
 * return Response.json({ error: "Invalid JSON" }, BadRequest);
 */
export const BadRequest = { status: 400, statusText: "Bad Request" } as const;

/**
 * HTTP 401 Unauthorized status.
 * Indicates the request requires authentication. The client must
 * authenticate itself to get the requested response.
 * @example
 * return new Response(null, Unauthorized);
 * @example
 * return Response.json({ error: "Login required" }, Unauthorized);
 */
export const Unauthorized = { status: 401, statusText: "Unauthorized" } as const;

/**
 * HTTP 402 Payment Required status.
 * Reserved for future use. Originally intended for digital payment systems,
 * sometimes used to indicate a feature requires payment.
 * @example
 * return new Response(null, PaymentRequired);
 * @example
 * return Response.json({ error: "Subscription required" }, PaymentRequired);
 */
export const PaymentRequired = { status: 402, statusText: "Payment Required" } as const;

/**
 * HTTP 403 Forbidden status.
 * Indicates the server understood the request but refuses to authorize it.
 * Unlike 401, authentication will not help.
 * @example
 * return new Response(null, Forbidden);
 * @example
 * return Response.json({ error: "Access denied" }, Forbidden);
 */
export const Forbidden = { status: 403, statusText: "Forbidden" } as const;

/**
 * HTTP 404 Not Found status.
 * Indicates the requested resource could not be found on the server.
 * The resource may have been removed or the URL is incorrect.
 * @example
 * return new Response(null, NotFound);
 * @example
 * return Response.json({ error: "User not found" }, NotFound);
 */
export const NotFound = { status: 404, statusText: "Not Found" } as const;

/**
 * HTTP 405 Method Not Allowed status.
 * Indicates the request method is not supported for the target resource.
 * The response must include an Allow header with valid methods.
 * @example
 * return new Response(null, MethodNotAllowed);
 * @example
 * return new Response(null, { ...MethodNotAllowed, headers: { Allow: "GET, POST" } });
 */
export const MethodNotAllowed = { status: 405, statusText: "Method Not Allowed" } as const;

/**
 * HTTP 406 Not Acceptable status.
 * Indicates the server cannot produce a response matching the Accept
 * headers sent by the client.
 * @example
 * return new Response(null, NotAcceptable);
 * @example
 * return Response.json({ error: "Cannot produce requested format" }, NotAcceptable);
 */
export const NotAcceptable = { status: 406, statusText: "Not Acceptable" } as const;

/**
 * HTTP 407 Proxy Authentication Required status.
 * Indicates the client must authenticate with a proxy server before
 * this request can be served.
 * @example
 * return new Response(null, ProxyAuthRequired);
 * @example
 * return new Response(null, { ...ProxyAuthRequired, headers: { "Proxy-Authenticate": "Basic" } });
 */
export const ProxyAuthRequired = {
	status: 407,
	statusText: "Proxy Authentication Required",
} as const;

/**
 * HTTP 408 Request Timeout status.
 * Indicates the server timed out waiting for the request. The client
 * may repeat the request without modifications.
 * @example
 * return new Response(null, RequestTimeout);
 * @example
 * return Response.json({ error: "Request took too long" }, RequestTimeout);
 */
export const RequestTimeout = { status: 408, statusText: "Request Timeout" } as const;

/**
 * HTTP 409 Conflict status.
 * Indicates the request conflicts with the current state of the server.
 * Often used for concurrent modification errors.
 * @example
 * return new Response(null, Conflict);
 * @example
 * return Response.json({ error: "Resource already exists" }, Conflict);
 */
export const Conflict = { status: 409, statusText: "Conflict" } as const;

/**
 * HTTP 410 Gone status.
 * Indicates the resource is no longer available and will not be available
 * again. Unlike 404, this is permanent.
 * @example
 * return new Response(null, Gone);
 * @example
 * return Response.json({ error: "Resource permanently removed" }, Gone);
 */
export const Gone = { status: 410, statusText: "Gone" } as const;

/**
 * HTTP 411 Length Required status.
 * Indicates the server requires a Content-Length header in the request.
 * The client should resend with the header included.
 * @example
 * return new Response(null, LengthRequired);
 * @example
 * return Response.json({ error: "Content-Length header required" }, LengthRequired);
 */
export const LengthRequired = { status: 411, statusText: "Length Required" } as const;

/**
 * HTTP 412 Precondition Failed status.
 * Indicates one or more conditions in the request headers evaluated to
 * false. Used with conditional requests.
 * @example
 * return new Response(null, PreconditionFailed);
 * @example
 * return Response.json({ error: "If-Match condition failed" }, PreconditionFailed);
 */
export const PreconditionFailed = { status: 412, statusText: "Precondition Failed" } as const;

/**
 * HTTP 413 Payload Too Large status.
 * Indicates the request entity is larger than the server is willing or
 * able to process.
 * @example
 * return new Response(null, PayloadTooLarge);
 * @example
 * return Response.json({ error: "File exceeds 10MB limit" }, PayloadTooLarge);
 */
export const PayloadTooLarge = { status: 413, statusText: "Payload Too Large" } as const;

/**
 * HTTP 414 URI Too Long status.
 * Indicates the URI requested by the client is longer than the server
 * is willing to interpret.
 * @example
 * return new Response(null, URITooLong);
 * @example
 * return Response.json({ error: "URL exceeds maximum length" }, URITooLong);
 */
export const URITooLong = { status: 414, statusText: "URI Too Long" } as const;

/**
 * HTTP 415 Unsupported Media Type status.
 * Indicates the media format of the request data is not supported by
 * the server.
 * @example
 * return new Response(null, UnsupportedMediaType);
 * @example
 * return Response.json({ error: "Content-Type must be application/json" }, UnsupportedMediaType);
 */
export const UnsupportedMediaType = { status: 415, statusText: "Unsupported Media Type" } as const;

/**
 * HTTP 416 Range Not Satisfiable status.
 * Indicates the range specified in the Range header cannot be fulfilled.
 * The range may be outside the target resource's size.
 * @example
 * return new Response(null, RangeNotSatisfiable);
 * @example
 * return new Response(null, { ...RangeNotSatisfiable, headers: { "Content-Range": "bytes 0-0/5000" } });
 */
export const RangeNotSatisfiable = { status: 416, statusText: "Range Not Satisfiable" } as const;

/**
 * HTTP 417 Expectation Failed status.
 * Indicates the expectation in the Expect request header cannot be met
 * by the server.
 * @example
 * return new Response(null, ExpectationFailed);
 * @example
 * return Response.json({ error: "Cannot meet expectation" }, ExpectationFailed);
 */
export const ExpectationFailed = { status: 417, statusText: "Expectation Failed" } as const;

/**
 * HTTP 418 I'm a teapot status.
 * A playful response defined in RFC 2324. The server refuses to brew
 * coffee because it is a teapot.
 * @example
 * return new Response(null, ImATeapot);
 * @example
 * return Response.json({ error: "I'm a teapot, not a coffee maker" }, ImATeapot);
 */
export const ImATeapot = { status: 418, statusText: "I'm a teapot" } as const;

/**
 * HTTP 422 Unprocessable Entity status.
 * Indicates the request was well-formed but contained semantic errors.
 * Commonly used for validation failures.
 * @example
 * return new Response(null, UnprocessableEntity);
 * @example
 * return Response.json({ errors: { email: "Invalid format" } }, UnprocessableEntity);
 */
export const UnprocessableEntity = { status: 422, statusText: "Unprocessable Entity" } as const;

/**
 * HTTP 425 Too Early status.
 * Indicates the server is unwilling to process a request that might be
 * replayed to avoid potential replay attacks.
 * @example
 * return new Response(null, TooEarly);
 * @example
 * return Response.json({ error: "Request sent too early" }, TooEarly);
 */
export const TooEarly = { status: 425, statusText: "Too Early" } as const;

/**
 * HTTP 426 Upgrade Required status.
 * Indicates the server refuses to perform the request using the current
 * protocol but might after the client upgrades.
 * @example
 * return new Response(null, UpgradeRequired);
 * @example
 * return new Response(null, { ...UpgradeRequired, headers: { Upgrade: "TLS/1.3" } });
 */
export const UpgradeRequired = { status: 426, statusText: "Upgrade Required" } as const;

/**
 * HTTP 428 Precondition Required status.
 * Indicates the server requires the request to be conditional to prevent
 * lost update problems.
 * @example
 * return new Response(null, PreconditionRequired);
 * @example
 * return Response.json({ error: "If-Match header required" }, PreconditionRequired);
 */
export const PreconditionRequired = { status: 428, statusText: "Precondition Required" } as const;

/**
 * HTTP 429 Too Many Requests status.
 * Indicates the user has sent too many requests in a given amount of time.
 * Used for rate limiting.
 * @example
 * return new Response(null, TooManyRequests);
 * @example
 * return new Response(null, { ...TooManyRequests, headers: { "Retry-After": "60" } });
 */
export const TooManyRequests = { status: 429, statusText: "Too Many Requests" } as const;

/**
 * HTTP 431 Request Header Fields Too Large status.
 * Indicates the server is unwilling to process the request because the
 * header fields are too large.
 * @example
 * return new Response(null, RequestHeaderFieldsTooLarge);
 * @example
 * return Response.json({ error: "Headers exceed size limit" }, RequestHeaderFieldsTooLarge);
 */
export const RequestHeaderFieldsTooLarge = {
	status: 431,
	statusText: "Request Header Fields Too Large",
} as const;

/**
 * HTTP 451 Unavailable For Legal Reasons status.
 * Indicates the resource is unavailable due to legal demands such as
 * censorship or government-mandated blocks.
 * @example
 * return new Response(null, UnavailableForLegalReasons);
 * @example
 * return Response.json({ error: "Content blocked in your region" }, UnavailableForLegalReasons);
 */
export const UnavailableForLegalReasons = {
	status: 451,
	statusText: "Unavailable For Legal Reasons",
} as const;

/**
 * HTTP 500 Internal Server Error status.
 * Indicates the server encountered an unexpected condition that prevented
 * it from fulfilling the request.
 * @example
 * return new Response(null, InternalServerError);
 * @example
 * return Response.json({ error: "Something went wrong" }, InternalServerError);
 */
export const InternalServerError = { status: 500, statusText: "Internal Server Error" } as const;

/**
 * HTTP 501 Not Implemented status.
 * Indicates the server does not support the functionality required to
 * fulfill the request.
 * @example
 * return new Response(null, NotImplemented);
 * @example
 * return Response.json({ error: "Feature not implemented" }, NotImplemented);
 */
export const NotImplemented = { status: 501, statusText: "Not Implemented" } as const;

/**
 * HTTP 502 Bad Gateway status.
 * Indicates the server received an invalid response from an upstream
 * server while acting as a gateway or proxy.
 * @example
 * return new Response(null, BadGateway);
 * @example
 * return Response.json({ error: "Upstream server error" }, BadGateway);
 */
export const BadGateway = { status: 502, statusText: "Bad Gateway" } as const;

/**
 * HTTP 503 Service Unavailable status.
 * Indicates the server is not ready to handle the request, often due to
 * maintenance or overload.
 * @example
 * return new Response(null, ServiceUnavailable);
 * @example
 * return new Response(null, { ...ServiceUnavailable, headers: { "Retry-After": "3600" } });
 */
export const ServiceUnavailable = { status: 503, statusText: "Service Unavailable" } as const;

/**
 * HTTP 504 Gateway Timeout status.
 * Indicates the server acting as a gateway did not receive a timely
 * response from the upstream server.
 * @example
 * return new Response(null, GatewayTimeout);
 * @example
 * return Response.json({ error: "Upstream server timed out" }, GatewayTimeout);
 */
export const GatewayTimeout = { status: 504, statusText: "Gateway Timeout" } as const;

/**
 * HTTP 505 HTTP Version Not Supported status.
 * Indicates the server does not support the HTTP protocol version used
 * in the request.
 * @example
 * return new Response(null, HTTPVersionNotSupported);
 * @example
 * return Response.json({ error: "HTTP version not supported" }, HTTPVersionNotSupported);
 */
export const HTTPVersionNotSupported = {
	status: 505,
	statusText: "HTTP Version Not Supported",
} as const;

/** Type representing any HTTP status code constant. */
export type StatusCode = { readonly status: number; readonly statusText: string };
