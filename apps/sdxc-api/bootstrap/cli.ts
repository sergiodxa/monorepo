/**
 * The command line's entry point, started by `sdxc run`: it runs the command
 * the arguments name and exits with its code. The Worker never imports it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cli } from "~/app/initializers/cli";

process.exitCode = await cli.run(process.argv.slice(2));
