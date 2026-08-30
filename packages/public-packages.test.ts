import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

async function readPackage(relativePath: string): Promise<Record<string, unknown> | null> {
  const packagePath = path.join(root, relativePath, "package.json");
  return readFile(packagePath, "utf8")
    .then((content) => JSON.parse(content) as Record<string, unknown>)
    .catch(() => null);
}

describe("Every QR Code package graph", () => {
  it("publishes exactly four Every QR Code packages", async () => {
    const core = await readPackage("packages/core");
    const renderer = await readPackage("packages/renderer-webgpu");
    const react = await readPackage("packages/react");
    const webComponent = await readPackage("packages/web-component");

    expect(core?.name).toBe("@every-qrcode/core");
    expect(renderer?.name).toBe("@every-qrcode/renderer-webgpu");
    expect(react?.name).toBe("@every-qrcode/react");
    expect(webComponent?.name).toBe("@every-qrcode/web-component");
    expect(react?.peerDependencies).toMatchObject({ react: ">=18", "react-dom": ">=18" });
    expect(webComponent?.exports).toHaveProperty("./auto");
  });

  it("contains only the four package directories", async () => {
    const packageDirectories = (await readdir(path.join(root, "packages"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(packageDirectories).toEqual(["core", "react", "renderer-webgpu", "web-component"]);
  });
});
