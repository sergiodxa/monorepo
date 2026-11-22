---
title: Margin
headline: An AI product page where every note links to the transcript line it came from, and the bill reprices as you type
summary: A landing for an invented AI note-taker whose every summary line links to the transcript line it came from, set as a notebook page.
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Margin landing, a headline on warm paper beside a ruled notes sheet with a red margin line and blue timestamp links.
  - id: notes
    page: ""
    highlight: "[data-slot=margin-notes-sheet]"
    alt: The notes sheet for a pricing sync, with a summary, decisions, to-dos and an open question, each ending in a blue timestamp, and handwritten labels in the margin.
  - id: cited
    page: "#t-0124"
    highlight: "#sources figure"
    alt: The twelve-line transcript with six cited lines highlighted in yellow, handwritten margin notes beside them, and the 01:24 line marked as the arrived target.
  - id: drafting
    page: ""
    highlight: "[data-slot=typed-terminal]"
    alt: A light code card titled pricing-sync.m4a to notes, listing each decision and to-do with the timestamp and speaker it came from, two flagged in red.
  - id: integrations
    page: ""
    highlight: "[data-slot=fan-out-diagram]"
    alt: A fan-out diagram from Notes approved to Linear, Slack, Notion, Calendar, Email and a webhook, each ticked, with Sent to 6 places below.
  - id: estimate
    page: "?hours=120&retention=2-years#pricing"
    highlight: "[data-slot=usage-estimate]"
    alt: The pricing calculator set to 120 recorded hours and a two-year archive, beside a bill of free hours, recorded hours and archive totalling $46.00.
  - id: phone
    page: ""
    viewport: phone
    alt: The Margin hero on a phone, the headline and sign-up above the ruled notes sheet.
---

Margin is an invented AI note-taker for recorded meetings: it writes summaries, decisions and to-dos that each link to the transcript line they came from. The product does not exist. The page is an AI product landing built from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) and [@sdxc/icons](/api/icons), set as a page of a notebook: warm paper, ballpoint blue, a red margin line, a yellow highlighter and the system's handwriting face for margin notes only.

It is the demo to read for an AI product page that has to earn trust. It shows the output with its sources, lets a reader check a note against the transcript in one click, says what the product gets wrong, lays out what it stores and for how long, and prices usage with a calculator that works as a plain form. The two moving parts that matter, the citation links and the live bill, both work before any script loads.

## The brief

Every AI note-taker makes the same promise, and buyers have learned to discount it. What separates a believable page from a hopeful one is evidence: notes a reader can verify, failures named before the buyer finds them, and a clear account of where the recording goes. Pricing for a usage-billed product adds a second problem, because a per-hour rate means nothing until the reader sees their own month priced.

Margin's page is built around one invented meeting, a four-and-a-half-minute pricing sync between Ana, Tomás and Priya. The notes, the transcript, the drafting log, the limits and the integrations all describe that meeting, so every claim on the page can be traced to the same source the product would trace it to.

## Notes that cite their sources

The hero's media is the notes sheet: a ruled card with the meeting's title, date, length and attendees, then a summary, the decisions, the to-dos with owners and dates, and an open question. Handwritten labels sit in the margin left of the red rule. Every line ends in a timestamp, and a line under the card says so.

![The notes sheet for a pricing sync, with a summary, decisions, to-dos and an open question, each ending in a blue timestamp, and handwritten labels in the margin](/showcase/margin/notes.webp "Every note ends in the timestamp it came from, including the to-do with no date said.")

Each timestamp is a plain link to `#t-mmss`, the id of a line in the transcript further down; `meeting.ts` turns "01:24" into `t-0124`, so the notes and the transcript share one source of times. The sheet is honest about gaps in the same register: Tomás's to-do carries "no date said" in red ink, because nobody gave one in the meeting.

## Landing on the line

Following a timestamp scrolls to the sources band, which prints the whole twelve-line transcript. The six lines the notes cite are highlighted in yellow, and beside each, in the margin column, a handwritten note says what it became: "decided: 2 months free", "to do: Ana, Friday". The one line the notes skipped carries a red note saying why: a joke, left out.

![The twelve-line transcript with six cited lines highlighted in yellow, handwritten margin notes beside them, and the 01:24 line marked as the arrived target](/showcase/margin/cited.webp "The line a timestamp points at is tinted and ruled on arrival, by CSS alone.")

The arrived line is marked by `:target`. Each transcript row carries its own rule, with a scroll margin that lands it well below the sticky header:

```tsx
when(
	"&:target",
	raw({
		backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 14%, transparent)",
		boxShadow: "inset 4px 0 0 var(--ui-brand-fg)",
	}),
),
```

No script tracks which note was followed. The browser's own fragment navigation does the work, so the citation lands visibly with JavaScript off, after a reload, and from a link shared in a chat.

## Drafting shown, limits admitted

The drafting band shows Margin writing the notes as a log in [TypedTerminal](/api/ui/typed-terminal), on its light code card so it sits on the paper: the file read, the voices counted, then each decision and to-do with the timestamp and speaker it came from. Two entries end in red, the to-do with no date and the question nobody took.

![A light code card titled pricing-sync.m4a to notes, listing each decision and to-do with the timestamp and speaker it came from, two flagged in red](/showcase/margin/drafting.webp "The drafting log ends each item in its source, and flags the two the meeting left open.")

The log types itself out, holds and loops, with a pause button beside it; its static markup is the finished session, which is what a reader with reduced motion sees, and a browser test (`margin.browser.test.tsx`) checks that no time-based animation runs when motion is reduced. The limits band follows with six slips, each shown as it would appear in the notes, with a red-pen correction beside it and what Margin does to make that slip easy to catch. The privacy band is a ledger of everything Margin stores from a meeting, where it lives, how long it stays and whether a model learns from it; its retention choices are the same three the pricing calculator offers. On a phone the ledger stacks each item and rules only between rows.

## Where the notes go

Integrations are a [FanOutDiagram](/api/ui/fan-out-diagram) beside the copy in a [Split](/api/ui/split): one source card, "Notes approved", fans out to Linear, Slack, Notion, a calendar, email and a webhook, each with what it received and a tick, closing on "Sent to 6 places" and a reminder that each item links back to its line.

![A fan-out diagram from Notes approved to Linear, Slack, Notion, Calendar, Email and a webhook, each ticked, with Sent to 6 places below](/showcase/margin/integrations.webp "One approval fans out to six destinations, each naming what it received.")

The diagram's strings are props and its connectors are drawn in CSS, so it reads the same to a screen reader as a list of six destinations.

## A bill priced from the address

Pricing is a [UsageEstimate](/api/ui/usage-estimate). On the left, a GET form asks for recorded hours a month in a [NumberField](/api/ui/number-field) and what happens to the transcript afterwards in a [RadioGroup](/api/ui/radio-group): delete it once the notes are written, keep it 90 days, or keep it two years for four cents more an hour. On the right, the bill: free hours, recorded hours at the hourly rate, the archive surcharge, the total and a note that audio is deleted within 24 hours whatever the choice.

![The pricing calculator set to 120 recorded hours and a two-year archive, beside a bill of free hours, recorded hours and archive totalling $46.00](/showcase/margin/estimate.webp "The bill is printed by the server from the query, so this address always shows 120 hours with a two-year archive.")

The page's render receives the request URL, and `readEstimateInput(url.searchParams)` turns `?hours=120&retention=2-years` into the bill, using the rates in `estimate.ts`: five free hours, 36 cents an hour up to 200 hours and 24 cents past it, with a ceiling of 2,000 hours so a typo never prints a five-figure bill. Without script, "Update the estimate" submits the form and the server answers with the new bill. With script, the component's live mode treats the bill as a named frame:

```tsx
live={{
	frame: BILL_FRAME,
	src: `${handle.props.url.pathname}${handle.props.url.search}`,
}}
```

As the reader types, an island re-requests that frame with the form's values, the demo's route answers with the bill alone, and the address follows the query, so the estimate a reader sees is always one they can share.

On a phone, the hero puts the headline and sign-up first and the notes sheet under them, still ruled and still linked.

![The Margin hero on a phone, the headline and sign-up above the ruled notes sheet](/showcase/margin/phone.webp "On a phone the notes sheet follows the headline, with every timestamp still a link.")

## Takes after

- [Granola](https://www.granola.ai) — AI meeting notes presented as a page of a notebook; Margin makes the margin itself carry the citations.
- [Otter.ai](https://otter.ai) — the recorded meeting turned into a transcript the summary points back into; Margin lands each link on its line with `:target`.
- [Perplexity](https://www.perplexity.ai) — every generated claim carries a citation a reader can follow, applied here to meeting notes.
