/**
 * Management API controller for a subject's passkeys
 * (`/api/subjects/:id/passkeys`).
 *
 * Lists a subject's passkeys, renames one, and deletes one — always keeping
 * at least one passkey on the subject's account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { noContent } from "@sdxc/http/response";
import { badRequest, notFound, ok } from "@sdxc/http/response/json";
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
import { LIMITS, maxLength } from "../../shared/lib/schema-checks";
import { toIsoString, toIsoStringOptional } from "../../shared/lib/timestamp";
import Passkey from "../../webauthn/models/passkey";
import Subject from "../models/subject";

let UpdatePasskeySchema = s.object({
	name: s.string().pipe(maxLength(LIMITS.name.max)),
});

/**
 * `GET /api/subjects/:id/passkeys` — lists a subject's passkeys.
 * @returns A JSON `Response` with the passkeys, or `notFound` if the subject is missing.
 */
export const index = createAction(
	routes.api.subjects.passkeys.index,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.loader("/api/subjects/:id/passkeys");

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.info("Subject not found", { subjectId: id });
			return notFound({ error: "Subject not found" });
		}

		let passkeys = await Passkey.listBySubject(db, id);

		log.info("Passkeys listed", { subjectId: id, count: passkeys.length });

		return ok(
			passkeys.map((passkey) => ({
				id: passkey.id,
				name: passkey.name,
				deviceType: passkey.device_type,
				backedUp: passkey.backed_up,
				transports: passkey.transports ? passkey.transports.split(",") : [],
				createdAt: toIsoString(passkey.created_at),
				lastUsedAt: toIsoStringOptional(passkey.last_used_at),
			})),
		);
	}),
);

/**
 * `PUT /api/subjects/:id/passkeys/:passkeyId` — renames one of a subject's passkeys.
 * @returns A JSON `Response` with the updated passkey, or an error `Response`.
 */
export const update = createAction(
	routes.api.subjects.passkeys.update,
	inject([Database] as const, async (db) => {
		let { params, request, logger } = getContext();
		let { id, passkeyId } = s.parse(s.object({ id: s.string(), passkeyId: s.string() }), params);
		let log = logger.action("/api/subjects/:id/passkeys/:passkeyId");

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.info("Subject not found", { subjectId: id });
			return notFound({ error: "Subject not found" });
		}

		let passkey = await Passkey.show(db, passkeyId);
		if (!passkey) {
			log.info("Passkey not found", { subjectId: id, passkeyId });
			return notFound({ error: "Passkey not found" });
		}

		if (passkey.subject_id !== id) {
			log.info("Passkey does not belong to subject", {
				subjectId: id,
				passkeyId,
			});
			return notFound({ error: "Passkey not found" });
		}

		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body", { subjectId: id, passkeyId });
			return body;
		}

		let result = await validate(body, UpdatePasskeySchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { subjectId: id, passkeyId });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		try {
			await Passkey.rename(db, passkeyId, result.data.name);
			let updated = await Passkey.show(db, passkeyId);
			if (!updated) {
				log.info("Passkey not found after rename", {
					subjectId: id,
					passkeyId,
				});
				return notFound({ error: "Passkey not found" });
			}
			log.info("Passkey renamed", { subjectId: id, passkeyId });
			return ok({
				id: updated.id,
				name: updated.name,
				deviceType: updated.device_type,
				backedUp: updated.backed_up,
				transports: updated.transports ? updated.transports.split(",") : [],
				createdAt: toIsoString(updated.created_at),
				lastUsedAt: toIsoStringOptional(updated.last_used_at),
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Passkey not found" });
			}
			throw error;
		}
	}),
);

/**
 * `DELETE /api/subjects/:id/passkeys/:passkeyId` — deletes one of a subject's passkeys.
 * Guarantees the subject keeps at least one passkey.
 * @returns A `204 No Content` `Response`, or an error `Response`.
 */
export const destroy = createAction(
	routes.api.subjects.passkeys.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id, passkeyId } = s.parse(s.object({ id: s.string(), passkeyId: s.string() }), params);
		let log = logger.action("/api/subjects/:id/passkeys/:passkeyId");

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.info("Subject not found", { subjectId: id });
			return notFound({ error: "Subject not found" });
		}

		let passkey = await Passkey.show(db, passkeyId);
		if (!passkey) {
			log.info("Passkey not found", { subjectId: id, passkeyId });
			return notFound({ error: "Passkey not found" });
		}

		if (passkey.subject_id !== id) {
			log.info("Passkey does not belong to subject", {
				subjectId: id,
				passkeyId,
			});
			return notFound({ error: "Passkey not found" });
		}

		let allPasskeys = await Passkey.listBySubject(db, id);
		if (allPasskeys.length === 1) {
			log.info("Cannot delete only passkey", { subjectId: id, passkeyId });
			return badRequest({
				error: "Cannot delete the only passkey. Add another passkey first.",
			});
		}

		try {
			await Passkey.destroy(db, passkeyId);
			log.info("Passkey deleted", { subjectId: id, passkeyId });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Passkey not found" });
			}
			throw error;
		}
	}),
);
