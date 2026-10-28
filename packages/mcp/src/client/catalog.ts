/**
 * Tool catalog types for an optionally typed {@link McpClient}: each entry
 * names a tool's argument object and the structured output a caller expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One tool in a first-party catalog: `input` types `call`'s tool fields (the
 * optional client-only `schema` key is separate), `output` types
 * `structuredContent` when no result schema is passed.
 */
export interface ToolContract {
	/** Tool argument fields for `call` (not including client-only `schema`). */
	input: object;
	/** Expected `structuredContent` shape when no result schema is passed. */
	output?: unknown;
}

/**
 * A map of tool name → {@link ToolContract}. Pass as `connect<Tools>(…)` for
 * typed names and arguments; omit for today's loose string/`Record` surface.
 * `connect` / {@link McpClient} constrain `Tools` as
 * `Record<keyof Tools, ToolContract>` so a concrete interface (no string index)
 * still type-checks.
 */
export type ToolCatalog = Record<string, ToolContract>;

/**
 * Default catalog: any string name, loose args, unknown structured output —
 * the same signatures untyped `connect()` had before catalogs existed.
 */
export type UntypedTools = {
	[name: string]: { input: Record<string, unknown>; output: unknown };
};

/** The `output` type of one catalog entry, defaulting to `unknown`. */
export type OutputOf<Entry extends ToolContract> = Entry extends {
	output: infer Output;
}
	? Output
	: unknown;
