#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const USERNAME = process.env.MONKEYTYPE_USERNAME || "wambo";
const API_KEY = process.env.MONKEYTYPE_API_KEY;

if (!API_KEY) {
  console.error("Missing MONKEYTYPE_API_KEY in environment. Exiting.");
  process.exit(1);
}

const endpoint = `https://api.monkeytype.com/users/${encodeURIComponent(
  USERNAME
)}/personalBests`;

const START = "<!-- MONKEYTYPE:START -->";
const END = "<!-- MONKEYTYPE:END -->";
const README_PATH = path.resolve(process.cwd(), "README.md");

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
}

function getNumber(val) {
  if (val === undefined || val === null) return undefined;
  const n = parseInt(String(val).replace(/[^\\d]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

function pickPbs(items, mode, allowed) {
  const best = new Map(); // key: mode2, value: pb
  for (const e of items) {
    const m = e.mode || e.type || e.testType;
    const m2 =
      getNumber(e.mode2) ??
      getNumber(e.mode2Val) ??
      getNumber(e.words) ??
      getNumber(e.time) ??
      getNumber(e.duration);

    if (String(m).toLowerCase() !== String(mode).toLowerCase()) continue;
    if (!allowed.includes(m2)) continue;

    const wpm =
      e.wpm ??
      e.wpmHigh ??
      e.wpm_value ??
      (e.stats && e.stats.wpm) ??
      undefined;

    const accRaw =
      e.acc ??
      e.accuracy ??
      e.accu ??
      (e.stats && (e.stats.acc || e.stats.accuracy));

    const acc = accRaw !== undefined ? Math.round(accRaw) : undefined;

    const cur = best.get(m2);
    if (!cur || (typeof wpm === "number" && wpm > (cur.wpm ?? -Infinity))) {
      best.set(m2, { wpm, acc, mode2: m2 });
    }
  }
  return allowed.map((a) => best.get(a) || null);
}

function fmtCell(pb) {
  if (!pb || pb.wpm === undefined) return "—";
  const wpm = Math.round(pb.wpm);
  const acc = pb.acc !== undefined ? `${pb.acc}%` : "—";
  return `${wpm} WPM (${acc})`;
}

function buildTables(data) {
  const timeOrder = [15, 30, 60, 120];
  const wordOrder = [10, 25, 50, 100];

  const times = pickPbs(data, "time", timeOrder);
  const words = pickPbs(data, "words", wordOrder);

  const timeHeader = `| ${timeOrder.map((s) => `${s}s`).join(" | ")} |`;
  const timeSep = `| ${timeOrder.map(() => "---").join(" | ")} |`;
  const timeRow = `| ${times.map(fmtCell).join(" | ")} |`;

  const wordHeader = `| ${wordOrder.map((w) => `${w}w`).join(" | ")} |`;
  const wordSep = `| ${wordOrder.map(() => "---").join(" | ")} |`;
  const wordRow = `| ${words.map(fmtCell).join(" | ")} |`;

  return [
    "#### Time tests",
    timeHeader,
    timeSep,
    timeRow,
    "",
    "#### Word tests",
    wordHeader,
    wordSep,
    wordRow,
  ].join("\\n");
}

function wrapSection(inner) {
  return [
    START,
    `### Monkeytype Personal Bests (${USERNAME})`,
    "",
    inner,
    "",
    `_Last updated: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC_`,
    END,
  ].join("\\n");
}

async function main() {
  const res = await fetch(endpoint, {
    headers: { Authorization: `ApeKey ${API_KEY}` },
  });
  if (!res.ok) {
    console.error(`API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const json = await res.json();

  const list =
    (json && (json.personalBests || json.data)) ||
    (Array.isArray(json) ? json : []);

  if (!Array.isArray(list)) {
    console.error("Unexpected API response shape.");
    process.exit(1);
  }

  const section = wrapSection(buildTables(list));

  const original = fs.readFileSync(README_PATH, "utf8");
  const pattern = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`);
  let updated;
  if (pattern.test(original)) {
    updated = original.replace(pattern, section);
  } else {
    const spacer = original.endsWith("\\n") ? "" : "\\n";
    updated = `${original}${spacer}\\n${section}\\n`;
  }

  if (updated !== original) {
    fs.writeFileSync(README_PATH, updated);
    console.log("README.md updated with latest Monkeytype PBs.");
  } else {
    console.log("README.md already up to date.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
