/**
 * Wipe all data from the database and R2 storage.
 * Usage: cd server && npx tsx scripts/wipe-all-data.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sql = neon(process.env.DATABASE_URL!);

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});
const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'ollie-receipts';

async function deleteAllR2Objects() {
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const list = await r2Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'receipts/',
      ContinuationToken: continuationToken,
    }));

    if (list.Contents) {
      for (const obj of list.Contents) {
        await r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key! }));
        deleted++;
      }
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

async function clearDatabase() {
  const tables = [
    'audit_log',
    'category_rules',
    'qb_categories',
    'receipts',
    'quickbooks_connections',
    'organizations',
    'users',
  ];

  const results: Record<string, number> = {};
  for (const table of tables) {
    const rows = await sql(`DELETE FROM ${table} RETURNING *`);
    results[table] = rows.length;
  }
  return results;
}

async function main() {
  console.log('Wiping all data...\n');

  console.log('Deleting R2 objects...');
  const r2Count = await deleteAllR2Objects();
  console.log(`  Deleted ${r2Count} files from R2\n`);

  console.log('Clearing database tables...');
  const dbResults = await clearDatabase();
  for (const [table, count] of Object.entries(dbResults)) {
    console.log(`  ${table}: ${count} rows deleted`);
  }

  console.log('\nDone! All data has been wiped.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
