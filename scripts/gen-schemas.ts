import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod/v4";
import { PROFILE_SCHEMA } from "../src/profile";

const SCHEMAS_DIR = "dist/schemas";
const schema = z.toJSONSchema(PROFILE_SCHEMA, { io: "input" });
await fs.mkdir(SCHEMAS_DIR, { recursive: true });
await fs.writeFile(
  path.join(SCHEMAS_DIR, "profile.json"),
  JSON.stringify(schema),
);
