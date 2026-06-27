"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, X, ArrowLeftRight, AlertCircle, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type CameraMode = "selfie" | "work_photo";

interface CameraModalProps {
  open: boolean;
  title: string;
  mode: CameraMode;
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  hint?: string;
  captureLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function labelCamera(cam: MediaDeviceInfo, index: number): string {
  if (cam.label) return cam.label;
  return `Camera ${index + 1}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CameraModal({
  open,
  title,
  mode,
  onCapture,
  onClose,
  hint,
  captureLabel = "Capture Photo",
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    mode === "selfie" ? "user" : "environment"
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  // ── Stop the camera stream completely ──────────────────────────────────────
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (mountedRef.current) {
      setStreamReady(false);
    }
  }, []);

  // ── Start the camera stream ────────────────────────────────────────────────
  const startStream = useCallback(
    async (deviceId?: string, fMode?: "user" | "environment") => {
      if (!mountedRef.current) return;

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setCameraError(null);
      setStreamReady(false);

      const targetFacingMode = fMode ?? facingMode;
      const targetDeviceId = deviceId ?? activeCameraId;

      const videoConstraints: MediaTrackConstraints = targetDeviceId
        ? {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: { ideal: targetFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error("Camera API not available"), { name: "NotSupportedError" });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            const vid = videoRef.current;
            if (!vid) return resolve();
            if (vid.readyState >= 2) return resolve();
            const handler = () => {
              vid.removeEventListener("loadedmetadata", handler);
              resolve();
            };
            vid.addEventListener("loadedmetadata", handler);
          });
        }

        if (!mountedRef.current) return;
        setStreamReady(true);

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          if (mountedRef.current) {
            setCameras(videoDevices);
            if (!targetDeviceId) {
              const activeTrack = stream.getVideoTracks()[0];
              const settings = activeTrack?.getSettings();
              if (settings?.deviceId) setActiveCameraId(settings.deviceId);
            }
          }
        } catch (_) {
          // non-critical
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        console.error("Camera access failed:", err);
        const msg =
          err?.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access and try again."
            : err?.name === "NotFoundError"
            ? "No camera found on this device."
            : err?.name === "NotReadableError"
            ? "Camera is in use by another app. Please close it and retry."
            : "Could not access camera. Please use HTTPS and grant camera permission.";
        setCameraError(msg);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Open/Close lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      setCapturedImage(null);
      setCountdown(null);
      setFlashActive(false);
      setCameraError(null);
      setStreamReady(false);
      setCameras([]);
      setActiveCameraId("");
      const t = setTimeout(() => startStream(), 150);
      return () => {
        clearTimeout(t);
        mountedRef.current = false;
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
    }
    return () => {
      mountedRef.current = false;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch Camera ──────────────────────────────────────────────────────────
  const switchCamera = useCallback(async () => {
    if (switching) return;
    setSwitching(true);
    try {
      if (cameras.length > 1) {
        const currentIndex = cameras.findIndex((c) => c.deviceId === activeCameraId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        const nextCam = cameras[nextIndex];
        setActiveCameraId(nextCam.deviceId);
        await startStream(nextCam.deviceId);
      } else {
        const nextFacing = facingMode === "user" ? "environment" : "user";
        setFacingMode(nextFacing);
        setActiveCameraId("");
        await startStream(undefined, nextFacing);
      }
    } finally {
      if (mountedRef.current) setSwitching(false);
    }
  }, [cameras, activeCameraId, facingMode, switching, startStream]);

  // ── Capture Snapshot ───────────────────────────────────────────────────────
  const captureSnapshot = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mode === "selfie") {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    stopStream();
    if (mountedRef.current) setCapturedImage(dataUrl);
  }, [mode, stopStream]);

  // ── Countdown → Capture ────────────────────────────────────────────────────
  const triggerCountdown = useCallback(() => {
    if (countdown !== null) return;
    setCountdown(3);
    let current = 3;
    countdownRef.current = setInterval(() => {
      current -= 1;
      if (current <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        if (mountedRef.current) {
          setCountdown(null);
          setFlashActive(true);
          setTimeout(() => { if (mountedRef.current) setFlashActive(false); }, 200);
          captureSnapshot();
        }
      } else {
        if (mountedRef.current) setCountdown(current);
      }
    }, 1000);
  }, [countdown, captureSnapshot]);

  // ── Retake ─────────────────────────────────────────────────────────────────
  const retake = useCallback(() => {
    setCapturedImage(null);
    setCountdown(null);
    startStream();
  }, [startStream]);

  // ── Confirm ───────────────────────────────────────────────────────────────
  const confirmCapture = useCallback(() => {
    if (capturedImage) onCapture(capturedImage);
  }, [capturedImage, onCapture]);

  // ── Close handler ─────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  if (!open) return null;

  const isMirrored = mode === "selfie";
  const hasSwitchButton = cameras.length > 1 || isMobileDevice();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden flex flex-col"
        style={{ maxHeight: "95dvh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center">
              <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">

          {/* Error */}
          {cameraError && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">{cameraError}</p>
                <button
                  onClick={() => startStream()}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* Preview */}
          {!cameraError && (
            <div
              className="relative rounded-2xl overflow-hidden bg-black border border-slate-200/20 dark:border-slate-700/30 shadow-inner w-full"
              style={{ aspectRatio: "4/3" }}
            >
              {!capturedImage && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn("w-full h-full object-cover", isMirrored && "scale-x-[-1]")}
                  />

                  {/* Loading spinner */}
                  {!streamReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                        <p className="text-white/80 text-xs font-semibold tracking-wide">Starting camera…</p>
                      </div>
                    </div>
                  )}

                  {/* Alignment guides */}
                  {streamReady && (
                    <div className="absolute inset-0 pointer-events-none">
                      {mode === "selfie" ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="border-2 border-dashed border-white/35 rounded-full"
                            style={{ width: "46%", height: "70%" }} />
                        </div>
                      ) : (
                        <div className="absolute inset-5 border-2 border-dashed border-white/30 rounded-xl" />
                      )}
                      {/* Corner marks */}
                      {[
                        "top-3 left-3 border-t-2 border-l-2 rounded-tl-lg",
                        "top-3 right-3 border-t-2 border-r-2 rounded-tr-lg",
                        "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg",
                        "bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg",
                      ].map((cls, i) => (
                        <div key={i} className={`absolute w-5 h-5 border-white/50 ${cls}`} />
                      ))}
                    </div>
                  )}

                  {/* Device selector */}
                  {streamReady && cameras.length > 1 && (
                    <div className="absolute top-3 left-3 z-20">
                      <select
                        value={activeCameraId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setActiveCameraId(id);
                          startStream(id);
                        }}
                        className="bg-black/70 text-white text-[11px] font-semibold border border-white/20 rounded-lg px-2 py-1.5 focus:outline-none backdrop-blur-sm max-w-[140px] truncate"
                      >
                        {cameras.map((cam, i) => (
                          <option key={cam.deviceId} value={cam.deviceId} className="bg-slate-900">
                            {labelCamera(cam, i)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Switch button */}
                  {streamReady && hasSwitchButton && (
                    <button
                      onClick={switchCamera}
                      disabled={switching}
                      type="button"
                      className="absolute top-3 right-3 z-20 bg-black/70 hover:bg-black/90 text-white px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-1.5 text-[11px] font-semibold backdrop-blur-sm transition-all disabled:opacity-50"
                    >
                      {switching
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <ArrowLeftRight className="w-3.5 h-3.5" />}
                      <span className="hidden xs:inline">Switch</span>
                    </button>
                  )}

                  {/* Countdown */}
                  {countdown !== null && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                      <span
                        key={countdown}
                        className="text-white font-black leading-none camera-countdown-number"
                        style={{ fontSize: "clamp(80px,20vw,120px)", textShadow: "0 0 60px rgba(99,102,241,0.9)" }}
                      >
                        {countdown}
                      </span>
                    </div>
                  )}

                  {/* Flash */}
                  {flashActive && (
                    <div className="absolute inset-0 bg-white z-40 camera-flash" />
                  )}
                </>
              )}

              {/* Captured preview */}
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured photo"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}

          {/* Hint */}
          {hint && !capturedImage && (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-medium">{hint}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-6 pt-3 flex-shrink-0 space-y-2.5 border-t border-slate-100 dark:border-slate-800">
          {!capturedImage ? (
            <button
              onClick={triggerCountdown}
              disabled={!!cameraError || !streamReady || countdown !== null}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/20 disabled:shadow-none min-h-[56px] text-sm"
            >
              {countdown !== null ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Capturing in {countdown}…</>
              ) : !streamReady && !cameraError ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Starting camera…</>
              ) : (
                <><Camera className="w-5 h-5" /> {captureLabel}</>
              )}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={retake}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-colors min-h-[56px] text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Retake
              </button>
              <button
                onClick={confirmCapture}
                className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 min-h-[56px] text-sm"
              >
                <Camera className="w-4 h-4" /> Use Photo
              </button>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
