/**
 * The `/api/v1/*` surface's problem types (RFC 9457): every failure the API answers
 * with is one entry here, so its `type` URL, status and title are written once and the
 * public error reference at `/docs/api/errors` can be checked against this list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";

/**
 * The API's problem catalog. Each slug is the kebab-case form of the error code the API
 * answered with before adopting problem details, so an error keeps its identity, and each
 * `type` resolves to its entry in the public error reference.
 */
export const apiProblems = defineProblems("https://uptime.sergiodxa.com/docs/api/errors/", {
	badRequest: { slug: "bad-request", status: 400, title: "The request is malformed" },
	validationError: {
		slug: "validation-error",
		status: 400,
		title: "The request failed validation",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
	limitExceeded: {
		slug: "limit-exceeded",
		status: 400,
		title: "The team has reached its limit for this resource",
	},
	unauthorized: { slug: "unauthorized", status: 401, title: "The API key is missing or invalid" },
	subscriptionRequired: {
		slug: "subscription-required",
		status: 402,
		title: "An active subscription is required",
	},
	forbidden: { slug: "forbidden", status: 403, title: "The API key lacks the required scope" },
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
	conflict: { slug: "conflict", status: 409, title: "The resource's state prevents this request" },
	rateLimited: { slug: "rate-limited", status: 429, title: "Too many requests" },
	internal: { slug: "internal", status: 500, title: "The request failed on the server" },
	internalError: {
		slug: "internal-error",
		status: 500,
		title: "The change was saved but could not be read back",
	},
	endpointUnavailable: {
		slug: "endpoint-unavailable",
		status: 503,
		title: "The endpoint is unavailable to this team",
	},
});

/**
 * A fresh `urn:uuid:` identifier for one failed request, for a problem's `instance`, so a
 * caller reporting an error can quote the occurrence as well as its type.
 *
 * @example apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });
 */
export function problemInstance(): string {
	return `urn:uuid:${generateUUID()}`;
}

/**
 * A `validation-error` problem for one field a schema accepted but the API still refuses,
 * such as an `endsAt` before its `startsAt`, so it reports like any schema failure.
 *
 * @param message - The reason, sent as both `detail` and the field's issue message.
 * @param pointer - JSON Pointer to the refused field; `""` names the request as a whole.
 * @example return invalidField("endsAt must be after startsAt", "/endsAt");
 */
export function invalidField(message: string, pointer = ""): Response {
	return apiProblems.validationError({
		detail: message,
		instance: problemInstance(),
		extensions: { errors: [{ pointer, code: "invalid", message }] },
	});
}
