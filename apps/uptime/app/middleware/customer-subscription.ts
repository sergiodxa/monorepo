import { createContext } from "react-router";

import { getContext } from "./context-storage";

export const CustomerSubscriptionContext = createContext<Promise<boolean>>();

export function hasActiveSubscription() {
	return getContext().get(CustomerSubscriptionContext);
}
