/**
 * Every problem the API answers with, by name. A handler returns `problems.<name>()` and the
 * OpenAPI document publishes each entry, so a client branches on a `type` the server declared.
 */

import * as s from "@sdxc/json-schema";
import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";

import { PROBLEMS_URL } from "~/config/constants";

export default defineProblems(PROBLEMS_URL, {
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
	tooManyRequests: {
		slug: "too-many-requests",
		status: 429,
		title: "Too many requests from this address",
	},
	validationError: {
		slug: "validation-error",
		status: 422,
		title: "The request failed validation",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
});
