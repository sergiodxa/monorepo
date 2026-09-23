/**
 * Turns a `s.parse()` failure inside an `/api/v1/*` controller into the API's own
 * 400 `validation-error` problem. Route params carrying a {@link typedId} schema reject a malformed or
 * wrong-resource identifier by throwing, and without this the throw would surface as
 * a 500 for what is really a caller mistake.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { issuesFrom } from "@sdxc/problem";
import * as s from "remix/data-schema";

import { apiProblems, problemInstance } from "~/app/services/api-problems";

/**
 * Answers 400 when a controller's schema parse throws.
 *
 * @returns Middleware forwarding to the handler, converting a thrown
 * `ValidationError` into a `validation-error` problem.
 * @example
 * export default createController(monitorRoutes, {
 * 	middleware: [catchValidationError()],
 * 	actions: { ... },
 * });
 */
export default function catchValidationError(): Middleware {
	return async (ctx, next) => {
		try {
			return await next();
		} catch (error) {
			if (!(error instanceof s.ValidationError)) throw error;
			return apiProblems.validationError({
				instance: problemInstance(),
				extensions: { errors: issuesFrom(error) },
			});
		}
	};
}
