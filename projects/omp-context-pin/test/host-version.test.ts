import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { MAX_HOST_MAJOR, MIN_HOST_VERSION, classifyHostVersion, parseHostVersion } from "../src/host-version.ts";

describe("parseHostVersion", () => {
  test("reads the leading triple and records whether a suffix is a prerelease", () => {
    expect(parseHostVersion("18.1.16")).toEqual({ major: 18, minor: 1, patch: 16, prerelease: false });
    expect(parseHostVersion(" 18.1.16+local ")).toEqual({ major: 18, minor: 1, patch: 16, prerelease: false });
    expect(parseHostVersion("18.1.8-beta.2")).toEqual({ major: 18, minor: 1, patch: 8, prerelease: true });
    expect(parseHostVersion("18.1.8-rc.1+build.5")).toEqual({ major: 18, minor: 1, patch: 8, prerelease: true });
    // A suffix that is not a semver marker leaves the version unreadable.
    for (const version of ["18.2.0rc.1", "18.1.8.1", "18.1.8beta", "18.1.8-", "18.1.8+", "18.1.8 beta"]) {
      expect(parseHostVersion(version)).toBeUndefined();
    }
    expect(parseHostVersion("18.1")).toBeUndefined();
    expect(parseHostVersion("main")).toBeUndefined();
    expect(parseHostVersion("")).toBeUndefined();
  });
});

describe("classifyHostVersion", () => {
  test("accepts the lowest supported version and later 18.x releases", () => {
    expect(classifyHostVersion("18.1.8")).toBe("supported");
    expect(classifyHostVersion("18.1.16")).toBe("supported");
    expect(classifyHostVersion("18.2.0")).toBe("supported");
    expect(classifyHostVersion("18.1.16+local")).toBe("supported");
  });

  test("treats a prerelease below the declared minimum as below it", () => {
    expect(classifyHostVersion("18.1.8-beta.2")).toBe("unsupported");
    expect(classifyHostVersion("18.2.0-rc.1")).toBe("supported");
    // Build metadata does not move the version below its release.
    expect(classifyHostVersion("18.1.8+build.5")).toBe("supported");
  });

  test("rejects versions below the minimum and the next major", () => {
    expect(classifyHostVersion("18.1.7")).toBe("unsupported");
    expect(classifyHostVersion("18.0.9")).toBe("unsupported");
    expect(classifyHostVersion("17.9.0")).toBe("unsupported");
    expect(classifyHostVersion("19.0.0")).toBe("unsupported");
  });

  test("reports an unreadable version as unknown rather than unsupported", () => {
    for (const version of ["", "main", "v18.1.8", "18.1", "18.2.0rc.1", "18.1.8.1"]) {
      expect(classifyHostVersion(version)).toBe("unknown");
    }
  });

  test("keeps the declared bounds in one place", () => {
    expect(MIN_HOST_VERSION).toEqual({ major: 18, minor: 1, patch: 8 });
    expect(MAX_HOST_MAJOR).toBe(19);
  });
});

describe("declared peer range", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    peerDependencies: Record<string, string>;
  };
  const range = manifest.peerDependencies["@oh-my-pi/pi-coding-agent"];

  test("matches the gate in the package manifest", () => {
    const match = /^>=(\d+\.\d+\.\d+) <(\d+)$/.exec(range ?? "");
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe(`${MIN_HOST_VERSION.major}.${MIN_HOST_VERSION.minor}.${MIN_HOST_VERSION.patch}`);
    expect(Number(match?.[2])).toBe(MAX_HOST_MAJOR);
  });

  test("is the range both component READMEs state", () => {
    for (const file of ["../README.md", "../README.zh.md"]) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8")).toContain(`\`${range}\``);
    }
  });
});
