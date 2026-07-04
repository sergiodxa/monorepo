import type { JSONValue } from "@pkg/types";

import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "../../lib/action";
import TenantMeta from "../../models/tenant-meta";

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
 * Provisions tenant metadata (tenant id, issuer, region) from the control plane.
 *
 * Called once at tenant creation and again whenever the tenant's canonical
 * hostname changes, so the OIDC issuer always matches the hostname clients use.
 * Guarded by the management-auth middleware, which accepts the platform's signed
 * internal token even before an issuer exists on a freshly-created tenant.
 */
export const create = action<"POST", "/api/setup">(async ({ db, request, logger }) => {
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
});
