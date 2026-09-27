/**
 * The domain sub-resource under a tenant: `GET .../domains` lists them, `POST
 * .../domains` attaches a custom domain — registering it with Cloudflare and
 * recording the DV verification record it answers with — `GET
 * .../domains/:domainId/verification` reads one domain's verification and
 * activation state, and `DELETE .../domains/:domainId` removes one,
 * deregistering it from Cloudflare too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { HostnameApiError } from "@sdxc/hostname";
import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { DomainRow } from "~/app/models/domain";

import {
	customDomainNotAllowed,
	domainIdParam,
	domainKindNotAttachable,
	domainNotFound,
	hostnameRegistrationFailed,
	mountedMiddleware,
	serializeDomain,
	serializeDomainVerification,
} from "~/app/http/controllers/management/tenants/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { TENANT_DOMAINS_ATTACH } from "~/app/http/openapi/tenants";
import Domain from "~/app/models/domain";
import {
	attachCustomDomain,
	CustomDomainNotAllowedError,
	removeDomain,
} from "~/app/services/domain";
import routes from "~/routes/management";

/** Finds a domain by id, scoped to the caller's own tenant — a domain id alone names no tenant of its own. */
async function findOwnDomain(
	db: Database,
	tenantId: string,
	domainId: string,
): Promise<DomainRow | null> {
	let domain = await Domain.findById(db, domainId);
	if (!domain || domain.tenant_id !== tenantId) return null;
	return domain;
}

/**
 * Builds the `tenantDomainsList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantDomainsList, createTenantDomainsListAction(options));
 */
export function createTenantDomainsListAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantDomainsList, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "tenant:write");
			if (refused) return refused;

			let domains = await Domain.listByTenant(ctx.db, ctx.managementCaller.tenantId);

			return json(domains.map(serializeDomain), { status: 200 });
		},
	});
}

/**
 * Builds the `tenantDomainsAttach` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantDomainsAttach, createTenantDomainsAttachAction(options));
 */
export function createTenantDomainsAttachAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantDomainsAttach, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "tenant:write");
			if (refused) return refused;

			let input = await TENANT_DOMAINS_ATTACH.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);
			let body = input.data.body;
			if (body.kind !== "custom") return domainKindNotAttachable();

			try {
				let domain = await attachCustomDomain(
					ctx.db,
					options.hostnameClient(),
					ctx.managementCaller.tenantId,
					body.hostname,
				);
				return json(serializeDomain(domain), { status: 201 });
			} catch (error) {
				if (error instanceof CustomDomainNotAllowedError) return customDomainNotAllowed();
				if (error instanceof HostnameApiError) return hostnameRegistrationFailed(error.message);
				throw error;
			}
		},
	});
}

/**
 * Builds the `tenantDomainsVerification` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantDomainsVerification, createTenantDomainsVerificationAction(options));
 */
export function createTenantDomainsVerificationAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantDomainsVerification, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "tenant:write");
			if (refused) return refused;

			let domainId = domainIdParam(ctx);
			let domain = await findOwnDomain(ctx.db, ctx.managementCaller.tenantId, domainId);
			if (!domain) return domainNotFound();

			return json(serializeDomainVerification(domain), { status: 200 });
		},
	});
}

/**
 * Builds the `tenantDomainsRemove` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantDomainsRemove, createTenantDomainsRemoveAction(options));
 */
export function createTenantDomainsRemoveAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantDomainsRemove, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "tenant:write");
			if (refused) return refused;

			let domainId = domainIdParam(ctx);
			let domain = await findOwnDomain(ctx.db, ctx.managementCaller.tenantId, domainId);
			if (!domain) return domainNotFound();

			await removeDomain(ctx.db, options.hostnameClient(), domain);

			return new Response(null, { status: 204 });
		},
	});
}
