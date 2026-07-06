/**
 * Request-scoped authenticated-subject context for the app. Creates a `SubjectContext`
 * carrying the current session's `SessionData` and exposes a `subject()` accessor that reads
 * it from context storage. Exists so route and loader code can reach the signed-in subject
 * without passing it through every function call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContext } from "react-router";

import type { SessionData } from "~/session";

import { getContext } from "./context-storage";

export const SubjectContext = createContext<SessionData>();

export function subject() {
	return getContext().get(SubjectContext);
}
