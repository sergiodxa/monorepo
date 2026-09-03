/**
 * Management API controller for subjects/users (`/api/subjects`).
 *
 * Exposes actions to list, show, import, update, delete, and mark-email-verified
 * for subjects; create is an import that preserves the source `sub` and timestamps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { noContent } from "@sdxc/http/response";
import { badRequest, conflict, created, notFound, ok } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import routes from "../../routes";
import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { isResponse, safeJsonParse } from "../../shared/lib/safe-json";
import { httpsUrl, LIMITS, maxLength } from "../../shared/lib/schema-checks";
import Subject from "../models/subject";

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

/**
 * `GET /api/subjects` — lists all subjects.
 * @returns A JSON `Response` with the array of subjects.
 */
export const index = createAction(
	routes.api.subjects.index,
	inject([Database] as const, async (db) => {
		let { logger } = getContext();
		let log = logger.loader("/api/subjects");
		let subjects = await Subject.list(db);
		log.info("Subjects listed", { count: subjects.length });
		return ok(subjects);
	}),
);

/**
 * `GET /api/subjects/:id` — retrieves a single subject.
 * @returns A JSON `Response` with the subject, or `notFound`.
 */
export const show = createAction(
	routes.api.subjects.show,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.loader("/api/subjects/:id");
		let subject = await Subject.show(db, id);
		if (!subject) {
			log.info("Subject not found", { subjectId: id });
			return notFound({ error: "Subject not found" });
		}
		log.info("Subject retrieved", { subjectId: id });
		return ok(subject);
	}),
);

/**
 * `POST /api/subjects` — imports a subject, preserving its id and timestamps.
 * @returns A JSON `Response` with the imported subject, `conflict` on duplicate, or an error `Response`.
 */
export const create = createAction(
	routes.api.subjects.create,
	inject([Database] as const, async (db) => {
		let { request, logger } = getContext();
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
	}),
);

/**
 * `PATCH/PUT /api/subjects/:id` — updates a subject's profile.
 * @returns A JSON `Response` with the updated subject, or an error `Response`.
 */
export const update = createAction(
	routes.api.subjects.update,
	inject([Database] as const, async (db) => {
		let { params, request, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.action("/api/subjects/:id");
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body", { subjectId: id });
			return body;
		}

		let result = await validate(body, UpdateSubjectSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { subjectId: id });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		try {
			await Subject.update(db, id, result.data);
			let subject = await Subject.show(db, id);
			log.info("Subject updated", { subjectId: id });
			return ok(subject);
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Subject not found", { subjectId: id });
				return notFound({ error: "Subject not found" });
			}
			if (error instanceof Subject.UsernameAlreadyTakenError) {
				log.info("Username already taken", {
					subjectId: id,
					username: result.data.username,
				});
				return badRequest({ error: error.message });
			}
			throw error;
		}
	}),
);

/**
 * `DELETE /api/subjects/:id` — deletes a subject.
 * @returns A `204 No Content` `Response`, or `notFound`.
 */
export const destroy = createAction(
	routes.api.subjects.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.action("/api/subjects/:id");
		try {
			await Subject.destroy(db, id);
			log.info("Subject deleted", { subjectId: id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Subject not found", { subjectId: id });
				return notFound({ error: "Subject not found" });
			}
			throw error;
		}
	}),
);

/**
 * `POST /api/subjects/:id/verify-email` — marks a subject's email as verified.
 * @returns A JSON `Response` confirming verification, or `notFound`.
 */
export const verifyEmail = createAction(
	routes.api.subjects.verifyEmail,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.action("/api/subjects/:id/verify-email");
		try {
			await Subject.verifyEmail(db, id);
			log.info("Email verified", { subjectId: id });
			return ok({ message: "Email verified" });
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Subject not found", { subjectId: id });
				return notFound({ error: "Subject not found" });
			}
			throw error;
		}
	}),
);
