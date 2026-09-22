/**
 * The centralized, type-safe route table for the management API, served on
 * `api.{PLATFORM_DOMAIN}`. This pass adds the subjects and identifiers resource
 * area onto the token endpoint the foundation pass already mapped; each later
 * resource-area pass extends this same table with its own routes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, get, patch, post, route } from "remix/routes";

/**
 * The management API's route map.
 *
 * @example
 * routes.token.href();
 */
export default route({
	token: post("/oauth/token"),

	subjectsCreate: post("/tenants/:tenantId/subjects"),
	subjectsList: get("/tenants/:tenantId/subjects"),
	subjectsRead: get("/tenants/:tenantId/subjects/:subjectId"),
	subjectsUpdate: patch("/tenants/:tenantId/subjects/:subjectId"),
	subjectsBlock: post("/tenants/:tenantId/subjects/:subjectId/block"),
	subjectsUnblock: post("/tenants/:tenantId/subjects/:subjectId/unblock"),
	subjectsDelete: del("/tenants/:tenantId/subjects/:subjectId"),

	subjectIdentifiersAdd: post("/tenants/:tenantId/subjects/:subjectId/identifiers"),
	subjectIdentifiersVerify: post("/tenants/:tenantId/subjects/identifiers/verify"),
	subjectIdentifiersSetPrimary: post("/tenants/:tenantId/subjects/:subjectId/identifiers/primary"),
	subjectIdentifiersRemove: del("/tenants/:tenantId/subjects/:subjectId/identifiers/:value"),
});
