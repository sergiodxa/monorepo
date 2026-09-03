/**
 * Remix fetch-router middleware that publishes the configured billing provider
 * on the request context, so a route bills by calling `context.billing`, plus
 * the route guard that gates a route on a feature the app already granted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { createContextKey } from "remix/router";

import type { Billing } from "../core/contract.js";

/**
 * Declared here, in an imported module rather than an ambient .d.ts, so the
 * augmentation is applied in consuming projects that import the middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/**
		 * The billing platform the current request bills against, configured by
		 * the billing middleware.
		 */
		billing: Billing;
	}
}

/**
 * What a route guard reads: the products a customer holds and the flags they
 * grant, as the app projected them into its own tables. An entitlement snapshot
 * read back from a platform satisfies it as-is.
 */
export interface EntitlementSnapshot {
	/** Products the customer currently holds, by our own slugs. */
	products: readonly string[];
	/** Feature flags the held products grant, keyed by our own feature slugs. */
	features: Readonly<Record<string, boolean>>;
}

/**
 * Reads the app's own entitlement projection for the current request, returning
 * `null` for a request that carries no billable subject, which the guard treats
 * as holding nothing.
 */
export interface EntitlementSource {
	(context: RequestContext): EntitlementSnapshot | null | Promise<EntitlementSnapshot | null>;
}

/** Options that configure the billing middleware. */
export interface BillingMiddlewareOptions {
	/**
	 * The platform to bill against, or a factory that resolves one per request. A
	 * provider built from a module-level binding needs no factory; one whose
	 * connection varies by tenant uses the factory form.
	 */
	provider: Billing | ((context: RequestContext) => Billing);
	/**
	 * Supplies the projection {@link requireEntitlement} gates on, so the guard
	 * reads the app's own tables. It is called only on a route that guards, and
	 * only once per request, so an app pays for the read where it gates.
	 */
	entitlements?: EntitlementSource;
}

/** Options that configure one entitlement guard. */
export interface RequireEntitlementOptions {
	/**
	 * Builds the response for a request that lacks the feature, receiving the
	 * request context so it can render an upgrade prompt in place as readily as
	 * it can redirect to a pricing page. Omitting it answers `403`.
	 */
	onDenied?: (context: RequestContext, feature: string) => Response | Promise<Response>;
}

/**
 * The snapshot a passing guard resolved, so a handler behind it reads the same
 * projection the gate decided on rather than loading it a second time.
 */
export const Entitlements = createContextKey<EntitlementSnapshot>();

/** Where the middleware leaves the app's projection reader for the guard to call. */
const EntitlementReader = createContextKey<EntitlementSource>();

/** Answer for a request whose subject holds no such feature. */
const FORBIDDEN = 403;

/**
 * Creates a middleware that publishes the request's billing platform as
 * `context.billing`, resolving a per-request provider once per request.
 *
 * @param options - Provider and entitlement configuration; see {@link BillingMiddlewareOptions}.
 * @returns A middleware that populates `context.billing`.
 * @example
 * let router = createRouter({ middleware: [billing({ provider: polar })] });
 */
export default function billing(options: BillingMiddlewareOptions): Middleware {
	return async (context, next) => {
		context.billing =
			typeof options.provider === "function" ? options.provider(context) : options.provider;

		if (options.entitlements) context.set(EntitlementReader, options.entitlements);

		return next();
	};
}

/**
 * Creates a guard that admits a request only when the projection the billing
 * middleware's `entitlements` option supplies grants `feature`, so the decision
 * comes from the app's own tables and the platform stays off the request path.
 *
 * @param feature - Our own feature slug, as a product's flags name it.
 * @param options - How to answer a denied request; see {@link RequireEntitlementOptions}.
 * @returns A middleware that admits entitled requests, answers the rest, and
 * publishes the snapshot it read as `context.entitlements`.
 * @throws When the billing middleware ran without an `entitlements` option.
 * @example
 * router.get(routes.flows, [requireEntitlement("flow_monitors")], handler);
 */
export function requireEntitlement(
	feature: string,
	options: RequireEntitlementOptions = {},
): Middleware<{
	key: typeof Entitlements;
	value: EntitlementSnapshot;
	property: "entitlements";
}> {
	return async (context, next) => {
		let read = context.get(EntitlementReader);

		if (read === undefined) {
			throw new Error(
				"Entitlement projection not found. Pass `entitlements` to billing() before using requireEntitlement().",
			);
		}

		let snapshot = context.has(Entitlements) ? context.get(Entitlements) : await read(context);

		if (snapshot === null || snapshot === undefined || snapshot.features[feature] !== true) {
			if (options.onDenied) return options.onDenied(context, feature);
			return new Response("Forbidden", { status: FORBIDDEN });
		}

		context.set(Entitlements, snapshot, { property: "entitlements" });

		return next();
	};
}
