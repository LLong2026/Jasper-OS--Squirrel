import React, { useState, useRef, useCallback } from 'react';
import { Monitor, X, Camera, Loader2, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

/**
 * Screen-share panel: lets the user pick a monitor via getDisplayMedia,
 * preview it live, capture a frame, and send it to Jasper for vision analysis.
 */
export default function ScreenSharePanel({ open, onClose, onCaptureSent }) {
  const [stream, setStream] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  const startShare = useCallback(async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setError('Screen sharing is not supported in this browser.');
        return;
      }
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      setStream(mediaStream);
      // Attach to video element once rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);

      // Auto-stop when the user ends sharing via browser UI
      mediaStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopShare();
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Screen share was cancelled.');
      } else {
        setError(err.message || 'Could not start screen share.');
      }
    }
  }, []);

  const stopShare = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const handleClose = useCallback(() => {
    stopShare();
    setError('');
    onClose();
  }, [stopShare, onClose]);

  const captureAndSend = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setIsCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `screen-share-${Date.now()}.png`, { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (onCaptureSent) await onCaptureSent(file_url);
    } catch (err) {
      setError(err.message || 'Capture failed.');
    } finally {
      setIsCapturing(false);
    }
  }, [onCaptureSent]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Screen Share with Jasper</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 rounded-lg bg-red-950/50 border border-red-800 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
            {stream ? (
              <video
                ref={videoRef}
                className="h-full w-full object-contain"
                muted
                playsInline
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <Monitor className="h-12 w-12 text-slate-600" />
                <p className="text-slate-400 text-sm max-w-xs">
                  Click "Select Monitor" — your browser will show all open screens and windows. Pick one for Jasper to see.
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {!stream ? (
                <Button onClick={startShare} className="bg-blue-600 hover:bg-blue-700">
                  <Play className="h-4 w-4" /> Select Monitor
                </Button>
              ) : (
                <Button onClick={stopShare} variant="secondary">
                  <Square className="h-4 w-4" /> Stop Sharing
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={captureAndSend}
                disabled={!stream || isCapturing}
                className="bg-green-600 hover:bg-green-700 disabled:bg-slate-700"
              >
                {isCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {isCapturing ? 'Sending...' : 'Capture & Send to Jasper'}
              </Button>
              <Button variant="outline" onClick={handleClose} className="border-slate-700 text-slate-300">
                Close
              </Button>
            </div>
          </div>

          {stream && (
            <p className="mt-3 text-xs text-slate-500">
              Jasper will analyse the captured frame with vision. Capture again any time to share an updated view.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}