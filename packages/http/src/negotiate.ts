const shortToMime = new Map<string, string[]>([
	["json", ["application/json"]],
	["html", ["text/html"]],
	["xml", ["application/xml", "text/xml"]],
	["text", ["text/plain"]],
	["markdown", ["text/markdown"]],
	["css", ["text/css"]],
	["javascript", ["text/javascript", "application/javascript"]],
	["csv", ["text/csv"]],
	["pdf", ["application/pdf"]],
]);

const mimeToShort = new Map<string, string>([
	["application/json", "json"],
	["text/html", "html"],
	["application/xml", "xml"],
	["text/xml", "xml"],
	["text/plain", "text"],
	["text/markdown", "markdown"],
	["text/css", "css"],
	["text/javascript", "javascript"],
	["application/javascript", "javascript"],
	["text/csv", "csv"],
	["application/pdf", "pdf"],
]);

/**
 * Represents a parsed Accept header for content negotiation.
 * Provides methods to check accepted content types and find preferences.
 */
export class AcceptList {
	private types: string[];

	constructor(header: string) {
		this.types = this.parseAcceptHeader(header);
	}

	/**
	 * Checks if a content type is accepted by the client.
	 * Supports shorthand types like "json", "html", "xml", "text", "markdown".
	 * @param type - The content type or shorthand to check
	 * @returns True if the type is accepted
	 * @example
	 * if (accepts(request).includes("json")) { ... }
	 * @example
	 * if (accepts(request).includes("text/html")) { ... }
	 */
	includes(type: string): boolean {
		let mimeTypes = this.resolveType(type);
		return this.types.some((t) => mimeTypes.includes(t) || t === "*/*");
	}

	/**
	 * Returns all accepted types in preference order (highest quality first).
	 * @returns Array of MIME types sorted by preference
	 * @example
	 * let types = accepts(request).all(); // ["text/html", "application/json", ...]
	 */
	all(): string[] {
		return this.types;
	}

	/**
	 * Finds the most preferred type from a list of available types.
	 * Returns the first match based on client preference, or null if none match.
	 * @param types - Available content types to choose from
	 * @returns The preferred type or null
	 * @example
	 * let preferred = accepts(request).preferred("application/json", "text/html");
	 */
	preferred(...types: string[]): string | null {
		for (let accepted of this.types) {
			if (types.includes(accepted)) return accepted;
			if (accepted === "*/*") return types[0] ?? null;
		}
		return null;
	}

	/**
	 * Converts a MIME type to its shorthand form.
	 * @param mimeType - The full MIME type
	 * @returns The shorthand type or null if not recognized
	 */
	toShortType(mimeType: string): string | null {
		return mimeToShort.get(mimeType) ?? null;
	}

	/**
	 * Parses an Accept header string into an array of MIME types sorted by quality.
	 * @param header - The Accept header value
	 * @returns Array of MIME types sorted by preference (highest quality first)
	 */
	private parseAcceptHeader(header: string): string[] {
		return header
			.split(",")
			.map((part) => {
				let [type = "", ...params] = part.trim().split(";");
				let q = 1;
				for (let param of params) {
					let [key, value = ""] = param.trim().split("=");
					if (key === "q") q = Number.parseFloat(value) || 0;
				}
				return { type: type.trim(), q };
			})
			.sort((a, b) => b.q - a.q)
			.map(({ type }) => type);
	}

	/**
	 * Resolves a shorthand type to an array of MIME types.
	 * @param type - The shorthand type or full MIME type
	 * @returns Array of MIME types
	 */
	private resolveType(type: string): string[] {
		return shortToMime.get(type) ?? [type];
	}
}

/**
 * Parses the Accept header from a request for content negotiation.
 * Returns an AcceptList that can be queried for accepted content types.
 * @param request - The incoming request
 * @returns An AcceptList instance for querying accepted types
 * @example
 * if (accepts(request).includes("json")) return json(data);
 * @example
 * let types = accepts(request).all();
 */
export function accepts(request: Request): AcceptList {
	let header = request.headers.get("Accept") ?? "*/*";
	return new AcceptList(header);
}

/**
 * Responds with the appropriate content type based on the Accept header.
 * Similar to Rails' respond_to, calls the matching handler for the preferred type.
 * Returns 406 Not Acceptable if no handler matches and no default is provided.
 * @param request - The incoming request
 * @param handlers - Object mapping content types to response handlers
 * @returns The response from the matching handler
 * @example
 * return respond(request, {
 *   json: () => json({ data }),
 *   html: () => html(renderPage(data)),
 * });
 * @example
 * return respond(request, {
 *   json: () => json({ data }),
 *   default: () => json({ data }), // fallback
 * });
 */
export function respond(request: Request, handlers: respond.Handlers): Response {
	let accept = accepts(request);

	for (let type of accept.all()) {
		let shortType = accept.toShortType(type);
		if (shortType && handlers[shortType]) return handlers[shortType]();
	}

	if (handlers.default) return handlers.default();

	return new Response("Not Acceptable", {
		status: 406,
		statusText: "Not Acceptable",
	});
}

export namespace respond {
	export type Handlers = {
		json?: () => Response;
		html?: () => Response;
		xml?: () => Response;
		text?: () => Response;
		markdown?: () => Response;
		css?: () => Response;
		javascript?: () => Response;
		csv?: () => Response;
		pdf?: () => Response;
		default?: () => Response;
		[key: string]: (() => Response) | undefined;
	};
}
