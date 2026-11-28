---
title: TTFB
description: Time to first byte, from the request leaving the browser to the first byte of the response arriving.
kind: glossary
date: "2026-07-01"
tags: [performance]
---

TTFB includes the connection (DNS, TCP, TLS), the time the request travels, whatever the server does, and the time the first byte takes to come back. It is the floor for everything the visitor sees: nothing renders before the first byte.

A good TTFB on a cache hit says little about your server; a good one on a miss says a lot.
