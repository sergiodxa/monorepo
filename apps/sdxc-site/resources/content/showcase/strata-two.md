---
title: Strata Two
headline: A hardware launch drawn entirely in SVG, with scroll-driven scenes, a board you can play and a preorder answered from the URL
summary: A launch page for an invented aluminium keyboard, drawn in SVG on a dark stage, with scroll-driven scenes, a playable board and a preorder that needs no script.
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Strata Two landing, an aluminium keyboard drawn in SVG on a dark stage with one signal-orange key, under the headline and the preorder price.
  - id: exploded
    page: ""
    highlight: "[data-slot=scroll-scene]"
    alt: The keyboard pulled apart into eight layers in 3D, from keycaps and switches down through the plate, gaskets, circuit board, foam and brass weight to the case, each named in a legend.
  - id: sound-board
    page: ""
    highlight: "[data-slot=strata-sound-board]"
    alt: The playable board drawn large, a 75% layout with an orange escape key and a knob, under a switch toggle for Silk linear and Notch tactile.
  - id: finishes
    page: "?finish=graphite#finishes"
    highlight: "#finishes svg[data-slot=strata-keyboard]"
    alt: The board recoloured in the Graphite finish, a dark case and dark keycaps with the orange escape key, above the three finish swatches.
  - id: compare
    page: ""
    highlight: "#compare table"
    alt: A comparison table of Strata One and Strata Two by mount, case, polling, wireless, battery, knob, hot-swap, keycaps, weight and price, an orange dot marking which board each row favours.
  - id: preorder
    page: "?finish=bronze&layout=iso&switch=notch&reserve=1#preorder"
    highlight: "#preorder div:has(> [data-slot=strata-reservation])"
    alt: The preorder answer, the $279 price over batch 03 at 846 of 1,200 reserved and the batches around it, beside an orange card confirming Strata Two in Bronze, ISO, Notch switches.
  - id: phone
    page: ""
    viewport: phone
    alt: The Strata Two hero on a phone, the keyboard across the width under the headline and the preorder button.
---

Strata Two is an invented 75% keyboard in a one-piece aluminium case with a gasket-mounted plate, on preorder for batch 03 at $279 and shipping 9 March 2027. The keyboard does not exist. The page is a hardware launch built from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) and [@sdxc/icons](/api/icons), and it has no photographs: the board is drawn in SVG throughout, on a dark stage with aluminium neutrals, raking light and one signal-orange key.

It is the demo to read for scroll-driven storytelling and progressive enhancement on a product page. Three scenes run on CSS scroll timelines and fall back to finished frames; a playable board adds sound through a small island; a finish picker recolours every drawing of the board with `:has()`; and the preorder is a GET form the server answers from its own URL. Each layer works without the one above it.

## The brief

A hardware launch has to make an object real through a screen. The genre's best pages take the product apart as the reader scrolls, light its materials, let the reader configure it and show the price and ship date without a sales call. They also tend to depend on heavy scripts and video, and break into a blank stage when either is missing.

Strata Two takes on the same storytelling with the platform. The scenes are CSS scroll-driven animations, the configuration is radios that belong to the order form, and the sound is the only part that needs JavaScript, which the page says plainly when it is off. Below the story, the page carries what a buyer compares: a spec sheet, the box contents, a comparison with the previous board that admits where it is still better, press reviews quoted with their criticism and an FAQ.

## The board, taken apart

The first of three scroll scenes, built with [ScrollScene](/api/ui/scroll-scene) and `sceneMotion` from the landing kit, holds the board on a tall runway and pulls it apart into its eight layers as the reader scrolls: keycaps, switches, plate, gaskets, circuit board, case foam, brass weight and case, with a legend naming each one and what it is made of.

![The keyboard pulled apart into eight layers in 3D, from keycaps and switches down through the plate, gaskets, circuit board, foam and brass weight to the case, each named in a legend](/showcase/strata-two/exploded.webp "Eight flat drawings stacked in CSS 3D, separated along the board's own depth as the reader scrolls.")

The layers are flat drawings stacked in CSS 3D, tilted back with `rotateX` and `rotateZ` inside a `preserve-3d` stage, so the board comes apart along its own depth. The second scene lights the three materials in turn with a light that rakes across each swatch, and the third looks at the board close and tilted back on a desk, typing a commit message one key at a time. Under reduced motion, or in a browser without scroll timelines, each scene is a static finished frame in normal flow: the board fully exploded, every swatch lit, the line complete with every key up. `hardware.browser.test.tsx` checks both the running scenes and the finished frames.

The typing scene reveals its line by clipping and moves its caret by translation, so scrolling through it changes no layout and the pinned keyboard under it stays still. A test asserts exactly that: the stage's layout does not change while the line types itself.

## A board you can play

The "Hear it" band draws the board at the full width of the stage with a switch toggle above it. A reader presses keys with a pointer, a finger or their own keyboard, and hears each press, synthesised for the switch they picked: Silk bottoms out round and low, Notch ticks at the bump first.

![The playable board drawn large, a 75% layout with an orange escape key and a knob, under a switch toggle for Silk linear and Notch tactile](/showcase/strata-two/sound-board.webp "Every key presses under a pointer or a finger, and each press is synthesised for the chosen switch.")

The board is a `clientEntry` island in `sound-board.tsx`. Its sounds come from `key-sound.ts`, which builds each press from noise and filters with Web Audio, scaled by the key's width so the space bar sounds deeper than a letter:

```ts
let size = 1 / Math.sqrt(Math.max(1, width));
if (voice.tick) click(ctx, now, voice.click * 1.4, 2, 0.12);
let bottom = now + (voice.tick ? 0.014 : 0.004);
click(ctx, bottom, voice.click * (0.6 + size * 0.4), voice.clickQ, 0.5);
thock(ctx, bottom, voice.tone * (0.55 + size * 0.45), voice.toneDecay * (2 - size), 0.35);
```

Physical keys are read only while the board has focus, so typing anywhere else on the page stays silent. Before the island loads, the keys still dip under a held pointer through CSS, and with scripts off a `<noscript>` line in the footnote says the sound plays with JavaScript on.

## A finish picker inside the order form

The finishes band shows three anodised finishes, Raw, Graphite and Bronze, as swatch radios beside the board. Choosing one recolours the board, every other drawing of the board on the page and the preorder summary.

![The board recoloured in the Graphite finish, a dark case and dark keycaps with the orange escape key, above the three finish swatches](/showcase/strata-two/finishes.webp "The Graphite radio is checked, so every drawing of the board on the page takes its colours.")

The radios carry `form="strata-preorder"`, so they belong to the preorder form further down while sitting in the finishes band. The recolouring is one mixin on the page wrapper in `finish.ts`: the default finish's colours as custom properties, swapped by `:has()` when another finish's radio is checked.

```ts
...rest.map((finish) =>
	when(`&:has(#${finishInputId(finish.value)}:checked)`, raw({ ...finish.colours })),
),
```

The server checks the radio the URL names, so `?finish=graphite` renders the page in Graphite before any interaction.

## The comparison, the specs and the reviews

The specs band is a datasheet in two ruled columns of term and value with tabular figures. The box is drawn as the open tray seen from above, each item in its cut-out with a numbered marker beside the same numbers as a list. The comparison sets Strata Two beside Strata One row by row, and marks with an orange dot which board each row favours, including the two rows where the older board still wins.

![A comparison table of Strata One and Strata Two by mount, case, polling, wireless, battery, knob, hot-swap, keycaps, weight and price, an orange dot marking which board each row favours](/showcase/strata-two/compare.webp "The dot marks the better board per row; Strata One keeps weight and price.")

A line under the table says who should buy the older board. The press reviews follow in the same spirit: each card carries the outlet's score, its verdict, what it liked and what it did not, the unit it tested and what has changed since. The outlets are invented, as the board is, and the page's FAQ closes in a [FaqBand](/api/ui/faq-band).

## A preorder answered from its own URL

The preorder band, back on the dark stage, gives the price and the $40 deposit, the open batch filling up beside the batches around it, and the form: finish (from the swatches above), layout and switch. The form submits by GET to the page itself.

![The preorder answer, the $279 price over batch 03 at 846 of 1,200 reserved and the batches around it, beside an orange card confirming Strata Two in Bronze, ISO, Notch switches](/showcase/strata-two/preorder.webp "The server reads the reservation from the query and answers with it, so preordering needs no script.")

The page's render receives the request URL and reads the order from it; a valid reservation renders a status card naming the board as configured, the ship date and a plain note that the demo has charged nothing, with a link to change the reservation. Values the form never sends fall back to the defaults, a case the browser tests cover.

On a phone, the keyboard runs the width of the screen under the headline, and the page never scrolls sideways at 375px, which the tests also check.

![The Strata Two hero on a phone, the keyboard across the width under the headline and the preorder button](/showcase/strata-two/phone.webp "On a phone the drawn board spans the screen under the headline.")

## Takes after

- [Keychron](https://www.keychron.com) — a 75% aluminium keyboard sold by its case, plate, switches and finish options.
- [Apple](https://www.apple.com) — product pages that take the device apart and light its materials as the reader scrolls; Strata Two does it with CSS scroll timelines and finished frames.
- [Teenage Engineering](https://teenage.engineering) — hardware on a dark stage with the product itself as the page's interface, here a board the reader can play.
