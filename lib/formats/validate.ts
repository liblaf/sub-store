import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function validateWithMihomo(body: string): Promise<void> {
  const directory: string = await fs.mkdtemp(path.join(os.tmpdir(), "sub-store-mihomo-"));
  try {
    const config: string = path.join(directory, "config.yaml");
    await fs.writeFile(config, body);
    await new Promise<void>((resolve, reject): void => {
      execFile("mihomo", ["-d", directory, "-f", config, "-t"], (error, stdout, stderr): void => {
        if (error) {
          reject(new Error(`mihomo -t failed:\n${stderr || stdout}`.trim(), { cause: error }));
          return;
        }
        resolve();
      });
    });
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}
