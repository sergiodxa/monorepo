import { href, Outlet, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import Subject from "~/models/subject";
import { getSubjectFromAccessToken } from "~/utils/decode-access-token";

import type { Route } from "./+types/route";

import { Navigation } from "./components/nav";

export const middleware: Route.MiddlewareFunction[] = [
	async (_, next) => {
		let accessToken = session().get("accessToken");
		if (!accessToken) return redirect(href("/authorize"));

		let subjectId = getSubjectFromAccessToken(accessToken);
		let subject = await Subject.findById(db(), subjectId);

		if (!subject || subject.role !== "admin") {
			return redirect("/sessions");
		}

		return next();
	},
];

export default function AdminLayout() {
	return (
		<main className="mx-auto max-w-7xl p-6 md:p-10">
			<Navigation />
			<div className="mt-6">
				<Outlet />
			</div>
		</main>
	);
}
