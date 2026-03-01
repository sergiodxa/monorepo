import { noContent } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import Subject from "~/tenant/models/subject";

let UpdateSubjectSchema = s.object({
	displayName: s.optional(s.string()),
	avatarUrl: s.optional(s.string()),
});

export const index = action<"GET", "/api/subjects">(async ({ db }) => {
	let subjects = await Subject.list(db);
	return ok(subjects);
});

export const show = action<"GET", "/api/subjects/:id">(async ({ db, params }) => {
	let subject = await Subject.show(db, { id: params.id });
	if (!subject) {
		return notFound({ error: "Subject not found" });
	}
	return ok(subject);
});

export const update = action<"PUT", "/api/subjects/:id">(async ({ db, params, request }) => {
	let body = (await request.json()) as Record<string, unknown>;
	let result = await validate(body, UpdateSubjectSchema);
	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	try {
		await Subject.update(db, { id: params.id }, result.data);
		let subject = await Subject.show(db, { id: params.id });
		return ok(subject);
	} catch (error) {
		if (error instanceof RecordNotFoundError) {
			return notFound({ error: "Subject not found" });
		}
		throw error;
	}
});

export const destroy = action<"DELETE", "/api/subjects/:id">(async ({ db, params }) => {
	try {
		await Subject.destroy(db, { id: params.id });
		return noContent();
	} catch (error) {
		if (error instanceof RecordNotFoundError) {
			return notFound({ error: "Subject not found" });
		}
		throw error;
	}
});

export const verifyEmail = action<"POST", "/api/subjects/:id/verify-email">(
	async ({ params, db }) => {
		try {
			await Subject.verifyEmail(db, { id: params.id });
			return ok({ message: "Email verified" });
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Subject not found" });
			}
			throw error;
		}
	},
);
