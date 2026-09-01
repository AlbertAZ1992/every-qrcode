import { readFile } from "node:fs/promises";

const packagePaths = [
  "packages/core/package.json",
  "packages/renderer-webgpu/package.json",
  "packages/react/package.json",
  "packages/web-component/package.json",
];

const tag = process.argv[2];
const version = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/u.exec(tag ?? "")?.[1];

if (!version) {
  console.error("Release tag must use the form v1.2.3.");
  process.exitCode = 1;
} else {
  const packages = await Promise.all(
    packagePaths.map(async (path) => {
      const manifest = JSON.parse(await readFile(path, "utf8"));
      return { name: manifest.name, path, version: manifest.version };
    }),
  );
  const mismatches = packages.filter((manifest) => manifest.version !== version);

  if (mismatches.length > 0) {
    for (const manifest of mismatches) {
      console.error(`${manifest.path}: expected ${version}, found ${manifest.version}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Release ${tag} matches all ${packages.length} public packages.`);
  }
}
