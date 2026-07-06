/**
 * Request-scoped customer-subscription context for the app. Creates a
 * `CustomerSubscriptionContext` holding a promise that resolves to whether the current
 * customer has an active subscription, and exposes a `hasActiveSubscription()` accessor that
 * reads it from context storage. Exists so route and loader code can gate paid features
 * without re-fetching subscription state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContext } from "react-router";

import { getContext } from "./context-storage";

export const CustomerSubscriptionContext = createContext<Promise<boolean>>();

export function hasActiveSubscription() {
	return getContext().get(CustomerSubscriptionContext);
}
