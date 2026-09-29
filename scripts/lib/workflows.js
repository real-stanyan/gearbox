// Workflow templates written into downstream repos. gearbox-check.yml is tool-owned
// (ADR-0051): gearbox-update rewrites it whenever it differs from CHECK_YML.

export function ciYml(gateCmd) {
  const cmd = gateCmd || "echo '<fill in the Gate command, byte-identical to the Gate section in AGENTS.md>' && exit 1";
  // Detect if cmd is safe for YAML plain scalar: single line, safe first char, no ": " or " #", doesn't end with ":"
  const isSafeScalar =
    !cmd.includes("\n") &&
    /^[A-Za-z0-9_.\/-]/.test(cmd) &&
    !cmd.includes(": ") &&
    !cmd.includes(" #") &&
    !cmd.endsWith(":");

  const runLine = isSafeScalar
    ? `      - run: ${cmd}`
    : `      - run: |\n${cmd.split("\n").map((l) => "          " + l).join("\n")}`;

  return `name: gate

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      # IMPORTANT: keep this identical to the Gate section in AGENTS.md.
      # That sameness is the contract that lets CI enforce what agents promise.
${runLine}
`;
}

export const SYNC_YML = `name: gearbox-sync

# Scheduled protocol auto-update (gearbox ADR-0049, fences ADR-0050).
# Weekly: checks the gearbox npm package (major version pinned), and when the
# protocol moved, opens a backfill PR (docs/gearbox-backfill-*) that rewrites the
# protocol fences and copies new protocol ADRs. Merging stays a human/agent
# decision in this repo (L1). Opt out by deleting this file — the shift-start
# self-check (gearbox-version) keeps working without it.

on:
  schedule:
    - cron: "17 3 * * 1"
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Skip if a backfill PR is already open
        id: guard
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          OPEN=\$(gh pr list --repo "\$GITHUB_REPOSITORY" --state open --json headRefName --jq '[.[] | select(.headRefName | startswith("docs/gearbox-backfill-"))] | length')
          if [ "\$OPEN" != "0" ]; then
            echo "Previous backfill PR still open — merge it first. Skipping."
            echo "skip=true" >> "\$GITHUB_OUTPUT"
          else
            echo "skip=false" >> "\$GITHUB_OUTPUT"
          fi
      - uses: actions/checkout@v5
        if: steps.guard.outputs.skip == 'false'
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v5
        if: steps.guard.outputs.skip == 'false'
        with:
          node-version: 24
      - name: Git identity for backfill commits
        if: steps.guard.outputs.skip == 'false'
        run: |
          git config user.name "gearbox-sync[bot]"
          git config user.email "gearbox-sync-bot@users.noreply.github.com"
      - name: Run gearbox-update
        if: steps.guard.outputs.skip == 'false'
        run: npx -y gearbox-agents@2 update --refresh-drift
      - name: Open the backfill PR
        if: steps.guard.outputs.skip == 'false'
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          BRANCH=\$(git for-each-ref --format='%(refname:short)' 'refs/heads/docs/gearbox-backfill-*' | tail -1)
          if [ -z "\$BRANCH" ]; then
            echo "Nothing to sync — protocol is current."
            exit 0
          fi
          gh pr create --head "\$BRANCH" \\
            --title "gearbox: protocol backfill (\$BRANCH)" \\
            --body-file gearbox-update-report.md \\
            || echo "PR creation failed — if the log above says GitHub Actions may not create pull requests, enable it in Settings → Actions → General → Workflow permissions. The sync branch is already pushed."
`;

export const CHECK_YML = `name: gearbox-check

# Protocol check (gearbox ADR-0051): fences intact, AGENTS.md within 32 KiB,
# required sections present, CI runs the Gate command. Read-only and offline.
# Tool-owned: gearbox-agents update rewrites this file when the template changes.

on:
  pull_request:
  push:
    branches: [main, master]

permissions:
  contents: read

jobs:
  protocol:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      - run: npx -y gearbox-agents@2 check
`;

export function pinSyncYml(text) {
  return text.replace(/gearbox-agents@latest/g, "gearbox-agents@2");
}
