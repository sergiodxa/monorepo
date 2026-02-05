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
