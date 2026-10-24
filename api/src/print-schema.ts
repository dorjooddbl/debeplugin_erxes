import { mkdirSync, writeFileSync } from "node:fs";
import { printClientSdl } from "./apollo/clientSdl.ts";

// Prints the SDL that ui/ codegen validates its documents against.
// Runs from api/ as a package script; needs no Redis, Mongo or running server.
mkdirSync("generated", { recursive: true });
writeFileSync("generated/schema.graphql", printClientSdl());
