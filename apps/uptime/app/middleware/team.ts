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
