/**
 * Management API controller for tenant branding (`/api/brand`).
 *
 * Reads the branding configuration (with defaults applied) and updates it from a
 * validated body; custom CSS is sanitized by the model on write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import routes from "../../routes.js";
import { isResponse, safeJsonParse } from "../../shared/lib/safe-json.js";
import { hexColor, httpsUrl, LIMITS, maxLength } from "../../shared/lib/schema-checks.js";
import Brand from "../models/brand.js";

let CSS_MAX_LENGTH = 50_000;

/** Validation schema for the update-brand request body. */
let UpdateBrandSchema = s.object({
	logoUrl: s.optional(s.nullable(s.string().pipe(maxLength(LIMITS.url.max), httpsUrl()))),
	primaryColor: s.optional(s.nullable(s.string().pipe(hexColor()))),
	backgroundColor: s.optional(s.nullable(s.string().pipe(hexColor()))),
	customCss: s.optional(s.nullable(s.string().pipe(maxLength(CSS_MAX_LENGTH)))),
});

/**
 * `GET /api/brand` — returns the tenant's branding configuration.
 * @returns A JSON `Response` with the branding record (defaults applied).
 */
export const show = createAction(
	routes.api.brand.show,
	inject([Database] as const, async (db) => {
		let { log } = getContext();

		let brand = await Brand.show(db);

		log.note("admin.brand.retrieved", { brand_id: brand?.id ?? null });

		return ok(brand);
	}),
);

/**
 * `PUT /api/brand` — updates branding from a validated JSON body.
 * @returns A JSON `Response` with the updated branding record, or an error `Response`.
 */
export const update = createAction(
	routes.api.brand.update,
	inject([Database] as const, async (db) => {
		let { request, log } = getContext();

		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.warn("http.invalid_json");
			return body;
		}

		let result = await validate(body, UpdateBrandSchema);
		if (isFailure(result)) {
			log.warn("http.invalid_body", { issues: result.error.issues.length });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		await Brand.update(db, result.data);
		let brand = await Brand.show(db);

		log.note("admin.brand.updated", { brand_id: brand?.id ?? null });

		return ok(brand);
	}),
);
