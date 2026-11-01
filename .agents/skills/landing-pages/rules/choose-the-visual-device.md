---
title: Choose the Visual Device
impact: CRITICAL
tags: [taste, flow-diagram, sequence-diagram, fan-out, event-ticker, typed-terminal, drawn-chart, code-stage, bento, switchers, visuals]
---

# Choose the Visual Device

Each band proves one claim, and the shape of the claim picks the visual. A process should move, an
integration should be code, breadth should be a mosaic of small moments. Choosing the device is a design
decision, not a component lookup: match it to what the reader needs to see.

## Why

- **The right device makes the claim self-evident.** An animated run of a browser check, step by step,
  ending on "passed", explains scheduled flows faster than any copy.
- **Variety keeps a long page alive.** Three code splits in a row read as one long band; alternating a
  code stage, a flow diagram and a bento keeps each scroll a new thing to look at.
- **Each animated device proves one shape of claim.** A run of steps, an exchange between parties, one
  thing reaching many, activity that keeps arriving, code that does something, a figure that grows. Reach
  for the one whose shape matches; a single device on every page reads as a template.

## Claim → device

| When the claim is about… | Show | Component | Reference |
| --- | --- | --- | --- |
| The product as a whole | a full product window; a switcher if it has several faces | `ProductFrame`, `SegmentedStage` | Keel hero (`demos/saas/sections.tsx` `HeroSection`) |
| One linear run that passes or fails (a scheduled check, a pipeline) | the run animating: trigger → steps → outcome | `FlowDiagram` | Uptime home `#flows`, `resources/components/marketing/flow-diagram.tsx` |
| An exchange between two to four parties (OAuth, a webhook handshake, a payment redirect) | messages travelling between lifelines in order | `SequenceDiagram` | book PKCE sign-in |
| One thing serving many, or many feeding one (one fetch for every follower, one alert to every channel) | a source pulsing out to each target in turn | `FanOutDiagram` | Reader home freshness band |
| Activity that keeps arriving, with the exception surfaced (checks landing, items arriving, jobs finishing) | rows arriving newest first, one flipping to failed | `EventTicker` | Uptime `/features/flows` |
| "You write this, it does that" (a spec, a command, a config) | the input typing itself, then its output | `TypedTerminal` | Uptime `/browser-flows` |
| A measured figure or a spread of values (intervals, latency, uptime) | a counter ticking to the real value over bars or a line that draws in | `DrawnChart` | Reader `/features` cadence |
| How a developer integrates | the real call, in the languages your readers use, as file tabs | `CodeStage tabs` | Keel "01 / Metering", Uptime home `#agents` (curl / mcp.json) |
| Running anywhere | the same code on each target, one tab per runtime | `CodeStage tabs` in a split with `bleed="end"` | sdxc.dev `runtime-showcase.tsx` |
| Breadth (many small capabilities) | one tiny moment per cell | `Bento` with scenes | Keel platform bento, Rooftree colour blocks |
| A set of features worth a page each | linked cards, each with a scene | `Feature.Grid` + `Feature.Media` + `Feature.Link` | Uptime home `#features` |
| A sequence the user follows | numbered timeline beside the screen it produces | `FeatureBand layout="split"` + `StepList variant="timeline"` | Uptime feature pages `#how-it-works` |
| A tour of an app | tabs down the side, one screen each | `FeatureBand layout="stage"`, `TabbedStage` | Rooftree tour |
| Scale or limits | four big figures | `StatStrip size="display"` | Uptime home figures |
| Reasons, guarantees, facts without pictures | an uncarded list with icons; cards are for media | `Feature.Grid variant="list"`, `CheckList` | Uptime benefits, comparison "why switch" |
| A comparison | an honest table, your column in brand ink | `Table` | Uptime `/vs/*` |
| Something physical | the object: a flat cover, a sample page, a device | `ProductFrame variant="device"`, or drawn by hand | book `cover.tsx` and `sample-page.tsx`, Rooftree `FannedPhone` (`demos/app/hero.tsx`) |
| What shipped lately | dated entries | `ChangelogStrip`, the hero `release` pin | Keel changelog |
| Who made it | a person, a portrait, a signature | `AuthorBand` | book demo |

## One claim, three devices

"Flow monitors sign in to your app every 15 minutes and alert on the step that broke":

- **Weak**: a feature card with a clock icon and that sentence. The reader takes it on trust.
- **Better**: the flow monitor's screen with its runs listed 15 minutes apart. It proves the product
  exists, but a list of runs shows a result, not the mechanism.
- **Strong**: `FlowDiagram` playing the run step by step, each step with its spec line, settling on
  "Run passed" with "A failed step alerts your team" under it. The claim is a process, so the device moves.

The same product on another page makes a different claim, so it gets a different device: `/features/flows`
shows runs landing 15 minutes apart in an `EventTicker`, one failing on its line; `/browser-flows` types
the spec in a `TypedTerminal`. Only the home plays the `FlowDiagram`.

## Animated flow diagrams

Use `FlowDiagram` for one linear run with a pass/fail outcome: a scheduled check, a build, a deploy. At
most once per page, and not on every page of a site; when the claim has another shape, use the device
below that matches it. It loops a run every few seconds, pausable, and shows the finished run under
reduced motion.

```tsx
import { BellIcon, ClockIcon } from "@sdxc/icons";
import { FlowDiagram } from "@sdxc/ui/landing";

<FlowDiagram
	aria-label="A flow monitor run"
	pauseLabel="Pause"
	trigger={{ icon: <ClockIcon size={14} aria-hidden="true" />, title: "The schedule starts a run", detail: "As often as every 15 minutes" }}
	steps={[
		{ title: "Sign in", code: 'http.post "/api/sessions" form { … }' },
		{ title: "Read the token", code: "session.json.token" },
		{ title: "Call the endpoint it authorises", code: 'http.get "/v1/account" bearer session.json.token' },
		{ title: "Check what comes back", code: "expect account.status 200" },
	]}
	outcome="Run passed"
	footnote={<><BellIcon size={14} aria-hidden="true" />A failed step alerts your team</>}
/>
```

These are the lines Uptime's home plays, in the product's own spec language. Uptime wraps the pattern in
`resources/components/marketing/flow-diagram.tsx` so its pages pass translated `labels` and an optional
`code` tuple; do the same once a second page needs the diagram.

What makes it good: each step carries a real line of the product's syntax, not a label; the trigger states
the real schedule; the footnote says what happens on failure. Three to five steps. An outcome with a
figure ("Passed in 4.2 s") is stronger still.

## The other animated devices

All of them are CSS-only loops in a `MotionLoop` (pausable), show their finished state under reduced
motion, take every string as a prop and need an `aria-label`. Feed each one real values from code.

- **`SequenceDiagram`** — `actors` (two to four) and `messages` `{ from, to, label, code? }` by actor
  index. For a protocol: the book's PKCE sign-in between the browser, the app and the Authorization Server,
  with the `code_challenge` and `code_verifier` lines on the arrows that carry them.
- **`FanOutDiagram`** — a `source` and two to six `targets`, `direction="in"` for many-to-one. For "one
  fetch, however many people follow it": the feed on top, each reader's queue lighting with "+3".
- **`EventTicker`** — `rows` `{ time, label, status, detail?, flipTo? }`, oldest first, and
  `statusLabels`. For continuous activity: runs at 12:00, 12:05, 12:10, the 12:15 one flipping to failed
  with the line that broke.
- **`TypedTerminal`** — `lines` `{ kind: "input" | "output", text, status? }` and a `prompt`. For code
  that does something: the spec types in, then `✓ 4 steps · 2.1s` prints. Keep it under ten lines.
- **`DrawnChart`** — a `metric` that counts up and a `series` as `bars` or a `line`, `highlight` for the
  bar that matters. For a figure the product measures: check intervals by how often a feed posts.

```tsx
import { FanOutDiagram } from "@sdxc/ui/landing";

<FanOutDiagram
	aria-label="One fetch fills every follower's queue"
	pauseLabel="Pause"
	source={{ title: "Harbor Daily", detail: 'GET /feed.xml  If-None-Match: "a1f3"' }}
	targets={[{ title: "Ana", detail: "+3" }, { title: "Ben", detail: "+3" }, { title: "Chloé", detail: "+3" }]}
	footnote="One fetch, however many people follow it"
/>
```

## Code stages

Code is a visual when it is short, real and in the reader's language. Show the one call that matters
(8–15 lines), titled with a filename, highlighted, in two or three tabs (`node.ts` / `worker.py` /
`curl.sh`). Keep tab labels short so the strip never overflows on phones. Code that only a library author
would write, or 60 lines of setup, is a wall, not a visual.

## Switchers

`SegmentedStage` (a hero with several product faces) and `TabbedStage` (a guided tour) let a band hold more
without growing. They switch with CSS radios and keep every panel in one grid cell, so the page never
jumps. Two or three faces in a hero; four to five stops in a tour.

## Pacing the devices

Plan the page as a table — band, claim, device, moment — and read the device column top to bottom: no
device twice in a row, and at least one thing that moves (a flow diagram, a sequence, a ticker, a switcher,
a marquee of real logos) somewhere below the fold. Across a site, read the animated devices page by page
too: when every page plays a `FlowDiagram`, most of them are the wrong device. @rules/worked-example.md shows the table and the check.

## Rules

1. Pick each band's visual from the shape of its claim, using the table above.
2. Animate a linear pass/fail run with `FlowDiagram` (real code lines, a real schedule, a measured
   outcome), at most once per page and not on every page of a site; animate other shapes of claim with
   `SequenceDiagram`, `FanOutDiagram`, `EventTicker`, `TypedTerminal` or `DrawnChart`.
3. Show integration as the one real call in the reader's languages, short and titled.
4. Use a bento for breadth, cards with scenes for features with pages, lists for facts without pictures.
5. Never put the same device in adjacent bands.
