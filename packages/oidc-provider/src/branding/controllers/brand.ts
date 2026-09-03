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

import routes from "../../routes";
import { isResponse, safeJsonParse } from "../../shared/lib/safe-json";
import { hexColor, httpsUrl, LIMITS, maxLength } from "../../shared/lib/schema-checks";
import Brand from "../models/brand";

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
		let { logger } = getContext();
		let log = logger.loader("/api/brand");

		let brand = await Brand.show(db);

		log.info("Brand settings retrieved", { brandId: brand?.id ?? null });

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
		let { request, logger } = getContext();
		let log = logger.action("/api/brand");

		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body");
			return body;
		}

		let result = await validate(body, UpdateBrandSchema);
		if (isFailure(result)) {
			log.info("Brand update validation failed", { issues: result.error.issues.length });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		await Brand.update(db, result.data);
		let brand = await Brand.show(db);

		log.info("Brand settings updated", { brandId: brand?.id ?? null });

		return ok(brand);
	}),
);
