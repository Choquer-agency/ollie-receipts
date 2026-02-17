import { Langfuse } from 'langfuse';

let langfuseInstance: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  if (langfuseInstance) return langfuseInstance;

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL;

  if (!secretKey || !publicKey) {
    return null;
  }

  langfuseInstance = new Langfuse({
    secretKey,
    publicKey,
    baseUrl: baseUrl || 'https://cloud.langfuse.com',
    flushInterval: 5000,
    flushAt: 10,
  });

  return langfuseInstance;
}

export function isLangfuseConfigured(): boolean {
  return !!(process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY);
}

// Graceful shutdown
process.on('beforeExit', async () => {
  if (langfuseInstance) {
    await langfuseInstance.shutdownAsync();
  }
});
