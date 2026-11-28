---
title: The Go Memory Model
description: The short, precise document that says when a write in one goroutine is guaranteed to be seen by a read in another.
kind: links
date: "2026-03-30"
tags: [go, concurrency]
url: https://go.dev/ref/mem
---

Its advice opens with "don't be clever", and the rest explains why. I reread it whenever I am tempted to share a variable between goroutines without a mutex or a channel because "it is only a bool". The section on happens-before is the clearest explanation I know of why the race detector is right and my intuition is not.
