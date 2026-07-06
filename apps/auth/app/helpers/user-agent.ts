/**
 * User-agent parsing helper for the auth app. Performs lightweight string
 * matching on a raw user-agent header to infer the browser, operating system,
 * and device type, producing the human-readable labels shown in the session and
 * device listings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

interface ParsedUserAgent {
	browser: string;
	os: string;
	deviceType: "desktop" | "mobile" | "tablet" | "unknown";
}

export function parseUserAgent(ua: string | null): ParsedUserAgent {
	if (!ua) {
		return { browser: "Unknown", os: "Unknown", deviceType: "unknown" };
	}

	let browser = "Unknown";
	let os = "Unknown";
	let deviceType: ParsedUserAgent["deviceType"] = "desktop";

	// Detect browser
	if (ua.includes("Firefox/")) {
		browser = "Firefox";
	} else if (ua.includes("Edg/")) {
		browser = "Edge";
	} else if (ua.includes("Chrome/")) {
		browser = "Chrome";
	} else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
		browser = "Safari";
	} else if (ua.includes("Opera/") || ua.includes("OPR/")) {
		browser = "Opera";
	}

	// Detect OS
	if (ua.includes("Windows")) {
		os = "Windows";
	} else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) {
		os = "macOS";
	} else if (ua.includes("Linux")) {
		os = "Linux";
	} else if (ua.includes("Android")) {
		os = "Android";
	} else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) {
		os = "iOS";
	}

	// Detect device type
	if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
		deviceType = "mobile";
	} else if (ua.includes("iPad") || ua.includes("Tablet")) {
		deviceType = "tablet";
	}

	return { browser: `${browser} on ${os}`, os, deviceType };
}
