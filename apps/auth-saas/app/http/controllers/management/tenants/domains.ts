/**
 * The domain sub-resource under a tenant: `GET .../domains` lists them, `POST
 * .../domains` attaches a custom domain for a tenant holding the `custom_domain`
 * entitlement — registering it with Cloudflare and recording the DV verification
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { HostnameApiError } from "@sdxc/hostname";
import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { Models } from "~/app/models";
import type { DomainRow } from "~/app/models/domains";

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
import { managementDenied } from "~/app/http/middleware/management-auth";
import { TENANT_DOMAINS_ATTACH } from "~/app/http/openapi/tenants";
import { operationInputProblem } from "~/app/http/parse-body";
import abilities from "~/app/policies/abilities";
import { attachCustomDomain, removeDomain } from "~/app/services/domain";
import routes from "~/routes/management";

/** Finds a domain by id, scoped to the caller's own tenant — a domain id alone names no tenant of its own. */
async function findOwnDomain(
	models: Models,
	tenantId: string,
	domainId: string,
): Promise<DomainRow | null> {
	let domain = await models.domains.find(domainId);
	if (!domain || domain.tenant_id !== tenantId) return null;
	return domain;
}

/**
 * Builds the `tenantDomainsList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantDomainsList, createTenantDomainsListAction(options));
 */
export function createTenantDomainsListAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantDomainsList, {
		middleware: [
			...mountedMiddleware(options, "read"),
			requireAbility(abilities.tenant.domains.list),
		],
		handler: async (ctx) => {
			let domains = await ctx.models.domains.ofTenant(ctx.managementCaller.tenantId).all();

			return json(domains.map(serializeDomain), { status: 200 });
		},
	});
}

/**
 * Builds the `tenantDomainsAttach` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantDomainsAttach, createTenantDomainsAttachAction(options));
 */
export function createTenantDomainsAttachAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantDomainsAttach, {
		middleware: [
			...mountedMiddleware(options, "write"),
			requireAbility(abilities.tenant.domains.attach, {
				onDenied: (ctx, decision) =>
					decision.cause === "denied" ? customDomainNotAllowed() : managementDenied(ctx, decision),
			}),
		],
		handler: async (ctx) => {
			let input = await TENANT_DOMAINS_ATTACH.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);
			let body = input.data.body;
			if (body.kind !== "custom") return domainKindNotAttachable();

			try {
				let domain = await attachCustomDomain(
					ctx.models,
					options.hostnameClient(),
					ctx.managementCaller.tenantId,
					body.hostname,
				);
				return json(serializeDomain(domain), { status: 201 });
			} catch (error) {
				if (error instanceof HostnameApiError) return hostnameRegistrationFailed(error.message);
				throw error;
			}
		},
	});
}

/**
 * Builds the `tenantDomainsVerification` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantDomainsVerification, createTenantDomainsVerificationAction(options));
 */
export function createTenantDomainsVerificationAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantDomainsVerification, {
		middleware: [
			...mountedMiddleware(options, "read"),
			requireAbility(abilities.tenant.domains.verification),
		],
		handler: async (ctx) => {
			let domainId = domainIdParam(ctx);
			let domain = await findOwnDomain(ctx.models, ctx.managementCaller.tenantId, domainId);
			if (!domain) return domainNotFound();

			return json(serializeDomainVerification(domain), { status: 200 });
		},
	});
}

/**
 * Builds the `tenantDomainsRemove` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantDomainsRemove, createTenantDomainsRemoveAction(options));
 */
export function createTenantDomainsRemoveAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantDomainsRemove, {
		middleware: [
			...mountedMiddleware(options, "write"),
			requireAbility(abilities.tenant.domains.remove),
		],
		handler: async (ctx) => {
			let domainId = domainIdParam(ctx);
			let domain = await findOwnDomain(ctx.models, ctx.managementCaller.tenantId, domainId);
			if (!domain) return domainNotFound();

			await removeDomain(ctx.models, options.hostnameClient(), domain);

			return new Response(null, { status: 204 });
		},
	});
}
