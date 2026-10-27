import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { discoverProfiles } from "./discover";

const directories: string[] = [];

async function makeDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sub-store-discover-test-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe("discoverProfiles", () => {
  test("recursively finds YAML files in globally sorted path order", async () => {
    const directory = await makeDirectory();
    const names = ["z.yaml", "a/z.yaml", "a.yaml", "a/deeper/profile with spaces.yaml"];
    for (const name of names) {
      const file = path.join(directory, name);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "{}");
    }

    expect(await discoverProfiles(directory)).toEqual(
      names.map((name) => path.join(directory, name)).sort(),
    );
  });

  test("ignores hidden files and subtrees and preserves the .yaml extension filter", async () => {
    const directory = await makeDirectory();
    for (const name of [
      "visible/profile.yaml",
      "visible/.hidden.yaml",
      ".hidden/nested/profile.yaml",
      "visible/.hidden/profile.yaml",
      "ignored.yml",
      "visible/ignored.txt",
    ]) {
      const file = path.join(directory, name);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "{}");
    }
    await fs.mkdir(path.join(directory, "empty.yaml"));

    expect(await discoverProfiles(directory)).toEqual([
      path.join(directory, "visible/profile.yaml"),
    ]);
  });

  test("skips directory symlinks including loops while accepting symlinks to YAML files", async () => {
    const directory = await makeDirectory();
    const external = await makeDirectory();
    await fs.mkdir(path.join(directory, "nested"));
    await fs.writeFile(path.join(external, "profile.yaml"), "{}");
    await fs.symlink(directory, path.join(directory, "nested/loop"), "dir");
    await fs.symlink(external, path.join(directory, "linked-directory"), "dir");
    const link = path.join(directory, "nested/linked.yaml");
    await fs.symlink(path.join(external, "profile.yaml"), link, "file");

    expect(await discoverProfiles(directory)).toEqual([link]);
    expect(await discoverProfiles(link)).toEqual([link]);
  });

  test("accepts an explicit regular file regardless of its extension", async () => {
    const directory = await makeDirectory();
    const file = path.join(directory, ".explicit-profile.txt");
    await fs.writeFile(file, "{}");

    expect(await discoverProfiles(file)).toEqual([file]);
  });

  test("rejects a tree with no visible .yaml profiles", async () => {
    const directory = await makeDirectory();
    await fs.mkdir(path.join(directory, "nested"));
    await fs.writeFile(path.join(directory, "nested/profile.yml"), "{}");

    await expect(discoverProfiles(directory)).rejects.toThrow("No .yaml profiles found");
  });
});
