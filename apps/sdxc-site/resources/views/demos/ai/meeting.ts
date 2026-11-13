/**
 * The one meeting Margin's landing shows everywhere: a four-minute pricing call, its
 * transcript line by line, and the notes written from it, each claim pointing at the line
 * it came from. Hero, sources band, typing demo and integrations all draw from this file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One spoken line of the transcript, as Margin's speech step wrote it down. */
export interface TranscriptLine {
	/** Minutes and seconds into the recording, `mm:ss`. */
	time: string;
	speaker: string;
	text: string;
}

/** A sentence of the notes and the transcript line it rests on. */
export interface Claim {
	text: string;
	/** The `time` of the line the claim cites. */
	cites: string;
}

/** An action item: who said they would do it, what, and by when if anyone said. */
export interface ActionItem extends Claim {
	owner: string;
	/** The due date said aloud, or `null` when nobody named one. */
	due: string | null;
}

/** The recording's name, as the reader uploaded it. */
export const MEETING_TITLE = "Pricing sync";

/** The recording's file name, shown where Margin reports what it read. */
export const MEETING_FILE = "pricing-sync.m4a";

/** The recording's length, as the transcript header prints it. */
export const MEETING_LENGTH = "4:31";

/** The call, line by line. */
export const TRANSCRIPT: readonly TranscriptLine[] = [
	{
		time: "00:12",
		speaker: "Ana",
		text: "So the question for today: does annual billing ship with the March release?",
	},
	{
		time: "00:31",
		speaker: "Tomás",
		text: "Finance is fine with it if the discount stays at two months free. Not three.",
	},
	{
		time: "01:05",
		speaker: "Priya",
		text: "Checkout is done for monthly. Annual needs one more state, the renewal notice.",
	},
	{ time: "01:22", speaker: "Ana", text: "How long for that?" },
	{ time: "01:24", speaker: "Priya", text: "Three days, if the copy is final by Monday." },
	{
		time: "02:10",
		speaker: "Tomás",
		text: "I’d like the refund window written down before launch. Fourteen days?",
	},
	{ time: "02:18", speaker: "Ana", text: "Fourteen works. Let’s call that decided." },
	{ time: "03:02", speaker: "Priya", text: "Who’s writing the renewal email?" },
	{ time: "03:05", speaker: "Ana", text: "I will. Draft by Friday." },
	{
		time: "03:40",
		speaker: "Tomás",
		text: "And I’ll check the tax on EU annual invoices with the accountants.",
	},
	{
		time: "04:15",
		speaker: "Ana",
		text: "We’re not touching team pricing this quarter. That’s its own conversation.",
	},
	{ time: "04:22", speaker: "Priya", text: "Agreed. Great, another meeting." },
];

/** The summary paragraph, one cited sentence at a time. */
export const SUMMARY: readonly Claim[] = [
	{ text: "Annual billing ships in March at two months free.", cites: "00:31" },
	{ text: "Refunds are open for fourteen days.", cites: "02:18" },
	{ text: "Team pricing waits for next quarter.", cites: "04:15" },
];

/** What the call settled. */
export const DECISIONS: readonly Claim[] = [
	{ text: "Annual discount is two months free, not three", cites: "00:31" },
	{ text: "Refund window is 14 days", cites: "02:18" },
	{ text: "Team pricing is out of scope this quarter", cites: "04:15" },
];

/** Who said they would do what. */
export const ACTION_ITEMS: readonly ActionItem[] = [
	{
		owner: "Priya",
		text: "Add the renewal-notice state to checkout",
		due: "3 days after copy",
		cites: "01:24",
	},
	{ owner: "Ana", text: "Draft the renewal email", due: "Friday", cites: "03:05" },
	{ owner: "Tomás", text: "Check tax on EU annual invoices", due: null, cites: "03:40" },
];

/** What the call raised and nobody took, kept rather than guessed at. */
export const OPEN_QUESTIONS: readonly Claim[] = [
	{ text: "Who finalises the checkout copy by Monday?", cites: "01:24" },
];

/**
 * The anchor id of a transcript line, so a citation links to it.
 *
 * @param time The line's `mm:ss`.
 * @returns An id such as `t-0218`.
 */
export function lineId(time: string): string {
	return `t-${time.replace(":", "")}`;
}

/** What a transcript line became in the notes, written in its margin. */
export interface MarginNote {
	text: string;
	/** Red marks a line Margin chose to leave out; ink marks one it used. */
	pen: "ink" | "red";
}

/** The margin of the transcript: the cited lines, and the one line left out on purpose. */
export const MARGIN_NOTES: Readonly<Record<string, MarginNote>> = {
	"00:31": { text: "decided: 2 months free", pen: "ink" },
	"01:24": { text: "to do: Priya · open question", pen: "ink" },
	"02:18": { text: "decided: 14-day refunds", pen: "ink" },
	"03:05": { text: "to do: Ana, Friday", pen: "ink" },
	"03:40": { text: "to do: Tomás, no date said", pen: "ink" },
	"04:15": { text: "decided: no team pricing", pen: "ink" },
	"04:22": { text: "a joke — left out", pen: "red" },
};
