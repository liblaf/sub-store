import fs from "node:fs/promises";
import path from "node:path";

import { PublishInputError } from "./errors";

/** Find profiles in nested folders without traversing hidden or linked directories. */
export async function discoverProfiles(inputPath: string): Promise<string[]> {
  const input = await fs.stat(inputPath);
  if (input.isFile()) return [inputPath];
  if (!input.isDirectory()) throw new PublishInputError("Profile input must be a file or folder");

  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
      } else if (entry.name.endsWith(".yaml")) {
        if (entry.isFile() || (entry.isSymbolicLink() && (await fs.stat(file)).isFile())) {
          files.push(file);
        }
      }
    }
  };
  await visit(inputPath);
  if (files.length === 0) throw new PublishInputError("No .yaml profiles found");
  return files.sort();
}
