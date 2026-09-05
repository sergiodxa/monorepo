/**
 * Management API controller for JWT signing keys (`/api/signing-keys`).
 *
 * Exposes actions to list keys and to generate, rotate, and delete them, so the
 * control plane can manage the tenant's token-signing key material.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { noContent } from "@sdxc/http/response";
import { badRequest, created, notFound, ok } from "@sdxc/http/response/json";
import { inject } from "@sdxc/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import routes from "../../routes.js";
import { RecordNotFoundError } from "../../shared/lib/db-errors.js";
import { toIsoString, toIsoStringOptional } from "../../shared/lib/timestamp.js";
import SigningKey from "../models/signing-key.js";

/**
 * `GET /api/signing-keys` — lists signing keys (public metadata only).
 * @returns A JSON `Response` with the array of key metadata.
 */
export const index = createAction(
	routes.api["signing-keys"].index,
	inject([Database] as const, async (db) => {
		let { log } = getContext();

		let signingKeys = await SigningKey.list(db);

		log.note("admin.signing_key.listed", { count: signingKeys.length });

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

/**
 * `POST /api/signing-keys` — generates a new key and marks it current.
 * @returns A JSON `Response` with the new key's id and algorithm.
 */
export const create = createAction(
	routes.api["signing-keys"].create,
	inject([Database] as const, async (db) => {
		let { log } = getContext();

		let keyPair = await SigningKey.generate(db);

		log.note("admin.signing_key.created", { key_id: keyPair.id });

		return created({
			id: keyPair.id,
			algorithm: keyPair.alg,
			isCurrent: true,
		});
	}),
);

/**
 * `POST /api/signing-keys/rotate` — generates a new current key, retiring the old.
 * @returns A JSON `Response` with the new current key's id and algorithm.
 */
export const rotate = createAction(
	routes.api["signing-keys"].rotate,
	inject([Database] as const, async (db) => {
		let { log } = getContext();

		let keyPair = await SigningKey.rotate(db);

		log.note("admin.signing_key.rotated", { key_id: keyPair.id });

		return ok({
			id: keyPair.id,
			algorithm: keyPair.alg,
			isCurrent: true,
		});
	}),
);

/**
 * `DELETE /api/signing-keys/:id` — deletes a non-current key.
 * @returns A `204 No Content` `Response`, `notFound`, or `badRequest` for the current key.
 */
export const destroy = createAction(
	routes.api["signing-keys"].destroy,
	inject([Database] as const, async (db) => {
		let { params, log } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);

		try {
			await SigningKey.destroy(db, id);
			log.note("admin.signing_key.deleted", { key_id: id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.warn("admin.signing_key.not_found", { key_id: id });
				return notFound({ error: "Signing key not found" });
			}
			if (error instanceof SigningKey.CannotDeleteCurrentKeyError) {
				log.warn("admin.signing_key.current_key_protected", { key_id: id });
				return badRequest({ error: error.message });
			}
			throw error;
		}
	}),
);
