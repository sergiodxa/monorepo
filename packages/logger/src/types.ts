/**
 * Structured log entry shapes shared across logger implementations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export namespace Log {
	export type Payload = Record<string, unknown>;
	export type Level = "info" | "error";
	export type Entry = { level: Level; event: string; payload?: Payload };
}
