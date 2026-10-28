/**
 * Minimal argv parsing for `mcp-bridge`: a remote URL plus auth/header flags. Kept free of
 * `@sdxc/cli` so the bridge stays Remix-free for Node/Bun agent spawns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Successful parse of a bridge invocation. */
export interface BridgeArgv {
	/** Upstream Streamable HTTP MCP endpoint. */
	url: string;
	/** Extra request headers (`Authorization`, custom keys). */
	headers: Record<string, string>;
	/** Whether cleartext `http://` URLs are allowed. */
	allowHttp: boolean;
}

/** Usage / validation failure; the CLI prints `message` on stderr and exits 2. */
export interface BridgeArgvError {
	message: string;
	showHelp?: boolean;
}

/** Usage text printed for `--help` or a missing URL. */
export const BRIDGE_USAGE = `Usage: mcp-bridge <url> [options]

Bridge Cursor (and other handshake-era MCP clients) to a modern-only
@sdxc/mcp/server endpoint over Streamable HTTP 2026-07-28.

Arguments:
  <url>                 Remote MCP endpoint (https://…/mcp)

Options:
  --header <name:value> Extra request header (repeatable)
  --token <token>       Shorthand for Authorization: Bearer <token>
  --allow-http          Allow cleartext http:// URLs (local development)
  --help, -h            Show this help
  --version, -v         Show version
`;

/**
 * Parses `process.argv.slice(2)` for the default bridge mode.
 *
 * @param argv Arguments after the program name.
 * @returns Parsed options, or an error describing what to print.
 */
export function parseBridgeArgv(argv: readonly string[]): BridgeArgv | BridgeArgvError {
	let url: string | undefined;
	let headers: Record<string, string> = {};
	let allowHttp = false;

	for (let index = 0; index < argv.length; index += 1) {
		let token = argv[index];
		if (token === undefined) break;

		if (token === "--help" || token === "-h") {
			return { message: BRIDGE_USAGE, showHelp: true };
		}
		if (token === "--version" || token === "-v") {
			return { message: "mcp-bridge 0.0.1", showHelp: true };
		}
		if (token === "--allow-http") {
			allowHttp = true;
			continue;
		}
		if (token === "--header" || token.startsWith("--header=")) {
			let value = token === "--header" ? argv[++index] : token.slice("--header=".length);
			if (value === undefined || value.length === 0) {
				return { message: "mcp-bridge: --header requires name:value" };
			}
			let parsed = parseHeader(value);
			if ("message" in parsed) return parsed;
			headers[parsed.name] = parsed.value;
			continue;
		}
		if (token === "--token" || token.startsWith("--token=")) {
			let value = token === "--token" ? argv[++index] : token.slice("--token=".length);
			if (value === undefined || value.length === 0) {
				return { message: "mcp-bridge: --token requires a value" };
			}
			headers.Authorization = `Bearer ${value}`;
			continue;
		}
		if (token.startsWith("-")) {
			return { message: `mcp-bridge: unknown option ${token}` };
		}
		if (url !== undefined) {
			return { message: "mcp-bridge: unexpected extra argument" };
		}
		url = token;
	}

	if (url === undefined) {
		return { message: BRIDGE_USAGE, showHelp: true };
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return { message: `mcp-bridge: invalid URL: ${url}` };
	}

	if (parsedUrl.protocol === "http:") {
		if (!allowHttp) {
			return {
				message:
					"mcp-bridge: http:// URLs require --allow-http (use https:// or pass the flag for local cleartext)",
			};
		}
	} else if (parsedUrl.protocol !== "https:") {
		return { message: `mcp-bridge: unsupported URL protocol ${parsedUrl.protocol}` };
	}

	return { url, headers, allowHttp };
}

/**
 * Splits a `Name:value` or `Name: value` header argument.
 *
 * @param raw Flag value from `--header`.
 */
function parseHeader(raw: string): { name: string; value: string } | BridgeArgvError {
	let separator = raw.indexOf(":");
	if (separator <= 0) {
		return { message: `mcp-bridge: --header expects Name:value, got ${raw}` };
	}
	let name = raw.slice(0, separator).trim();
	let value = raw.slice(separator + 1).trim();
	if (name.length === 0) {
		return { message: `mcp-bridge: --header is missing a name in ${raw}` };
	}
	return { name, value };
}

/** Whether a parse result is an error. */
export function isBridgeArgvError(value: BridgeArgv | BridgeArgvError): value is BridgeArgvError {
	return "message" in value && !("url" in value);
}
