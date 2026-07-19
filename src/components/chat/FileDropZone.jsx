import React, { useState, useCallback } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Wraps the chat area and accepts dragged-in files.
 * On drop, uploads each file via Core.UploadFile and calls onFilesUploaded with [{ file_url, file_name }].
 */
export default function FileDropZone({ children, onFilesUploaded, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragCounter = React.useRef(0);

  const handleDragEnter = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, [disabled]);

  const handleDragOver = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
  }, [disabled]);

  const handleDrop = useCallback(async (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({ file_url, file_name: file.name });
      }
      if (onFilesUploaded) await onFilesUploaded(uploaded);
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  }, [disabled, onFilesUploaded]);

  return (
    <div
      className="relative flex-1 flex flex-col overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {(isDragging || isUploading) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-blue-500 bg-slate-800/60 px-12 py-10">
            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
                <p className="text-slate-200 font-medium">Uploading to Jasper...</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-blue-400" />
                <p className="text-slate-200 font-medium">Drop files to share with Jasper</p>
                <p className="text-xs text-slate-400">Images, PDFs, documents</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}