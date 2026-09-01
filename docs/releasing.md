# Releasing Every QR Code

GitHub Releases and npm packages are separate systems. This repository connects them with
`.github/workflows/publish.yml`: publishing a non-prerelease GitHub Release starts the npm workflow.

## Normal release

1. Update all four public package versions to the same value in a pull request.
2. Merge only after tests, type checking, lint, formatting, and the production build pass.
3. On GitHub, create a release whose tag matches that package version, such as `v0.1.3`.
4. Publish the GitHub Release.

The workflow checks out that exact tag, verifies all package versions, runs the full repository
gates, packs the packages, and publishes them in dependency order:

```text
core → renderer-webgpu → react + web-component
```

If a job is rerun after a partial registry publish, it skips packages that already exist and
continues with the remaining packages.

## Authentication

Each public package trusts the same GitHub Actions workflow through npm Trusted Publishing:

```text
GitHub repository: AlbertAZ1992/every-qrcode
Workflow filename: publish.yml
Allowed action: npm publish
```

GitHub receives a short-lived OIDC identity for the workflow run. No long-lived npm publish token
is stored in GitHub. Because the repository and packages are public, npm also records provenance
for each automated publish.

## Versioning rule

The GitHub tag and npm package versions describe a code release. `generatorVersion` describes the
visual recipe used by a saved QR world. They are deliberately independent: package `0.2.0` can
still render both generator v1 and a future generator v2.
