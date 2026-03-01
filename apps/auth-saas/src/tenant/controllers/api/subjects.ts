import type { JSONValue } from "@pkg/types";

import { noContent } from "@pkg/http/response";
import { ok, unprocessableEntity } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import Subject from "~/tenant/models/subject";

export const index = action<"GET", "/api/subjects">(async ({ db }) => {
	let subjects = await Subject.list(db);
	return ok(subjects);
});

export const show = action<"GET", "/api/subjects/:id">(async ({ db, params }) => {
	let subject = await Subject.show(db, params);
	if (!subject) return noContent();
	return ok(subject);
});

export const update = action<"PUT", "/api/subjects/:id">(async ({ db, params, request }) => {
	let body = (await request.json()) as JSONValue;
	let result = await validate(
		body,
		s.object({ displayName: s.optional(s.string()), avatarUrl: s.optional(s.string()) }),
	);
	if (isFailure(result)) return unprocessableEntity(result.error);
	let subject = await Subject.update(db, params, result.data);
	return ok(subject);
});

export const destroy = action<"DELETE", "/api/subjects/:id">(async ({ db, params }) => {
	await Subject.destroy(db, params);
	return noContent();
});

export const verifyEmail = action<"POST", "/api/subjects/:id/verify-email">(
	async ({ params, db }) => {
		await Subject.verifyEmail(db, params);
		return ok({ message: "Email verified" });
	},
);
