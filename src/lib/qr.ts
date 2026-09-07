import type { QRPayload } from './types';
import { COLLEGE_LAT, COLLEGE_LNG } from './geo';

export function generateToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function encodeQR(subject: string, token: string): string {
  const payload: QRPayload = {
    subject,
    timestamp: Date.now(),
    lat: COLLEGE_LAT,
    lng: COLLEGE_LNG,
    token,
  };
  return JSON.stringify(payload);
}

export function decodeQR(data: string): QRPayload | null {
  try {
    const parsed = JSON.parse(data);
    if (
      typeof parsed.subject === 'string' &&
      typeof parsed.timestamp === 'number' &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number' &&
      typeof parsed.token === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
