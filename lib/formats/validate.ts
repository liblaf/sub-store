import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function validateWithMihomo(
  body: string,
  executable: "mihomo" | "mihomo-smart" = "mihomo",
): Promise<void> {
  const directory: string = await fs.mkdtemp(path.join(os.tmpdir(), `sub-store-${executable}-`));
  try {
    const config: string = path.join(directory, "config.yaml");
    await fs.writeFile(config, body, { mode: 0o600 });
    await new Promise<void>((resolve, reject): void => {
      execFile(
        executable,
        ["-d", directory, "-f", config, "-t"],
        { timeout: 60_000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 },
        (error): void => {
          if (error) {
            // Native diagnostics can contain provider URLs and credentials. Do not
            // retain their output, including through an Error cause.
            const reason =
              error.code === "ENOENT"
                ? `Install ${executable} and make it available on PATH.`
                : error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
                  ? "Diagnostic output exceeded the 1 MiB limit. Check the generated configuration locally."
                  : error.killed
                    ? "Validation exceeded 60 seconds. Check provider and geodata availability locally."
                    : `Check the generated configuration with ${executable} -t locally; native diagnostics are withheld because they may contain credentials.`;
            reject(new Error(`Mihomo configuration validation failed. ${reason}`));
            return;
          }
          resolve();
        },
      );
    });
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}
