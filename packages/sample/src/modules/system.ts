/**
 * Files, paths, and the machine-facing strings around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset.js";
import type { Random } from "../random.js";

/** Interface name parts, in the order a name is assembled. */
const INTERFACE_TYPES = ["en", "wl", "ww"] as const;
const INTERFACE_SCHEMAS = ["index", "slot", "mac", "pci"] as const;

/** Fields of a cron expression, each with the range it admits. */
const CRON_FIELDS = [
	{ min: 0, max: 59 },
	{ min: 0, max: 23 },
	{ min: 1, max: 28 },
	{ min: 1, max: 12 },
	{ min: 0, max: 6 },
] as const;

/** Options for a file name. */
export interface FileNameOptions {
	/** The extension to use; a common one is drawn when none is named. */
	extension?: string;
}

/** Options for a network interface name. */
export interface NetworkInterfaceOptions {
	/** `"en"`, `"wl"`, or `"ww"`; drawn when none is named. */
	type?: string;
	/** How the suffix is built: `"index"`, `"slot"`, `"mac"`, or `"pci"`. */
	schema?: string;
}

/** File names, paths, types, and machine identifiers. */
export interface SystemModule {
	/** An extension in everyday use, such as `"pdf"`. */
	commonFileExt(): string;
	/** A broad file kind in everyday use, such as `"image"`. */
	commonFileType(): string;
	/** A file name carrying a common extension. */
	commonFileName(options?: FileNameOptions): string;
	/** An extension from the wider list, such as `"woff2"`. */
	fileExt(): string;
	/** A broad file kind, such as `"font"`. */
	fileType(): string;
	/** A file name carrying an extension from the wider list. */
	fileName(options?: FileNameOptions): string;
	/** An absolute directory, such as `"/var/log"`. */
	directoryPath(): string;
	/** An absolute path to a file. */
	filePath(): string;
	/** A MIME type, such as `"image/png"`. */
	mimeType(): string;
	/** A network interface name, such as `"enp3s0"`. */
	networkInterface(options?: NetworkInterfaceOptions): string;
	/** A semantic version, such as `"3.7.1"`. */
	semver(): string;
	/** A cron expression, such as `"15 3 * * 1"`. */
	cron(): string;
}

/** Create the `system` module over one stream and dataset. */
export function createSystemModule(random: Random, data: Dataset): SystemModule {
	function name(extension: string): string {
		return `${random.pick(data.fileWords)}_${random.pick(data.fileWords)}.${extension}`;
	}

	let system: SystemModule = {
		commonFileExt() {
			return random.pick(data.commonFileExtensions);
		},
		commonFileType() {
			return random.pick(data.commonFileTypes);
		},
		commonFileName(options = {}) {
			return name(options.extension ?? system.commonFileExt());
		},
		fileExt() {
			return random.pick(data.fileExtensions);
		},
		fileType() {
			let mime = system.mimeType();
			return mime.slice(0, mime.indexOf("/"));
		},
		fileName(options = {}) {
			return name(options.extension ?? system.fileExt());
		},
		directoryPath() {
			return random.pick(data.directoryPaths);
		},
		filePath() {
			return `${system.directoryPath()}/${system.fileName()}`;
		},
		mimeType() {
			return random.pick(data.mimeTypes);
		},
		networkInterface(options = {}) {
			let type = options.type ?? random.pick(INTERFACE_TYPES);
			let schema = options.schema ?? random.pick(INTERFACE_SCHEMAS);
			if (schema === "index") return `${type}o${random.int(0, 9)}`;
			if (schema === "slot") return `${type}s${random.int(0, 9)}f${random.int(0, 9)}`;
			if (schema === "pci") return `${type}p${random.int(0, 9)}s${random.int(0, 9)}`;
			let mac = Array.from({ length: 6 }, () =>
				random.int(0, 255).toString(16).padStart(2, "0"),
			).join("");
			return `${type}x${mac}`;
		},
		semver() {
			return `${random.int(0, 9)}.${random.int(0, 20)}.${random.int(0, 20)}`;
		},
		cron() {
			return CRON_FIELDS.map((field) =>
				random.bool(0.4) ? "*" : String(random.int(field.min, field.max)),
			).join(" ");
		},
	};

	return system;
}
