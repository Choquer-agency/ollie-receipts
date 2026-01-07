import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Receipt, ReceiptStatus } from '../types';
import { parseReceiptImage } from '../services/geminiService';
import { receiptApi } from '../services/apiService';
import axios from 'axios';

interface ReceiptUploadProps {
  onUploadComplete: (receipt: Receipt) => void;
}

interface UploadStats {
  total: number;
  completed: number;
  duplicates: number;
  successful: number;
}

const ReceiptUpload: React.FC<ReceiptUploadProps> = ({ onUploadComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [stats, setStats] = useState<UploadStats>({ total: 0, completed: 0, duplicates: 0, successful: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    const total = files.length;
    setStats({ total, completed: 0, duplicates: 0, successful: 0 });

    // Step 1: Check for filename duplicates
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

    const processFile = async (file: File) => {
      try {
        // Skip if duplicate filename
        if (duplicateFilenames.has(file.name)) {
          setStats(prev => ({ 
            ...prev, 
            completed: prev.completed + 1,
            duplicates: prev.duplicates + 1,
          }));
          return;
        }

        // Step 2: Get signed upload URL from backend
        const { uploadUrl, publicUrl } = await receiptApi.getUploadUrl(file.name, file.type);

        // Step 3: Upload file directly to R2
        await axios.put(uploadUrl, file, {
          headers: {
            'Content-Type': file.type,
          },
        });

        // Step 4: Create receipt record with filename
        const newReceipt = await receiptApi.create({
          imageUrl: publicUrl,
          status: ReceiptStatus.UPLOADED,
          originalFilename: file.name,
        });

        // Don't notify parent yet - wait for OCR to complete
        // This prevents showing receipts that may be duplicates

        // Step 5: Process with Gemini OCR
        try {
          // Read file for OCR
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          const base64Data = await base64Promise;
          const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

          const parsedData = await parseReceiptImage(base64Data, mimeType);
          
          // Check for transaction detail duplicates
          const transactionCheck = await receiptApi.checkDuplicates([{
            filename: file.name,
            transactionDetails: {
              vendorName: parsedData.vendor_name,
              transactionDate: parsedData.transaction_date,
              tax: parsedData.tax,
              total: parsedData.total,
            },
          }]);

          const isTransactionDuplicate = transactionCheck.results[0]?.isDuplicate && 
                                        transactionCheck.results[0]?.reason === 'transaction_details';

          if (isTransactionDuplicate) {
            // Delete the receipt we just created and mark as duplicate
            await receiptApi.delete(newReceipt.id);
            setStats(prev => ({ 
              ...prev, 
              duplicates: prev.duplicates + 1,
            }));
          } else {
            // Update receipt with OCR data
            const updatedReceipt = await receiptApi.update(newReceipt.id, {
              ...parsedData,
              vendorName: parsedData.vendor_name,
              transactionDate: parsedData.transaction_date,
              suggestedCategory: parsedData.suggested_category,
              status: ReceiptStatus.OCR_COMPLETE,
            });
            
            onUploadComplete(updatedReceipt);
            setStats(prev => ({ 
              ...prev, 
              successful: prev.successful + 1,
            }));
          }
        } catch (err) {
          console.error('OCR error:', err);
          const errorReceipt = await receiptApi.update(newReceipt.id, {
            status: ReceiptStatus.ERROR,
          });
          onUploadComplete(errorReceipt);
          setStats(prev => ({ 
            ...prev, 
            successful: prev.successful + 1,
          }));
        }
      } catch (err) {
        console.error("File upload error", err);
      } finally {
        setStats(prev => ({ ...prev, completed: prev.completed + 1 }));
      }
    };

    // Process files in chunks of 3
    const chunkSize = 3;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = Array.from(files).slice(i, i + chunkSize);
      await Promise.all(chunk.map(file => processFile(file)));
    }

    setIsProcessing(false);
    setTimeout(() => setStats({ total: 0, completed: 0, duplicates: 0, successful: 0 }), 5000);
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

  const progressPercent = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

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
                  {Math.round(progressPercent)}%
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
                 <p style={{
                   fontSize: 'var(--font-size-body)',
                   fontWeight: 'var(--font-weight-bold)',
                   color: 'var(--text-primary)',
                 }}>
                   Processing {stats.total} documents
                 </p>
                 <p style={{
                   fontSize: 'var(--font-size-small)',
                   color: 'var(--text-secondary)',
                 }}>
                   Extracting details using AI...
                 </p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', marginLeft: '-8px', marginBottom: 'var(--spacing-4)' }}>
                <div style={{ 
                  ...iconContainerBaseStyles, 
                  backgroundColor: 'var(--background-muted)',
                  color: 'var(--primary)',
                }}>
                  <Upload size={24} />
                </div>
                <div style={{ 
                  ...iconContainerBaseStyles,
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success-text)',
                  transform: 'translateY(4px)',
                }}>
                  <FileText size={24} />
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

      {stats.total > 0 && (
        <div style={{
          backgroundColor: 'var(--background-elevated)',
          padding: 'var(--spacing-4)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-raised)',
        }}>
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
                {stats.completed === stats.total ? 'Upload complete' : `Uploading ${stats.total} items...`}
              </span>
              <span style={{
                fontSize: 'var(--font-size-small)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
              }}>
                {stats.completed} / {stats.total}
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
                  width: `${progressPercent}%`,
                  borderRadius: 'var(--radius-md)',
                }}
              />
           </div>
           {stats.completed === stats.total && (
             <div style={{ marginTop: 'var(--spacing-3)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
               {stats.successful > 0 && (
                 <div style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: 'var(--spacing-2)',
                   fontSize: 'var(--font-size-small)',
                   fontWeight: 'var(--font-weight-semibold)',
                   color: 'var(--status-success-text)',
                 }}>
                   <CheckCircle2 size={14} /> {stats.successful} {stats.successful === 1 ? 'receipt' : 'receipts'} ready for review below
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
                   <AlertCircle size={14} /> {stats.duplicates} {stats.duplicates === 1 ? 'receipt was a duplicate' : 'receipts were duplicates'}
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

