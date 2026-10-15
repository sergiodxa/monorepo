/**
 * Live preview island for `MessageScroller`. The frame scrolls natively with no script,
 * and what script adds is the follow behavior, so the preview carries `messageFollow`
 * against a `ScrollFollowModel` and streams each reply in a word at a time: the viewport
 * stays pinned to the live edge while the answer is still arriving, and reveals the jump
 * control the moment the reader scrolls back through what came before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowDownIcon, ArrowUpIcon, MessageSquareDashedIcon, RotateCwIcon } from "@sdxc/icons";
import { bg, border, borderEdge } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { center, grow, hidden, hstack, vstack } from "@sdxc/u/layout";
import { clip } from "@sdxc/u/overflow";
import { bs, is, m, minBs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, textAlign, weight } from "@sdxc/u/typography";
import { Bubble, Button, Heading, HeadingScope, Input, MessageScroller, Text } from "@sdxc/ui";
import { scrollFade } from "@sdxc/ui/animations";
import { ScrollFollowModel } from "@sdxc/ui/behaviors";
import { messageFollow } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** One exchange the Send button plays, so every press adds a question and its answer. */
interface Exchange {
	ask: string;
	answer: string;
}

/** The conversation the composer walks through, one exchange per press. */
const SCRIPT: Exchange[] = [
	{
		ask: "I'm building a chat and the scroll keeps jumping every time a reply streams in.",
		answer:
			"Wrap the log in MessageScroller and pair its viewport with messageFollow. The viewport pins to the live edge as words arrive, so the newest text lands in place rather than shoving the thread around it.",
	},
	{
		ask: "What happens when someone scrolls up to read something earlier?",
		answer:
			"Following backs off the moment the reader leaves the live edge, and the jump control appears in its place. Pressing it returns to the newest turn and hands following back to the model.",
	},
	{
		ask: "And while a reply is still arriving?",
		answer:
			"The log keeps writing and the viewport keeps still, so the reader chooses when to catch up.",
	},
];

/** How often a streamed answer gains its next word, in milliseconds. */
const WORD_INTERVAL = 45;

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `let model = new ScrollFollowModel({ pinned: true });
let turns = [];
let streaming = false;

// A reply arrives a word at a time, which is what the viewport follows.
function send() {
	let exchange = script[sent++];
	let answerId = \`answer-\${sent}\`;
	turns = [
		...turns,
		{ id: \`ask-\${sent}\`, from: "reader", body: exchange.ask },
		{ id: answerId, from: "assistant", body: "" },
	];
	streaming = true;
	void handle.update();

	// Sending is the reader asking to be at the live edge, wherever they were reading.
	model.scrollToEnd();

	let words = exchange.answer.split(" ");
	let written = 0;

	timer = setInterval(() => {
		written += 1;
		turns = [
			...turns.slice(0, -1),
			{ id: answerId, from: "assistant", body: words.slice(0, written).join(" ") },
		];
		if (written >= words.length) {
			clearInterval(timer);
			streaming = false;
		}
		void handle.update();
	}, 45);
}

<MessageScroller>
	<MessageScroller.Viewport mix={[messageFollow(model), scrollFade({ axis: "block" })]}>
		<MessageScroller.Content aria-busy={streaming || undefined}>
			{turns.map((turn) => (
				<MessageScroller.Item key={turn.id} messageId={turn.id} scrollAnchor mix={[p(3)]}>
					{/* The reader's own turns hug the trailing edge in a frame; everyone else's
					    run unframed, so the answer reads as one column of prose. */}
					<Bubble
						variant={turn.from === "reader" ? "muted" : "ghost"}
						align={turn.from === "reader" ? "end" : "start"}
					>
						<Bubble.Content>{turn.body}</Bubble.Content>
					</Bubble>
				</MessageScroller.Item>
			))}
		</MessageScroller.Content>
	</MessageScroller.Viewport>

	{/* The control floats over the frame rather than scrolling inside it, so the
	    viewport's own edge fade stays on the conversation. */}
	<MessageScroller.Button
		aria-label="Jump to latest"
		hidden={false}
		data-scroll-jump
		mix={[when("&:not([data-visible])", hidden())]}
	>
		<ArrowDownIcon />
	</MessageScroller.Button>
</MessageScroller>`;

/** A chat window that streams each reply, hydrated so the viewport can follow it. */
export const MessageScrollerPreview = clientEntry(
	import.meta.url,
	function MessageScrollerPreview(handle: Handle) {
		let model = new ScrollFollowModel({ pinned: true });
		let turns: { id: string; from: "reader" | "assistant"; body: string }[] = [];
		let sent = 0;
		let streaming = false;
		let timer: ReturnType<typeof setInterval> | undefined;

		// The interval outlives a single render, so it is dropped with the island.
		handle.signal.addEventListener("abort", () => clearInterval(timer));

		/** Plays the next exchange: the question lands at once, the answer a word at a time. */
		function send() {
			let exchange = SCRIPT[sent];
			if (!exchange || streaming) return;

			sent += 1;
			let answerId = `answer-${sent}`;
			turns = [
				...turns,
				{ id: `ask-${sent}`, from: "reader", body: exchange.ask },
				{ id: answerId, from: "assistant", body: "" },
			];
			streaming = true;
			void handle.update();

			// Sending is the reader asking to be at the live edge, wherever they were reading.
			model.scrollToEnd();

			let words = exchange.answer.split(" ");
			let written = 0;

			timer = setInterval(() => {
				written += 1;
				turns = [
					...turns.slice(0, -1),
					{ id: answerId, from: "assistant", body: words.slice(0, written).join(" ") },
				];

				if (written >= words.length) {
					clearInterval(timer);
					streaming = false;
				}

				void handle.update();
			}, WORD_INTERVAL);
		}

		/** Returns the window to the state it opened in, so the demo can be played again. */
		function reset() {
			clearInterval(timer);
			turns = [];
			sent = 0;
			streaming = false;
			void handle.update();
		}

		return () => {
			let next = SCRIPT[sent];

			return (
				<div
					mix={[
						vstack({ gap: 0, align: "stretch" }),
						is("24rem"),
						rounded("lg"),
						border({ color: "neutral", width: 1 }),
						bg(),
						clip(),
					]}
				>
					<header
						mix={[
							hstack({ gap: 3, align: "start", justify: "between" }),
							p(4),
							borderEdge("block-end", { width: 1, style: "solid", color: "neutral" }),
						]}
					>
						<div mix={[vstack({ gap: 1, align: "start" })]}>
							<HeadingScope>
								<Heading mix={[m(0), text("base"), weight("semibold")]}>New chat</Heading>
							</HeadingScope>
							<Text mix={[text("sm")]}>How can I help you today?</Text>
						</div>
						<Button
							variant="ghost"
							size="sm"
							aria-label="Start over"
							mix={[on<HTMLButtonElement, "click">("click", reset)]}
						>
							<RotateCwIcon />
						</Button>
					</header>

					<MessageScroller
						// The card around it draws the frame, so the log adds no edge of its own.
						style={{ border: "none", borderRadius: "0" }}
						mix={[bs("18rem"), grow()]}
					>
						<MessageScroller.Viewport mix={[messageFollow(model), scrollFade({ axis: "block" })]}>
							{/* The log fills the viewport whatever it holds, so an empty state has a
							    height to centre itself in. */}
							<MessageScroller.Content
								aria-busy={streaming || undefined}
								mix={[vstack({ gap: 0, align: "stretch" }), minBs("100%")]}
							>
								{turns.length === 0 ? (
									<div mix={[vstack({ gap: 2, align: "center", justify: "center" }), grow(), p(6)]}>
										<div mix={[center(), is(10), bs(10), rounded("full"), bg("neutral.tint")]}>
											<MessageSquareDashedIcon />
										</div>
										<p mix={[m(0), text("sm"), weight("semibold")]}>Nothing here yet</p>
										<Text mix={[text("sm"), textAlign("center")]}>
											Press send to start the conversation and watch the reply arrive.
										</Text>
									</div>
								) : (
									turns.map((turn) => (
										<MessageScroller.Item
											key={turn.id}
											messageId={turn.id}
											scrollAnchor
											mix={[p(3)]}
										>
											{/* The reader's own turns hug the trailing edge in a frame; everyone
											    else's run unframed, so the answer reads as one column of prose. */}
											<Bubble
												variant={turn.from === "reader" ? "muted" : "ghost"}
												align={turn.from === "reader" ? "end" : "start"}
											>
												<Bubble.Content mix={[text("sm")]}>{turn.body}</Bubble.Content>
											</Bubble>
										</MessageScroller.Item>
									))
								)}
							</MessageScroller.Content>
						</MessageScroller.Viewport>

						{/* The control floats over the frame rather than scrolling inside it, so the
						    viewport's own edge fade stays on the conversation. The mixin reveals it
						    through data-visible once the reader leaves the live edge. */}
						<MessageScroller.Button
							aria-label="Jump to latest"
							hidden={false}
							data-scroll-jump
							mix={[when("&:not([data-visible])", hidden())]}
						>
							<ArrowDownIcon />
						</MessageScroller.Button>
					</MessageScroller>

					<div
						mix={[
							hstack({ gap: 2, align: "center" }),
							p(3),
							borderEdge("block-start", { width: 1, style: "solid", color: "neutral" }),
						]}
					>
						{/* The composer carries the next scripted question, so a press has something to
						    send and the reader can read it before it lands. */}
						<Input
							aria-label="Message"
							value={next?.ask ?? "That is everything, thanks."}
							readOnly
							mix={[grow(), rounded("full"), text("sm")]}
						/>
						<Button
							type="button"
							aria-label="Send"
							size="sm"
							disabled={next === undefined || streaming}
							mix={[on<HTMLButtonElement, "click">("click", send)]}
						>
							<ArrowUpIcon />
						</Button>
					</div>
				</div>
			);
		};
	},
);

export default { code: CODE, render: () => <MessageScrollerPreview /> };
