import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import SigningKey from "~/tenant/models/signing-key";

export const index = action<"GET", "/api/signing-keys">(async ({ db, logger }) => {
	let log = logger.loader("/api/signing-keys");

	let signingKeys = await SigningKey.list(db);

	log.info("Signing keys listed", { count: signingKeys.length });

	return ok(
		signingKeys.map((key) => ({
			id: key.id,
			algorithm: key.algorithm,
			isCurrent: key.isCurrent,
			createdAt: key.createdAt,
			expiresAt: key.expiresAt,
		})),
	);
});

export const create = action<"POST", "/api/signing-keys">(async ({ db, logger }) => {
	let log = logger.action("/api/signing-keys");

	let keyPair = await SigningKey.generate(db);

	log.info("Signing key created", { keyId: keyPair.id });

	return created({
		id: keyPair.id,
		algorithm: "ES256",
		isCurrent: true,
	});
});

export const rotate = action<"POST", "/api/signing-keys/rotate">(async ({ db, logger }) => {
	let log = logger.action("/api/signing-keys/rotate");

	let keyPair = await SigningKey.rotate(db);

	log.info("Signing key rotated", { newKeyId: keyPair.id });

	return ok({
		id: keyPair.id,
		algorithm: "ES256",
		isCurrent: true,
	});
});

export const destroy = action<"DELETE", "/api/signing-keys/:id">(async ({ db, params, logger }) => {
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
});
