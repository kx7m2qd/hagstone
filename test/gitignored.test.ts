import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_IGNORES, gitIgnoredPatterns, isIgnored } from "../src/core/ignore.js";
import { pathScope } from "../src/core/scope.js";

describe("root-anchored ignore patterns", () => {
  it("match only from the scan root", () => {
    expect(isIgnored(".env.local", ["/.env.local"])).toBe(true);
    expect(isIgnored("app/.env.local", ["/.env.local"])).toBe(false);
    expect(isIgnored("out/index.html", ["/out/"])).toBe(true);
    expect(isIgnored("src/out/index.ts", ["/out/"])).toBe(false);
    expect(isIgnored("notes", ["/notes"])).toBe(true);
    expect(isIgnored("notes/a.md", ["/notes"])).toBe(true);
    expect(isIgnored("notes2/a.md", ["/notes"])).toBe(false);
  });

  it("skip framework build output and caches by default", () => {
    for (const p of [".next/static/chunks/a.js", ".cache/x.csv", "apps/web/.next/server/a.json", "coverage/lcov.info"])
      expect(isIgnored(p, DEFAULT_IGNORES)).toBe(true);
    expect(isIgnored("src/app/next/page.tsx", DEFAULT_IGNORES)).toBe(false);
  });

  it("gitleaks' path allowlist covers every default ignore", async () => {
    const toml = await readFile(new URL("../config/gitleaks.toml", import.meta.url), "utf8");
    const re = new RegExp(toml.match(/'''(.+?)'''/)![1]!);
    for (const d of DEFAULT_IGNORES) expect(re.test(`x/${d}file`), d).toBe(true);
    expect(re.test("src/app.js")).toBe(false);
  });
});

describe("pathScope tooling", () => {
  it("treats top-level and package-level scripts/ and tools/ as dev tooling", () => {
    expect(pathScope("scripts/build.cjs")).toBe("tooling");
    expect(pathScope("scripts/catalogue/crawl.mjs")).toBe("tooling");
    expect(pathScope("tools/gen.py")).toBe("tooling");
    expect(pathScope("packages/web/scripts/x.js")).toBe("tooling");
  });
  it("leaves app code named tools or scripts alone", () => {
    expect(pathScope("src/app/tools/page.tsx")).toBe("prod");
    expect(pathScope("src/scripts/run.ts")).toBe("prod");
  });
});

describe("gitIgnoredPatterns", () => {
  let repo: string;
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "ignore" });
  beforeAll(async () => {
    repo = await mkdtemp(join(tmpdir(), "hs-gitignored-"));
    git("init", "-q");
    await writeFile(join(repo, ".gitignore"), ".env.*\n.next/\nsecret.txt\n");
    await writeFile(join(repo, ".env.local"), "KEY=1\n");
    await mkdir(join(repo, ".next"));
    await writeFile(join(repo, ".next", "a.js"), "x\n");
    await writeFile(join(repo, "app.js"), "x\n");
    // Ignored by .gitignore but committed anyway: it must stay in scope.
    await writeFile(join(repo, "secret.txt"), "x\n");
    git("add", "-f", "secret.txt");
  });
  afterAll(() => rm(repo, { recursive: true, force: true }));

  it("lists untracked ignored files, never tracked ones", async () => {
    const p = await gitIgnoredPatterns(repo);
    expect(p.sort()).toEqual(["/.env.local", "/.next/"]);
    expect(isIgnored("secret.txt", p)).toBe(false);
    expect(isIgnored("app.js", p)).toBe(false);
  });

  it("is empty outside a git work tree", async () => {
    const plain = await mkdtemp(join(tmpdir(), "hs-nogit-"));
    try {
      expect(await gitIgnoredPatterns(plain)).toEqual([]);
    } finally {
      await rm(plain, { recursive: true, force: true });
    }
  });
});
