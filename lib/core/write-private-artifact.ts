import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { Artifact } from "./builder";

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

/** Write an artifact and its metadata without depending on the caller's umask. */
export async function writePrivateArtifact(output: string, artifact: Artifact): Promise<void> {
  // `mode` applies to directories this application creates. Do not chmod a
  // pre-existing output directory: it may have been deliberately supplied by a caller.
  await fs.mkdir(path.dirname(output), { mode: PRIVATE_DIRECTORY_MODE, recursive: true });
  await writePrivateFile(output, artifact.body);
  await writePrivateFile(`${output}.metadata.json`, JSON.stringify(artifact.metadata));
}

async function writePrivateFile(file: string, contents: string): Promise<void> {
  // Open without truncating so an existing permissive file can be made private
  // before any new secret is written. Refuse a final-component symlink rather
  // than chmodding and overwriting its target.
  const handle = await fs.open(
    file,
    constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_WRONLY,
    PRIVATE_FILE_MODE,
  );
  try {
    await handle.chmod(PRIVATE_FILE_MODE);
    await handle.truncate(0);
    await handle.writeFile(contents);
  } finally {
    await handle.close();
  }
}
