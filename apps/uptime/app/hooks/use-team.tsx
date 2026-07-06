/**
 * React context plumbing for the active team. It defines a `TeamProvider` that supplies the
 * current team (id, name, slug, logo, ownerId) to the tree and a `useTeam` hook that reads
 * it, throwing if used outside a provider. It exists so components can access the current
 * team without prop drilling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContext, useContext } from "react";

interface Team {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	ownerId: string;
}

const TeamContext = createContext<Team | null>(null);

export function useTeam() {
	let team = useContext(TeamContext);
	if (team) return team;
	throw Error("useTeam must be used within a TeamProvider");
}

export function TeamProvider(props: { team: Team; children: React.ReactNode }) {
	return <TeamContext.Provider value={props.team}>{props.children}</TeamContext.Provider>;
}
