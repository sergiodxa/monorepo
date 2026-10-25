/**
 * A reader for the `text/event-stream` format a JMAP event-source resource streams,
 * following the HTML Living Standard's server-sent events parsing: fields per line,
 * an event per blank line, and the last event id carried across events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One dispatched server-sent event. */
export interface ServerSentEvent {
	/** The `event` field, or `"message"` when the event named none. */
	event: string;
	/** The `data` lines joined with `\n`. */
	data: string;
	/** The most recent `id` field the stream sent, at or before this event. */
	id: string | null;
}

/** A line terminator: CRLF, a lone CR or a lone LF. */
const LINE_BREAK = /\r\n|\r|\n/u;

/**
 * Reads `stream` as server-sent events. Comment lines (`:`) and events with empty data are
 * dropped, and an event dispatches once its blank line arrives, so an unterminated last one is dropped.
 * A trailing CR waits for the next chunk, so a CRLF split across two chunks is one line break.
 *
 * @param stream - The response body.
 * @yields Each event, as soon as its terminating blank line arrives.
 */
export async function* readEventStream(
	stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent, void, undefined> {
	let reader = stream.getReader();
	let decoder = new TextDecoder();
	let buffer = "";
	let state = { event: "", data: [] as string[], id: null as string | null };
	try {
		for (;;) {
			let chunk = await reader.read();
			if (chunk.done) return;
			buffer += decoder.decode(chunk.value, { stream: true });
			let held = buffer.endsWith("\r") ? "\r" : "";
			let lines = buffer.slice(0, buffer.length - held.length).split(LINE_BREAK);
			buffer = (lines.pop() ?? "") + held;
			for (let line of lines) {
				let event = readLine(state, line);
				if (event !== null) yield event;
			}
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Applies one line to the event being assembled, and returns the event when the line is
 * the blank one that dispatches it.
 *
 * @param state - The event in progress and the stream's last event id.
 * @param line - One line without its terminator.
 */
function readLine(
	state: { event: string; data: string[]; id: string | null },
	line: string,
): ServerSentEvent | null {
	if (line === "") {
		let event =
			state.data.length === 0
				? null
				: { event: state.event || "message", data: state.data.join("\n"), id: state.id };
		state.event = "";
		state.data = [];
		return event;
	}
	if (line.startsWith(":")) return null;
	let colon = line.indexOf(":");
	let field = colon === -1 ? line : line.slice(0, colon);
	let value = colon === -1 ? "" : line.slice(colon + 1);
	if (value.startsWith(" ")) value = value.slice(1);
	if (field === "event") state.event = value;
	else if (field === "data") state.data.push(value);
	else if (field === "id" && !value.includes("\0")) state.id = value;
	return null;
}
