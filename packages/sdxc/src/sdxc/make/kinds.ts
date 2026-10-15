/**
 * Every kind of file `sdxc make` writes: the folder the app layout gives it, its extension,
 * whether a test goes beside it, and the placeholders its stubs may use. The folders are
 * fixed, so a generated file always lands where the layout expects to find it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A kind `sdxc make` writes. */
export type KindName =
	| "controller"
	| "middleware"
	| "validator"
	| "job"
	| "model"
	| "migration"
	| "factory"
	| "service"
	| "policy"
	| "initializer"
	| "email"
	| "mcp";

/** Where one kind's files go and which placeholders their stubs may use. */
export interface Kind {
	/** The folder under the project root; a migration's folder comes from its chain instead. */
	folder: string;
	extension: ".ts" | ".tsx" | ".sql";
	/** Whether `make.tests` writes a test beside the file. */
	tests: boolean;
	/** Whether the name may hold folders. */
	nested: boolean;
	/** Placeholders beyond {@link COMMON_PLACEHOLDERS}. */
	placeholders: readonly string[];
}

/**
 * The placeholders every stub may use: the file's base name (`name`), its camelCase `key`, its
 * PascalCase `Name`, its `snake` and `title` spellings, and the import `specifier` of the file.
 */
export const COMMON_PLACEHOLDERS = ["name", "key", "Name", "snake", "title", "specifier"];

/**
 * Every kind, in the order `sdxc make --help` lists them. `path` is the declaration's key path
 * in its map (`trials.expire`), `routes` the route contract's specifier, `tool` the MCP tool
 * name, `uri` an MCP resource's pattern, `model` the factory's model specifier.
 */
export const KINDS: Readonly<Record<KindName, Kind>> = {
	controller: {
		folder: "app/http/controllers",
		extension: ".tsx",
		tests: true,
		nested: true,
		placeholders: ["path", "routes"],
	},
	middleware: {
		folder: "app/http/middleware",
		extension: ".ts",
		tests: true,
		nested: true,
		placeholders: [],
	},
	validator: {
		folder: "app/http/validators",
		extension: ".ts",
		tests: true,
		nested: true,
		placeholders: [],
	},
	job: { folder: "app/jobs", extension: ".ts", tests: true, nested: true, placeholders: ["path"] },
	model: { folder: "app/models", extension: ".ts", tests: true, nested: true, placeholders: [] },
	migration: {
		folder: "database/migrations",
		extension: ".sql",
		tests: false,
		nested: false,
		placeholders: [],
	},
	factory: {
		folder: "database/factories",
		extension: ".ts",
		tests: false,
		nested: true,
		placeholders: ["model"],
	},
	service: {
		folder: "app/services",
		extension: ".ts",
		tests: true,
		nested: true,
		placeholders: [],
	},
	policy: { folder: "app/policies", extension: ".ts", tests: true, nested: true, placeholders: [] },
	initializer: {
		folder: "app/initializers",
		extension: ".ts",
		tests: true,
		nested: true,
		placeholders: [],
	},
	email: { folder: "app/emails", extension: ".tsx", tests: true, nested: true, placeholders: [] },
	mcp: {
		folder: "app/mcp/tools",
		extension: ".ts",
		tests: true,
		nested: true,
		placeholders: ["path", "tool", "uri"],
	},
};

/** Where `make mcp --resource` writes, beside the tools. */
export const MCP_RESOURCES_FOLDER = "app/mcp/resources";

/** Whether `value` names a kind. */
export function isKind(value: string): value is KindName {
	return Object.hasOwn(KINDS, value);
}
