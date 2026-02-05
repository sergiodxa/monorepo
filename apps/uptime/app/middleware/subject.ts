import { createContext } from "react-router";

import type { SessionData } from "~/session";

import { getContext } from "./context-storage";

export const SubjectContext = createContext<SessionData>();

export function subject() {
	return getContext().get(SubjectContext);
}
