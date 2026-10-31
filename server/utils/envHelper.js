import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

export const updateEnvVariables = async (updates = {}) => {
  try {
    let existingContent = '';
    try {
      existingContent = await fs.readFile(envPath, 'utf8');
    } catch (err) {
      existingContent = '';
    }

    const lines = existingContent.split(/\r?\n/);
    const updatedKeys = new Set();
    const newLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        newLines.push(line);
        continue;
      }

      const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        const key = match[1];
        if (key in updates && updates[key] !== undefined) {
          newLines.push(`${key}=${updates[key]}`);
          updatedKeys.add(key);
          process.env[key] = String(updates[key]);
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    }

    // Add any new keys that weren't already in the file
    for (const [key, val] of Object.entries(updates)) {
      if (!updatedKeys.has(key) && val !== undefined) {
        newLines.push(`${key}=${val}`);
        process.env[key] = String(val);
      }
    }

    await fs.writeFile(envPath, newLines.join('\n'), 'utf8');
    return true;
  } catch (err) {
    console.error('[envHelper] Error updating .env file:', err.message);
    return false;
  }
};
