/**
 * The server side of Parley's live conversation: a stream of JSON lines that first answers
 * whatever the visitor last posted, then plays the conversation's scripted lines one by one
 * with a typing pause before each, flipping a teammate's presence along the way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";

import type { DemoAppRequest } from "~/resources/views/demo-apps";
import type { LiveEvent } from "~/resources/views/demo-apps/parley/live";
import type { Entry } from "~/resources/views/demo-apps/parley/model";

import {
	LIVE,
	answerTo,
	conversationPage,
	findConversation,
	findPerson,
} from "~/resources/views/demo-apps/parley/data";
import { LiveRun } from "~/resources/views/demo-apps/parley/messages";
import { answerEntry, liveEntry } from "~/resources/views/demo-apps/parley/model";
import { PRESENCE_LABEL } from "~/resources/views/demo-apps/parley/parts";
import { readState } from "~/resources/views/demo-apps/parley/state";

/** How long after the visitor's own post a teammate starts typing their answer. */
const ANSWER_DELAY = 1500;

/** How long a teammate types an answer. */
const ANSWER_TYPING = 2400;

/** A teammate who comes back to their desk partway through, so presence visibly changes. */
const RETURNING = { person: "jonah", after: 1 } as const;

/** Resolves after `ms`, or at once when the visitor leaves. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		let timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

/** Renders one entry as the run the log appends. */
async function lineHtml(entry: Entry, page: string, thread: boolean): Promise<string> {
	return renderToString(
		<LiveRun entry={entry} place={{ page, back: page }} inThread={thread} now={entry.at} />,
	);
}

/**
 * Answers `live/c/<name>` or `live/d/<handle>` with the conversation's live events, or `null`
 * for an address no conversation has.
 *
 * @param part The stream's path.
 * @param request The request, whose cookie says what the visitor already saw.
 */
export function liveStream(part: string, request: DemoAppRequest): ReadableStream<string> | null {
	let [first = "", kind = "", name = "", ...rest] = part.split("/");
	if (first !== "live" || (kind !== "c" && kind !== "d") || name === "" || rest.length > 0) {
		return null;
	}
	let key = `${kind}:${name}`;
	let conversation = findConversation(key);
	if (conversation === undefined) return null;
	let page = conversationPage(key);
	let state = readState(request.cookie);
	let controller = new AbortController();
	let pending = state.sent.filter((message) => message.key === key && !message.answered).at(-1);
	let seen = state.live[key]?.length ?? 0;
	let lines = LIVE[key] ?? [];

	return new ReadableStream<string>({
		async start(stream) {
			let emit = (event: LiveEvent) => stream.enqueue(`${JSON.stringify(event)}\n`);
			let signal = controller.signal;
			let shown = 0;

			if (pending !== undefined) {
				let answer = answerTo(key, pending.text);
				let person = findPerson(answer.author);
				await wait(ANSWER_DELAY, signal);
				if (signal.aborted) return;
				emit({ type: "typing", person: answer.author, name: person?.name.split(" ")[0] ?? "" });
				await wait(ANSWER_TYPING, signal);
				if (signal.aborted) return;
				let entry = answerEntry({ ...pending, at: Date.now() - 12_000 }, state);
				if (entry !== null) {
					let thread = pending.parent !== undefined;
					emit({
						type: "message",
						person: answer.author,
						target: thread ? `thread-${pending.parent}` : "log",
						html: await lineHtml(entry, page, thread),
						seen: { answer: pending.id },
					});
					shown += 1;
				}
			}

			for (let index = seen; index < lines.length; index += 1) {
				let line = lines[index];
				if (line === undefined) break;
				await wait(line.pause, signal);
				if (signal.aborted) return;
				let person = findPerson(line.author);
				if (line.typing > 0 && person !== undefined && !person.bot) {
					emit({ type: "typing", person: line.author, name: person.name.split(" ")[0] ?? "" });
					await wait(line.typing, signal);
					if (signal.aborted) return;
				}
				let entry = liveEntry(key, index, Date.now(), state);
				if (entry === null) continue;
				emit({
					type: "message",
					person: line.author,
					target: "log",
					html: await lineHtml(entry, page, false),
					seen: { live: String(index) },
				});
				shown += 1;
				if (shown === RETURNING.after) {
					emit({
						type: "presence",
						person: RETURNING.person,
						state: "active",
						label: PRESENCE_LABEL.active,
					});
				}
			}
			stream.close();
		},
		cancel() {
			controller.abort();
		},
	});
}
