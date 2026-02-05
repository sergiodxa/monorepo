import { redirect } from "react-router";

import { getSession } from "~/middleware/session";

export async function loader() {
	getSession().set("email", "sergiodxa@gmail.com");
	return redirect("/accept-invite?invite=caa13997-01d3-4272-a5cc-56bbd974c7f3");
}
