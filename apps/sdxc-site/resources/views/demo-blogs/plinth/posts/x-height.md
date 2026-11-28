---
title: x-height
description: The height of a typeface's lowercase letters without ascenders or descenders, measured from the baseline to the top of the letter x.
kind: glossary
date: "2026-11-12"
tags: [typography]
---

Two typefaces at the same `font-size` can look a size apart, because `font-size` sets the height of the em box, not of the letters in it. What the eye reads as size is mostly the x-height: a face with a tall x-height looks larger and stays legible smaller.

The ratio of x-height to font size is what `font-size-adjust` works with. Set it to your web font's ratio and a fallback face is scaled to the same x-height while the web font loads, which I wrote up in [a note on fallback fonts](/showcase/plinth/demo/notes/font-size-adjust). CSS also has an `ex` unit, one x-height of the current font, which is handy for sizing inline icons next to lowercase text.
