export namespace Log {
	export type Payload = Record<string, unknown>;
	export type Level = "info" | "error";
	export type Entry = { level: Level; event: string; payload?: Payload };
}
