# Wakaba — App Context

**Wakaba** is a native iPhone and iPad app for practicing Japanese vocabulary. It is designed for people who already know some Japanese grammar and want to remember words, recognize them when listening, and use them in context. It is not intended to teach the entire language from scratch.

**Tagline:** “Grow with every session.”
**Spanish tagline:** “Crece con cada práctica.”

The app is free, with no ads, subscriptions, or in-app purchases. Practice runs locally, and progress can sync through the user’s private iCloud account. The interface and translations support English and Spanish.

## Main Features

- More than **1,190 vocabulary entries and 2,100 sentences**.
- Swipeable flashcards showing kanji, furigana, hiragana, katakana, romaji, and the meaning in the user’s language. Cards flip to reveal details and conjugations.
- A ten-level learning path with short practice sessions, level exams, spaced repetition, and targeted review of weaker skills.
- New words are introduced before being assessed. Kanji and katakana appear gradually as the learner becomes ready.
- Exercises covering meaning, reading, writing, listening, and optional speaking, plus sentence ordering, missing words, and verb conjugations.
- Japanese pronunciation using system voices, without bundled recordings or an external speech service.
- Reference tables for kana and particles, a kanji reference, animated stroke-order guides, and kana handwriting practice with a finger or Apple Pencil.
- Kanji reference grouped and ordered by stroke count, with linked vocabulary and animated stroke-order guides.
- A daily streak and a growing bonsai that represents accumulated practice.
- Progress and word-of-the-day widgets, plus configurable daily reminders.

## Personality and Visual Identity

Wakaba combines Japanese minimalism, warmth, and a native iOS feel. Cream paper backgrounds, rounded cards, vermilion accents, and prominent Japanese typography define the light appearance. Dark mode uses warm charcoal surfaces and soft coral accents.

The app icon reinterprets **学**, a kanji associated with learning, as a small bonsai.

Gamification is gentle: growth, companionship, and consistency, without currencies, rankings, or penalties that prevent further practice.

## Characters

Four original, kawaii characters inspired by Japanese folklore accompany the learner. Their poses reflect their roles rather than serving only as decoration.

- **Kitsune:** the friendly fox guide. Points toward the recommended session on the learning path, accompanies study, and occasionally celebrates correct answers. Its assets use `kitsune-` and `kitsuneguide-` filenames.
- **Aka Oni:** the red oni, named `oni` in asset filenames. Accompanies incorrect answers, explains corrections, and offers targeted review of previous mistakes from the learning path. Its stern expression is playful rather than threatening.
- **Tanuki:** the cheerful companion who applauds effort and celebrates completed sessions. On the learning path, offers listening practice using familiar vocabulary.
- **Tengu:** the teacher and character-practice companion. Introduces learning activities and offers nearby kana practice from the path, including reading and tracing.

Character assets include welcoming, studying, pointing, reviewing, listening, teaching, and celebratory poses.

## Bonsai Growth

The bonsai grows according to **total distinct days practiced**, independently of the consecutive-day streak. Completing several sessions on one day counts as one practiced day. Missing a day breaks the streak but does not shrink the tree.

Its ten stages begin at:

**0, 4, 8, 12, 16, 30, 60, 90, 180, and 365 practiced days.**

The pot remains the same size while the trunk, branches, and foliage become more developed. This represents lasting progress rather than a reward that disappears after a missed day.

## Widgets

Two widget types are available:

- **Practice bonsai:** small and medium sizes, showing the bonsai, current streak, whether the user practiced today, and learned-word count where space permits.
- **Word of the day:** small, medium, and large sizes, showing Japanese spelling, its kana reading when applicable, the localized meaning, and romaji. Tapping opens that word’s flashcard.

The supplied widget captures use demonstration progress: **23 days of streak and 36 learned words**.

## Color Palette

| Role                      | Light Mode | Dark Mode |
| ------------------------- | ---------- | --------- |
| Main background           | `#F7F5ED`  | `#1E1C19` |
| Cards and surfaces        | `#FFFFFF`  | `#2D2A26` |
| Primary text              | `#000000`  | `#F3EEE3` |
| Secondary text            | `#858581`  | `#BEB5A6` |
| Accent and icons          | `#C43B2E`  | `#EE967E` |
| Primary button background | `#C43B2E`  | `#B64838` |
| Primary button text       | `#FFFFFF`  | `#FFFFFF` |

Dividers use the primary text color at **10% opacity**.

## Available Assets

All assets are optimised copies under `apps/blog/public/apps/wakaba/` in this repository, served at `/apps/wakaba/`, and only the files the pages use are kept:

- **`characters/`**: transparent WebP illustrations of Kitsune, Aka Oni, Tanuki, and Tengu at 360 × 360, squared and trimmed. Filenames identify the character and pose, such as `kitsune-pointing.webp`, `oni-correction.webp`, `tanuki-listening.webp` and `tengu-teaching.webp`; Aka Oni uses the `oni` prefix.
- **`screenshots/`**: actual app screenshots as WebP at 560 × 1218, organized into `en/` and `es/` with the same file names in both, including the learning path with character guides, flashcards, practice activities and references. Screens captured in both appearances carry `-light` and `-dark` suffixes, such as `en/flashcards-fish-dark.webp`. `practice-reminder.webp` is a notification banner at 560 × 113.
- **`bonsai/`**: transparent WebP of all ten growth stages at 480 × 455, organized into `light/` and `dark/` and cropped to one frame so the pot stays in place. Filenames include the stage index and minimum practiced-day threshold, such as `04-day-016.webp`.
- **`widgets/`**: actual iOS WidgetKit gallery screenshots as WebP at 560 × 1218, organized into `en/` and `es/` and named by widget type, size, and appearance: `progress-medium-light.webp`, `progress-medium-dark.webp`, `word-large-light.webp` and `word-large-dark.webp`. These include the surrounding native widget-selection interface.
- **`branding/logo/favicon.svg`**: the standalone logo as an SVG favicon, vermilion in light and coral in dark. The pages' header and footer draw the same mark inline.
- **`branding/app-icon/apple-touch-icon.png`**: the rounded app icon at 180 × 180.
- **`branding/social-card.png`** and **`branding/social-card-es.png`**: the 1200 × 630 Open Graph and Twitter cards in English and Spanish, drawn from the logo and the full-grown bonsai.
