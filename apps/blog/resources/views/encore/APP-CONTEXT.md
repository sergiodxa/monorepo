# Encore — App Context

**Encore: Music Party Game** is a native card game for iPhone, iPad, Apple Watch and Mac. Someone draws a face-down card, taps to reveal a singing challenge, and the group sings a song that fits it: “Sing a song you're slightly embarrassed to admit you love.” It is made for friends and families singing together in the same room, with or without a karaoke machine. The app gives the challenge; the people in the room supply the song.

**Tagline:** “Your next night starts with a song.”
**Spanish tagline:** “Tu próxima noche empieza con una canción.” _(translation proposed for the landing; the App Store campaign is English only)_

Supporting lines from the App Store screenshot campaign (`output/app-store/` in the app's repository): “Draw a card. Make it a sing-along.”, “A little mystery. A lot of music.”, “Tap to reveal your next challenge.”, “Keep the songs coming.”, “Swipe for a fresh challenge.”, “Bring everyone together.”, “A familiar song. A shared moment.”

## Pricing and Business Model

A paid app: a **one-time purchase of US$4.99** on the App Store, with no subscriptions, in-app purchases or ads. The code contains no StoreKit, so every card and feature comes with the purchase.

- App Store listing: <https://apps.apple.com/us/app/encore-music-party-game/id6813754400> (Apple ID `6813754400`).
- Category: Music Games (`LSApplicationCategoryType`).
- Version 1.0; iOS and iPadOS 17 and watchOS 10. On Apple silicon Macs the iPad app installs from the Mac App Store as-is; there is no separate macOS build or listing.
- Rated **4+** on the App Store: suitable for all ages.
- **Family Sharing** is on: one purchase covers everyone in the family group.

## Data and Privacy

- No account, no sign-in, no server. Every card is built into the app.
- Gameplay state lives in memory and is never persisted: a fresh deck is dealt on every launch (`GameSession`).
- The device stores only three “hint already shown” flags and the two Settings switches (haptics, sound effects) in `UserDefaults`.
- No microphone, recording or speech recognition. The app never listens to anyone sing.
- No analytics, advertising or third-party SDKs. The Swift package has no dependencies.
- The iPhone and the paired Apple Watch exchange the current card's title, prompt, whether it is revealed, and the reveal/next/shuffle commands, directly through Apple's WatchConnectivity.

The published policy is at `/apps/encore/privacy` (source `resources/content/encore/privacy.md`).

## Languages

English (development language), Spanish, Argentine Spanish (voseo: “Cantá una canción…”) and Japanese. Every authored card, every generated card piece, the hints and the system Settings page are translated in all four.

## Main Features

- **108 hand-written challenge cards**, each with an uppercase title and a one-line prompt, across personal, group, genre, era, performance, song-title, situation and emotional sets. Examples: GUILTY PLEASURE, MAIN CHARACTER, ONE-HIT WONDER, DUET WITH A STRANGER, WEDDING SONG, THE SLOW BUILD, and ENCORE (“You earned it. Sing whatever you want.”).
- **Generated challenges**, a large pool built at launch, that combine two pieces — a theme, a style, an era, a language or a title rule — such as “a romantic rock song” or “a song from the 1990s with a colour in the title”. Compatibility rules keep nonsense pairs out (two eras at once, romance with rebellion). Generated cards have no title.
- **A dealer that avoids repeats.** About nine in ten draws are hand-written cards while any remain unseen. The dealer remembers the last eight cards and steers away from the same tags, theme, genre, era, title rule and performance style; easier cards come up more often than hard ones. When every authored card has been played, five generated cards bridge to a fresh pass of the authored deck, so a group sees few generated cards in practice; the pool's size is not stated anywhere and is not worth a figure.
- **The card is the interface.** No navigation, tab bar or buttons: tap the face-down card to flip it, swipe it away for the next challenge (it arrives already revealed), shake the phone to shuffle a new deck face-down. Three one-time hints teach the gestures: “Tap to reveal”, “Swipe when you're done”, “Shake to shuffle”.
- **Undo.** Swiping registers an undo, so Command-Z on a Mac or an iPad keyboard brings the previous card back; a shuffle clears it.
- **Apple Watch remote.** The Watch shows the current card's title and “Card ready” or the prompt, with Reveal or Next, and Shuffle. It is a remote for the iPhone game and needs Encore open on the iPhone (“Open Encore on iPhone” when it is out of reach).
- **iPad and Mac.** iPad runs in every orientation. On a Mac the iPad app runs as it is; with a keyboard on iPad or Mac, **Game → Shuffle Deck** is Command-R. (The project also has Mac Catalyst code that scales the card with the window, but no Catalyst build ships.)
- **Haptics and sound effects**, both off by default and switched on in the system Settings app under Encore. The ambient audio respects the silent switch and mixes with music that is already playing.
- **Accessibility.** VoiceOver reads each card's title and prompt, with “Next challenge” and “Shuffle deck” actions; with Reduce Motion the card fades instead of flipping.

## Personality and Visual Identity

A theatre at night just before the encore: plum darkness, stage-light glow, and gold, coral and violet ribbons sweeping in from the edges with small four-point sparkles. It is festive without being loud — the card always keeps a calm field in the middle for the prompt.

- **Cards:** 320 × 460 points, 20pt corners. The back is ornate artwork (a central burst like applause or a spotlight, mirrored ribbons, sound-wave arcs, notes, confetti) on a deep plum gradient. The front is warm paper in light mode and plum in dark, with ribbon flourishes cropped into its corners, small sparkles along the edges and a thin gold inner frame.
- **Type in the app:** SF Rounded throughout. Card titles are small, semibold, uppercase and widely tracked; prompts are title-2 medium, centred.
- **Marketing type (App Store campaign):** an elegant bold serif for headlines, a clean sans for captions, and the wordmark ENCORE in widely spaced gold capitals beside the icon.
- **App icon:** the card back's central burst — a gold four-point star inside coral and gold rays — framed by violet, coral and gold ribbons on dark plum.
- **Tone:** playful and warm, a little theatrical (“Full theatrical commitment expected”, “dramatically overperform every line”), never competitive: no scores, players, turns or timers.

## Color Palette

Read from `Encore/Assets.xcassets` and the SwiftUI code (`GameView.swift`, `CardStackView.swift`). The app sets its colours in code as RGB fractions; hex values are those fractions rounded to 8 bits.

| Role                                          | Light Mode                        | Dark Mode                         |
| --------------------------------------------- | --------------------------------- | --------------------------------- |
| Background gradient (top-left → bottom-right) | `#FFE8D4` → `#E6D1F7` → `#FFDBC7` | `#0E0513` → `#1F0924` → `#0B0412` |
| Stage-light glow at the centre                | `#FFF7E3` at 78%                  | `#8A33B8` at 24%                  |
| Card back gradient                            | `#3D0F4A` → `#1A0830`             | `#290833` → `#0F031F`             |
| Card front gradient                           | `#FFFAF0` → `#F7EBE6`             | `#26122E` → `#14081F`             |
| Card front reading field                      | white at 94%                      | `#1F0D26` at 96%                  |
| Card border gradient                          | `#D1D1D1` → `#ADADAD`             | `#595959` → `#333333`             |
| Card text                                     | system primary / secondary        | system primary / secondary        |
| Accent colour (asset catalog, universal)      | `#E4CF9F`                         | `#E4CF9F`                         |
| Watch buttons                                 | system purple                     | system purple                     |

Ornament colours, the same in both appearances with different opacity: coral `#FF5C61`, gold `#FFB23D`, violet `#9140EB` and pink `#E84CA6`. Background ribbons draw at 24% (light) and 16% (dark); card flourishes at 48% and 78%; the card's inner frame is gold at 72% and 55%.

## Assets

All assets live in `apps/blog/public/apps/encore/`, served at `/apps/encore/`, and the pages use every one:

- **`screenshots/{en,es,ja}/`**: `card-back`, `challenge` (EARWORM), `swipe` (FAMILY REUNION), `shuffle` and `generated`, each as `-light` and `-dark` WebP at 560 × 1218, from 1206 × 2622 iPhone captures. The page follows the reader's language and colour scheme.
- **`watch/{en,es,ja}/`**: `card-ready` and `challenge`, WebP at 416 × 496. The Watch shows the simulator's clock, since watchOS screenshots cannot override the time.
- **`branding/app-icon/apple-touch-icon.png`**: the app icon at 180 × 180.
- **`branding/logo/favicon.svg`**: the icon's burst as a single-colour mark, plum in light and gold in dark.
- **`branding/social-card-{en,es,ja}.png`**: 1200 × 630 link previews drawn from the landing's own pieces: the app's card-back artwork, the EARWORM card, the serif headline and the plum backdrop. A shared link shows the card in the language its `?lang=` names, English without one.

To replace a screen, export the same name at 1206 × 2622 and convert it to WebP at 560 × 1218.

Apple's **Download on the App Store** badge is shared by every app page, under `public/apps/app-store/`: `badge-en-us-black.svg`, `badge-en-us-white.svg`, `badge-es-mx-black.svg`, `badge-es-mx-white.svg`, `badge-ja-jp-black.svg` and `badge-ja-jp-white.svg`, downloaded unaltered from Apple's marketing resources (<https://developer.apple.com/app-store/marketing/guidelines/>). Apple publishes Latin American Spanish (`es-mx`) for Argentina.

The App Store campaign images in `output/app-store/` have headlines and device frames baked in, so they are not usable as screens here; raw simulator or device captures are.

## Decisions

Answered by the developer on 2026-11-07:

1. **Languages.** The landing, the privacy policy and the support form ship in English, Argentine Spanish and Japanese, the app's languages (its neutral Spanish shares the Argentine pages).
2. **Mac.** Encore works on Apple silicon Macs as the iPad app; the pages say it works on Mac without describing Mac-only behaviour.
3. **Generated cards.** No count is shown: after the hand-written deck, five generated cards lead into a fresh pass, so they are a small part of any night.
4. **Age rating.** 4+, for all ages.
5. **Family Sharing.** Supported: one purchase, the whole family group downloads it.
