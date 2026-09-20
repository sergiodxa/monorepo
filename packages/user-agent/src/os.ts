/**
 * Which operating system sent the request, reported in the platform's own
 * numbering: `17.4` for iOS, `14` for Android, `10` for Windows. Each system
 * writes its version somewhere different, so each gets a reader of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OperatingSystem } from "./types.js";

/** The Apple hardware token, which decides between the two Apple systems. */
const APPLE_DEVICE = /\b(?:iPhone|iPod|iPad)\b/;

/** Apple writes the version with underscores, e.g. `CPU OS 17_4 like Mac OS X`. */
const APPLE_VERSION = /\b(?:iPhone )?OS (\d+(?:[._]\d+)*) like Mac OS X/;

/** The release where Apple split the tablet system off under its own name. */
const IPADOS_SINCE = 13;

/**
 * The marketing name behind each NT version. Windows 11 reports `NT 10.0` like
 * its predecessor, so a machine on 11 reads as `10`.
 */
const WINDOWS_NT_VERSIONS = new Map([
	["5.1", "XP"],
	["5.2", "XP"],
	["6.0", "Vista"],
	["6.1", "7"],
	["6.2", "8"],
	["6.3", "8.1"],
	["10.0", "10"],
]);

/** Turn Apple's underscore-separated version into the dotted form it stands for. */
function dotted(version: string): string {
	return version.replaceAll("_", ".");
}

/**
 * iOS and iPadOS, told apart by the hardware token and the version: the tablet
 * system carried the phone's name and numbering until it was split off at 13.
 */
function readApple(userAgent: string): OperatingSystem | null {
	if (!APPLE_DEVICE.test(userAgent)) return null;

	let version = APPLE_VERSION.exec(userAgent)?.[1];
	let isTablet = userAgent.includes("iPad");
	let major = version === undefined ? 0 : Number.parseInt(version, 10);

	return {
		name: isTablet && major >= IPADOS_SINCE ? "iPadOS" : "iOS",
		version: version === undefined ? null : dotted(version),
	};
}

/**
 * Windows, phones included. A Windows phone reports an Android version beside
 * its own for site compatibility, so it is claimed here before Android sees it.
 */
function readWindows(userAgent: string): OperatingSystem | null {
	let phone = /\bWindows Phone(?: OS)? ([\d.]+)/.exec(userAgent);
	if (phone !== null) return { name: "Windows Phone", version: phone[1] ?? null };

	let nt = /\bWindows NT ([\d.]+)/.exec(userAgent);
	if (nt !== null) {
		let version = nt[1] === undefined ? undefined : WINDOWS_NT_VERSIONS.get(nt[1]);
		return { name: "Windows", version: version ?? null };
	}

	if (userAgent.includes("Windows")) return { name: "Windows", version: null };

	return null;
}

/** Android, whose version follows the name directly and is absent on some builds. */
function readAndroid(userAgent: string): OperatingSystem | null {
	let match = /\bAndroid(?: ([\d.]+))?/.exec(userAgent);
	if (match === null) return null;
	return { name: "Android", version: match[1] ?? null };
}

/**
 * Chrome OS, which reports a build number after the architecture and is read
 * before Linux because a Chromebook describes itself as an X11 platform.
 */
function readChromeOS(userAgent: string): OperatingSystem | null {
	let match = /\bCrOS \S+ ([\d.]+)/.exec(userAgent);
	if (match !== null) return { name: "Chrome OS", version: match[1] ?? null };
	if (userAgent.includes("CrOS")) return { name: "Chrome OS", version: null };
	return null;
}

/**
 * macOS. Safari freezes the version it reports at `10_15_7`, so a newer Mac
 * reads as `10.15.7` while a Chromium browser on the same machine reports the
 * real release.
 */
function readMac(userAgent: string): OperatingSystem | null {
	let match = /\bMac OS X (\d+(?:[._]\d+)*)/.exec(userAgent);
	if (match !== null) {
		let version = match[1];
		return { name: "macOS", version: version === undefined ? null : dotted(version) };
	}

	if (userAgent.includes("Macintosh")) return { name: "macOS", version: null };

	return null;
}

/** Linux, the desktop platform left once every system built on it is claimed. */
function readLinux(userAgent: string): OperatingSystem | null {
	if (/\b(?:Linux|X11)\b/.test(userAgent)) return { name: "Linux", version: null };
	return null;
}

/**
 * Name the operating system behind a user agent string and the version it reports.
 *
 * @param userAgent - The raw `User-Agent` header value.
 * @returns The system, with `null` in both fields when no reader claims the string.
 */
export function detectOperatingSystem(userAgent: string): OperatingSystem {
	return (
		readApple(userAgent) ??
		readWindows(userAgent) ??
		readAndroid(userAgent) ??
		readChromeOS(userAgent) ??
		readMac(userAgent) ??
		readLinux(userAgent) ?? { name: null, version: null }
	);
}
