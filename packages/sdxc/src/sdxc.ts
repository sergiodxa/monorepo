#!/usr/bin/env node
/**
 * The `sdxc` binary of the umbrella: runs `@sdxc/kit`'s command line, so a project that lists
 * `sdxc` has the command at the exact kit version its release pins, with no install of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSDXC, kitVersion } from "@sdxc/kit";

process.exitCode = await createSDXC({ version: kitVersion() }).run(process.argv.slice(2));
