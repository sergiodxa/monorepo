/**
 * The reason phrase for each HTTP error status, which RFC 9457 makes the `title`
 * of an `about:blank` problem, so a status alone produces a complete document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The registered phrase for every 4xx and 5xx status in the IANA HTTP status registry. */
const STATUS_PHRASES: Record<number, string> = {
	400: "Bad Request",
	401: "Unauthorized",
	402: "Payment Required",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	406: "Not Acceptable",
	407: "Proxy Authentication Required",
	408: "Request Timeout",
	409: "Conflict",
	410: "Gone",
	411: "Length Required",
	412: "Precondition Failed",
	413: "Content Too Large",
	414: "URI Too Long",
	415: "Unsupported Media Type",
	416: "Range Not Satisfiable",
	417: "Expectation Failed",
	421: "Misdirected Request",
	422: "Unprocessable Content",
	423: "Locked",
	424: "Failed Dependency",
	425: "Too Early",
	426: "Upgrade Required",
	428: "Precondition Required",
	429: "Too Many Requests",
	431: "Request Header Fields Too Large",
	451: "Unavailable For Legal Reasons",
	500: "Internal Server Error",
	501: "Not Implemented",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
	505: "HTTP Version Not Supported",
	506: "Variant Also Negotiates",
	507: "Insufficient Storage",
	508: "Loop Detected",
	511: "Network Authentication Required",
};

/**
 * The reason phrase for `status`, or `"Unknown Status"` for a code the registry
 * leaves unnamed, so every problem carries a title.
 *
 * @param status - The HTTP status code.
 * @returns The phrase to use as the problem's `title`.
 */
export function statusPhrase(status: number): string {
	return STATUS_PHRASES[status] ?? "Unknown Status";
}
