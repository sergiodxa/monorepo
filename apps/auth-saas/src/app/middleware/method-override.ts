import middleware from "~/lib/middleware";

/**
 * Method override middleware that converts POST requests with _method query parameter
 * to the specified HTTP method (PUT, PATCH, DELETE).
 * 
 * This enables HTML forms (which only support GET/POST) to submit PUT/DELETE requests.
 * The _method parameter can be in the query string: ?_method=PUT
 */
export default middleware(async (context, next) => {
	let request = context.request;
	
	// Only override POST requests
	if (request.method !== "POST") {
		return next();
	}

	let url = new URL(request.url);
	let methodOverride = url.searchParams.get("_method");

	if (!methodOverride) {
		return next();
	}

	let method = methodOverride.toUpperCase();
	
	// Only allow safe method overrides
	if (!["PUT", "PATCH", "DELETE"].includes(method)) {
		return next();
	}

	// Remove _method from query string
	url.searchParams.delete("_method");

	// Create new request with overridden method
	let newRequest = new Request(url.toString(), {
		method,
		headers: request.headers,
		body: request.body,
		// @ts-expect-error duplex is required for streaming bodies
		duplex: "half",
	});

	// Replace request in context
	context.request = newRequest;

	return next();
});
