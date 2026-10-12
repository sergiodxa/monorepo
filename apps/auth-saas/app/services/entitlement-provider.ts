/**
 * The flag provider that turns a tenant's entitlement projection into
 * answers: a key under the "entitlement." namespace is resolved from the
 * request's own context rather than from a rule set, and every other key
 * reaches the wrapped provider, which is what makes the namespace a real
 * boundary rather than a naming convention.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	EvaluationContext,
	MaybePromise,
	ProviderMetadata,
	ResolutionDetails,
	TrackingEventDetails,
} from "@sdxc/flags";
import type { Provider } from "@sdxc/flags/provider";
import type { JSONValue } from "@sdxc/types";

import { failed, resolved } from "@sdxc/flags/provider";

import { PLANS } from "~/app/services/billing/catalog";

/** Every key this provider answers itself carries this prefix. */
const NAMESPACE = "entitlement.";

/** The tier a context is read as when it names none, or names one this catalog does not carry. */
const DEFAULT_TIER: keyof typeof PLANS = "free";

/** This provider's two numeric keys, mapped to the plan field each one reads. */
const PLAN_LIMIT_KEYS: Readonly<Record<string, "dauCap" | "auditRetentionDays">> = {
	"entitlement.dau-cap": "dauCap",
	"entitlement.audit-retention-days": "auditRetentionDays",
};

/** What a request's context carries about the plan a tenant currently holds. */
interface PlanFact {
	tier?: string;
	status?: string;
}

/** Reads the plan tier a context names, falling back to Free for a context that names none or an unrecognized one. */
function planTierOf(context: EvaluationContext): keyof typeof PLANS {
	let plan = context.plan as PlanFact | undefined;

	if (plan && typeof plan === "object" && typeof plan.tier === "string" && plan.tier in PLANS) {
		return plan.tier as keyof typeof PLANS;
	}

	return DEFAULT_TIER;
}

/** Reads the tenant's boolean grants off a context, denying every slug for a context that carries none. */
function entitlementMapOf(context: EvaluationContext): Readonly<Record<string, boolean>> {
	let entitlement = context.entitlement;

	if (entitlement && typeof entitlement === "object" && !Array.isArray(entitlement)) {
		return entitlement as Readonly<Record<string, boolean>>;
	}

	return {};
}

/** Turns a flag key's dashed slug back into the catalog's own underscored feature slug. */
function featureSlugOf(key: string): string {
	return key.slice(NAMESPACE.length).replace(/-/g, "_");
}

/**
 * Wraps a provider with the tenant entitlement namespace. Constructed over an
 * `EngineProvider`, it answers every "entitlement.*" boolean from the
 * evaluation context's own `entitlement` map, answers its two known numeric
 * keys from the plan tier the context names, and hands every other key to
 * the engine underneath — which is where a release flag or a kill switch is
 * declared.
 *
 * @example
 * let provider = new EntitlementProvider(new EngineProvider(createEngine({ store })));
 */
export class EntitlementProvider implements Provider {
	readonly metadata: ProviderMetadata = { name: "entitlement" };

	#wrapped: Provider;

	/**
	 * @param wrapped The provider every key outside the entitlement namespace falls through to.
	 */
	constructor(wrapped: Provider) {
		this.#wrapped = wrapped;
	}

	get hooks(): Provider["hooks"] {
		return this.#wrapped.hooks;
	}

	get events(): Provider["events"] {
		return this.#wrapped.events;
	}

	get domainScoped(): Provider["domainScoped"] {
		return this.#wrapped.domainScoped;
	}

	/** Initializes the wrapped provider, so the engine underneath loads before anything evaluates through it. */
	async initialize(context: EvaluationContext = {}, domain?: string): Promise<void> {
		await this.#wrapped.initialize?.(context, domain);
	}

	/** Shuts the wrapped provider down. */
	async shutdown(): Promise<void> {
		await this.#wrapped.shutdown?.();
	}

	track(name: string, context: EvaluationContext, details?: TrackingEventDetails): void {
		this.#wrapped.track?.(name, context, details);
	}

	resolveBoolean(
		key: string,
		defaultValue: boolean,
		context: EvaluationContext = {},
	): MaybePromise<ResolutionDetails<boolean>> {
		if (!key.startsWith(NAMESPACE)) return this.#wrapped.resolveBoolean(key, defaultValue, context);

		let features = entitlementMapOf(context);
		let slug = featureSlugOf(key);

		return resolved(features[slug] ?? false, { flagMetadata: { plan: planTierOf(context) } });
	}

	resolveNumber(
		key: string,
		defaultValue: number,
		context: EvaluationContext = {},
	): MaybePromise<ResolutionDetails<number>> {
		if (!key.startsWith(NAMESPACE)) return this.#wrapped.resolveNumber(key, defaultValue, context);

		let field = PLAN_LIMIT_KEYS[key];
		if (!field)
			return failed(defaultValue, "FLAG_NOT_FOUND", `No entitlement limit named "${key}".`);

		let tier = planTierOf(context);
		return resolved(PLANS[tier][field], { flagMetadata: { plan: tier } });
	}

	resolveString(
		key: string,
		defaultValue: string,
		context: EvaluationContext = {},
	): MaybePromise<ResolutionDetails<string>> {
		if (!key.startsWith(NAMESPACE)) return this.#wrapped.resolveString(key, defaultValue, context);

		return failed(
			defaultValue,
			"TYPE_MISMATCH",
			`"${key}" is an entitlement, which grants or limits and answers as neither a string nor a structure.`,
		);
	}

	resolveObject(
		key: string,
		defaultValue: JSONValue,
		context: EvaluationContext = {},
	): MaybePromise<ResolutionDetails<JSONValue>> {
		if (!key.startsWith(NAMESPACE)) return this.#wrapped.resolveObject(key, defaultValue, context);

		return failed(
			defaultValue,
			"TYPE_MISMATCH",
			`"${key}" is an entitlement, which grants or limits and answers as neither a string nor a structure.`,
		);
	}
}
