---
title: Wakaba
headline: Selling a Japanese vocabulary app with real screens, four companions and a bonsai that grows in CSS
summary: The marketing page, support desk and privacy policy for Wakaba, an iPhone and iPad app, server-rendered in English and Spanish from the @sdxc/ui landing kit.
tagline: A Japanese vocabulary app's landing
cover: hero
shots:
  - id: hero
    page: "https://sergiodxa.com/apps/wakaba"
    alt: Wakaba's landing, the tagline "Grow with every session" over three real app screens framed as phones, rising out of a vermilion circle with Kitsune and Tanuki beside them.
  - id: path
    page: "https://sergiodxa.com/apps/wakaba"
    highlight: "[data-slot='tabbed-stage']"
    alt: The learning-path tour, four steps on a rail beside the real screen of the step that is on.
  - id: companions
    page: "https://sergiodxa.com/apps/wakaba"
    highlight: "#companions ul"
    alt: Four cards for Kitsune, Aka Oni, Tanuki and Tengu, each tinted after its character and naming the role it plays.
  - id: exercises
    page: "https://sergiodxa.com/apps/wakaba"
    highlight: "#exercises ul"
    alt: Five real practice screens in phone frames, listening, speaking, building a sentence, conjugating and a correction, each with its caption.
  - id: bonsai
    page: "https://sergiodxa.com/apps/wakaba"
    highlight: "#bonsai div:has(> [data-slot='motion-loop'])"
    wait: 1700
    alt: The bonsai on a white card over a timeline of practised days from 0 to 365, beside a card comparing a Friday and a Monday after a missed weekend.
  - id: privacy
    page: "https://sergiodxa.com/apps/wakaba"
    highlight: "#privacy div:has(> div > [data-slot='check-list'])"
    alt: The privacy band, "Your practice stays yours", beside a card of four checked facts with Kitsune sitting on its corner.
  - id: support
    page: "https://sergiodxa.com/apps/wakaba/support"
    highlight: "section[aria-labelledby='support-form']"
    alt: The support form on a white card, with name, email, topic, device, OS and app versions and a message.
  - id: phone-es
    page: "https://sergiodxa.com/apps/wakaba?lang=es-AR"
    viewport: phone
    alt: The landing in Spanish on a phone, "Crece con cada práctica" above the App Store badge and a single framed screen.
---

Wakaba is a free iPhone and iPad app for practising Japanese vocabulary, and [sergiodxa.com/apps/wakaba](https://sergiodxa.com/apps/wakaba) is the page its App Store listing points to as its Marketing URL. Beside it sit the listing's Support URL, a contact form at `/apps/wakaba/support`, and its privacy policy at `/apps/wakaba/privacy`. All three are served by the blog's Worker on the blog's domain, and none of them looks like the blog: they wear the app's cream paper, vermilion accent and warm charcoal dark mode, with a header and footer of their own.

The landing shows the app instead of describing it. Every phone on the page frames a real screenshot, taken in both appearances and in both of the app's languages, and the page picks the right one for the visitor. Four companions from Japanese folklore walk the reader through the bands, and the app's signature, a bonsai that grows with the days a learner practises, plays as a time-lapse built from CSS keyframes alone. The page is assembled from the `@sdxc/ui` landing kit, and every word of it is rendered on the server in English or Spanish.

## The brief

A page for an App Store app has a narrow job. It has to convince someone in a few screens that the app is worth installing, show exactly what they will see after they do, and send them to the listing. It also has to satisfy Apple: the listing needs a support page a person can actually use and a privacy policy that says what the app does with their data. The audience reads on phones more than anywhere else, many of them arrive from a Spanish-language store, and a good share of them use dark mode, which the app itself supports.

Wakaba's pages take on all of it under the blog's constraints. The blog renders every page on the server with `remix/component`, keeps every link a full document navigation, and allows a script only where it improves markup that already works. So the tours, the time-lapse, the swipeable rows and the disclosures all work before any script runs, and the few islands on the page add autoplay and scroll-aware fades on top. The App Store listing lives in `config/wakaba.ts`, the copy in `resources/content/wakaba/`, the views in `resources/views/wakaba/` and the shell in `resources/layouts/wakaba.tsx`.

## Real screens in phone frames, in the visitor's language and scheme

The hero sets the tagline as the `h1` in a [LandingHero](/api/ui/landing-hero), with the App Store call and a [LinkButton](/api/ui/link-button) that jumps to the bonsai. Below it, three phones rise out of a vermilion circle: the learning path in front, a flashcard and a practice question fanned behind it once the stage is wide enough, with Kitsune and Tanuki standing at the edges. On a wide stage two cards drift past the phones, a streak and a word of the day, inside a [MotionLoop](/api/ui/motion-loop) whose toggle pauses them; the drift runs only for readers who allow motion.

Each phone is the `Phone` component in `resources/views/wakaba/parts.tsx`. It looks the screen up in a table of captures, swaps `{lang}` in the file path for the page's language, and draws a `<picture>` with the light capture as the image and the dark one as a `prefers-color-scheme: dark` source, inside the [PhoneFrame](/api/ui/phone-frame) bezel. The captures already carry the status bar, so the frame adds only the hardware. The kana-tracing screen is an iPad capture and gets a tablet bezel with gentler corners. The first screens load eagerly with high fetch priority; every other one is lazy.

The page's language comes from `resolvePageLocale`: an explicit `?lang=` wins, then the first matching `Accept-Language` entry, so `es`, `es-MX` and `es-419` all reach the Argentine Spanish page, and anything else gets English. The response carries `Content-Language` and `Vary: Accept-Language`, the layout advertises both versions with `hreflang` alternates, and a reader who picked Spanish through `?lang=` stays on it, since every internal link keeps the parameter. A `WakabaLanguage` provider hands the copy to every component through context, so a band, a phone frame and the App Store badge all print and pick captures in one language.

![The landing in Spanish on a phone](/showcase/wakaba/phone-es.webp "With ?lang=es-AR the page, its App Store badge and the framed screen are all in Spanish, and on a phone the hero keeps one screen at a readable size.")

The App Store call reads the listing from `config/wakaba.ts`. With an id it renders Apple's own badge, unaltered and in the page's language, linking `apps.apple.com`; with a `null` id it renders a quiet "Coming soon to the App Store" note, so nobody taps a dead link. The same id adds the `apple-itunes-app` meta tag for Safari's smart banner. The listing is live, so today every call is the badge.

## A tour of the path, and the exercises side by side

The learning-path band walks through the four steps a learner takes in a level: meeting a word, practising it, passing the level exam and reviewing what slipped. On a wide band the steps sit on a rail of native radio buttons beside the screen each one switches; the radios do the switching in CSS, so the tour works with no script at all. A small island, `PathAutoplay`, rides in the band's header. While a third of the stage is visible it marks the tour as playing, and when the active step's progress line finishes growing it checks the next radio. The line's CSS sets the pace, so pausing or reducing motion stops the tour with it.

![The learning-path tour](/showcase/wakaba/path.webp "Each step on the rail switches the real screen beside it, and the tour plays on its own while it is on screen.")

On a narrow band the same steps become cards, each with its own screen, in a row that scrolls sideways. That row is `Swipeable`, which the exercises band uses too: five practice screens, listening, speaking, building a sentence, conjugating a verb and learning from a mistake, each card most of the row's width and snapping to its centre so one is readable and its neighbours peek in. From a container width where all five fit it becomes a plain grid. The `SwipeFade` island sets `data-fade` on the row as the reader scrolls, so only an edge with more cards past it fades.

![The five exercises](/showcase/wakaba/exercises.webp "Five real practice screens sit whole on a wide screen and become a row that swipes one phone at a time on a narrow one.")

Between them, the companions band introduces Kitsune, Aka Oni, Tanuki and Tengu on cards tinted after each one, with the kanji of the name in the app's Mincho face and the moment each character turns up: the guide, the corrector, the cheerleader and the teacher. Outside that band the characters appear only as decoration, with empty alt text, since this band is where they are named.

![The four companions](/showcase/wakaba/companions.webp "Each companion gets a card tinted after it, naming the role it plays in a session.")

Further down, the flashcard and kana-tracing bands are split [FeatureBand](/api/ui/feature-band)s with two framed screens each, and a [LandingSection](/api/ui/landing-section) holds a bento of six cards that show the smaller features with the top of a real screen fading out. The languages card shows the app in the page's other language, since a reader already sees their own on every other screen. Heavy bands carry `content-visibility: auto` with an estimated height, so the browser lays them out only as they near the viewport.

## A bonsai that grows in CSS

The bonsai band holds the app's idea in one picture: the tree grows with the days a learner practises, through ten stages that begin at 0, 4, 8, 12, 16, 30, 60, 90, 180 and 365 days, and missing a day never shrinks it. `resources/views/wakaba/bonsai.tsx` stacks all ten stage images in one grid cell and gives each its own opacity keyframes, generated from the stage list: a stage fades in over 0.8 seconds, holds for three, and fades out under the next. The full-grown tree holds for six seconds before the loop wraps, and the first stage fades in under it, so the pot never stands empty. A timeline of the ten day counts fills underneath in step with the tree.

There is no script in it. The animation runs inside a [MotionLoop](/api/ui/motion-loop) with a pause toggle, and only under `motionSafe`; with reduced motion every stage but the last stays transparent, so the reader sees the grown tree and its alt text. Each stage is a `<picture>` with a dark-mode source, so the tree turns coral on charcoal along with the page.

![The bonsai time-lapse beside the missed weekend](/showcase/wakaba/bonsai.webp "The tree grows through ten stages over a timeline of practised days, beside a card showing a missed weekend reset the streak and leave the tree alone.")

Beside the time-lapse, a card compares a Friday and a Monday after a skipped weekend. The streak drops from 23 days to one, marked in the accent; practised days go from 41 to 42; the tree is the same 30-day tree. The card is a definition list whose rows lay out on three shared columns through `display: contents`, so labels and both days align across rows.

## Privacy, support and a policy with a Markdown twin

The privacy band states the app's practice as four checked facts in a [CheckList](/api/ui/check-row): no ads, analytics or tracking, practice on the device, progress in the learner's private iCloud and speech recognised on the device. Kitsune sits on the card's corner once the band is wide enough for the card and the copy to stand side by side, and beside the title before that. The band links to the full policy.

![The privacy band](/showcase/wakaba/privacy.webp "The app's privacy practice reads as four plain facts, with a link to the full policy.")

The policy is a bundled Markdown file per language. `app/http/controllers/wakaba-privacy.tsx` parses it with [@sdxc/markdown](/api/markdown) on each request and renders the HTML page on a white card at a short measure, or serves the Markdown itself when the request prefers `text/markdown`, and `/apps/wakaba/privacy.md` serves it whatever the request accepts. Both formats come from one source, so they can never disagree.

The support page is a [Form](/api/ui/form) of [TextField](/api/ui/text-field)s, two [Select](/api/ui/select)s and a [TextArea](/api/ui/textarea) on a white card, with topic and device values that stay in English whatever language their labels are in. The controller in `app/http/controllers/wakaba-support.tsx` checks hidden fields from [@sdxc/honeypot](/api/honeypot) first: a filled trap answers like a success without sending, and an expired token re-renders the form with the message kept. Then the support desk spends one of five submissions per minute for the visitor's address through [@sdxc/rate-limit](/api/rate-limit), the fields are validated in the page's language, [@sdxc/spam](/api/spam) scores the request, and [@sdxc/mail](/api/mail) delivers it from a verified sender with the visitor's address as Reply-To.

![The support form](/showcase/wakaba/support.webp "The support form asks for what a fix needs, device and versions included, and every failure keeps the visitor's message.")

Every state renders through the same view: idle, invalid with an [Alert](/api/ui/alert) above the form and each field's message beside it, rate-limited with `retry-after: 60`, failed with a 503, resubmit after an expired form, and sent. A delivery redirects with 303 to the confirmation, carried across by a session flash, so a reload never sends twice.

## One shell on a shared domain

`resources/layouts/wakaba.tsx` renders the document in a `wakaba` scope, which is what `resources/css/wakaba.css` keys on. That stylesheet declares the app's palette as the raw brand and neutral ramps the `@sdxc/ui` theme derives every semantic token from, built so the derivations land on the app's own values: cream `#F7F5ED` and white cards with vermilion `#C43B2E` in light, charcoal `#1E1C19` and `#2D2A26` with coral `#EE967E` in dark. Secondary text sits one step darker than the app's grey so it keeps a 4.5:1 contrast on cream. The same stylesheet sets the rounded display face, the Mincho for kanji and the landing kit's tokens, so the shared components take Wakaba's look with no component of their own, and `theme-color` tints the browser chrome to match in each scheme.

The shell adds the 学 mark as an SVG favicon that is vermilion in light and coral in dark, the app icon, Open Graph and Twitter cards in the page's language, and a canonical URL that names `?lang=` for the Spanish version. The questions band is a two-column [FaqBand](/api/ui/faq-band) of [Accordion](/api/ui/accordion) items, one open at a time per column through the native `name` attribute, and the page closes on a [ClosingCta](/api/ui/closing-cta) with all four companions over the same App Store call as the hero.
