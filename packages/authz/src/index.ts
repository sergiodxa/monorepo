/**
 * Public surface of the authorization package: the ability catalog, the policy
 * builders, the access a binding returns, and the decisions it answers with.
 * Adapters for routers, jobs, MCP, flags and billing live in their own entries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	Access,
	AccessBinding,
	CheckArgs,
	ContextArgs,
	DerivedBinding,
	RoleSource,
} from "./access.js";
export type {
	Ability,
	AbilityGroup,
	AbilityName,
	AbilityOptions,
	AnyAbility,
	Catalog,
	CatalogMethods,
	Claims,
	ContextDefinition,
	ContextOf,
	Decisions,
	DeniedAs,
	FieldOf,
	GroupContext,
	LoadTarget,
} from "./catalog.js";
export type {
	Allowed,
	AuthzErrorOptions,
	ConditionFailure,
	Decision,
	Denied,
	GrantId,
	Refusal,
	Undecidable,
	Ungranted,
} from "./decision.js";
export type { FactLoader, FactRequest, FactSource, InvocationContext } from "./facts.js";
export type {
	AllowGrant,
	AllowOptions,
	DenyGrant,
	DenyOptions,
	FactDefinition,
	FactDefinitions,
	FactValue,
	FactValues,
	Grant,
} from "./grants.js";
export type { Condition } from "./language.js";
export type {
	AccessOf,
	AnyPolicy,
	AuthzTypes,
	FactsOf,
	Policy,
	PolicyOptions,
	RegisteredAccess,
	RegisteredPolicy,
	RoleOf,
} from "./policy.js";

export { abilities, ability, context, isAbility } from "./catalog.js";
export { AuthzError, Forbidden } from "./decision.js";
export { factLoader, isFactLoader } from "./facts.js";
export { allow, deny, fact } from "./grants.js";
export { parseCondition } from "./language.js";
export { definePolicy } from "./policy.js";
