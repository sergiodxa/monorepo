/**
 * Utilities for parsing user agent strings into human-readable device information.
 *
 * Used to label passkeys and browser sessions with friendly names (e.g. "Chrome
 * on macOS") and to pick a matching device icon in the account UI.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { html, type SafeHtml } from "remix/html-template";

/** Human-readable browser, OS, and device type parsed from a user agent string. */
interface ParsedUserAgent {
	browser: string;
	os: string;
	device: "desktop" | "mobile" | "tablet" | "unknown";
}

/**
 * Parses a user agent string into browser and OS information.
 * @param userAgent - Raw user agent string
 * @returns Parsed browser, OS, and device type
 * @example
 * parseUserAgent(request.headers.get("user-agent"));
 * // { browser: "Safari", os: "macOS", device: "desktop" }
 */
export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
	if (!userAgent) {
		return { browser: "Unknown", os: "Unknown", device: "unknown" };
	}

	let browser = parseBrowser(userAgent);
	let os = parseOS(userAgent);
	let device = parseDevice(userAgent);

	return { browser, os, device };
}

/**
 * Identifies the browser from a user agent string.
 * @param ua - Raw user agent string.
 * @returns A browser name, or `"Unknown Browser"` when none matches.
 */
function parseBrowser(ua: string): string {
	// Order matters - check more specific browsers first
	if (ua.includes("Edg/")) return "Edge";
	if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
	if (ua.includes("Chrome/") && !ua.includes("Chromium")) return "Chrome";
	if (ua.includes("Chromium")) return "Chromium";
	if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
	if (ua.includes("Firefox/")) return "Firefox";
	if (ua.includes("MSIE") || ua.includes("Trident/")) return "Internet Explorer";
	return "Unknown Browser";
}

/**
 * Identifies the operating system from a user agent string.
 * @param ua - Raw user agent string.
 * @returns An OS name, or `"Unknown OS"` when none matches.
 */
function parseOS(ua: string): string {
	// Mobile OS first
	if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
	if (ua.includes("Android")) return "Android";

	// Desktop OS
	if (ua.includes("Mac OS X") || ua.includes("macOS")) return "macOS";
	if (ua.includes("Windows NT 10")) return "Windows 10";
	if (ua.includes("Windows NT 11") || (ua.includes("Windows NT 10") && ua.includes("Win64")))
		return "Windows";
	if (ua.includes("Windows")) return "Windows";
	if (ua.includes("Linux") && !ua.includes("Android")) return "Linux";
	if (ua.includes("CrOS")) return "ChromeOS";

	return "Unknown OS";
}

/**
 * Classifies the device form factor from a user agent string.
 * @param ua - Raw user agent string.
 * @returns `"desktop"`, `"mobile"`, `"tablet"`, or `"unknown"`.
 */
function parseDevice(ua: string): "desktop" | "mobile" | "tablet" | "unknown" {
	if (ua.includes("iPad") || ua.includes("Tablet")) return "tablet";
	if (ua.includes("Mobile") || ua.includes("iPhone") || ua.includes("Android")) {
		if (ua.includes("iPad")) return "tablet";
		return "mobile";
	}
	if (ua.includes("Windows") || ua.includes("Mac OS") || ua.includes("Linux")) {
		return "desktop";
	}
	return "unknown";
}

/**
 * Formats parsed user agent into a display string like "Safari on macOS".
 * @param parsed - Parsed user agent info
 * @returns Formatted string
 */
export function formatUserAgent(parsed: ParsedUserAgent): string {
	if (parsed.browser === "Unknown" && parsed.os === "Unknown") {
		return "Unknown device";
	}
	return `${parsed.browser} on ${parsed.os}`;
}

/**
 * Generates a passkey name from user agent, like "Chrome on macOS" or "Safari on iPhone".
 * @param userAgent - Raw user agent string
 * @returns Passkey name string
 */
export function generatePasskeyName(userAgent: string | null): string {
	let parsed = parseUserAgent(userAgent);
	return formatUserAgent(parsed);
}

/**
 * Returns an SVG icon for the device type.
 * @param device - Device type
 * @returns SafeHtml SVG element
 */
export function getDeviceIcon(device: "desktop" | "mobile" | "tablet" | "unknown"): SafeHtml {
	switch (device) {
		case "desktop":
			return html`
				<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					/>
				</svg>
			`;
		case "mobile":
			return html`
				<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
					/>
				</svg>
			`;
		case "tablet":
			return html`
				<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
					/>
				</svg>
			`;
		default:
			return html`
				<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					/>
				</svg>
			`;
	}
}
