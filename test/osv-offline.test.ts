import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { packageLine } from "../src/engines/manifest-lines.js";
import { loadedOfflineDbs, missingOfflineDbs } from "../src/engines/osv.js";
import { toRelative } from "../src/engines/paths.js";

describe("packageLine", () => {
  it("finds a requirement by its PEP 503 name, any case or separator", () => {
    const req = "# deps\nFlask==2.0.1\nrequests==2.19.0\nzope.interface==5.0\n";
    expect(packageLine(req, "flask", "2.0.1", "PyPI")).toBe(2);
    expect(packageLine(req, "requests", "2.19.0", "PyPI")).toBe(3);
    expect(packageLine(req, "zope-interface", "5.0", "PyPI")).toBe(4);
  });

  it("doesn't match a longer name that contains it", () => {
    expect(packageLine("requests-oauthlib==1.0\nrequests==2.19.0\n", "requests", "2.19.0", "PyPI")).toBe(2);
    expect(packageLine('"@types/lodash": "4.14.0",\n"lodash": "4.17.20"\n', "lodash", "4.17.20", "npm")).toBe(2);
  });

  it("prefers the entry with the version: package-lock key followed by its version", () => {
    const lock = [
      "{",
      '  "packages": {',
      '    "node_modules/lodash": {',
      '      "version": "4.17.21"',
      "    },",
      '    "node_modules/a/node_modules/lodash": {',
      '      "version": "4.17.20"',
      "    }",
      "  }",
      "}",
    ].join("\n");
    expect(packageLine(lock, "lodash", "4.17.20", "npm")).toBe(6);
    expect(packageLine(lock, "lodash", "4.17.21", "npm")).toBe(3);
  });

  it("finds a Maven artifact in a pom by its artifactId", () => {
    const pom = "<dependency>\n  <groupId>org.yaml</groupId>\n  <artifactId>snakeyaml</artifactId>\n  <version>1.33</version>\n</dependency>\n";
    expect(packageLine(pom, "org.yaml:snakeyaml", "1.33", "Maven")).toBe(3);
  });

  it("is undefined when the package isn't in the file", () => {
    expect(packageLine("flask==2.0.1\n", "django", "4.0", "PyPI")).toBeUndefined();
  });
});

describe("osv-scanner offline databases", () => {
  const stderr = [
    "Scanning dir .",
    "Loaded npm local db from /cache/osv-db/osv-scalibr/npm/all.zip",
    "could not load db for PyPI ecosystem: unable to fetch OSV database: no offline version of the OSV database is available",
    "could not load db for PyPI ecosystem: unable to fetch OSV database: no offline version of the OSV database is available",
  ].join("\n");

  it("reports each ecosystem without a database once", () => {
    expect(missingOfflineDbs(stderr)).toEqual(["PyPI"]);
    expect(missingOfflineDbs("Loaded npm local db from /x")).toEqual([]);
  });

  it("lists loaded databases and their files", () => {
    expect([...loadedOfflineDbs(stderr)]).toEqual([["npm", "/cache/osv-db/osv-scalibr/npm/all.zip"]]);
  });
});

describe("toRelative through a symlinked root", () => {
  let base: string;
  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), "hs-paths-"));
    await mkdir(join(base, "real"));
    await writeFile(join(base, "real", "requirements.txt"), "flask==2.0.1\n");
    await symlink(join(base, "real"), join(base, "link"));
  });
  afterAll(() => rm(base, { recursive: true, force: true }));

  it("maps an engine's real path back under the root", async () => {
    const real = await realpath(join(base, "real", "requirements.txt"));
    expect(toRelative(join(base, "link"), real)).toBe("requirements.txt");
  });

  it("leaves ordinary relative paths alone", () => {
    expect(toRelative("/repo", "src/app.js")).toBe("src/app.js");
    expect(toRelative("/repo", "/repo/src/app.js")).toBe("src/app.js");
  });
});
