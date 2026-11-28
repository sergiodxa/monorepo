---
title: Stop the fallback font from jumping
description: font-size-adjust keeps the x-height steady while a web font loads.
kind: notes
date: "2026-07-02"
tags: [typography, css]
---

The jump when a web font swaps in is mostly a change in [x-height](/showcase/plinth/demo/glossary/x-height), not width. `font-size-adjust` takes a ratio of x-height to font size and scales whichever face is showing to match it. Set it to the web font's own ratio, `font-size-adjust: 0.52` for the face I use here, and the web font renders unchanged while Arial is scaled to the same lowercase height. The swap still happens; it just stops moving the paragraph.
