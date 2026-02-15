import { queryAnalytics } from "~/services/analytics.server";

export async function loader() {
	try {
		await queryAnalytics<{ test: number }>("SELECT 1 as test FROM ping_results LIMIT 1");

		return Response.json({ status: "ok" }, { status: 200 });
	} catch (error) {
		let message = error instanceof Error ? error.message : "Unknown error occurred";

		return Response.json({ status: "error", message }, { status: 503 });
	}
}
