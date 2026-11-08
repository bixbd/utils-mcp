# Releasing to npm

For maintainers. Releases are tag driven, and all public packages share one version.

## One-time setup

1. Create an npm token that can publish the `@bixbd` packages and bypasses two-factor authentication (a granular token with "Bypass two-factor authentication", or a classic Automation token).
2. Save it as the `NPM_TOKEN` secret in the GitHub environment named `npm`. Add required reviewers there if you want an approval step before publishing.

## Release

1. Make sure `main` is green.
2. Create a GitHub release at https://github.com/bixbd/utils-mcp/releases/new with a new tag such as `v0.1.0-beta.3`, target `main`. Tick "Set as a pre-release" for versions with a dash. Pushing the tag from a terminal works too.
3. The Release workflow checks the tag is on `main`, runs `bun run check`, stamps the version, publishes in dependency order with provenance, creates the GitHub release if it does not exist yet, and attaches `utils-mcp.mcpb` (the Claude Desktop extension) to it.

Versions with a dash (`v0.2.0-beta.1`) publish under the `next` dist-tag and never become `latest`. Plain versions (`v1.0.0`) publish as `latest`. A version can never be republished, so a failed release needs a new tag.

## What gets published

Every non-private package under `packages/` and `connectors/`. The example connector and everything in `tools/` are private.

Packages are published in dependency order: core, testkit, connectors, then the server.
