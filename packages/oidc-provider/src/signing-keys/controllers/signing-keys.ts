import type { RequestContext } from "remix/fetch-router";

import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import routes from "../../routes";
import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { toIsoString, toIsoStringOptional } from "../../shared/lib/timestamp";
import SigningKey from "../models/signing-key";

export const index = createAction(
	routes.api["signing-keys"].index,
	inject([Database] as const, async (db) => {
		let { logger } = getContext();
		let log = logger.loader("/api/signing-keys");

		let signingKeys = await SigningKey.list(db);

		log.info("Signing keys listed", { count: signingKeys.length });

		return ok(
			signingKeys.map((key) => ({
				id: key.id,
				algorithm: key.algorithm,
				isCurrent: key.is_current,
				createdAt: toIsoString(key.created_at),
				expiresAt: toIsoStringOptional(key.expires_at),
			})),
		);
	}),
);

export const create = createAction(
	routes.api["signing-keys"].create,
	inject([Database] as const, async (db) => {
		let { logger } = getContext();
		let log = logger.action("/api/signing-keys");

		let keyPair = await SigningKey.generate(db);

		log.info("Signing key created", { keyId: keyPair.id });

		return created({
			id: keyPair.id,
			algorithm: "ES256",
			isCurrent: true,
		});
	}),
);

export const rotate = createAction(
	routes.api["signing-keys"].rotate,
	inject([Database] as const, async (db) => {
		let { logger } = getContext();
		let log = logger.action("/api/signing-keys/rotate");

		let keyPair = await SigningKey.rotate(db);

		log.info("Signing key rotated", { newKeyId: keyPair.id });

		return ok({
			id: keyPair.id,
			algorithm: "ES256",
			isCurrent: true,
		});
	}),
);

export const destroy = createAction(
	routes.api["signing-keys"].destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.action("/api/signing-keys/:id");

		try {
			await SigningKey.destroy(db, params.id);
			log.info("Signing key deleted", { keyId: params.id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Signing key not found", { keyId: params.id });
				return notFound({ error: "Signing key not found" });
			}
			if (error instanceof SigningKey.CannotDeleteCurrentKeyError) {
				log.info("Cannot delete current signing key", { keyId: params.id });
				return badRequest({ error: error.message });
			}
			throw error;
		}
	}),
);
