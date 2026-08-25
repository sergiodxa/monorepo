/**
 * Accept-header content negotiation: parse quality-ordered client
 * preferences and pick the response representation that matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
 * Holds an Accept header's types ordered by quality so callers can query
 * preference without re-parsing on every check.
 */
export class AcceptList {
	private types: string[];

	constructor(header: string) {
		this.types = this.parseAcceptHeader(header);
	}

	/**
	 * Matches shorthand types ("json", "html", "xml", "text", "markdown") as
	 * well as full MIME types, and treats a wildcard Accept header as
	 * matching any type.
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
	 * Accepted types sorted by preference, highest quality first.
	 * @returns Array of MIME types sorted by preference
	 * @example
	 * let types = accepts(request).all(); // ["text/html", "application/json", ...]
	 */
	all(): string[] {
		return this.types;
	}

	/**
	 * Walks the client's accepted types in preference order and returns the
	 * first one present in `types`; a wildcard Accept header matches the
	 * first of `types` rather than every candidate.
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

	private resolveType(type: string): string[] {
		return shortToMime.get(type) ?? [type];
	}
}

/**
 * Reads the Accept header, defaulting to accepting every type when the
 * client sends none.
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
 * Calls the handler for the client's preferred type, trying candidates in
 * quality order; answers 406 Not Acceptable when nothing matches and no
 * `default` handler is given.
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
