/**
 * The one error every blueprint step fails with. It names the stub and, for a problem inside one,
 * the line, so a message can point a person or an agent straight at the text to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A stub that does not parse or render, or files a plan cannot write. */
export class BlueprintError extends Error {
	override name = "BlueprintError";
	/** The stub the problem is in, as the caller named it; `undefined` for a plan's own errors. */
	readonly source: string | undefined;
	/** The 1-based line in the stub's file, front matter included, when the problem has one. */
	readonly line: number | undefined;

	/**
	 * @param message - What is wrong, without the location; the location leads the final message
	 */
	constructor(message: string, location: { source?: string; line?: number } = {}) {
		let where = [location.source, location.line].filter((part) => part !== undefined).join(":");
		super(where === "" ? message : `${where}: ${message}`);
		this.source = location.source;
		this.line = location.line;
	}
}
