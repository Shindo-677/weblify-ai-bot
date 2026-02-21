import fetch from 'node-fetch';

export function safeLuaFilename(name: string): string {
  // Keep it simple and safe for Discord uploads
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!cleaned.toLowerCase().endsWith('.lua')) return `${cleaned}.lua`;
  return cleaned;
}

export async function downloadAttachmentToBuffer(url: string, maxBytes: number): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const arr = await res.arrayBuffer();
  if (arr.byteLength > maxBytes) throw new Error(`File too large. Max ${maxBytes} bytes.`);
  return Buffer.from(arr);
}
