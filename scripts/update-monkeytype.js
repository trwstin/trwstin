#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const USERNAME = process.env.MONKEYTYPE_USERNAME || "wambo";
const API_KEY = process.env.MONKEYTYPE_API_KEY;

const START = "<!-- MONKEYTYPE:START -->";
const END = "<!-- MONKEYTYPE:END -->";
const README_PATH = path.resolve(process.cwd(), "README.md");

const endpoint = `https://api.monkeytype.com/users/${encodeURIComponent(
  USERNAME
)}/profile`;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bestOf(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  // highest WPM; fall back gracefully if fields are missing
  let best = null;
  for (const e of arr) {
    const wpm =
      typeof e?.wpm === "number"
        ? e.wpm
        : typeof e?.wpmHigh === "number"
        ? e.wpmHigh
        : undefined;
    if (typeof wpm !== "number") continue;
    if (!best || wpm > best.wpm) {
      best = {
        wpm,
        acc:
          typeof e?.acc === "number"
            ? Math.round(e.acc)
            : typeof e?.accuracy === "number"
            ? Math.round(e.accuracy)
            : undefined,
      };
    }
  }
  return best;
}

function fmtCell(pb) {
  if (!pb) return "—";
  const wpm = Math.round(pb.wpm);
  const acc = pb.acc !== undefined ? `${pb.acc}%` : "—";
  return `${wpm} WPM (${acc})`;
}

function buildTables(personalBests) {
  // Expected structure from API profile: { time: { "15": [..], ... }, words: {...} }
  const time = personalBests?.time ?? {};
  const words = personalBests?.words ?? {};

  const timeBuckets = ["15", "30", "60", "120"];
  const wordBuckets = ["10", "25", "50", "100"];

  const timeRow = timeBuckets.map((k) => fmtCell(bestOf(time[k]))).join(" | ");
  const wordRow = wordBuckets
    .map((k) => fmtCell(bestOf(words[k])))
    .join(" | ");

  const md = [
    "#### Time tests",
    `| ${timeBuckets.map((s) => `${s}s`).join(" | ")} |`,
    `| ${timeBuckets.map(() => "---").join(" | ")} |`,
    `| ${timeRow} |`,
    "",
    "#### Word tests",
    `| ${wordBuckets.map((w) => `${w}w`).join(" | ")} |`,
    `| ${wordBuckets.map(() => "---").join(" | ")} |`,
    `| ${wordRow} |`,
  ].join("\n");

  return md;
}

function wrapSection(username, inner) {
  return [
    START,
  `### [Monkeytype](https://monkeytype.com/profile/${username}) Personal Bests:`,
    "",
    inner,
    "",
    `_Last updated: ${new Date().toISOString()
      .slice(0, 16)
      .replace("T", " ")} UTC_`,
    END,
  ].join("\n");
}

async function fetchProfile(url, key) {
  const headers = {};
  if (key) headers["Authorization"] = `ApeKey ${key}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response (${res.status}): ${text}`);
  }
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${text}`);
  }
  // The public API typically returns { data: { ...profile } }
  return json?.data ?? json;
}

async function main() {
  const profile = await fetchProfile(endpoint, API_KEY);
  const pbs = profile?.personalBests;
  if (!pbs) {
    console.error("No personalBests found in profile response.");
  }

  const section = wrapSection(USERNAME, buildTables(pbs || {}));

  const original = fs.readFileSync(README_PATH, "utf8");
  const pattern = new RegExp(
    `${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`
  );
  let updated;
  if (pattern.test(original)) {
    updated = original.replace(pattern, section);
  } else {
    const spacer = original.endsWith("\n") ? "" : "\n";
    updated = `${original}${spacer}\n${section}\n`;
  }

  if (updated !== original) {
    fs.writeFileSync(README_PATH, updated);
    console.log("README.md updated with latest Monkeytype PBs.");
  } else {
    console.log("README.md already up to date.");
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});