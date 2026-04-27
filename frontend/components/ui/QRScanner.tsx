"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { X, Camera } from "lucide-react";

interface QRScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
    onTimeout: () => void;
}

const TIMEOUT_SECONDS = 120;

export default function QRScanner({ onScan, onClose, onTimeout }: QRScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number>(0);
    const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);
    const [cameraError, setCameraError] = useState("");
    const [started, setStarted] = useState(false);

    const stopAll = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        if (timeoutRef.current) clearInterval(timeoutRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

    const handleClose = useCallback(() => {
        stopAll();
        onClose();
    }, [stopAll, onClose]);

    useEffect(() => {
        let countdownInterval: ReturnType<typeof setInterval>;

        const start = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setStarted(true);

                // Countdown
                countdownInterval = setInterval(() => {
                    setSecondsLeft(s => {
                        if (s <= 1) {
                            clearInterval(countdownInterval);
                            stopAll();
                            onTimeout();
                            return 0;
                        }
                        return s - 1;
                    });
                }, 1000);

                // Frame scan loop
                const scan = () => {
                    const video = videoRef.current;
                    const canvas = canvasRef.current;
                    if (!video || !canvas) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;

                    if (video.readyState === video.HAVE_ENOUGH_DATA) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert",
                        });
                        if (code?.data) {
                            clearInterval(countdownInterval);
                            stopAll();
                            onScan(code.data);
                            return;
                        }
                    }
                    rafRef.current = requestAnimationFrame(scan);
                };
                rafRef.current = requestAnimationFrame(scan);

            } catch {
                setCameraError("Camera access denied — please allow camera permission and try again.");
            }
        };

        void start();

        return () => {
            clearInterval(countdownInterval);
            stopAll();
        };
    }, [stopAll, onScan, onTimeout]);

    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-900">Scan QR Code</span>
                    </div>
                    <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Camera / Error */}
                <div className="relative bg-black aspect-square">
                    {cameraError ? (
                        <div className="absolute inset-0 flex items-center justify-center p-6">
                            <p className="text-white text-center text-sm font-medium">{cameraError}</p>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                playsInline
                                muted
                            />
                            {/* Scan frame overlay */}
                            {started && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-48 h-48 border-2 border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                                </div>
                            )}
                        </>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Timer + hint */}
                <div className="px-6 py-4 flex items-center justify-between">
                    <p className="text-[10px] font-medium text-slate-500">Point camera at provider&apos;s QR code</p>
                    <span className={`text-sm font-black tabular-nums ${secondsLeft <= 30 ? "text-rose-500" : "text-slate-700"}`}>
                        {mm}:{ss}
                    </span>
                </div>
            </div>
        </div>
    );
}
