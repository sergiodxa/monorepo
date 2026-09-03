/**
 * Management API tenant setup endpoint controller.
 *
 * Lets the control plane provision or re-provision a tenant's metadata (id,
 * issuer, region) so the OIDC issuer always matches the hostname clients use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { badRequest, ok } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import routes from "../../routes.js";
import TenantMeta from "../models/tenant-meta.js";

/**
 * Payload written by the control plane to provision a tenant Durable Object.
 * The `issuer` is stored without a scheme; token issuance prepends `https://`.
 */
const SetupSchema = s.object({
	tenant_id: s.string(),
	issuer: s.string(),
	region: s.optional(s.string()),
});

/**
 * Provisions tenant metadata from the control plane, re-run whenever the
 * tenant's hostname changes so the OIDC issuer stays aligned with it. The
 * management-auth middleware allows this before an issuer exists yet.
 * @returns A JSON `Response` `{ ok: true }` on success, or a `badRequest` on invalid payload.
 */
export const create = createAction(
	routes.api.setup,
	inject([Database] as const, async (db) => {
		let { request, logger } = getContext();
		let log = logger.action("/api/setup");

		let body = (await request.json().catch(() => null)) as JSONValue;
		let result = await validate(body, SetupSchema);
		if (isFailure(result)) {
			return badRequest({ error: "invalid_request", error_description: "Invalid setup payload" });
		}

		await TenantMeta.setTenantId(db, result.data.tenant_id);
		await TenantMeta.setIssuer(db, result.data.issuer);
		if (result.data.region) {
			await TenantMeta.set(db, TenantMeta.KEYS.REGION, result.data.region);
		}

		let createdAt = await TenantMeta.get(db, TenantMeta.KEYS.CREATED_AT);
		if (!createdAt) {
			await TenantMeta.set(db, TenantMeta.KEYS.CREATED_AT, new Date().toISOString());
		}

		log.info("Tenant setup applied", {
			tenantId: result.data.tenant_id,
			issuer: result.data.issuer,
		});

		return ok({ ok: true });
	}),
);
