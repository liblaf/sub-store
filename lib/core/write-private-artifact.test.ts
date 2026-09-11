import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { writePrivateArtifact } from "./write-private-artifact";

const artifact = {
  body: "private configuration",
  metadata: { headers: { "Subscription-Userinfo": "upload=1" } },
};

async function withTemporaryDirectory(testCase: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sub-store-artifact-"));
  try {
    await testCase(dir);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

describe("writePrivateArtifact", (): void => {
  test("creates private directories and files", async (): Promise<void> => {
    await withTemporaryDirectory(async (dir: string): Promise<void> => {
      const output = path.join(dir, "created", "nested", "stash.yaml");

      await writePrivateArtifact(output, artifact);

      expect((await stat(path.dirname(output))).mode & 0o777).toBe(0o700);
      expect((await stat(path.dirname(path.dirname(output)))).mode & 0o777).toBe(0o700);
      expect((await stat(output)).mode & 0o777).toBe(0o600);
      expect((await stat(`${output}.metadata.json`)).mode & 0o777).toBe(0o600);
    });
  });

  test("repairs existing output files without changing an existing caller directory", async (): Promise<void> => {
    await withTemporaryDirectory(async (dir: string): Promise<void> => {
      const outputDir = path.join(dir, "caller-directory");
      const output = path.join(outputDir, "stash.yaml");
      await mkdir(outputDir);
      await chmod(outputDir, 0o755);
      await writeFile(output, "old artifact", { mode: 0o644 });
      await writeFile(`${output}.metadata.json`, "old metadata", { mode: 0o644 });
      await chmod(output, 0o644);
      await chmod(`${output}.metadata.json`, 0o644);

      await writePrivateArtifact(output, artifact);

      expect((await stat(outputDir)).mode & 0o777).toBe(0o755);
      expect((await stat(output)).mode & 0o777).toBe(0o600);
      expect((await stat(`${output}.metadata.json`)).mode & 0o777).toBe(0o600);
      expect(await readFile(output, "utf-8")).toBe(artifact.body);
    });
  });

  test("refuses to overwrite a symlink target", async (): Promise<void> => {
    await withTemporaryDirectory(async (dir: string): Promise<void> => {
      const victim = path.join(dir, "victim");
      const output = path.join(dir, "stash.yaml");
      await writeFile(victim, "unchanged", { mode: 0o644 });
      await symlink(victim, output);

      await expect(writePrivateArtifact(output, artifact)).rejects.toThrow();

      expect(await readFile(victim, "utf-8")).toBe("unchanged");
      expect((await stat(victim)).mode & 0o777).toBe(0o644);
    });
  });
});
