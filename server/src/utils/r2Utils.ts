import { GetObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '../config/r2.js';

/**
 * Download image from R2 (or external URL fallback) and return as Buffer with content type
 */
export async function downloadFromR2(imageUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
  fileName: string;
}> {
  // If the URL is an R2 URL (current or old prefix), fetch directly from R2 using credentials
  const isCurrentR2 = R2_PUBLIC_URL && imageUrl.startsWith(R2_PUBLIC_URL);
  const receiptsIdx = imageUrl.indexOf('/receipts/');
  const isOldR2 = !isCurrentR2 && receiptsIdx !== -1;

  if (isCurrentR2 || isOldR2) {
    const rawKey = isCurrentR2
      ? imageUrl.replace(`${R2_PUBLIC_URL}/`, '')
      : imageUrl.substring(receiptsIdx + 1); // strip leading '/' -> "receipts/..."
    const key = decodeURIComponent(rawKey);
    const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
    const r2Response = await r2Client.send(command);

    if (!r2Response.Body) {
      throw new Error('Image not found in R2 storage');
    }

    const bytes = await r2Response.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);
    const contentType = r2Response.ContentType || 'image/jpeg';
    const fileName = decodeURIComponent(key.split('/').pop() || 'receipt.jpg');

    return { buffer, contentType, fileName };
  }

  // Fallback: fetch from external URL
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  // Extract filename from URL
  const urlPath = new URL(imageUrl).pathname;
  const fileName = decodeURIComponent(urlPath.split('/').pop() || 'receipt.jpg');

  return { buffer, contentType, fileName };
}
