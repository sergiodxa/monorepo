/**
 * Request-scoped team context for the app. Defines a `Team` type combining the selected team
 * row with its memberships, creates a `TeamContext`, and exposes a `team()` accessor that
 * reads the current team from context storage. Exists so route and loader code can reach the
 * active team without passing it through every function call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContext } from "react-router";

import type { SelectMembership, SelectTeam } from "~/db/schema";

import { getContext } from "./context-storage";

export interface Team extends SelectTeam {
	memberships: [Pick<SelectMembership, "subjectId" | "role">];
}

export const TeamContext = createContext<Team>();

export function team() {
	return getContext().get(TeamContext);
}
