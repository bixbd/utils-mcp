export type Pkg = { name: string; dir: string; version: string; private: boolean; dependsOn: string[] };

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** "v1.2.3" or "1.2.3" becomes "1.2.3". Throws on anything that is not semver. */
export function versionFromTag(tag: string): string {
  const version = tag.replace(/^v/, "");
  if (!SEMVER.test(version)) {
    throw new Error(`Tag "${tag}" is not a semver version like v1.2.3`);
  }
  return version;
}

/** npm dist-tag: prereleases go to "next" so they never become `latest`. */
export function distTag(version: string): string {
  return version.includes("-") ? "next" : "latest";
}

/** Publishable packages in dependency order (dependencies first). Throws on cycles. */
export function publishOrder(packages: Pkg[]): Pkg[] {
  const publishable = packages.filter((p) => !p.private);
  const names = new Set(publishable.map((p) => p.name));
  const done = new Set<string>();
  const ordered: Pkg[] = [];
  let remaining = [...publishable];
  while (remaining.length > 0) {
    const ready = remaining.filter((p) => p.dependsOn.every((d) => !names.has(d) || done.has(d)));
    if (ready.length === 0) {
      throw new Error(`Dependency cycle among: ${remaining.map((p) => p.name).join(", ")}`);
    }
    for (const p of ready) {
      done.add(p.name);
      ordered.push(p);
    }
    remaining = remaining.filter((p) => !done.has(p.name));
  }
  return ordered;
}
