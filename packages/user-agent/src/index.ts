/**
 * Public surface of the user agent package: the reading function and the shapes
 * it answers with, including the closed sets of browser, engine, system, device
 * and vendor names a caller can switch over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	Browser,
	BrowserName,
	Device,
	DeviceType,
	DeviceVendor,
	Engine,
	EngineName,
	OperatingSystem,
	OperatingSystemName,
	UserAgent,
} from "./types.js";

export { parse } from "./parse.js";
