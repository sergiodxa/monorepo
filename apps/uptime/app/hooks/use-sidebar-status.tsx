import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useCallback,
	useContext,
	useState,
} from "react";

type Status = "open" | "closed";

const StateContext = createContext<Status>("closed");
const DispatchContext = createContext<Dispatch<SetStateAction<Status>>>(() => void 0);

export function SidebarStatusProvider({
	children,
}: {
	children: (status: Status) => React.ReactNode;
}) {
	let [status, setStatus] = useState<Status>("closed");

	return (
		<DispatchContext.Provider value={setStatus}>
			<StateContext.Provider value={status}>{children(status)}</StateContext.Provider>
		</DispatchContext.Provider>
	);
}

export function useSidebarStatus() {
	return useContext(StateContext);
}

function useSidebarStatusDispatch() {
	return useContext(DispatchContext);
}

export function useToggleSidebarStatus() {
	let dispatch = useSidebarStatusDispatch();
	return useCallback(() => {
		dispatch((current) => (current === "open" ? "closed" : "open"));
	}, [dispatch]);
}
