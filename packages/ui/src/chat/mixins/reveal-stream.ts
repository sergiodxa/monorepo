/**
 * Replays a server-rendered reply as if it were arriving from a model: its text shows a few
 * words at a time and each block (a paragraph, a list item, a table row, a code block) appears
 * when the text reaches it. The markup is already final, so a stop keeps what has shown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Attribute a reply waiting to stream carries in the server's HTML; `streamTarget()` keeps it
 * unpainted while scripts run and motion is allowed, and {@link revealStream} removes it.
 */
export const STREAM_PENDING_ATTRIBUTE = "data-stream-pending";

/** Attribute {@link revealStream} sets on the reply when it ends: `"done"` or `"stopped"`. */
export const STREAM_END_ATTRIBUTE = "data-stream-end";

/** Attribute {@link revealStream} puts on a block the text has not reached yet. */
export const STREAM_HIDDEN_ATTRIBUTE = "data-stream-hidden";

/** Elements that appear whole once the reveal reaches them, so a half-built list never shows. */
const BLOCK_SELECTOR =
	"p, li, tr, h1, h2, h3, h4, h5, h6, pre, figure, blockquote, table, ul, ol, dl, dt, dd, hr, img, [data-stream-block]";

/** Controls and notes that belong to the reply's frame, which stay whole and shown throughout. */
const SKIP_SELECTOR = "button, [data-stream-skip]";

/** Words per tick, cycled, so the pace reads as a model's uneven chunks. */
const CHUNKS = [2, 1, 3, 2, 1, 2] as const;

/** Milliseconds between ticks. */
const DEFAULT_INTERVAL = 32;

/** How a reveal finished. */
export type StreamRevealEnd = "done" | "stopped";

/** Options for {@link revealStream}. */
export interface StreamRevealOptions {
	/** Milliseconds between ticks. @default 32 */
	interval?: number;
	/** Called once, when the whole reply has shown or {@link StreamReveal.stop} ran. */
	onEnd?: (end: StreamRevealEnd) => void;
	/** Stops the reveal where it is when aborted, as {@link StreamReveal.stop} does. */
	signal?: AbortSignal;
}

/** A running reveal. */
export interface StreamReveal {
	/** Freezes the reply at what has shown; the rest of it stays out of the page. */
	stop(): void;
}

/** One text node and its words, in reading order. */
interface Run {
	node: Text;
	tokens: string[];
}

/**
 * Starts revealing `root`'s content from nothing. Text inside buttons and
 * `[data-stream-skip]` is left whole, and whitespace between blocks is kept, so the
 * finished reply is exactly the markup the server sent.
 *
 * @param root The reply's element, already holding its final content.
 * @param options Pace, completion callback and an abort signal.
 * @returns The running reveal.
 * @example revealStream(document.getElementById("reply-7")!, { onEnd: () => setIdle() })
 */
export function revealStream(root: HTMLElement, options: StreamRevealOptions = {}): StreamReveal {
	let { interval = DEFAULT_INTERVAL, onEnd, signal } = options;
	let runs = collectRuns(root);
	let blocks = [...root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)].filter(
		(block) => block.closest(SKIP_SELECTOR) === null,
	);
	for (let block of blocks) block.setAttribute(STREAM_HIDDEN_ATTRIBUTE, "");
	for (let run of runs) run.node.data = "";
	root.removeAttribute(STREAM_PENDING_ATTRIBUTE);
	root.setAttribute("aria-busy", "true");

	let runIndex = 0;
	let tokenIndex = 0;
	let blockIndex = 0;
	let tick = 0;
	let ended = false;

	/** Shows every hidden block that comes before `node` in the document or holds it. */
	function showBlocksUpTo(node: Node) {
		while (blockIndex < blocks.length) {
			let block = blocks[blockIndex]!;
			let position = block.compareDocumentPosition(node);
			let reached =
				position & Node.DOCUMENT_POSITION_FOLLOWING ||
				position & Node.DOCUMENT_POSITION_CONTAINED_BY;
			if (!reached) return;
			block.removeAttribute(STREAM_HIDDEN_ATTRIBUTE);
			blockIndex++;
		}
	}

	/** Ends the reveal once, showing the rest when it ran to completion. */
	function end(how: StreamRevealEnd) {
		if (ended) return;
		ended = true;
		clearInterval(timer);
		if (how === "done") for (let block of blocks) block.removeAttribute(STREAM_HIDDEN_ATTRIBUTE);
		root.removeAttribute("aria-busy");
		root.setAttribute(STREAM_END_ATTRIBUTE, how);
		onEnd?.(how);
	}

	/** Adds the next chunk of words to the reply. */
	function step() {
		let budget = CHUNKS[tick++ % CHUNKS.length]!;
		while (budget > 0) {
			let run = runs[runIndex];
			if (run === undefined) return end("done");
			if (tokenIndex === 0) showBlocksUpTo(run.node);
			let token = run.tokens[tokenIndex++];
			if (token !== undefined) run.node.data += token;
			if (tokenIndex >= run.tokens.length) {
				runIndex++;
				tokenIndex = 0;
			}
			if (token !== undefined && token.trim() !== "") budget--;
		}
	}

	let timer = setInterval(step, interval);
	signal?.addEventListener("abort", () => end("stopped"), { once: true });
	if (runs.length === 0) end("done");

	return { stop: () => end("stopped") };
}

/**
 * Lists the reply's text nodes in reading order with their words, leaving out text that is
 * only whitespace or belongs to a control.
 */
function collectRuns(root: HTMLElement): Run[] {
	let runs: Run[] = [];
	let walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		let text = node as Text;
		if (text.data.trim() === "") continue;
		if (text.parentElement?.closest(SKIP_SELECTOR)) continue;
		runs.push({ node: text, tokens: text.data.match(/\s*\S+\s*/g) ?? [text.data] });
	}
	return runs;
}
