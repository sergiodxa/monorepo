import { badRequest } from "@pkg/http/response/json";

/**
 * Safely parses JSON from a request body.
 * Returns the parsed body or a badRequest Response if parsing fails.
 */
export async function safeJsonParse(request: Request): Promise<Record<string, unknown> | Response> {
	try {
		let body = await request.json();
		if (typeof body !== "object" || body === null || Array.isArray(body)) {
			return badRequest({ error: "Invalid JSON: expected an object" });
		}
		return body as Record<string, unknown>;
	} catch {
		return badRequest({ error: "Invalid JSON body" });
	}
}

/**
 * Type guard to check if a value is a Response.
 */
export function isResponse(value: unknown): value is Response {
	return value instanceof Response;
}
