import { noContent } from "@pkg/http/response";
import { badRequest, conflict, created, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "../../lib/action";
import { RecordNotFoundError } from "../../lib/db-errors";
import { isResponse, safeJsonParse } from "../../lib/safe-json";
import { httpsUrl, LIMITS, maxLength } from "../../lib/schema-checks";
import Subject from "../../models/subject";

let UpdateSubjectSchema = s.object({
	displayName: s.optional(s.string().pipe(maxLength(LIMITS.name.max))),
	avatarUrl: s.optional(s.string().pipe(maxLength(LIMITS.url.max), httpsUrl())),
	username: s.optional(s.string().pipe(maxLength(LIMITS.name.max))),
});

/**
 * Import payload: an explicit `id` preserves the source `sub`; ISO timestamps
 * carry over so verified emails and creation dates survive the migration.
 */
let ImportSubjectSchema = s.object({
	id: s.string().pipe(maxLength(LIMITS.name.max)),
	email: s.string().pipe(maxLength(LIMITS.email.max)),
	username: s.string().pipe(maxLength(LIMITS.name.max)),
	emailVerifiedAt: s.optional(s.nullable(s.string())),
	displayName: s.optional(s.nullable(s.string().pipe(maxLength(LIMITS.name.max)))),
	avatarUrl: s.optional(s.nullable(s.string().pipe(maxLength(LIMITS.url.max)))),
	createdAt: s.optional(s.string()),
});

export const index = action<"GET", "/api/subjects">(async ({ db, logger }) => {
	let log = logger.loader("/api/subjects");
	let subjects = await Subject.list(db);
	log.info("Subjects listed", { count: subjects.length });
	return ok(subjects);
});

export const show = action<"GET", "/api/subjects/:id">(async ({ db, params, logger }) => {
	let log = logger.loader("/api/subjects/:id");
	let subject = await Subject.show(db, params.id);
	if (!subject) {
		log.info("Subject not found", { subjectId: params.id });
		return notFound({ error: "Subject not found" });
	}
	log.info("Subject retrieved", { subjectId: params.id });
	return ok(subject);
});

export const create = action<"POST", "/api/subjects">(async ({ db, request, logger }) => {
	let log = logger.action("/api/subjects");
	let body = await safeJsonParse(request);
	if (isResponse(body)) {
		log.info("Invalid JSON body");
		return body;
	}

	let result = await validate(body, ImportSubjectSchema);
	if (isFailure(result)) {
		log.info("Invalid import body");
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	try {
		let subject = await Subject.import(db, result.data);
		log.info("Subject imported", { subjectId: subject.id });
		return created(subject);
	} catch (error) {
		if (error instanceof Subject.ConflictError) {
			log.info("Subject import conflict", { message: error.message });
			return conflict({ error: error.message });
		}
		throw error;
	}
});

export const update = action<"PUT", "/api/subjects/:id">(
	async ({ db, params, request, logger }) => {
		let log = logger.action("/api/subjects/:id");
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body", { subjectId: params.id });
			return body;
		}

		let result = await validate(body, UpdateSubjectSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { subjectId: params.id });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		try {
			await Subject.update(db, params.id, result.data);
			let subject = await Subject.show(db, params.id);
			log.info("Subject updated", { subjectId: params.id });
			return ok(subject);
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Subject not found", { subjectId: params.id });
				return notFound({ error: "Subject not found" });
			}
			if (error instanceof Subject.UsernameAlreadyTakenError) {
				log.info("Username already taken", {
					subjectId: params.id,
					username: result.data.username,
				});
				return badRequest({ error: error.message });
			}
			throw error;
		}
	},
);

export const destroy = action<"DELETE", "/api/subjects/:id">(async ({ db, params, logger }) => {
	let log = logger.action("/api/subjects/:id");
	try {
		await Subject.destroy(db, params.id);
		log.info("Subject deleted", { subjectId: params.id });
		return noContent();
	} catch (error) {
		if (error instanceof RecordNotFoundError) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}
		throw error;
	}
});

export const verifyEmail = action<"POST", "/api/subjects/:id/verify-email">(
	async ({ params, db, logger }) => {
		let log = logger.action("/api/subjects/:id/verify-email");
		try {
			await Subject.verifyEmail(db, params.id);
			log.info("Email verified", { subjectId: params.id });
			return ok({ message: "Email verified" });
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Subject not found", { subjectId: params.id });
				return notFound({ error: "Subject not found" });
			}
			throw error;
		}
	},
);
