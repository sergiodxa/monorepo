import { RequestMethods } from "remix/fetch-router";

import middleware from "~/lib/middleware";

/**
 * Method override middleware that reads _method from query string OR form body.
 * 
 * This enables HTML forms (which only support GET/POST) to submit PUT/DELETE requests.
 * The _method parameter can be in:
 * - Query string: ?_method=PUT
 * - Form body: <input type="hidden" name="_method" value="PUT">
 * 
 * Note: Must be placed AFTER formData middleware to read from form body.
 */
export default middleware(async (context, next) => {
	// Check query string first
	let url = new URL(context.request.url);
	let methodFromQuery = url.searchParams.get("_method");
	
	// Then check form body (if formData middleware has run)
	let methodFromBody = context.formData?.get("_method");
	
	let methodOverride = methodFromQuery ?? methodFromBody;
	
	if (typeof methodOverride !== "string") {
		return next();
	}

	let method = methodOverride.toUpperCase();
	
	// Only allow valid HTTP methods
	if (RequestMethods.includes(method as (typeof RequestMethods)[number])) {
		context.method = method as (typeof RequestMethods)[number];
	}

	return next();
});
