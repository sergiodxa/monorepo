import { redirectDocument } from "react-router";

export function loader() {
	return redirectDocument("https://sergiodxa.com");
}
