// tui.js — shared zero-dependency terminal animation library for the gearbox tool family
// (gearbox-install / gearbox-version / gearbox-update, ADR-0035).
//
// Design rules:
//   - Zero runtime dependencies: raw ANSI escapes only (truecolor + cursor control).
//   - Every animation is TTY-gated: when stdout is not a TTY (CI, pipes, agent shells),
//     each helper degrades to plain single-line output — no escape garbage in logs.
//   - Animations are presentational: real work runs first (or is wrapped), the spinner
//     only adds a minimum display duration so steps are readable. Nothing here changes
//     tool behavior, output semantics, or exit codes.
//   - Palette is baked from the project logo (bone/steel/iron greys + amber bar).

import { stdout } from "node:process";

export const isTTY = Boolean(stdout.isTTY);

// ============== Palette (from the pixel logo) ==============

export const BONE = [219, 215, 203]; // logo light grey
export const STEEL = [172, 169, 158]; // logo mid grey
export const IRON = [106, 104, 96]; // logo dark grey
export const AMBER = [239, 159, 39]; // logo amber bar
const WHITE = [255, 255, 255];

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const DIM = `${ESC}2m`;
const BOLD = `${ESC}1m`;
const GREEN = `${ESC}32m`;

const fg = ([r, g, b]) => `${ESC}38;2;${r};${g};${b}m`;
const bg = ([r, g, b]) => `${ESC}48;2;${r};${g};${b}m`;
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

const up = (n) => stdout.write(`${ESC}${n}A`);
const clearLine = () => stdout.write(`${ESC}2K\r`);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cursor hygiene: hide during animations, always restore (including on Ctrl-C).
let cursorHidden = false;
function hideCursor() {
  if (!isTTY || cursorHidden) return;
  stdout.write(`${ESC}?25l`);
  cursorHidden = true;
  process.on("exit", showCursor);
  process.on("SIGINT", () => {
    showCursor();
    stdout.write("\n");
    process.exit(130);
  });
}
export function showCursor() {
  if (cursorHidden) {
    stdout.write(`${ESC}?25h`);
    cursorHidden = false;
  }
}

// ============== Gradient text ==============

// Horizontal bone → amber gradient (defaults match the logo palette).
export function grad(s, from = BONE, to = AMBER) {
  const chars = [...s];
  const n = Math.max(chars.length - 1, 1);
  return chars.map((ch, i) => (ch === " " ? ch : fg(mix(from, to, i / n)) + ch)).join("") + RESET;
}

// ============== Pixel logo (baked from gearbox-logo-dark.png, 26x28 @ 4 colors) ==============

const PX_PAL = [BONE, STEEL, IRON, AMBER];
const PX_ROWS = [
  ".............0............", "......00.....0.....11.....", "......00....000....11.....",
  ".......0000111110011......", ".......0011111111111......", "......0111111111111.......",
  ".00..0111112222211........", ".000011112.......2........", "...001112.................",
  "...01112..................", "...0111...................", "...1112...................",
  "..01112...................", "0001112...................", "..01112......3333333333333",
  "...1112......3333333333333", "...0111......3333333333333", "...01112.....3333333333333",
  "...111112.........211122..", ".111111112.......211112222", ".11..11111122222111112..22",
  "......111111111111112.....", ".......1111111111122......", ".......1112111112222......",
  "......11....222....22.....", "......11.....2.....22.....", ".............2............",
  "..........................",
];
const PX_W = PX_ROWS[0].length;
const PX_H = PX_ROWS.length; // even (half-block pairs)
const AMBER_IDX = 3;

function pxColor(r, c) {
  const ch = PX_ROWS[r][c];
  return ch === "." ? null : PX_PAL[parseInt(ch, 36)];
}

// Render the logo as half-block (▀/▄) lines; visible(r, c) decides whether a pixel shows yet.
function pxLines(visible) {
  const lines = [];
  for (let y = 0; y < PX_H; y += 2) {
    let line = "  ";
    for (let x = 0; x < PX_W; x++) {
      const t = visible(y, x) ? pxColor(y, x) : null;
      const b = visible(y + 1, x) ? pxColor(y + 1, x) : null;
      if (t && b) line += fg(t) + bg(b) + "▀" + RESET;
      else if (t) line += fg(t) + "▀" + RESET;
      else if (b) line += fg(b) + "▄" + RESET;
      else line += " ";
    }
    lines.push(line);
  }
  return lines;
}

const WORDMARK = "g e a r b o x";
const TAGLINE = "multi-agent · one source of truth";

// Full logo show: grey pixels dissolve in (ease-out), amber bar sweeps left→right,
// gradient wordmark + tagline type in beside the bar. Non-TTY: no-op (tools print
// their own plain headers).
export async function logo({ speed = 1 } = {}) {
  if (!isTTY) return;
  hideCursor();
  const H2 = PX_H / 2;
  stdout.write("\n");
  for (let i = 0; i < H2; i++) stdout.write("\n");

  // dissolve order for grey pixels (amber bar excluded — it gets its own sweep)
  const coords = [];
  for (let r = 0; r < PX_H; r++)
    for (let c = 0; c < PX_W; c++) {
      const ch = PX_ROWS[r][c];
      if (ch !== "." && parseInt(ch, 36) !== AMBER_IDX) coords.push(r * PX_W + c);
    }
  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [coords[i], coords[j]] = [coords[j], coords[i]];
  }

  const lit = new Set();
  const drawFrame = (visible) => {
    up(H2);
    for (const line of pxLines(visible)) {
      clearLine();
      stdout.write(line + "\n");
    }
  };
  // ease-out dissolve: big chunks first, small last
  const framesN = Math.max(4, Math.round(16 / speed));
  for (let f = 1; f <= framesN; f++) {
    const t = f / framesN;
    const target = Math.round(coords.length * (1 - (1 - t) ** 3));
    while (lit.size < target) lit.add(coords[lit.size]);
    drawFrame((r, c) => {
      const ch = PX_ROWS[r][c];
      return ch !== "." && parseInt(ch, 36) !== AMBER_IDX && lit.has(r * PX_W + c);
    });
    await sleep(30 / speed);
  }
  // amber bar sweeps left → right
  const barCols = [];
  for (let c = 0; c < PX_W; c++)
    if ([...Array(PX_H).keys()].some((r) => PX_ROWS[r][c] === String(AMBER_IDX))) barCols.push(c);
  const barStep = Math.max(1, Math.round(speed));
  for (let i = 0; i < barCols.length; i += barStep) {
    const limit = barCols[Math.min(i + barStep - 1, barCols.length - 1)];
    drawFrame((r, c) =>
      PX_ROWS[r][c] === String(AMBER_IDX) ? c <= limit : PX_ROWS[r][c] !== ".",
    );
    await sleep(22 / speed);
  }
  // wordmark + tagline beside the amber bar
  const wordRow = Math.floor(PX_H / 4) + 1;
  const col = PX_W + 6;
  up(H2 - wordRow);
  const word = [...WORDMARK];
  for (let k = 1; k <= word.length; k++) {
    stdout.write(`${ESC}${col}G${ESC}0K` + BOLD + grad(word.slice(0, k).join("")) + RESET);
    await sleep(35 / speed);
  }
  stdout.write(`\n${ESC}${col}G` + DIM);
  for (const ch of TAGLINE) {
    stdout.write(ch);
    await sleep(8 / speed);
  }
  stdout.write(RESET);
  stdout.write(`${ESC}${H2 - wordRow - 1}B\r\n`);
  showCursor();
}

// ============== Step spinner ==============

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Run `work` (sync fn or promise-returning fn, optional), then show an amber braille
// spinner for at least `minMs`, resolving to a green ✓ line. Non-TTY: run work, print
// the plain line, zero delay. Returns work's result.
export async function step(label, note, { minMs = 250, work } = {}) {
  let result;
  if (work) result = await work();
  const noteStr = note ? `  ${DIM}${note}${RESET}` : "";
  if (!isTTY) {
    stdout.write(`  ✓ ${label}${note ? `  ${note}` : ""}\n`);
    return result;
  }
  hideCursor();
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < minMs) {
    clearLine();
    stdout.write(`  ${fg(AMBER)}${FRAMES[i++ % FRAMES.length]}${RESET} ${label}${noteStr}`);
    await sleep(45);
  }
  clearLine();
  stdout.write(`  ${GREEN}✓${RESET} ${label}${noteStr}\n`);
  showCursor();
  return result;
}

// ============== Progress bar ==============

// Iterate items through eachFn(item, index) with a gradient progress bar (TTY) or a
// single plain summary line (non-TTY). doneNote renders dim after the ✓ title.
export async function progress(title, items, eachFn, { perItemMs = 18, doneNote = "" } = {}) {
  const width = 26;
  if (!isTTY) {
    for (let i = 0; i < items.length; i++) await eachFn(items[i], i);
    stdout.write(`  ✓ ${title}${doneNote ? `  ${doneNote}` : ""}\n`);
    return;
  }
  hideCursor();
  for (let i = 0; i < items.length; i++) {
    await eachFn(items[i], i);
    const t = (i + 1) / items.length;
    const filled = Math.round(t * width);
    const bar = [...Array(width)]
      .map((_, j) => (j < filled ? fg(mix(BONE, AMBER, j / width)) + "█" : `${DIM}░`))
      .join("");
    clearLine();
    stdout.write(
      `  ${bar}${RESET} ${String(i + 1).padStart(2)}/${items.length}  ${DIM}${String(items[i]).slice(0, 40)}${RESET}`,
    );
    await sleep(perItemMs);
  }
  clearLine();
  stdout.write(`  ${GREEN}✓${RESET} ${title}${doneNote ? `  ${DIM}${doneNote}${RESET}` : ""}\n`);
  showCursor();
}

// ============== Typewriter line ==============

export async function typeLine(line, msPerChar = 4) {
  if (!isTTY) {
    // strip nothing: caller passes pre-colored text; plain terminals ignore at pipe level anyway
    stdout.write(line + "\n");
    return;
  }
  // Type character-by-character but keep ANSI escape sequences atomic.
  const tokens = line.match(/\x1b\[[0-9;?]*[a-zA-Z]|./gs) || [];
  for (const tok of tokens) {
    stdout.write(tok);
    if (!tok.startsWith("\x1b")) await sleep(msPerChar);
  }
  stdout.write("\n");
}

// Gradient horizontal rule with an optional inline title.
export function rule(title = "", width = 44) {
  const body = title ? `── ${title} ` + "─".repeat(Math.max(width - title.length - 4, 0)) : "─".repeat(width);
  return "  " + grad(body);
}
