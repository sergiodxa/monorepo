---
title: Goroutine leak
description: A goroutine that can never finish, usually blocked on a channel or a call nobody will complete, holding its memory for the life of the process.
kind: glossary
date: "2025-09-24"
tags: [go, concurrency]
---

The classic case is a goroutine sending its result on an unbuffered channel after the caller has given up and stopped receiving. The send blocks forever, and so does everything the goroutine references.

They show up as a `runtime.NumGoroutine()` count that only grows. The fix is to give every blocking operation a way out, usually a `select` on `ctx.Done()`, or a buffered channel sized to the number of senders.
