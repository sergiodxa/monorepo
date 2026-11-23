---
title: Vesper
headline: A streaming service that runs on links, forms and cookies, with a theater player and a list kept per profile
summary: An invented streaming service with profiles, a billboard over sideways shelves, series with seasons, live search, a list kept per profile and a theater player, always dark and drawn in SVG.
tagline: A streaming service, drawn in SVG
accent: "oklch(0.6 0.18 40)"
cover: home
shots:
  - id: home
    page: ""
    wait: 1200
    alt: Vesper's home, a featured title on a rounded billboard with a white Play button, above shelves of Continue watching and ranked Trending cards.
  - id: continue
    page: ""
    highlight: "#vesper-continue"
    wait: 1200
    alt: The Continue watching shelf, landscape cards with progress bars and how much is left of each episode.
  - id: profiles
    page: "profiles"
    highlight: "[data-slot='profile-picker']"
    wait: 1200
    alt: The Who's watching screen, four square smiling avatars for Noa, Theo, Ines and Kids over a dimmed backdrop.
  - id: episodes
    page: "title/tidewater?tab=episodes&season=2"
    highlight: "[data-slot='episode-list']"
    wait: 1200
    alt: Season two of Tidewater as an episode list, each row with a drawn still, its number and title, its running time and a synopsis.
  - id: seasons
    page: "title/tidewater?tab=episodes&season=2"
    click: "button[commandfor='vesper-seasons-tidewater']"
    highlight: "#vesper-seasons-tidewater"
    alt: The season menu open under its button, with season two ticked.
  - id: player
    page: "watch/tidewater/2-3"
    highlight: "[data-slot='video-player-controls']"
    wait: 1500
    alt: The theater player's controls along the foot of the picture, with elapsed time, a progress bar, skip-back, play and skip-forward, and buttons for sound, subtitles, settings and full screen.
  - id: search
    page: "search?q=tide"
    highlight: "ul[aria-label='Results']"
    wait: 1200
    alt: The search results for tide, one card for Tidewater with a New Season badge under a count of one result.
  - id: phone
    page: ""
    viewport: phone
    wait: 1200
    alt: Vesper's home on a phone, the Tidewater billboard with Play and More info above the Continue watching shelf and a bottom tab bar for Home, Series, Search and My List.
---

Vesper is an invented streaming service. It has a "Who's watching?" profile picker, a home of sideways shelves under a featured billboard, series and films by genre, a page for every title with its seasons and episodes, search, My List, and a theater player. It is always dark, whatever the visitor's own setting: ink-violet neutrals, an ember brand colour, and key art drawn in SVG for every title. Every title, person and picture in it is made up.

The build shows how much of a streaming app fits into links, forms and cookies. The chosen profile is a cookie, and each profile's list is another. A title's tab and season live in the address. Every screen renders on the server and works without script. Once script loads, links and posts swap only the main frame, and named frames redraw the small parts that change, such as one list button or the search results, while the rest of the page holds still.

## The brief

A streaming home is a wall of pictures, and it has to stay fast. It needs a billboard that sells one title, then shelf after shelf that scroll sideways, each card showing enough to choose from and more on focus. Title pages need the right primary action: Play from the start, or Resume where you stopped. The player has to seek properly, show chapters and captions, and keep its controls out of the way. And profiles have to really separate people. A child's profile must never reach an adult title, even through a typed address.

Vesper takes on each of those. Its video components come from `@sdxc/ui/video`: [TitleHero](/api/ui/title-hero), [VideoShelf](/api/ui/video-shelf), [VideoCard](/api/ui/video-card), [EpisodeList](/api/ui/episode-list), [ProfilePicker](/api/ui/profile-picker) and [VideoPlayer](/api/ui/video-player). The rest is the app's own routing and cookies.

## Profiles that really separate people

The profile screen is a [ProfilePicker](/api/ui/profile-picker) over a dimmed backdrop of the featured title. Choosing a profile is a form post that sets the `vesper.profile` cookie, and the server reads it on every screen to decide what to show.

![The Who's watching screen, four square smiling avatars for Noa, Theo, Ines and Kids over a dimmed backdrop](/showcase/vesper/profiles.webp "Choosing a profile is a form post, and the cookie it sets shapes every screen after it.")

The Kids profile only reaches titles rated for all ages. The rule lives in one function, `visibleTitles()`, and every route that looks up a title checks it, so a title page, a watch page or a "More like this" list for an adult title answers as if the title did not exist. Typing the address does not get around it, and a test checks that with the Kids cookie set. Each profile starts with its own My List: the household's picks, or only the children's titles on Kids.

The profile menu in the top bar lists every profile with its avatar, so switching is one click. A switch starts the next page at the top, wherever the redirect lands. The menu's "Reset the demo" expires every Vesper cookie and lands on home with a toast.

## Shelves built for scrolling sideways

Home opens on a [TitleHero](/api/ui/title-hero): a rounded card set in from the page edges, framing the featured title's scene on its horizon, with a dotted fact line, this week's rank and a white Play button. The shelves below are each a [VideoShelf](/api/ui/video-shelf): Continue watching, Trending with ranks, My List, Vesper Originals as posters, "Because you watched", and one shelf per genre.

Each item is a [VideoCard](/api/ui/video-card). On desktop, a card shows its title's line and facts over the art under the pointer or keyboard focus. Continue watching cards carry a progress bar and say how much is left.

![The Continue watching shelf, landscape cards with progress bars and how much is left of each episode](/showcase/vesper/continue.webp "Continue watching shows each title's progress and the time left, read from the profile's history.")

The art is a real performance concern on a page like this. Key art and every episode still are SVG files under `/demos/vesper/art/`, loaded with `<img>`. The hero's art loads first and everything else loads lazily, on the title's own sky colour until it arrives, so an empty card already looks like its scene. The files are cached across screens, and a test fails whenever a file falls out of date with the code that draws it.

## A title page that remembers where you are

A title's art lies behind its whole page. Over it sit rating and format badges, the facts, this week's rank, the synopsis, a white Play or Resume pill, and a round My List button. The primary action reads the profile's history: Play S1:E1 for a title not yet started, Resume where the profile left off otherwise.

Below that, Episodes, More like this and Details are tabs kept in the address with `?tab=`, so `title/tidewater?tab=details` is a page you can link. Episodes has a season dropdown. Each season is also an address, `?season=2`, and its episodes are an [EpisodeList](/api/ui/episode-list) with a drawn still, the number and title, the running time and a synopsis for each.

![Season two of Tidewater as an episode list, each row with a drawn still, its number and title, its running time and a synopsis](/showcase/vesper/episodes.webp "Each season is its own address, and every episode row links straight to the player.")

The season menu is a native popover opened with `commandfor`, placed under the start of its button, with the season on screen ticked. Its items are links to each season's address, so it needs no script to work.

![The season menu open under its button, with season two ticked](/showcase/vesper/seasons.webp "The season menu is a native popover of links, with the season on screen ticked.")

Details lays the title out in three columns: what it is, its facts, and who made it, cast included.

## A theater player that seeks

The watch page is a [VideoPlayer](/api/ui/video-player) on its stage layout, so the episode fills the window. The way back, the series and episode, Next episode and an Episodes panel sit over the picture. Along the foot are the time, a centred skip-back, play and skip-forward cluster, and buttons for sound, subtitles, settings and full screen. Everything but the picture fades while it plays.

![The theater player's controls along the foot of the picture, with elapsed time, a progress bar, skip-back, play and skip-forward, and buttons for sound, subtitles, settings and full screen](/showcase/vesper/player.webp "The player keeps its controls over the picture, and they fade while it plays.")

Each episode and film has chapters placed by its running time, and captions timed against them. Those are passed straight to the player as props. The clips are tiny transparent WebM files, one for each running time, played over the drawn scene. They are served by the Worker with byte ranges: the whole file with `Accept-Ranges: bytes`, a range as `206 Partial Content`, and a range past the end as `416`. That is what lets resuming, skipping and dragging the progress bar actually move playback. Static files answering a range request with the whole file would leave every clip unseekable.

## My List and search, each in its own frame

My List is kept in a cookie per profile. The list button on a title lives in its own named frame, so adding or removing a title redraws only that button and raises a [Toasts](/api/ui/toasts) message, while the page, its scroll and its shelves stay put. Undo puts the title back. A My List post keeps the scroll where it was.

Search results are a named frame too. As the visitor types, the frame reloads for the query about 180 ms after the last keystroke. The address follows in place, without a history entry per letter, and a polite status announces the count. Without script, the form submits on Enter and loads the page. Matches on a title's name rank first, and an empty result explains itself.

![The search results for tide, one card for Tidewater with a New Season badge under a count of one result](/showcase/vesper/search.webp "Results reload in their own frame as you type, under a count that a screen reader also hears.")

A thin ember bar shows at the top while a screen or post is loading, and only after a short delay, so a fast swap never flashes it. On phones, the top bar's destinations move into a [TabBar](/api/ui/tab-bar) at the bottom, with Search taking the place of the search field.

![Vesper's home on a phone, the Tidewater billboard with Play and More info above the Continue watching shelf and a bottom tab bar for Home, Series, Search and My List](/showcase/vesper/phone.webp "On a phone the destinations move into a bottom tab bar, and the shelves still scroll sideways.")

## Takes after

- [Netflix](https://www.netflix.com) — "Who's watching?", the billboard over shelves of ranked and continue-watching titles, and the Episodes, More like this and Details tabs. In Vesper those tabs and seasons are addresses.
- [Apple TV](https://tv.apple.com) — key art behind the whole title page, with a white Play pill and the controls laid over the picture while it plays.

## Where to start reading

- [`vesper/home.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/vesper/home.tsx) — the billboard and shelves for the current profile.
- [`vesper/search-live.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/vesper/search-live.tsx) — results that reload in a frame as you type.
- [`vesper/watch.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/vesper/watch.tsx) — the theater player, its chapters and captions.
- [`vesper/data.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/vesper/data.ts) — the catalogue and `visibleTitles()`, the rule the Kids profile rests on.
