---
title: Centered
headline: A video course page whose lesson plays, seeks and reads its transcript before any script loads
summary: A landing for an invented wheel-throwing video course, led by a lesson playing in a dark screening room set into a bright cobalt page.
tagline: A pottery course in a screening room
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Centered landing, a heavy headline and enrol button over a lesson playing on a dark screening stage.
  - id: player
    page: ""
    highlight: "[data-slot=video-player-layout]"
    alt: The lesson player on its dark stage, a drawn potter's wheel with the control bar, a chapter list with stills and a timed transcript beside it.
  - id: settings
    page: ""
    click: "[aria-label=Settings]"
    highlight: "[data-slot=video-player-settings]"
    alt: The player's settings menu open over the frame, with Camera, Captions and Playback speed rows.
  - id: curriculum
    page: ""
    highlight: "#curriculum [data-slot=curriculum]"
    alt: Modules 1 and 2 of the curriculum, four numbered lessons each with running times and free-preview badges.
  - id: completion
    page: ""
    highlight: "[data-slot=drawn-chart]"
    alt: A completion chart of 2,314 students, bars falling from 92% finishing module 1 to 41% finishing module 6.
  - id: pricing
    page: ""
    highlight: "#pricing [data-slot=pricing-plans]"
    alt: Three plans, Self-paced at $180, Cohort at $420 for eight weeks on a dark card, and Team seats at $140 a seat.
  - id: phone
    page: ""
    viewport: phone
    alt: The Centered hero on a phone, the headline, enrol button and free-lesson link stacked above the player.
---

Centered is an invented video course in wheel-throwing pottery: 24 lessons in six modules, filmed from the side and over the wheel, self-paced or with a cohort, and ending in a lidded jar. The course does not exist. The page is a course landing built from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) utilities and [@sdxc/icons](/api/icons), with every picture drawn in SVG.

It is the demo to read for a page that sells video. Its hero is a real lesson player with chapters, captions, a transcript and a settings menu, not a poster with a play button, and all of it keeps working with JavaScript off. Around it, the art direction is a bright, friendly page around a dark screening room: cobalt glaze as the one colour, a heavy geometric sans from the platform's own fonts, rounded corners that stop short of pills, and soft lifted cards.

## The brief

A course landing has one job a product page does not: it has to let a visitor judge teaching they have not paid for. That means a sample lesson that plays well, a curriculum specific enough to show what each hour covers, proof that students finish, and prices that make the difference between learning alone and learning with a group plain.

The hard parts are mostly in the video. A player that only works after its script loads leaves a slow phone staring at a dead frame. Chapters and transcripts that are just text cannot take a reader to the moment they describe. Static video files served without byte ranges cannot be seeked at all. Centered takes all of these on, then spends the rest of the page on a curriculum, an honest completion chart and three plans.

## A lesson that plays before the island does

The hero is lesson 7, "Centering 3 kg", in [VideoPlayer](/api/ui/video-player) on its `theater` tone. The visitor gets a custom control bar with seek, play, time, captions, settings and full screen, a segmented scrubber under the frame with one segment per chapter, the lesson title and its module, a chapter list with a still for each chapter, a timed transcript, and an up-next card for lesson 8.

![The lesson player on its dark stage, a drawn potter's wheel with the control bar, a chapter list with stills and a timed transcript beside it](/showcase/centered/player.webp "Chapters, transcript and the custom bar all belong to one VideoPlayer, rendered on the server.")

Everything in that picture is rendered on the server. Chapters and captions are WebVTT tracks on the `<video>`, and every chapter and transcript time is a link into the clip, so with scripts off a reader can still jump to "Checking with a still finger" and the browser plays from 6:58. Once the player's island runs, the native controls give way to the custom bar and those same links seek in place. The clip is served by the site's Worker with `Accept-Ranges: bytes`, answering a range request with `206 Partial Content`, which is what lets seeking work in production at all.

The picture itself is a drawing. The poster and the wheel frame are SVG, and the clip is a transparent WebM of the lesson's 703-second length that plays over them. A browser without WebM falls back to a small H.264 MP4 whose solid ground matches the frame's backdrop. Once the island has swapped in the custom bar, the video element is made fully transparent, so the drawn frame shows in every browser even where a transparent WebM would paint opaque.

## A camera switch with no JavaScript in it

The settings menu carries the player's own Captions and Playback speed menus, plus one the demo adds: Camera, with Side and Overhead. Choosing Overhead swaps the drawn wheel for a view from above.

![The player's settings menu open over the frame, with Camera, Captions and Playback speed rows](/showcase/centered/settings.webp "The Camera row is the demo's own settings menu; picking Overhead swaps the frame through CSS.")

The switch is a radio group inside the menu, and the swap is CSS on the player that reads which radio is checked. Both frames sit in the player's frame slot, each tagged with `data-camera`, and the one that is not chosen is hidden:

```tsx
when(
	`&:has(input[name="${CAMERA}"][value="overhead"]:checked) [data-camera="side"]`,
	raw({ visibility: "hidden" }),
),
when(
	`&:not(:has(input[name="${CAMERA}"][value="overhead"]:checked)) [data-camera="overhead"]`,
	raw({ visibility: "hidden" }),
),
```

That lives in `lesson-player.tsx`, next to the `VideoPlayer.SettingsMenu` that declares the two options. The player supplies the menu, focus handling and the back button; the demo supplies only the choice and the selector that acts on it.

## A curriculum read like a syllabus

Below the hero, four figures sit between hairline rules in the headline's weight, then the curriculum: six modules in [Curriculum](/api/ui/curriculum), two to a row on a wide screen. Each module states its lesson count, its total running time and how many lessons are free, and each lesson carries its number, its title, its own running time and a "Free preview" badge where one applies.

![Modules 1 and 2 of the curriculum, four numbered lessons each with running times and free-preview badges](/showcase/centered/curriculum.webp "Every lesson shows its running time, and the free previews are marked where they sit in the course.")

The data comes from `data.ts`, the same module the player reads its lesson from, so the lesson playing in the hero is the lesson marked free in module 2. Below the curriculum, a progress band shows a student's page part way through the course: the six pieces as silhouettes, the skill each proves and how many lessons of each are done, so progress reads as things a student can now throw.

## Completion shown honestly

Most course pages show a finished piece and stop. Centered's work band shows six student pieces with the faults their makers named, then how many students finished each module, falling to the share who finished all six.

![A completion chart of 2,314 students, bars falling from 92% finishing module 1 to 41% finishing module 6](/showcase/centered/completion.webp "Completion falls module by module, and the chart names the cohort and what counts as finishing.")

The chart is a [DrawnChart](/api/ui/drawn-chart). It leads with the size of the cohort and the months it started, marks the last module in the brand colour, and closes on a footnote defining "finished": every lesson watched and the piece logged, self-paced and cohort students together. The headline number counts up and the bars draw in, hold and loop, with a button to pause the chart.

## Three ways to take the course

Pricing is a [PricingBand](/api/ui/pricing-band) of three plans: Self-paced, paid once; Cohort, eight weeks with a start date in a badge, a weekly live critique and a dark card that marks it as the featured plan; and Team seats, priced per seat from five, for studios and schools.

![Three plans, Self-paced at $180, Cohort at $420 for eight weeks on a dark card, and Team seats at $140 a seat](/showcase/centered/pricing.webp "The cohort plan carries its start date, and team seats are priced per seat from five.")

Each plan's action is a link to the closing enrolment call, so the plans need no script. The bands after pricing answer what a buyer asks next: the certificate, drawn as the document a student receives; the refund policy; and an FAQ set as two accordions of three in a [FaqBand](/api/ui/faq-band), side by side on a wide screen and one list on a phone. Every band below the fold renders only as it nears the viewport, holding a measured height at 1440px and 375px so in-page links land on their section.

On a phone the hero stacks the headline, the enrol button and a "Watch 6 lessons free" link above the player, and the [SiteHeader](/api/ui/site-header) folds its sections into a sheet that closes when a link is followed.

![The Centered hero on a phone, the headline, enrol button and free-lesson link stacked above the player](/showcase/centered/phone.webp "On a phone the offer comes first and the lesson follows directly under it.")

## Takes after

- [MasterClass](https://www.masterclass.com) — the dark, cinematic video stage that leads the page; Centered sets it inside a bright page so the stage reads as a room.
- [Domestika](https://www.domestika.org) — a craft course sold by its curriculum, lesson running times and student projects; Centered adds the faults students named and a completion chart.
- [Maven](https://maven.com) — the choice between learning alone and joining a cohort with a start date, set here as one pricing band.
