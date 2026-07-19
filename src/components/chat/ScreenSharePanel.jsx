import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Monitor, X, Camera, Loader2, Play, Square, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const LIVE_INTERVAL_MS = 8000; // capture a fresh frame every 8s

/**
 * Screen-share panel with optional LIVE VISION.
 * - Snapshot mode: capture a single frame and send it.
 * - Live Vision mode: keep the stream open and continuously capture a frame
 *   every LIVE_INTERVAL_MS, pushing the latest URL up via onLiveFrame so the
 *   parent can attach it to every outgoing message — giving Jasper real-time sight.
 */
export default function ScreenSharePanel({ open, onClose, onCaptureSent, onLiveFrame }) {
  const [stream, setStream] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [lastLiveAt, setLastLiveAt] = useState(null);
  const videoRef = useRef(null);
  const liveTimerRef = useRef(null);
  const streamRef = useRef(null); // keep a stable ref for the interval closure

  // keep streamRef in sync
  useEffect(() => { streamRef.current = stream; }, [stream]);

  // When the panel re-expands, re-attach the live stream to the (now-mounted)
  // modal video element so the preview keeps playing.
  useEffect(() => {
    if (!collapsed && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [collapsed]);

  const captureFrame = useCallback(async (label = 'live') => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      const file = new File([blob], `screen-${label}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    } catch (err) {
      console.error('Frame capture failed:', err);
      return null;
    }
  }, []);

  const stopLive = useCallback(() => {
    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setLiveMode(false);
    if (onLiveFrame) onLiveFrame(null);
  }, [onLiveFrame]);

  const startLive = useCallback(async () => {
    if (!streamRef.current) return;
    setLiveMode(true);
    setCollapsed(true); // hide the modal so chat stays fully interactive
    // capture immediately, then on interval
    const tick = async () => {
      const url = await captureFrame('live');
      if (url) {
        setLastLiveAt(Date.now());
        if (onLiveFrame) onLiveFrame(url);
      }
    };
    tick();
    liveTimerRef.current = setInterval(tick, LIVE_INTERVAL_MS);
  }, [captureFrame, onLiveFrame]);

  const stopShare = useCallback(() => {
    stopLive();
    const s = streamRef.current;
    if (s) s.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopLive]);

  const [collapsed, setCollapsed] = useState(false);

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
      streamRef.current = mediaStream;
      // Wait for the video element to mount, then attach the stream and
      // auto-start Live Vision so Jasper can see the selected screen.
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
        // Kick off live vision automatically once the frame is ready.
        setTimeout(() => { startLive(); }, 400);
      }, 50);

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
  }, [stopShare, startLive]);

  const handleClose = useCallback(() => {
    stopShare();
    setError('');
    onClose();
  }, [stopShare, onClose]);

  const captureAndSend = useCallback(async () => {
    setIsCapturing(true);
    try {
      const url = await captureFrame('snap');
      if (url && onCaptureSent) await onCaptureSent(url);
    } catch (err) {
      setError(err.message || 'Capture failed.');
    } finally {
      setIsCapturing(false);
    }
  }, [captureFrame, onCaptureSent]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      const s = streamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (!open) return null;

  // The shared screen is being captured — keep the video element mounted (hidden)
  // so frames can be grabbed, but get out of the user's way: a small floating pill
  // is all that remains on screen, leaving the chat fully interactive.
  if (collapsed && stream) {
    return (
      <>
        {/* hidden but rendered video — required to capture frames */}
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ position: 'fixed', top: 0, left: 0, width: 2, height: 2, opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}
        />
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-red-500/40 bg-slate-900/95 px-3 py-2 shadow-2xl backdrop-blur">
          <span className="flex items-center gap-1.5 rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE VISION
          </span>
          {lastLiveAt && (
            <span className="text-[10px] text-slate-400">
              {new Date(lastLiveAt).toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={() => setCollapsed(false)}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-200"
            title="Open controls"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            onClick={stopShare}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-400 hover:text-red-300"
            title="Stop sharing"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Jasper Vision</h2>
            {liveMode && (
              <span className="ml-2 flex items-center gap-1 rounded-full bg-red-600/20 border border-red-500/40 px-2 py-0.5 text-xs text-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {stream && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="text-slate-400 hover:text-slate-200"
                title="Minimize — keep Jasper watching in the background"
              >
                <EyeOff className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose} className="text-slate-400 hover:text-slate-200">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 rounded-lg bg-red-950/50 border border-red-800 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
            {stream ? (
              <video ref={videoRef} className="h-full w-full object-contain" muted playsInline />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <Eye className="h-12 w-12 text-slate-600" />
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
              {stream && !liveMode && (
                <Button onClick={startLive} className="bg-green-600 hover:bg-green-700">
                  <Eye className="h-4 w-4" /> Enable Live Vision
                </Button>
              )}
              {stream && liveMode && (
                <Button onClick={stopLive} variant="outline" className="border-slate-600 text-slate-200">
                  <EyeOff className="h-4 w-4" /> Pause Live Vision
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={captureAndSend}
                disabled={!stream || isCapturing || liveMode}
                className="bg-green-600 hover:bg-green-700 disabled:bg-slate-700"
              >
                {isCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {isCapturing ? 'Sending...' : 'Single Snapshot'}
              </Button>
              <Button variant="outline" onClick={handleClose} className="border-slate-700 text-slate-300">
                Close
              </Button>
            </div>
          </div>

          {stream && liveMode && (
            <p className="mt-3 text-xs text-green-300/80">
              Live Vision is ON — Jasper is watching your screen in real time and sees a fresh frame every {LIVE_INTERVAL_MS / 1000}s. Just talk to her normally; she'll reference what she sees.
              {lastLiveAt && <span className="block text-slate-500 mt-1">Last frame: {new Date(lastLiveAt).toLocaleTimeString()}</span>}
            </p>
          )}
          {stream && !liveMode && (
            <p className="mt-3 text-xs text-slate-500">
              Tip: enable Live Vision so Jasper can see your screen continuously and interact with you about what's happening — not just a one-off snapshot.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}