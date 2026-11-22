---
title: Encore
headline: Selling a party game from a marketing page that lets the visitor play a round
summary: The landing for Encore, a singing card game for iPhone, iPad, Apple Watch and Mac, with playable cards, the app's own sounds and three languages.
cover: landing
shots:
  - id: landing
    page: "https://sergiodxa.com/apps/encore"
    alt: The Encore landing, with the headline "Your next night starts with a song.", the App Store badge and three phone screens on a plum stage.
  - id: play
    page: "https://sergiodxa.com/apps/encore"
    click: "#play button[aria-label='Tap to reveal']"
    highlight: "section#play"
    alt: The "Pick a card, any card" band, a revealed challenge card on the game's backdrop with a Draw another button and a shuffle button.
  - id: round
    page: "https://sergiodxa.com/apps/encore"
    highlight: "[data-slot='tabbed-stage']"
    alt: The guided tour of a round, four steps on a rail beside the phone screen of the step that is selected.
  - id: deck
    page: "https://sergiodxa.com/apps/encore"
    click: "#deck li:nth-child(2) label"
    highlight: "#deck ul"
    alt: Five cards from the deck in a row, four face down and one turned over to show its challenge.
  - id: watch
    page: "https://sergiodxa.com/apps/encore"
    highlight: "[data-slot='split-media']"
    alt: Two Apple Watch screens in drawn bezels, one with the card ready and one with the challenge revealed.
  - id: privacy
    page: "https://sergiodxa.com/apps/encore"
    highlight: "section#privacy"
    alt: The privacy band, "What happens at karaoke stays at karaoke", over a row of checked facts and a link to the policy.
  - id: support
    page: "https://sergiodxa.com/apps/encore/support"
    highlight: "form[method='post']"
    alt: The Encore support form, with fields for name, email, topic, device, OS and app versions and a message.
  - id: phone-privacy
    page: "https://sergiodxa.com/apps/encore/privacy"
    viewport: phone
    alt: The Encore privacy policy on a phone, its title in the display serif beside a drawn card back.
---

Encore is a singing card game for iPhone, iPad, Apple Watch and Mac: someone draws a face-down card, taps to reveal a challenge such as "Sing a song you're slightly embarrassed to admit you love", and the room sings something that fits. Its marketing page lives at [sergiodxa.com/apps/encore](https://sergiodxa.com/apps/encore), served by the same Worker as the author's blog, and it is the address the App Store listing names as the app's Marketing URL. The support and privacy pages beside it are the listing's Support URL and privacy policy.

The page sells a paid app, so it has one job: make a visitor want to play before they reach the App Store badge. It does that by letting them play. Three real cards wait face down in the second band, the deck band turns over at a tap, a guided tour walks through a round on the app's own screens, and every card on the page is drawn in the browser from the app's SwiftUI geometry, in the visitor's colour scheme and in English, Argentine Spanish or Japanese. Its bands come from the `@sdxc/ui` landing kit; the game adds a card, a phone, a Watch and the app's sounds.

## The brief

A landing for a native app carries constraints a web product's page does not. The product cannot run in the page, so the page has to stand in for it with screens and pieces honest enough that nothing in the app surprises a buyer later. The listing is the only place to buy, so every call to action ends at the same App Store URL. The app ships in three languages, so the page should too, in the visitor's language on first load, with a link a person can share in any of them. Apple requires a support page and a privacy policy, and both need to be real pages, kept in step with the landing's look. And a party game's page should feel like the game: warm, theatrical, a little noisy, without costing a visitor who reads on a phone in a quiet room anything.

Encore's page takes all of that on inside the blog app. `app/http/controllers/encore.tsx` renders `resources/views/encore/landing.tsx` on the server, the page shell in `resources/layouts/encore.tsx` gives it a header, footer, social tags and Safari's smart App Store banner of its own, and three small islands add the playable card, the page's sounds and the switch that mutes them. Everything else is HTML and CSS.

## A real card in the visitor's hands

The second band, "Pick a card, any card", deals three real cards from the deck on the game's backdrop: oversized ribbons in violet, coral and gold sweeping in from both edges, a few sparkles, music notes drifting upward. Tapping the card flips it in 3D; "Draw another" sends it off the table to the right and lands the next one already face up, the way a swipe works in the app; a shuffle button in the corner deals the sample again face down, as shaking the phone does. After the third card the table shows the App Store badge and says how many cards are waiting in the app.

![The playable card band](/showcase/encore/play.webp "The playable card deals three real challenges, with Draw another and a shuffle button in the stage's corner.")

That band is `resources/components/encore-draw.tsx`, a `clientEntry` island. It renders the first card face down on the server, so a visitor sees a real card before any script runs, and every control is a `<button>` that works with mouse, touch and keyboard. The face-down card carries the app's own hint, "Tap to reveal", as its accessible name, and once it flips a visually hidden line reads the title and prompt through a polite live region. Under reduced motion a card changes in place without travelling. The draw button is `@sdxc/ui`'s [Button](/api/ui/button) with the landing kit's [landingCtaChrome](/api/ui/styles/landing-cta-chrome), so it matches the hero's calls.

The card itself is `resources/views/encore/card.tsx`, a 320 by 460 point card drawn as SVG and CSS from the app's code: the ornate back with mirrored ribbons around an applause burst, and the face with ribbon flourishes cropped into its corners, sparkles along the edges and a thin gold inner frame. The same component draws every card on the page.

## A round, told in four moves

"Flip. Sing. Swipe. Repeat until hoarse." is a guided tour: four steps on a rail, Tap to reveal, Sing it, Swipe for the next one and Shake things up, each beside the phone screen it produces. The screens are real captures from the app, framed in `@sdxc/ui`'s [PhoneFrame](/api/ui/phone-frame) through the page's `Phone` part, and each one is a `<picture>` with a light and a dark capture, so the phone follows the visitor's scheme and language.

![The guided tour of a round](/showcase/encore/round.webp "Each step of a round sits on a rail beside the screen it produces, here the face-down card waiting for a tap.")

The rail is a set of native radios. The screens share one grid cell and the checked radio picks which one shows through `:has()`, so switching steps needs no script and the band keeps one height. A small island, `PathAutoplay`, advances the tour while it is on screen: when the active step's progress line finishes growing, it checks the next radio. Because the line's CSS sets the pace, reduced motion stops the tour with it. On a narrow screen the same steps become cards in a row that scrolls sideways, each with its own screen.

The first viewport uses the same frames. [LandingHero](/api/ui/landing-hero) centres the headline "Your next night starts with a song.", the price note and two calls, the App Store badge and a [LinkButton](/api/ui/link-button) down to the tour. Below them, a stage holds the revealed challenge in front and two screens fanned behind it once the stage is wide enough, with a drawn card standing on each side on the widest stages. Those placements are container queries on the stage.

## The deck, flipped without script

The deck band shows five cards face down in a row: hand-written challenges and one combined challenge, each tilted as if just dealt. Each card turns over at a tap to show its challenge, and turns back at a second tap.

![Five cards from the deck](/showcase/encore/deck.webp "Every card in the deck band is a native checkbox, so it flips at a tap with no script at all.")

Each card is a `FlipCard` from `resources/views/encore/parts.tsx`: a `<label>` around a visually hidden checkbox and the card's two faces, with `input:checked` rotating the pair through 180 degrees. Keyboard focus draws an outline around the card through `:has(input:focus-visible)`, and the hidden text reads "Tap to reveal" with the card's title. On a phone the five cards stack into one pile and only the top card takes taps; from a 60rem container they spread into a row and each one flips. The band and the ones after it carry `content-visibility: auto` with an estimated height, so the browser lays out the heavy bands only as they near the viewport while the scrollbar stays still.

## The Watch, the nights and the facts

The Watch band is a [FeatureBand](/api/ui/feature-band) in its split layout: what the Watch can do as a list on one side, and on the other two Watch captures in a drawn rounded bezel, the card ready and the challenge revealed, the second set lower so the pair reads as a sequence.

![Two Apple Watch screens](/showcase/encore/watch.webp "The Watch band pairs the card waiting on the wrist with the challenge revealed.")

After it comes a bento of six nights, from a karaoke bar to New Year's Eve, each led by the real card from the deck that fits it on a block tinted in one of the app's ornament colours. Then privacy, as plain facts: no account, no microphone, no tracking, every card in the app, and the iPhone and the Watch talking only to each other. Each fact is a checked pill under the band's promise, with a link to the full policy in the page's language.

![The privacy band](/showcase/encore/privacy.webp "Privacy reads as five checked facts under the band's promise, with the policy one link away.")

The questions sit in a two-column [FaqBand](/api/ui/faq-band), each column an [Accordion](/api/ui/accordion) of disclosures on cards, so a reader can keep several answers open at once. The page closes on a [ClosingCta](/api/ui/closing-cta) with the app's burst, the campaign's last line, the same badge as the hero and the way to support.

## Three languages from one request

Every Encore route picks its language the same way, through `resolveLocale` and `ENCORE_LOCALES` in `config/encore.ts`: an explicit `?lang=` wins, then the first matching `Accept-Language` entry, matched on the base tag so `es` and `es-MX` both reach the Argentine Spanish page, and English for anyone else. The response carries `Content-Language` and `Vary: Accept-Language`. `inLanguage` keeps a visitor who picked a language on it as they move between the landing, support and privacy, and the footer links each translation, named in its own language.

Copy lives in `resources/content/encore/` as one module per language, handed down the tree by an `EncoreLanguage` context provider, so every band, card and screen prints in the page's language: the cards carry their translated titles and prompts, and the phone and Watch screens load the captures from that language's folder. The layout advertises every translation to search engines with `hreflang` links and an `x-default`, sets `og:locale`, and picks the social card from `?lang=` alone, so a shared link previews the same way for everyone who opens it.

`config/encore.ts` also holds the App Store ID. `ENCORE_APP_STORE_URL` is built from it, and every download call on every Encore page links that one listing, while the layout writes the same ID into the `apple-itunes-app` meta tag for Safari's smart banner.

## Sounds, motion and the switch

The page plays the app's own sounds. `resources/components/encore-sound.ts` rebuilds the reveal and the shuffle from the formulas the SwiftUI code synthesizes them with, a 0.1 second chirp rising from 620 to 980 Hz and a 0.28 second flutter like a riffled deck, sample by sample into a Web Audio buffer. The playable card chirps and riffles; a second island, `EncorePageSounds`, listens for the reader's own changes, so a deck card chirps as it turns over and picking a tour step or a question ticks. The tour advancing by itself sets a radio from script, which fires no `change` event, so it stays silent. The audio context is created on the first sound, always after a tap, and on Safari the audio session is set to ambient so the page follows the ringer switch.

The speaker in the header, `EncoreSoundToggle`, is a toggle button with `aria-pressed`. Its waves pulse while sound is on and give way to a small cross when it is off, with a blip up or down as it changes. The choice is stored in `localStorage`, and every control that shows it follows along through a custom event, which also carries the choice for the page in view when storage is unavailable in a private window.

Motion follows one rule: sparkles twinkling down the gutters, notes drifting off the stage and cards flipping with a slight overshoot all sit behind `motionSafe` or a `prefers-reduced-motion` query, so a reader who asks for less motion sees the sparkles still and the cards swap faces in place.

## Support and privacy as real pages

The support page is the app's Support URL. It frames the form in `EncorePage`, the title in the display serif beside a drawn card back, and asks for a name, an email, a topic, the device, OS and app versions and a message, built from `@sdxc/ui`'s [TextField](/api/ui/text-field), [Select](/api/ui/select), [TextArea](/api/ui/textarea), [Label](/api/ui/label), [FieldError](/api/ui/field-error) and [Alert](/api/ui/alert). The fields carry the validator's limits as `maxlength`, so the browser stops a visitor before the server has to.

![The support form](/showcase/encore/support.webp "The support form asks for the device and versions a bug report needs, and keeps every value when a send fails.")

`app/http/controllers/encore-support.tsx` checks the [@sdxc/honeypot](/api/honeypot) trap fields, admits the sender against a per-address rate limit, validates the form in the page's language, scores it through a spam filter and mails it from a verified sending address, with the visitor's address as Reply-To. A delivery redirects to a confirmation carried by a flash, so a reload never sends twice. A filled trap or a request scored as spam gets the same confirmation without a send, so a bot learns nothing; an invalid form, a rate limit or a failed delivery re-renders the form with the visitor's values intact and an alert naming the problem, with a fresh honeypot token each time.

The privacy policy is one Markdown file per language in `resources/content/encore/`, parsed through [@sdxc/markdown](/api/markdown) and rendered into a [Typeset](/api/ui/typeset) reading column. `/apps/encore/privacy.md`, and a request for the page that prefers `text/markdown`, answer with the same source, so the HTML page and its Markdown twin always agree.

![The privacy policy on a phone](/showcase/encore/phone-privacy.webp "On a phone the policy keeps the header's links and the card back beside the title, with lines at a readable measure.")

On a phone every Encore page keeps the same header: the wordmark, Support, Privacy and the speaker fit beside each other at 320 pixels in every language, so the shell needs no menu.
