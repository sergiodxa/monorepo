---
title: The Measure
headline: A typography book's page set like the book itself, where every form confirms in place through a fragment
summary: A landing for an invented web typography book and video course, set as an editorial print page in one serif on ivory paper with a single red.
tagline: A typography course on ivory paper
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Measure landing, a serif headline set like a title page beside a flat red cloth cover, a buy button and a link to the free chapter.
  - id: cover
    page: ""
    highlight: "[data-slot=book]"
    alt: The book's cover drawn in SVG, red cloth with a hinge crease, a measure rule marked 66 over ruled lines, the title The Measure and the author's name.
  - id: sample
    page: ""
    highlight: "#sample [data-slot=split-media]"
    alt: The free chapter's first page, a running head and page number, a large red chapter numeral, a drop cap and a red rule marked 34 ch spanning the paragraph.
  - id: contents
    page: ""
    click: "#contents [data-slot=curriculum-lesson]:nth-child(2) summary"
    highlight: "#contents [data-slot=curriculum-part]"
    alt: Part I of the contents, five numbered chapters with page numbers, chapter 2 The measure marked Free and opened on its summary, page count and video lessons.
  - id: praise
    page: ""
    highlight: "#praise"
    alt: The jacket band, four figures in ruled columns, readers, average rating, pages and hours of video, with an italic blurb under each.
  - id: pricing
    page: ""
    highlight: "#pricing [data-slot=pricing-plans]"
    alt: Two plans with square corners, The book at $39 and the Complete edition at $99 on an ink card marked Most chosen.
  - id: phone
    page: ""
    viewport: phone
    alt: The Measure hero on a phone, the serif headline stacked above the buy button and the cover.
---

The Measure is an invented book and video course on web typography for designers and engineers: measure, rhythm, scale and fonts, with CSS for every chapter. The book does not exist. The page is a book landing built from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) and [@sdxc/icons](/api/icons), and it is the demo to read for how far theme tokens take a brand.

Everything on the page is set as a printed book's site: one serif for every face, ivory paper and ink with a single printer's red, square corners on every box and control, rules where other pages use shadows, tracked capitals for eyebrows and emphasis in italic. Under that print register sit the same shared landing components every other demo uses. The page also shows the book's own craft as its sample, and it confirms each of its four forms beside the button that sent it, through nothing more than a URL fragment and `:target`.

## The brief

A book page has to sell reading, and a typography book has a harder version of that problem: the page is itself a piece of typography, and a reader will judge the book by it. It needs a cover, a sample a reader can judge, a table of contents specific enough to show the book's shape, the author, praise, and plain pricing between the book and the book with its course.

The Measure takes on each of those in a print register, rendered entirely on the server. It sets the hero as a title page, uses the free chapter's first page as the sample, sets the contents the way the printed book does, stacks figures and blurbs as a jacket would, and keeps the pricing to two plans so no width ever leaves one alone on a row.

## A title page and a flat cover

The hero sets its promise like a title page, "Set type people finish reading", with "finish" in italic, beside the cover. A buy button and an underlined way into the free chapter follow, then the review score as a printed line. The parts enter in turn on load, only for a reader who allows motion.

![The book's cover drawn in SVG, red cloth with a hinge crease, a measure rule marked 66 over ruled lines, the title The Measure and the author's name](/showcase/the-measure/cover.webp "The cover is SVG, shown flat and square-on the way a catalogue plate shows a book.")

The cover is drawn in SVG: matte cloth, a hinge crease, a measure rule over ruled lines and the title, edged by a single rule, shown flat and square-on so it carries the same print register as the page around it. Below the hero, a [LogoSentence](/api/ui/logo-sentence) credits the publications that reviewed the book as one sentence with their mastheads in it, the way a jacket flap credits its reviewers.

## The book's typography as the sample

The free-chapter band puts an email form and a direct download beside the chapter's opening page, set the way the book sets it: a running head and page number, a large chapter numeral in the red, the chapter title, a drop cap, and a measure rule annotated in the margin colour.

![The free chapter's first page, a running head and page number, a large red chapter numeral, a drop cap and a red rule marked 34 ch spanning the paragraph](/showcase/the-measure/sample.webp "The 34 ch rule spans exactly the paragraph beneath it, because both share one 34ch column.")

The rule is the detail a typographer checks. The paragraph and the rule share one `34ch` column in the same face and size, so the rule spans exactly the line length it annotates. The form posts to an example endpoint; the direct download is there for a reader who would rather not leave an address.

## Contents set like the printed book

The table of contents holds the band's title at the start column while the three parts run down the other. Each part is a [Curriculum](/api/ui/curriculum) of chapters: number, title and opening page, with the free chapter badged, and each chapter opens in place on a summary and the videos that go with it.

![Part I of the contents, five numbered chapters with page numbers, chapter 2 The measure marked Free and opened on its summary, page count and video lessons](/showcase/the-measure/contents.webp "Each chapter is a native disclosure that opens on its summary, page count and videos.")

Each chapter is a native `<details>` inside the curriculum, so opening one needs no script and a reader can open as many as they like. The page numbers make the contents read as a printed book's, and the "Free" badge points at the same chapter the sample band shows.

## Proof as a jacket

Below an un-carded list of six skills the book teaches, the jacket band sets four figures in a ruled [StatStrip](/api/ui/stat-strip) and four blurbs in the same four ruled columns beneath, so each quotation reads under its figure, as a book's back cover stacks its praise. Four of each keeps a phone's two-up figures in whole rows.

![The jacket band, four figures in ruled columns, readers, average rating, pages and hours of video, with an italic blurb under each](/showcase/the-measure/praise.webp "Figures and blurbs share four ruled columns, so each quotation sits under its figure.")

The author follows in an [AuthorBand](/api/ui/author-band) with an engraved-style portrait, a signature and her profiles, then readers' reviews led by one set in ink, each naming what changed in the reader's own work after the book.

## Two plans, and forms that answer

Pricing is a [PricingBand](/api/ui/pricing-band) of two plans: the book alone, and the complete edition with the video course on an ink card marked "Most chosen". Both are one-time purchases, and both actions are real forms.

![Two plans with square corners, The book at $39 and the Complete edition at $99 on an ink card marked Most chosen](/showcase/the-measure/pricing.webp "Two plans in the print register, square corners and rules throughout.")

Each plan's button is a `CheckoutButton` that posts to an example endpoint whose redirect carries a fragment naming that plan's own confirmation. The confirmation sits under the button, hidden until it is the target:

```tsx
<form method="post" action={`/examples/book/checkout#bought-${plan}`} mix={[grid()]}>
```

The note beneath it is a `role="status"` paragraph with `"&:target": { display: "block" }` and a scroll margin that clears the sticky header, so the reader lands on "The book is in your library" right where they clicked. The free-chapter form and the letters sign-up in the [SiteFooter](/api/ui/site-footer) work the same way, with `#chapter-sent` and `#letters-signed-up`. All four work with JavaScript off, and the page opens with a single `<h1>`, bands at `<h2>` and cards at `<h3>`, because the landing bands own their heading levels. Heavy bands below the fold render only as they near view, with measured placeholder heights.

On a phone, the [SiteHeader](/api/ui/site-header) collapses its sections into a sheet below its extra-large breakpoint so the bar keeps one line at tablet widths, and the hero stacks the title, the buy button and the cover.

![The Measure hero on a phone, the serif headline stacked above the buy button and the cover](/showcase/the-measure/phone.webp "On a phone the title page stacks above the cover, still in one serif.")

## Takes after

- [Practical Typography](https://practicaltypography.com) — a typography book whose own pages demonstrate what it teaches; The Measure uses its first page as the sample.
- [A Book Apart](https://abookapart.com) — a web design book sold with a cover, a sample chapter and its contents.
- [Refactoring UI](https://www.refactoringui.com) — a design book sold as a book alone or a complete package with videos, here as two plans.
