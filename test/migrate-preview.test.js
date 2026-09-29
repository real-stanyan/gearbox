import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, cpSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findFence } from "../scripts/lib/fence.js";
import { REPO, runTool, tmp, read, write } from "./helpers.js";

// scripts/dev/migrate-preview.js: a maintainer's dry run of the v1 → v2 migration. It only reads the
// downstream, and writes only into out-dir.
const FX = join(REPO, "test/fixtures/v1.15.2-install");
const FX_AGENTS = readFileSync(join(FX, "AGENTS.md"), "utf8");
const preview = (down, out) => runTool("dev/migrate-preview.js", [down, out]);
const v1Copy = () => {
  const dir = tmp("gearbox-preview-down-");
  cpSync(FX, dir, { recursive: true });
  return dir;
};
const freshOut = () => join(tmp("gearbox-preview-out-"), "out");
const refused = (r, pattern) => {
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, pattern);
  assert.doesNotMatch(r.out, /\n\s+at /, "a clean message, not a stack trace");
};

test("preview: the v1.15.2 install migrates against this checkout's fences, written to out-dir only", () => {
  const down = v1Copy();
  const out = freshOut();
  const r = preview(down, out);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /maintainer octo-owner · carried 0 · moved 0 · flagged 0 · collisions 0 · index kept/);
  assert.equal(findFence(read(out, "AGENTS.md"), "protocol").block, findFence(read(REPO, "AGENTS.md"), "protocol").block);
  assert.equal(findFence(read(out, "CONTEXT.md"), "glossary").block, findFence(read(REPO, "CONTEXT.md"), "glossary").block);
  assert.equal(JSON.parse(read(out, "report.json")).maintainer, "octo-owner");
  assert.ok(!existsSync(join(out, "INDEX.md")));
  assert.equal(read(down, "AGENTS.md"), FX_AGENTS);
});

test("preview refuses an out-dir that is the downstream (however spelled) or the Gearbox checkout it reads", () => {
  const down = v1Copy();
  refused(preview(down, `${down}/sub/..`), /out-dir is the downstream dir/);
  const link = join(tmp("gearbox-preview-link-"), "link");
  symlinkSync(down, link);
  refused(preview(down, link), /out-dir is the downstream dir/);
  assert.equal(read(down, "AGENTS.md"), FX_AGENTS);

  // A throwaway Gearbox checkout: the helper takes its upstream fences from the checkout it lives in.
  const gearbox = tmp("gearbox-preview-self-");
  cpSync(join(REPO, "scripts"), join(gearbox, "scripts"), { recursive: true });
  for (const f of ["AGENTS.md", "CONTEXT.md"]) write(gearbox, f, read(REPO, f));
  const r = spawnSync(process.execPath, [join(gearbox, "scripts/dev/migrate-preview.js"), down, gearbox], { encoding: "utf8" });
  refused({ code: r.status, out: `${r.stdout}${r.stderr}` }, /out-dir is the Gearbox checkout/);
  assert.equal(read(gearbox, "AGENTS.md"), read(REPO, "AGENTS.md"));
});

test("preview refuses a missing downstream, a missing AGENTS.md, and a half-migrated tree — writing nothing", () => {
  const out = freshOut();
  refused(preview(join(tmp(), "nope"), out), /no downstream directory/);
  refused(preview(tmp("gearbox-preview-empty-"), out), /no AGENTS\.md/);
  const half = v1Copy();
  write(half, "CONTEXT.md", `${read(half, "CONTEXT.md")}\n${findFence(read(REPO, "CONTEXT.md"), "glossary").block}\n`);
  refused(preview(half, out), /half-migrated/);
  assert.ok(!existsSync(out));
});

test("preview: a malformed marker or an unpaired code fence is a clean refusal naming the file", () => {
  const out = freshOut();
  const marker = v1Copy();
  write(marker, "AGENTS.md", `${FX_AGENTS}\n<!-- gearbox:protocol oops -->\n`);
  refused(preview(marker, out), /AGENTS\.md: malformed gearbox marker on line \d+/);
  const fence = v1Copy();
  write(fence, "AGENTS.md", FX_AGENTS.replace("<Project tech stack, one per line. Example: Next.js 15 / TypeScript / Postgres>", "```bash\nnpm run build"));
  refused(preview(fence, out), /AGENTS\.md line \d+: this code fence is never closed/);
  assert.ok(!existsSync(out));
});
