---
title: Cache key
description: The parts of a request a cache uses to decide whether it has seen it before. Two requests with the same key share one stored response.
kind: glossary
date: "2026-11-10"
tags: [caching, edge]
---

A cache key is built from parts of the request, by default the method, the host, the path and the query string. When a new request arrives, the cache computes its key and looks it up; a match is a hit, anything else is a miss.

Anything a response depends on must be in its key, or one visitor's response is served to another. Anything it does not depend on should be left out, or the cache stores copies nobody reuses. I wrote about that balance in [Cache keys are a contract](/showcase/lowtide/demo/articles/cache-keys-are-a-contract).
