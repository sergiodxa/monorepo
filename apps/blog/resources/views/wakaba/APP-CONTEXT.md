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

The pages use optimised copies of the app's art, served from `apps/blog/public/apps/wakaba/` (URL path `/apps/wakaba/`):

- **`public/apps/wakaba/characters/`**: transparent WebP illustrations of Kitsune, Aka Oni, Tanuki, and Tengu, squared and trimmed: `kitsune.webp` (pointing), `oni.webp` (correction), `tanuki.webp` (applause) and `tengu.webp` (teaching) for the companions band, plus poses named by character and activity, such as `kitsune-study.webp`, `tanuki-listening.webp` and `oni-checkpoint.webp`.
- **`public/apps/wakaba/screens/`**: actual English app screenshots as WebP at 560 × 1218, including the learning path with character guides, flashcards, and practice activities. Screens captured in both appearances carry `-light` and `-dark` suffixes, such as `flashcards-fish-dark.webp`.
- **`public/apps/wakaba/bonsai/`**: transparent WebP of all ten growth stages, named by appearance and stage index, such as `light-04.webp` and `dark-04.webp`, each cropped to the same frame so the pot stays in place.
- **`public/apps/wakaba/screens/widget-*.webp`**: actual iOS WidgetKit gallery screenshots in English, `widget-progress-*` (Practice bonsai, medium) and `widget-word-*` (Word of the day, large), in light and dark. These include the surrounding native widget-selection interface.
- **`public/apps/wakaba/favicon.svg`**: the standalone logo, drawn in vermilion in light and coral in dark. The page's header and footer draw the same mark inline.
- **`public/apps/wakaba/apple-touch-icon.png`**: the rounded app icon, at 180 × 180 for the home-screen bookmark.
- **`public/apps/wakaba/social-card.png`**: the 1200 × 630 Open Graph and Twitter card, drawn from the logo and the full-grown bonsai.

The full-size originals are not part of the repository.
