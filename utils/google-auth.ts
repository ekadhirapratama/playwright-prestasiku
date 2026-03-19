import { google, Auth } from 'googleapis';
import * as fs from 'fs';

export async function getAuthClient(): Promise<Auth.GoogleAuth> {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!keyPath && !keyJson) {
    throw new Error(
      'Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON in .env'
    );
  }

  const credentials = keyJson
    ? JSON.parse(keyJson)
    : JSON.parse(fs.readFileSync(keyPath!, 'utf-8'));

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}
