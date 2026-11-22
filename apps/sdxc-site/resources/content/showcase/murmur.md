---
title: Murmur
headline: A music service whose tracks are written in the browser and keep playing while every page swaps
summary: An invented music service whose every track is synthesized in the browser, with a player that keeps playing while the pages around it swap.
cover: home
shots:
  - id: home
    page: ""
    alt: Murmur's home screen, with quick picks, shelves of drawn album covers and the player bar along the foot.
  - id: player-bar
    page: "album/tidelight"
    click: "button[aria-label='Play Tidelight']"
    highlight: "[data-slot='player-bar']"
    wait: 4000
    alt: The player bar with the current track, shuffle, previous, play, next and repeat, a seek bar and volume.
  - id: track-list
    page: "album/tidelight"
    highlight: "[data-slot='track-list']"
    alt: The Tidelight album's numbered track table with titles, artists and durations.
  - id: shelf
    page: ""
    highlight: "#murmur-new-releases"
    alt: A shelf of new releases, each a drawn square cover with its title and artist.
  - id: library
    page: ""
    highlight: "section[aria-labelledby='murmur-library-heading']"
    alt: The sidebar's library, listing the listener's playlists, albums and artists.
  - id: artist
    page: "artist/lumen-harbor"
    alt: The artist page for Lumen Harbor, with popular tracks, discography and related artists.
  - id: phone-home
    page: ""
    viewport: phone
    alt: Murmur's home on a phone, with quick picks, shelves and a bottom tab bar for Home, Search and Library.
---

Murmur is an invented music streaming service. Its artists, albums and playlists are original
and made up, and every cover is a geometric composition drawn in SVG from a motif, three inks
and a seed. No audio file ships with it: each track is written as sound in the visitor's
browser the moment it is played, so the music is as invented as the artists who "made" it.

The demo sets out to show the one thing a music app cannot fake: a player that keeps playing
while you browse. In Murmur the player lives outside the frame the screens load into, so a
single `<audio>` element plays on while the listener moves between home, search, the library,
albums and artists. Every screen still renders on the server, and every play, like and save is
a form that works with script turned off.

## The brief

A streaming service has to get the player right above everything else. Navigation must never
interrupt the music, the queue has to be whatever list the listener pressed play on, shuffle
and repeat need predictable next and previous, and the operating system's media keys and lock
screen should know what is playing. Around the player, the library, shelves and track tables
have to be quick to scan, and the listener's likes and saves have to stick.

Murmur takes on all of that, plus a constraint of its own: there are no recordings. The demo
needs real, seekable audio of honest length without shipping a single file, which is what
[@sdxc/synth](/api/synth) is for.

## A player that survives every page

The shell draws the sidebar, the main area and the [PlayerBar](/api/ui/player-bar) along the
foot. Links swap only the main frame, so the player island, `player.tsx`, mounts once and owns
the one `<audio>` element, the queue, shuffle, repeat, volume and the bar's state for the whole
visit. A `MutationObserver` on the main region marks the page again after each swap, so the
playing row in any track table, and the play button of the list that is playing, stay in step
with the music.

![The player bar playing First Light on the Breakwater, with transport controls, seek bar and volume](/showcase/murmur/player-bar.webp "The bar sits outside the swapped main frame, so the track keeps playing while pages change.")

Play buttons are forms. Without script, a play post sets a now-playing cookie and the server
draws the bar with that track. With script, the island takes the submit and builds the queue
from the rows on the page when the form sits among them, so the queue is exactly what the
listener sees:

```tsx
let container = form.closest<HTMLElement>("[data-track-context]");
let rows =
	container?.dataset.trackContext === wanted
		? [...container.querySelectorAll<HTMLElement>("[data-track-id]")]
				.map((row) => findTrack(row.dataset.trackId ?? ""))
				.filter((entry) => entry !== undefined)
		: [];
```

The queue itself comes from `createPlayQueue` in [@sdxc/ui](/api/ui)'s audio namespace, a pure
model of shuffle order and repeat off, all or one, so next and previous follow the same rules
everywhere. The island writes the same now-playing cookie the server reads, so a reload shows
the track and list the listener left. Pressing play on the list already playing pauses or
resumes it.

## Music written in the browser

Each track has a song spec in `data.ts`: a style, a key, a tempo and the layers an album keeps
in common. When a track is first played, the player renders it with `renderSong` at 22.05 kHz,
wraps the samples as a WAV with `encodeWav`, and hands the `<audio>` element a blob address:

```tsx
let bytes = encodeWav(
	renderSong(songSpec(track), { sampleRate: SONG_SAMPLE_RATE }),
	SONG_SAMPLE_RATE,
);
let url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
```

Because it is a real media element playing a real file, seeking, durations and the Media
Session API all work as they would for a recording. A track sounds the same on every visit,
since its spec is seeded. The island keeps a few rendered tracks in memory and releases the
oldest, never the one playing, and it writes the next track's sound shortly after the current
one starts, so Next begins at once. Media keys and the lock screen show the track's title and
artwork through the Media Session, which the browser tests assert by title.

The queue panel and the now-playing view are client views of the island's state. Both open
from the bar once something plays: the queue as a native popover showing a
[QueueList](/api/ui/queue-list) of "Now playing" and "Up next", and the now-playing view as a
native dialog through `command="show-modal"`, drawing visuals from the music's spectrum with an
`AnalyserNode`.

## Track tables and shelves built to scan

Albums, playlists and Liked Songs share a [TrackList](/api/ui/track-list): numbered rows whose
number turns into a play button on hover or focus, with the artists, the duration and a heart
on every row. The playing row shows animated equalizer bars, which hold still under reduced
motion.

![The Tidelight album's numbered track table with titles, artists and durations](/showcase/murmur/track-list.webp "Each row's number becomes a play button, and a liked track keeps its heart.")

Home opens with a greeting and six quick picks from the listener's library, then shelves:
made for you, new releases and the artists the listener follows. Each shelf is a
[VideoShelf](/api/ui/video-shelf) of [MediaTile](/api/ui/media-tile) covers with a floating play
button, and scrolls sideways with its own controls.

![A shelf of new releases, each a drawn square cover with its title and artist](/showcase/murmur/shelf.webp "Covers are drawn from a motif, three inks and a seed, so no artwork imitates a real record.")

An artist page leads with a large drawn banner and monthly listeners, then popular tracks, the
discography and related artists, with a Follow button that is another form.

![The artist page for Lumen Harbor, with popular tracks and a Following button](/showcase/murmur/artist.webp "An artist page reuses the same track table and shelves as every other screen.")

## A library that sticks

Likes, saved albums and playlists, followed artists and the last track played live in the
visitor's own cookies, each list in a cookie of its own, so they survive a reload and work
without script. The sidebar's library is a frame of its own; after a save, like or follow, the
player island reloads just that frame on the next screen swap, so the sidebar catches up without
a full page load. The library screen filters by kind in the address, as
`library?view=playlists`, `albums` or `artists`.

![The sidebar's library, listing the listener's playlists, albums and artists](/showcase/murmur/library.webp "The library is its own frame, reloaded on its own after a like, save or follow.")

## Phones get their own layout

On a phone the sidebar gives way to a top bar and a [TabBar](/api/ui/tab-bar) for Home, Search
and Library. Once something plays, a mini player rides above the tab bar and opens the
now-playing view full screen.

![Murmur's home on a phone, with quick picks, shelves and a bottom tab bar](/showcase/murmur/phone-home.webp "On a phone, Home, Search and Library move into a bottom tab bar, with the mini player above it once a track plays.")

## Takes after

- [Spotify](https://open.spotify.com) — the sidebar library, home shelves and a player bar
  along the foot with a queue beside it; Murmur keeps the bar outside a swapped frame so
  the pages around it render on the server.
- [Apple Music](https://music.apple.com) — the full-screen now-playing view and album pages
  that lead with large art; Murmur draws its art and its visuals from the music itself.
- [YouTube Music](https://music.youtube.com) — quick picks at the top of home and a mini player
  above the tab bar on phones.

## Where to start reading

- [`player.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/murmur/player.tsx)
  — the island that owns the `<audio>`, the queue, the Media Session and the now-playing view.
- [`data.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/murmur/data.ts)
  — the invented catalogue, each album with the song spec its tracks are synthesized from.
- [`state.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/murmur/state.ts)
  — the listener's likes, saves and follows in cookies.
