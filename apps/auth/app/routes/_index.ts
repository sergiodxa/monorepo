import { href, redirect } from "react-router";

export function loader() {
	return redirect(href("/authorize"));
}
