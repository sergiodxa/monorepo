---
title: Malfoid Stickers
headline: Selling an iMessage sticker pack by letting every sticker answer a message
summary: The landing, support desk and privacy policy for Malfoid Stickers, a free pack of 170 iMessage stickers, server-rendered in English and Spanish from the @sdxc/ui landing kit.
tagline: An iMessage sticker pack's landing
cover: hero
shots:
  - id: hero
    page: "https://sergiodxa.com/apps/malfoid"
    alt: The Malfoid Stickers landing, the headline "A little cute. A little dramatic. A lot of attitude." above five stickers of Malfoid standing on a cream stage, the smug one in the middle.
  - id: meet
    page: "https://sergiodxa.com/apps/malfoid"
    highlight: "#meet figure"
    alt: A conversation on a card, two messages from a friend answered by stickers of Malfoid, a death stare and a hidden smile.
  - id: moods
    page: "https://sergiodxa.com/apps/malfoid"
    highlight: "#moods ul"
    alt: Eight cards for the pack's everyday sets, each with the sticker that stands for it, what the set is for and a link to its ten stickers.
  - id: occasions
    page: "https://sergiodxa.com/apps/malfoid"
    highlight: "#moods div:has(> ul > li > a[href='#thanksgiving'])"
    alt: A row of nine tiles for the holiday sets, from Thanksgiving to Earth Day, each with a sticker dressed for the day.
  - id: viewer
    page: "https://sergiodxa.com/apps/malfoid"
    click: "#stickers [data-lightbox-index='59']"
    wait: 1200
    alt: The sticker viewer open over the page, a friend's message "Should I text my ex?" answered by a large sticker of Malfoid giving a thumbs-down, with its description beneath.
  - id: privacy
    page: "https://sergiodxa.com/apps/malfoid"
    highlight: "section#privacy"
    alt: The privacy band, "She isn't interested in your data.", beside a card of checked facts with Malfoid, arms crossed, sitting on its corner.
  - id: support
    page: "https://sergiodxa.com/apps/malfoid/support"
    highlight: "form[method='post']"
    alt: The Malfoid Stickers support form, with fields for name, email, topic, device, OS and app versions and a message.
  - id: phone-es
    page: "https://sergiodxa.com/apps/malfoid?lang=es-AR"
    viewport: phone
    alt: The landing in Spanish on a phone, the short headline "Tierna. Dramática. Con actitud." above three stickers on the cream stage.
---

Malfoid Stickers is a free pack of 170 iMessage stickers for iPhone and iPad, and [sergiodxa.com/apps/malfoid](https://sergiodxa.com/apps/malfoid) is the page its App Store listing names as its Marketing URL. Beside it sit the listing's Support URL, a contact form at `/apps/malfoid/support`, and its privacy policy at `/apps/malfoid/privacy`. The blog's Worker serves all three on the blog's domain, in the pack's own palette of emerald, ivory, platinum cream and blush on a silver-mint ground, with a header and footer of their own.

A sticker pack has no screens to show and no features to list: the product is the artwork, and what it does is answer a message. So the page leads with the art and shows it doing that job. Malfoid answers a friend in the second band, its seventeen sets work as a table of contents, and every one of the 170 stickers opens in a viewer where it replies to a message of its own. Nothing on the page is a description standing in for a sticker. The bands come from the `@sdxc/ui` landing kit, and every word is rendered on the server in English or Spanish.

## The brief

The pack is textless, so it works in any language, costs nothing, shows no ads and collects no data; the page has to say all four quickly and prove the first by showing the art. Apple needs a support page a person can use and a privacy policy that states what the app touches. The pack is not listed yet, so the download call has to be honest about that without a dead link, and switch to the real badge the day an id exists.

The pages follow the blog's rules: server rendering with `remix/component`, every link a full document navigation, and a script only where it improves markup that already works. The copy lives in `resources/content/malfoid/`, the views in `resources/views/malfoid/`, the shell in `resources/layouts/malfoid.tsx` and the listing in `config/malfoid.ts`.

## The art first

The hero sets the headline as the `h1` in a [LandingHero](/api/ui/landing-hero), with the App Store call and a [LinkButton](/api/ui/link-button) that jumps to the gallery. Under it, five stickers stand in a row on a rounded cream stage, overlapping its top edge like stickers pressed onto a page, the proudest one raised in the middle and the others leaning away from it. On a phone the two outer stickers drop out, so the middle three stay large. The headline has a long and a short form, and the phone gets the short one rather than four lines of type.

![The landing in Spanish on a phone](/showcase/malfoid/phone-es.webp "With ?lang=es-AR the page is in Spanish, and on a phone the short headline and three stickers fit the first screen.")

The second band introduces Malfoid in two sentences beside a conversation: a friend's message in a grey bubble, a sticker sent as the reply with no bubble around it, the way Messages shows one. The pack's whole pitch is in that card.

![A conversation answered with stickers](/showcase/malfoid/meet.webp "Two messages from a friend, each answered with a sticker instead of words.")

The next band is a table of contents for the pack's seventeen sets of ten. The eight everyday sets, six moods plus friendship and memes, each get a card with the sticker that stands for it, a line about when to reach for it, and a link to its stickers further down. The nine occasions, Thanksgiving to Earth Day, follow as a compact row of tiles, each with a sticker dressed for the day; a name that runs to two lines stretches the whole row, so the tiles stay one height.

![The everyday sets](/showcase/malfoid/moods.webp "Each everyday set gets a card with its sticker and a jump to its ten stickers in the gallery.")

![The occasions](/showcase/malfoid/occasions.webp "The holiday sets sit in one row of tiles below them.")

## Sixty stickers, each answering a message

The gallery lists all 170 stickers set by set, under two headings, every day and occasions, in rows of ten, five on a narrow screen, so every row is full. Each tile is a [Lightbox](/api/ui/lightbox) trigger, a plain button with `command="show-modal"` that opens a native `<dialog>` at that sticker. A slide shows a message a friend might send, "Should I text my ex?" or "Tomorrow is Monday again.", and the sticker answering it at full size, with its description beneath. The arrows, a swipe or the keyboard step through all 170 in the gallery's order, and on a phone the counter keeps its own line above the description, so the sticker never jumps between slides. Every message is written in both languages, and the slide's accessible name reads the exchange as a sentence.

![The sticker viewer](/showcase/malfoid/viewer.webp "Each sticker opens answering a message of its own, with its description as the caption.")

The stickers are WebP at 240 and 480 pixels through `srcset`, eager in the hero and lazy below it. Opening a lazy sticker used to show the message before the art, so a small island, `StickerPreload`, closes that gap: pointing at or focusing a tile switches that slide's images to eager loading, and while a slide is on screen an `IntersectionObserver` loads the stickers on either side of it. The viewer works without the island, loading each sticker as its slide comes into view.

## Privacy, support and a policy with a Markdown twin

The privacy band states the pack's practice as checked facts in a [CheckList](/api/ui/check-row): free with no ads or purchases, no account to make, no analytics or tracking, no access to conversations, contacts or photos, and every sticker bundled for offline use. The policy is a bundled Markdown file per language, rendered as a page or served as Markdown when the request prefers `text/markdown`, and `/apps/malfoid/privacy.md` serves it to anyone.

![The privacy band](/showcase/malfoid/privacy.webp "The pack's privacy practice reads as plain facts, with a link to the full policy.")

The support page opens with quick fixes for the problems people actually hit, such as stickers someone can't find in Messages or a pack missing from the drawer on another device, and then a [Form](/api/ui/form) of [TextField](/api/ui/text-field)s, two [Select](/api/ui/select)s and a [TextArea](/api/ui/textarea). Its topic and device values stay in English whatever language their labels are in. A submission passes [@sdxc/honeypot](/api/honeypot), a per-address limit through [@sdxc/rate-limit](/api/rate-limit), validation in the page's language and a score from [@sdxc/spam](/api/spam), and [@sdxc/mail](/api/mail) delivers it from a verified sender with the visitor's address as Reply-To. A delivery redirects to a confirmation, so a reload never sends twice.

![The support form](/showcase/malfoid/support.webp "The support form asks for what a fix needs, device and versions included.")

## One shell, two languages, honest about the store

`resources/layouts/malfoid.tsx` renders every page in a `malfoid` scope, and `resources/css/malfoid.css` declares the pack's palette as the brand and neutral ramps the `@sdxc/ui` theme derives its tokens from, with an ivory surface for cards in light and a lifted charcoal in dark, so cards stay distinct from the bands behind them. The language comes from `?lang=` first, then `Accept-Language`; the response carries `Content-Language` and `Vary: Accept-Language`, the layout lists both versions as `hreflang` alternates, and every internal link keeps the choice.

Each page has a social card of its own, in the page's language: the landing's, the policy's and the support page's, each with three stickers that suit it. The favicon is Malfoid's face from the app icon. The download call reads the listing from `config/malfoid.ts`: with a `null` id it says "Coming soon to the App Store" and links nowhere, and once the id is set it becomes Apple's badge and adds the `apple-itunes-app` tag for Safari's smart banner. The page ends on a [FaqBand](/api/ui/faq-band) of questions and a [ClosingCta](/api/ui/closing-cta) with Malfoid waving over the same call as the hero.
