---
title: Undercurrent
headline: A newsletter and podcast home set as one letter, where the sample issue, the episode and the archive all work without script
summary: A landing for an invented letter and podcast about everyday infrastructure, set as one column of a letter with the latest issue and episode on the page.
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Undercurrent landing, set like the top of a letter on cool writing paper, the issue line and promise over an email sign-up and the cadence written out.
  - id: subscribe
    page: ""
    highlight: "[data-slot=undercurrent-subscribe]"
    alt: The sign-up form, an email address field and a Subscribe free button, with the cadence written out beneath.
  - id: figure
    page: ""
    highlight: "figure:has(svg[aria-label^='The tower'])"
    alt: The letter's drawn figure, a water tower and a nine-storey building, the night water level and the lower 7 a.m. line, with 13 m and 6 m of head marked at the ninth-floor tap.
  - id: episode
    page: ""
    highlight: "[data-slot=episode-player]"
    alt: Episode 63 in a native audio player, six timed chapters below it, a Read the transcript disclosure and a note that the demo's audio is a placeholder.
  - id: archive
    page: ""
    highlight: "#archive-water"
    alt: The Water topic open in the archive, 15 letters, its three most recent numbered and linked, and a link to all 15.
  - id: replies
    page: ""
    highlight: "#replies li:nth-child(3) figure"
    alt: A reader's reply complaining that episodes run long with a guest and that they skip to the chapter they want, signed with a name and since when they have listened.
  - id: membership
    page: ""
    highlight: "[data-slot=pricing-plans]"
    alt: Two tiers, Reader at Free with every letter and episode, and Member at $6 a month or $60 a year with field recordings and a private feed.
  - id: phone
    page: ""
    viewport: phone
    alt: The Undercurrent hero on a phone, the single column of the letter with the sign-up form under the promise.
---

Undercurrent is an invented fortnightly letter and podcast about the water mains, power lines, signals and post under an ordinary day, read aloud with the people who run them. The publication does not exist. The page is its home, built from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) and [@sdxc/icons](/api/icons), and set like a letter: one column on cool writing paper, a humanist sans at a long leading and one blue-black ink.

It is the demo to read for a quiet, reading-first page. It asks for an address in the first screen, then lets the visitor judge the writing before asking again: the latest letter is on the page in full, the latest episode plays in the browser's own player with its chapters and transcript, and the archive opens by topic. Every one of those works with JavaScript off, and both sign-up forms land the reader on a confirmation right under the button they pressed.

## The brief

A newsletter's home has one conversion, the email address, and a skeptical audience that has been asked for it too often. The honest way to earn it is to show an issue, show the voice, state the cadence plainly and make leaving easy. A podcast adds a second format the same page has to carry: audio that plays without a third-party embed, chapters a listener can jump between, and a transcript for anyone who would rather read.

Undercurrent's page is built around those needs and nothing else. It is one column at a reading measure, header included, with no feature grid and no logo wall. Its sections are a sign-up, the latest letter, the latest episode, the archive, the host, readers' replies, two tiers, questions, and a postscript sign-up.

## A sign-up that answers where it was sent

The page opens like the top of a letter: the issue line, the promise, the sign-up form and the cadence written out, with a way down to the latest letter for a visitor who wants a sample first.

![The sign-up form, an email address field and a Subscribe free button, with the cadence written out beneath](/showcase/undercurrent/subscribe.webp "A plain form with the cadence under it: when the letter comes, how long it takes and how to leave.")

The form is a `SubscribeForm` component used twice, in the hero and in the postscript, each with its own confirmation id. It posts to an example endpoint whose address ends in that id, the redirect back keeps the fragment, and the confirmation paragraph under the form is shown by `:target`:

```tsx
<form
	method="post"
	action={`/examples/newsletter/subscribe#${handle.props.confirmation}`}
	data-slot="undercurrent-subscribe"
```

The confirmation is a `role="status"` paragraph saying the next letter arrives Thursday at 7 a.m. Because each form names its own id, the reader who subscribes from the postscript lands back at the postscript. `newsletter.browser.test.tsx` checks that both are plain forms posting an address.

## The latest letter as the sample

Below the hero, the latest letter is set as a reader gets it in their inbox: the issue line, the salutation, the body at a long leading and the sign-off. It is the page's sample issue, so a visitor judges the writing itself before giving an address.

The letter has one drawn figure, and it carries the argument. The issue is about water pressure at the top of a hill, and the figure measures the gap on the drawing: the tower's night water level, the lower line at seven in the morning when the hill showers at once, and the head left at a ninth-floor tap at each time.

![The letter's drawn figure, a water tower and a nine-storey building, the night water level and the lower 7 a.m. line, with 13 m and 6 m of head marked at the ninth-floor tap](/showcase/undercurrent/figure.webp "The figure measures the morning pressure drop on the drawing, and its caption states the numbers.")

The figure is SVG in the page's ink and one blue, with its full explanation as its accessible name, so a screen reader hears the measurement and not "diagram".

## An episode in the browser's own player

The listening band carries episode 63 in [EpisodePlayer](/api/ui/episode-player): the episode title and guest, a native `<audio controls>` with a captions track, a list of timed chapters, a transcript in a disclosure, and a plain note that the demo's audio is a placeholder that chimes where each chapter starts. The three episodes before it follow as a plain list.

![Episode 63 in a native audio player, six timed chapters below it, a Read the transcript disclosure and a note that the demo's audio is a placeholder](/showcase/undercurrent/episode.webp "Every chapter time is a media-fragment link, so it plays from that point with no script.")

Every chapter and transcript time is a media-fragment link (`src#t=N`), so with scripts off a click plays the file from that moment. With script, the component's island seeks the player in place and marks the current chapter. The captions track is required by the component, and the player also takes the chapter list's name, the transcript label and a download link for readers who cannot play audio, so the page passes all of them. The browser tests check that a chapter seeks the player and that captions are on the audio.

## An archive that fits one screen

Sixty-three letters fit in one quiet screen because the archive is folded by subject. Each topic is a native `<details>` whose summary carries its name and count; opened, it lists its three most recent letters by number and a link to the rest. The first topic, Water, is open on load and the rest stay folded.

![The Water topic open in the archive, 15 letters, its three most recent numbered and linked, and a link to all 15](/showcase/undercurrent/archive.webp "Each subject is a native disclosure with its count; the first opens on load.")

The topic counts add up to the sixty-three letters sent so far, and no two subjects share a word, so the list scans without ambiguity.

## Replies, the host and two tiers

The replies band prints what readers and listeners wrote back down the column, like a letters page, each naming the letter or episode it is about. One fair complaint is kept in.

![A reader's reply complaining that episodes run long with a guest and that they skip to the chapter they want, signed with a name and since when they have listened](/showcase/undercurrent/replies.webp "The letters page keeps one fair complaint, printed like the rest.")

The host band, an [AuthorBand](/api/ui/author-band), introduces the writer in her own words beside a drawn portrait at a desk microphone, with the credentials that make her worth trusting on pipes and wires and the places a reader can write back. Membership is a [PricingBand](/api/ui/pricing-band) of two tiers, so a reader sees exactly what the free letter includes and what paying adds.

![Two tiers, Reader at Free with every letter and episode, and Member at $6 a month or $60 a year with field recordings and a private feed](/showcase/undercurrent/membership.webp "The free tier carries every letter and episode; membership adds recordings and a private feed.")

An FAQ in a [FaqBand](/api/ui/faq-band) and the postscript sign-up close the page. On a phone the column simply narrows; the browser tests check that the page never scrolls sideways and that the header's menu closes when a section link in it is followed.

![The Undercurrent hero on a phone, the single column of the letter with the sign-up form under the promise](/showcase/undercurrent/phone.webp "On a phone the letter keeps its single column and the form stays in the first screen.")

## Takes after

- [99% Invisible](https://99percentinvisible.org) — a podcast about the overlooked design and infrastructure of everyday life.
- [Substack](https://substack.com) — a publication's home that leads with the latest issue, a subscribe form and free and paid tiers; Undercurrent runs its player and archive without any embed.
