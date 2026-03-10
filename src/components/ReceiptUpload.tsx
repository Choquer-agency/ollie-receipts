import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Receipt, ReceiptStatus } from '../types';
import { receiptApi, setAuthToken } from '../services/apiService';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';

interface ReceiptUploadProps {
  onUploadComplete: (receipt: Receipt) => void;
}

interface UploadStats {
  total: number;
  uploaded: number;
  duplicates: number;
  errors: number;
}

interface OcrProgress {
  total: number;
  completed: number;
}

// Concurrency-limited parallel execution
async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = task().then(r => { results.push(r); executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

const ReceiptUpload: React.FC<ReceiptUploadProps> = ({ onUploadComplete }) => {
  const { getToken } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [stats, setStats] = useState<UploadStats>({ total: 0, uploaded: 0, duplicates: 0, errors: 0 });
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [pendingOcrIds, setPendingOcrIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // Helper to refresh auth token before API calls
  const refreshAuthToken = async () => {
    try {
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }
      return token;
    } catch (error) {
      console.error('Failed to refresh auth token:', error);
      return null;
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Poll for OCR completion
  useEffect(() => {
    if (pendingOcrIds.size === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    // Start polling
    pollStartRef.current = Date.now();
    pollIntervalRef.current = setInterval(async () => {
      // Safety timeout: stop after 5 minutes
      if (Date.now() - pollStartRef.current > 5 * 60 * 1000) {
        console.warn('OCR polling timed out after 5 minutes');
        setPendingOcrIds(new Set());
        setOcrProgress(null);
        return;
      }

      try {
        const allReceipts = await receiptApi.getAll();
        if (!Array.isArray(allReceipts)) return;

        let completedCount = 0;
        const stillPending = new Set<string>();

        for (const id of pendingOcrIds) {
          const receipt = allReceipts.find((r: Receipt) => r.id === id);
          if (!receipt) {
            // Receipt was deleted (duplicate detection on server)
            completedCount++;
          } else if (receipt.status !== ReceiptStatus.UPLOADED) {
            // OCR completed (success or error)
            completedCount++;
            onUploadComplete(receipt);
          } else {
            stillPending.add(id);
          }
        }

        if (completedCount > 0) {
          setPendingOcrIds(stillPending);
          setOcrProgress(prev => prev ? {
            ...prev,
            completed: prev.total - stillPending.size,
          } : null);
        }

        if (stillPending.size === 0) {
          setOcrProgress(null);
          // Clear stats after a moment
          setTimeout(() => setStats({ total: 0, uploaded: 0, duplicates: 0, errors: 0 }), 5000);
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Continue polling, don't stop
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pendingOcrIds.size]); // Re-run when pending count changes to 0

  const processFiles = async (files: FileList | File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    const total = files.length;
    setStats({ total, uploaded: 0, duplicates: 0, errors: 0 });

    // Refresh auth token before starting uploads
    const token = await refreshAuthToken();
    if (!token) {
      console.error('Failed to get auth token');
      setIsUploading(false);
      return;
    }

    // Step 1: Check for filename duplicates (batch)
    const filesToCheck = Array.from(files).map(file => ({
      filename: file.name,
    }));

    let duplicateFilenames = new Set<string>();
    try {
      const duplicateCheck = await receiptApi.checkDuplicates(filesToCheck);
      duplicateCheck.results.forEach((result: any) => {
        if (result.isDuplicate && result.reason === 'filename') {
          duplicateFilenames.add(result.filename);
        }
      });
    } catch (err) {
      console.error('Error checking duplicates:', err);
    }

    // Count filename duplicates upfront
    const dupCount = Array.from(files).filter(f => duplicateFilenames.has(f.name)).length;
    if (dupCount > 0) {
      setStats(prev => ({ ...prev, duplicates: dupCount }));
    }

    // Generate a session ID to group this batch in Langfuse
    const sessionId = crypto.randomUUID();

    // Step 2: Upload all non-duplicate files to R2 with high concurrency
    const filesToUpload = Array.from(files).filter(f => !duplicateFilenames.has(f.name));
    const uploadedReceipts: Receipt[] = [];

    const uploadTasks = filesToUpload.map(file => async () => {
      try {
        // Get signed upload URL
        const { uploadUrl, publicUrl } = await receiptApi.getUploadUrl(file.name, file.type);

        // Upload file directly to R2
        await axios.put(uploadUrl, file, {
          headers: { 'Content-Type': file.type },
        });

        // Create receipt record (no OCR yet)
        const newReceipt = await receiptApi.create({
          imageUrl: publicUrl,
          status: ReceiptStatus.UPLOADED,
          originalFilename: file.name,
        });

        // Show receipt in UI immediately
        onUploadComplete(newReceipt);
        uploadedReceipts.push(newReceipt);

        setStats(prev => ({ ...prev, uploaded: prev.uploaded + 1 }));
        return newReceipt;
      } catch (err) {
        console.error('File upload error:', err);
        setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        return null;
      }
    });

    await withConcurrency(uploadTasks, 10);

    setIsUploading(false);

    // Step 3: Trigger batch OCR on the server (fire and forget)
    const receiptIds = uploadedReceipts.map(r => r.id);
    if (receiptIds.length > 0) {
      setOcrProgress({ total: receiptIds.length, completed: 0 });
      setPendingOcrIds(new Set(receiptIds));

      try {
        await receiptApi.triggerBatchOcr(receiptIds, sessionId);
      } catch (err) {
        console.error('Failed to trigger batch OCR:', err);
        // Receipts are uploaded but OCR won't run - they'll stay in 'uploaded' status
      }
    } else {
      // All were duplicates or errors
      setTimeout(() => setStats({ total: 0, uploaded: 0, duplicates: 0, errors: 0 }), 5000);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const isProcessing = isUploading || ocrProgress !== null;
  const uploadPercent = stats.total > 0 ? (stats.uploaded + stats.duplicates + stats.errors) / stats.total * 100 : 0;

  const dropzoneStyles: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '224px',
    border: '2px dashed',
    borderColor: dragActive ? 'var(--primary)' : 'var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    cursor: isProcessing ? 'default' : 'pointer',
    transition: 'var(--transition-default)',
    backgroundColor: dragActive ? 'var(--background-muted)' : 'var(--background-elevated)',
    pointerEvents: isProcessing ? 'none' : 'auto',
  };

  const iconContainerBaseStyles: React.CSSProperties = {
    padding: 'var(--spacing-3)',
    borderRadius: 'var(--radius-xl)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '4px solid var(--background-elevated)',
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={dropzoneStyles}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 'var(--spacing-5)',
          paddingBottom: 'var(--spacing-6)',
          textAlign: 'center',
          paddingLeft: 'var(--spacing-6)',
          paddingRight: 'var(--spacing-6)',
        }}>
          {isProcessing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', width: '256px' }}>
              <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto' }}>
                <Loader2
                  style={{
                    width: '64px',
                    height: '64px',
                    color: 'var(--primary)',
                    animation: 'spin 1s linear infinite',
                    position: 'absolute',
                    inset: 0,
                  }}
                />
                {isUploading && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-tiny)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--primary)',
                  }}>
                    {Math.round(uploadPercent)}%
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
                 <p style={{
                   fontSize: 'var(--font-size-body)',
                   fontWeight: 'var(--font-weight-bold)',
                   color: 'var(--text-primary)',
                 }}>
                   {isUploading
                     ? `Uploading ${stats.total} documents`
                     : `Processing ${ocrProgress?.total} receipts with AI`
                   }
                 </p>
                 <p style={{
                   fontSize: 'var(--font-size-small)',
                   color: 'var(--text-secondary)',
                 }}>
                   {isUploading
                     ? 'Sending files to storage...'
                     : `${ocrProgress?.completed || 0} of ${ocrProgress?.total || 0} complete`
                   }
                 </p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', marginLeft: '-8px', marginBottom: 'var(--spacing-4)' }}>
                <div style={{
                  ...iconContainerBaseStyles,
                  backgroundColor: '#E8F5E9',
                  color: 'var(--primary)',
                }}>
                  <Upload size={24} />
                </div>
              </div>
              <p style={{
                marginBottom: 'var(--spacing-1)',
                fontSize: 'var(--font-size-body)',
                color: 'var(--text-primary)',
                fontWeight: 'var(--font-weight-bold)',
              }}>
                Add your documents
              </p>
              <p style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-4)',
                maxWidth: '320px',
              }}>
                Drag and drop multiple receipts or PDFs here.
                Our AI will handle the rest.
              </p>
              <button style={{
                padding: 'var(--button-padding-sm)',
                backgroundColor: 'var(--background-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-body)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'var(--transition-default)',
                boxShadow: 'var(--shadow-raised)',
              }}>
                Select Files
              </button>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          multiple
          accept="image/*,.pdf"
          onChange={handleChange}
          disabled={isProcessing}
        />
      </div>

      {(stats.total > 0 || ocrProgress) && (
        <div style={{
          backgroundColor: 'var(--background-elevated)',
          padding: 'var(--spacing-4)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-raised)',
        }}>
           {isUploading && (
             <>
               <div style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 alignItems: 'center',
                 marginBottom: 'var(--spacing-2)',
               }}>
                  <span style={{
                    fontSize: 'var(--font-size-small)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--text-primary)',
                  }}>
                    Uploading {stats.total} items...
                  </span>
                  <span style={{
                    fontSize: 'var(--font-size-small)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                  }}>
                    {stats.uploaded} / {stats.total - stats.duplicates}
                  </span>
               </div>
               <div style={{
                 width: '100%',
                 backgroundColor: 'var(--background-muted)',
                 height: '8px',
                 borderRadius: 'var(--radius-md)',
                 overflow: 'hidden',
               }}>
                  <div
                    style={{
                      backgroundColor: 'var(--primary)',
                      height: '100%',
                      transition: 'width 500ms ease-out',
                      width: `${uploadPercent}%`,
                      borderRadius: 'var(--radius-md)',
                    }}
                  />
               </div>
             </>
           )}

           {!isUploading && ocrProgress && (
             <>
               <div style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 alignItems: 'center',
                 marginBottom: 'var(--spacing-2)',
               }}>
                  <span style={{
                    fontSize: 'var(--font-size-small)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--text-primary)',
                  }}>
                    {ocrProgress.completed === ocrProgress.total ? 'Processing complete' : 'Extracting receipt data...'}
                  </span>
                  <span style={{
                    fontSize: 'var(--font-size-small)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                  }}>
                    {ocrProgress.completed} / {ocrProgress.total}
                  </span>
               </div>
               <div style={{
                 width: '100%',
                 backgroundColor: 'var(--background-muted)',
                 height: '8px',
                 borderRadius: 'var(--radius-md)',
                 overflow: 'hidden',
               }}>
                  <div
                    style={{
                      backgroundColor: 'var(--primary)',
                      height: '100%',
                      transition: 'width 500ms ease-out',
                      width: `${ocrProgress.total > 0 ? (ocrProgress.completed / ocrProgress.total) * 100 : 0}%`,
                      borderRadius: 'var(--radius-md)',
                    }}
                  />
               </div>
             </>
           )}

           {!isUploading && !ocrProgress && stats.total > 0 && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
               {stats.uploaded > 0 && (
                 <div style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 'var(--spacing-2)',
                   fontSize: 'var(--font-size-small)',
                   fontWeight: 'var(--font-weight-semibold)',
                   color: 'var(--status-success-text)',
                 }}>
                   <CheckCircle2 size={14} /> {stats.uploaded} {stats.uploaded === 1 ? 'receipt' : 'receipts'} processed
                 </div>
               )}
               {stats.duplicates > 0 && (
                 <div style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 'var(--spacing-2)',
                   fontSize: 'var(--font-size-small)',
                   fontWeight: 'var(--font-weight-semibold)',
                   color: 'var(--text-secondary)',
                 }}>
                   <AlertCircle size={14} /> {stats.duplicates} duplicate {stats.duplicates === 1 ? 'receipt' : 'receipts'} skipped
                 </div>
               )}
               {stats.errors > 0 && (
                 <div style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 'var(--spacing-2)',
                   fontSize: 'var(--font-size-small)',
                   fontWeight: 'var(--font-weight-semibold)',
                   color: 'var(--status-error-text)',
                 }}>
                   <AlertCircle size={14} /> {stats.errors} {stats.errors === 1 ? 'receipt failed to upload' : 'receipts failed to upload'}
                 </div>
               )}
             </div>
           )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ReceiptUpload;
