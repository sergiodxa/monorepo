/**
 * Holds the in-memory store to the shared store contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describeStoreContract } from "./lib/store-contract.js";
import { MemoryStore } from "./memory.js";

describeStoreContract("MemoryStore", () => new MemoryStore());
