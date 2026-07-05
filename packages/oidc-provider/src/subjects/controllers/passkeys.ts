import type { RequestContext } from "remix/fetch-router";

import { noContent } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

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

export const index = createAction(
	routes.api.subjects.passkeys.index,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.loader("/api/subjects/:id/passkeys");

		let subject = await Subject.show(db, params.id);
		if (!subject) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}

		let passkeys = await Passkey.listBySubject(db, params.id);

		log.info("Passkeys listed", { subjectId: params.id, count: passkeys.length });

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

export const update = createAction(
	routes.api.subjects.passkeys.update,
	inject([Database] as const, async (db) => {
		let { params, request, logger } = getContext() as RequestContext<{
			id: string;
			passkeyId: string;
		}>;
		let log = logger.action("/api/subjects/:id/passkeys/:passkeyId");

		let subject = await Subject.show(db, params.id);
		if (!subject) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}

		let passkey = await Passkey.show(db, params.passkeyId);
		if (!passkey) {
			log.info("Passkey not found", { subjectId: params.id, passkeyId: params.passkeyId });
			return notFound({ error: "Passkey not found" });
		}

		if (passkey.subject_id !== params.id) {
			log.info("Passkey does not belong to subject", {
				subjectId: params.id,
				passkeyId: params.passkeyId,
			});
			return notFound({ error: "Passkey not found" });
		}

		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body", { subjectId: params.id, passkeyId: params.passkeyId });
			return body;
		}

		let result = await validate(body, UpdatePasskeySchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { subjectId: params.id, passkeyId: params.passkeyId });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		try {
			await Passkey.rename(db, params.passkeyId, result.data.name);
			let updated = await Passkey.show(db, params.passkeyId);
			if (!updated) {
				log.info("Passkey not found after rename", {
					subjectId: params.id,
					passkeyId: params.passkeyId,
				});
				return notFound({ error: "Passkey not found" });
			}
			log.info("Passkey renamed", { subjectId: params.id, passkeyId: params.passkeyId });
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

export const destroy = createAction(
	routes.api.subjects.passkeys.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string; passkeyId: string }>;
		let log = logger.action("/api/subjects/:id/passkeys/:passkeyId");

		let subject = await Subject.show(db, params.id);
		if (!subject) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}

		let passkey = await Passkey.show(db, params.passkeyId);
		if (!passkey) {
			log.info("Passkey not found", { subjectId: params.id, passkeyId: params.passkeyId });
			return notFound({ error: "Passkey not found" });
		}

		if (passkey.subject_id !== params.id) {
			log.info("Passkey does not belong to subject", {
				subjectId: params.id,
				passkeyId: params.passkeyId,
			});
			return notFound({ error: "Passkey not found" });
		}

		let allPasskeys = await Passkey.listBySubject(db, params.id);
		if (allPasskeys.length === 1) {
			log.info("Cannot delete only passkey", { subjectId: params.id, passkeyId: params.passkeyId });
			return badRequest({
				error: "Cannot delete the only passkey. Add another passkey first.",
			});
		}

		try {
			await Passkey.destroy(db, params.passkeyId);
			log.info("Passkey deleted", { subjectId: params.id, passkeyId: params.passkeyId });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Passkey not found" });
			}
			throw error;
		}
	}),
);
