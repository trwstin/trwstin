#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const MONKEYTYPE_USERNAME = process.env.MONKEYTYPE_USERNAME || 'wambo';
const MONKEYTYPE_API_KEY = process.env.MONKEYTYPE_API_KEY;
const README_PATH = path.join(__dirname, '..', 'README.md');

// Markers for updating README
const START_MARKER = '<!-- MONKEYTYPE:START -->';
const END_MARKER = '<!-- MONKEYTYPE:END -->';

/**
 * Fetch personal bests from Monkeytype API
 */
async function fetchPersonalBests() {
  const url = `https://api.monkeytype.com/users/${MONKEYTYPE_USERNAME}/personalBests`;
  
  const headers = {};
  if (MONKEYTYPE_API_KEY) {
    headers['Authorization'] = `ApeKey ${MONKEYTYPE_API_KEY}`;
  }

  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching personal bests:', error.message);
    throw error;
  }
}

/**
 * Parse and organize personal bests data
 */
function parsePersonalBests(data) {
  const timePBs = {};
  const wordPBs = {};

  // Handle different API response structures
  const pbData = data.data || data;

  if (!pbData || typeof pbData !== 'object') {
    console.warn('Unexpected API response structure');
    return { timePBs, wordPBs };
  }

  // Parse time mode PBs
  if (pbData.time) {
    for (const [duration, entries] of Object.entries(pbData.time)) {
      if (Array.isArray(entries) && entries.length > 0) {
        // Get the best entry (usually first one)
        const best = entries[0];
        timePBs[duration] = {
          wpm: Math.round(best.wpm || 0),
          acc: Math.round(best.acc || best.accuracy || 0)
        };
      }
    }
  }

  // Parse words mode PBs
  if (pbData.words) {
    for (const [wordCount, entries] of Object.entries(pbData.words)) {
      if (Array.isArray(entries) && entries.length > 0) {
        // Get the best entry (usually first one)
        const best = entries[0];
        wordPBs[wordCount] = {
          wpm: Math.round(best.wpm || 0),
          acc: Math.round(best.acc || best.accuracy || 0)
        };
      }
    }
  }

  return { timePBs, wordPBs };
}

/**
 * Build Markdown tables for time and word tests
 */
function buildMarkdownTables(timePBs, wordPBs) {
  let markdown = '';

  // Time tests table
  const timeColumns = ['15', '30', '60', '120'];
  markdown += '#### Time Tests\n\n';
  markdown += '| Duration | 15s | 30s | 60s | 120s |\n';
  markdown += '|----------|-----|-----|-----|------|\n';
  
  // WPM row
  markdown += '| **WPM** |';
  timeColumns.forEach(col => {
    const pb = timePBs[col];
    markdown += ` ${pb ? `**${pb.wpm}**` : 'N/A'} |`;
  });
  markdown += '\n';
  
  // Accuracy row
  markdown += '| **Accuracy** |';
  timeColumns.forEach(col => {
    const pb = timePBs[col];
    markdown += ` ${pb ? `${pb.acc}%` : 'N/A'} |`;
  });
  markdown += '\n\n';

  // Word tests table
  const wordColumns = ['10', '25', '50', '100'];
  markdown += '#### Word Tests\n\n';
  markdown += '| Words | 10w | 25w | 50w | 100w |\n';
  markdown += '|-------|-----|-----|-----|------|\n';
  
  // WPM row
  markdown += '| **WPM** |';
  wordColumns.forEach(col => {
    const pb = wordPBs[col];
    markdown += ` ${pb ? `**${pb.wpm}**` : 'N/A'} |`;
  });
  markdown += '\n';
  
  // Accuracy row
  markdown += '| **Accuracy** |';
  wordColumns.forEach(col => {
    const pb = wordPBs[col];
    markdown += ` ${pb ? `${pb.acc}%` : 'N/A'} |`;
  });
  markdown += '\n';

  return markdown;
}

/**
 * Update README with new content between markers
 */
function updateReadme(newContent) {
  const readmeContent = fs.readFileSync(README_PATH, 'utf8');
  
  const startIndex = readmeContent.indexOf(START_MARKER);
  const endIndex = readmeContent.indexOf(END_MARKER);
  
  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Markers not found in README.md');
  }

  const before = readmeContent.substring(0, startIndex + START_MARKER.length);
  const after = readmeContent.substring(endIndex);
  
  const updatedContent = `${before}\n${newContent}\n${after}`;
  
  fs.writeFileSync(README_PATH, updatedContent, 'utf8');
  console.log('README.md updated successfully!');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(`Fetching personal bests for user: ${MONKEYTYPE_USERNAME}`);
    
    const data = await fetchPersonalBests();
    const { timePBs, wordPBs } = parsePersonalBests(data);
    
    console.log('Time PBs:', timePBs);
    console.log('Word PBs:', wordPBs);
    
    const markdown = buildMarkdownTables(timePBs, wordPBs);
    updateReadme(markdown);
    
    console.log('Success! Monkeytype dashboard updated.');
  } catch (error) {
    console.error('Failed to update Monkeytype dashboard:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchPersonalBests, parsePersonalBests, buildMarkdownTables, updateReadme };
