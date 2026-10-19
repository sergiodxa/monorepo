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
	| "mcp"
	| "command";

/** Where one kind's files go and which placeholders their stubs may use. */
export interface Kind {
	/** The folder under the project root; a migration's folder comes from its chain instead. */
	folder: string;
	extension: ".ts" | ".tsx" | ".sql";
	/** Whether `make.tests` writes a test beside the file. */
	tests: boolean;
	/**
	 * Whether the kind writes its test alone: a policy's abilities and grants are edits to the
	 * app's catalog and policy, so the only file it writes is the test that checks them.
	 */
	testOnly?: boolean;
	/** Whether the name may hold folders. */
	nested: boolean;
	/** Placeholders beyond {@link COMMON_PLACEHOLDERS}. */
	placeholders: readonly string[];
}

/**
 * The placeholders every stub may use: the file's base name (`name`), its camelCase `key`, its
 * PascalCase `Name`, its `snake` and `title` spellings, the import `specifier` of the file, and
 * the `header` tags crediting its author, placed at the end of the module JSDoc's description.
 */
export const COMMON_PLACEHOLDERS = ["name", "key", "Name", "snake", "title", "specifier", "header"];

/**
 * Every kind, in the order `sdxc make --help` lists them. `path` is the declaration's key path
 * in its map (`trials.expire`, or a policy's ability group `billing.invoice`), `routes` the route contract's specifier, `tool` the MCP tool
 * name, `uri` an MCP resource's pattern, `model` the factory's model specifier. A command's
 * `command` is the words typed to run it (`users grant`), `member` the property access that
 * reaches its declaration (`.users.grant`), and `words` those words as string literals. A
 * model's `columns` are the column lines of the fields `make model` was given and `table` the
 * plural its table is named; a factory's `attributes` are a value per field, empty without fields.
 * A `--resource` controller's `ability` is the one it checks, `access` the guard answering a
 * refusal with an empty response and `pageAccess` the one rendering the not-found page.
 */
export const KINDS: Readonly<Record<KindName, Kind>> = {
	controller: {
		folder: "app/http/controllers",
		extension: ".tsx",
		tests: true,
		nested: true,
		placeholders: ["path", "routes", "ability", "access", "pageAccess"],
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
	model: {
		folder: "app/models",
		extension: ".ts",
		tests: true,
		nested: true,
		placeholders: ["columns", "table"],
	},
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
		placeholders: ["model", "attributes"],
	},
	service: {
		folder: "app/services",
		extension: ".ts",
		tests: true,
		nested: true,
		placeholders: [],
	},
	policy: {
		folder: "app/policies",
		extension: ".ts",
		tests: true,
		testOnly: true,
		nested: true,
		placeholders: ["path"],
	},
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
	command: {
		folder: "app/commands",
		extension: ".ts",
		tests: true,
		nested: true,
		placeholders: ["command", "member", "words"],
	},
};

/** What `make model` writes beside the model unless `--skip` names it. */
export const MODEL_COMPANIONS = ["migration", "factory"] as const;

/** One of {@link MODEL_COMPANIONS}. */
export type ModelCompanion = (typeof MODEL_COMPANIONS)[number];

/** Where `make mcp --resource` writes, beside the tools. */
export const MCP_RESOURCES_FOLDER = "app/mcp/resources";

/** Whether `value` names a kind. */
export function isKind(value: string): value is KindName {
	return Object.hasOwn(KINDS, value);
}
