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

export const show = action<"GET", "/api/brand">(async ({ db }) => {
	let brand = await Brand.show(db);
	return ok(brand);
});

export const update = action<"PUT", "/api/brand">(async ({ db, request }) => {
	let body = (await request.json()) as Record<string, unknown>;
	let result = await validate(body, UpdateBrandSchema);
	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	await Brand.update(db, result.data);
	let brand = await Brand.show(db);
	return ok(brand);
});
