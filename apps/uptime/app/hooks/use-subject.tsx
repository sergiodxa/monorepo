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
