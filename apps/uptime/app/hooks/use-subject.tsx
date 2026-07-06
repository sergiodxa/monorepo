/**
 * React context plumbing for the signed-in subject (user). It defines a `SubjectProvider`
 * that supplies the current user (id, name, email, avatar, isAdmin) to the tree and a
 * `useSubject` hook that reads it, throwing if used outside a provider. It exists so
 * components can access the current user without prop drilling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContext, useContext } from "react";

interface Subject {
	id: string;
	name: string;
	email: string;
	avatar: string;
	isAdmin: boolean;
}

const SubjectContext = createContext<Subject | null>(null);

export function useSubject() {
	let subject = useContext(SubjectContext);
	if (subject) return subject;
	throw Error("useSubject must be used within a SubjectProvider");
}

export function SubjectProvider(props: { subject: Subject; children: React.ReactNode }) {
	return <SubjectContext.Provider value={props.subject}>{props.children}</SubjectContext.Provider>;
}
