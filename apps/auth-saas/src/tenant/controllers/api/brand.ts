import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import Brand from "~/tenant/models/brand";

let UpdateBrandSchema = s.object({
	logoUrl: s.optional(s.nullable(s.string())),
	primaryColor: s.optional(s.nullable(s.string())),
	backgroundColor: s.optional(s.nullable(s.string())),
	customCss: s.optional(s.nullable(s.string())),
});

export const show = action<"GET", "/api/brand">(async ({ db, logger }) => {
	let log = logger.loader("/api/brand");

	let brand = await Brand.show(db);

	log.info("Brand settings retrieved", { brandId: brand?.id ?? null });

	return ok(brand);
});

export const update = action<"PUT", "/api/brand">(async ({ db, request, logger }) => {
	let log = logger.action("/api/brand");

	let body = (await request.json()) as Record<string, unknown>;
	let result = await validate(body, UpdateBrandSchema);
	if (isFailure(result)) {
		log.info("Brand update validation failed", { issues: result.error.issues.length });
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	await Brand.update(db, result.data);
	let brand = await Brand.show(db);

	log.info("Brand settings updated", { brandId: brand?.id ?? null });

	return ok(brand);
});
