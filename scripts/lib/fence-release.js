// The fence release rule (ADR-0050), Gearbox repo only: the protocol version moves exactly when
// fence content moves. scripts/check-gearbox.js enforces it and scripts/dev/rehash-fences.js
// stamps what it enforces — both read this module, so the check and the fix can't disagree.
import { execFileSync } from "node:child_process";
import { findFence } from "./fence.js";

const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

function git(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 24 });
  } catch {
    return null;
  }
}

// a > b for "vX.Y.Z" strings; false when either isn't one.
export function semverGreater(a, b) {
  const x = RELEASE_TAG.exec(a);
  const y = RELEASE_TAG.exec(b);
  if (!x || !y) return false;
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) > Number(y[i]);
  return false;
}

// The highest vX.Y.Z tag, or null (outside git, no tags, a shallow checkout without them).
// Pre-release and other v* tags are ignored.
export function latestTag(root) {
  const out = git(root, ["tag", "-l", "v*", "--sort=-v:refname"]);
  return (out || "").split("\n").map((t) => t.trim()).find((t) => RELEASE_TAG.test(t)) || null;
}

// Both fences as committed at `ref`: each a Fence, or null when the file is missing there, has
// no fence, or holds a malformed one — so a v1 tag reads as "no fences".
export function fencesAt(root, ref) {
  const at = (path, name) => {
    if (ref.startsWith("-")) return null; // never let a ref turn into a git option
    const text = git(root, ["cat-file", "blob", `${ref}:${path}`]);
    if (text === null) return null;
    try {
      return findFence(text, name);
    } catch {
      return null;
    }
  };
  return { protocol: at("AGENTS.md", "protocol"), glossary: at("CONTEXT.md", "glossary") };
}

// The rule for the working-tree fences `current` = { protocol, glossary } against the latest tag.
// changed: either fence's content differs from the tag's (a tag without fences counts as
// changed). changed ⇒ both markers carry package.json's version, and that version is bumped past
// the tag; unchanged ⇒ they keep the tag's version, so a README-only release doesn't move the
// protocol version. `expected` is the version the markers must carry. No tag (or no fence to
// judge) ⇒ nothing to compare, errors [].
export function releaseState(root, current, pkgVersion) {
  const tag = latestTag(root);
  if (!tag || !current.protocol || !current.glossary)
    return { tag, changed: null, tagVersion: null, expected: null, bumped: null, errors: [] };
  const prev = fencesAt(root, tag);
  const changed =
    !prev.protocol ||
    !prev.glossary ||
    prev.protocol.actualHash !== current.protocol.actualHash ||
    prev.glossary.actualHash !== current.glossary.actualHash;
  const tagVersion = prev.protocol ? prev.protocol.version : null;
  const bumped = semverGreater(pkgVersion, tag);
  const expected = changed ? pkgVersion : tagVersion;
  const marker = current.protocol.version;
  const rehash = "run node scripts/dev/rehash-fences.js (ADR-0050)";
  const errors = [];
  if (changed && !bumped)
    errors.push(`fence content changed since ${tag}, but package.json's version (${pkgVersion}) isn't greater than ${tag} — changed protocol text needs a new version: bump package.json's version, then ${rehash}`);
  if (marker !== expected)
    errors.push(
      changed
        ? `fence content changed since ${tag}, so the marker version (${marker}) must equal package.json's (${pkgVersion}) — set package.json's version, then ${rehash}`
        : `fence content is unchanged since ${tag}, so the marker version (${marker}) must stay ${tagVersion} — ${rehash}`,
    );
  return { tag, changed, tagVersion, expected, bumped, errors };
}
