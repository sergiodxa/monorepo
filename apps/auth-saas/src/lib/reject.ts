import { json } from "@pkg/http/response";

export function reject(error: string, description: string, status: number = 400) {
	return json(
		{ error, error_description: description },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}
