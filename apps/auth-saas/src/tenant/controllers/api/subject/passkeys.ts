import { noContent } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import { isResponse, safeJsonParse } from "~/lib/safe-json";
import Passkey from "~/tenant/models/passkey";
import Subject from "~/tenant/models/subject";

let UpdatePasskeySchema = s.object({
	name: s.string(),
});

export const index = action<"GET", "/api/subjects/:id/passkeys">(async ({ db, params, logger }) => {
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
			createdAt: passkey.created_at,
			lastUsedAt: passkey.last_used_at,
		})),
	);
});

export const update = action<"PUT", "/api/subjects/:id/passkeys/:passkeyId">(
	async ({ db, params, request, logger }) => {
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
				createdAt: updated.created_at,
				lastUsedAt: updated.last_used_at,
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Passkey not found" });
			}
			throw error;
		}
	},
);

export const destroy = action<"DELETE", "/api/subjects/:id/passkeys/:passkeyId">(
	async ({ db, params, logger }) => {
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
	},
);
