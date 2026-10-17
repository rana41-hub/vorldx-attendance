import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Building2,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { QRSession } from '../../types';

export const KioskPage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [session, setSession] = useState<QRSession | null>(null);
  const [officeCode] = useState('HQ_MAIN');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 1. Live Digital Clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fetch Active Session from server
  const fetchActiveSession = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRotating(true);
    setErrorMessage(null);
    try {
      const data = await api.getActiveQRSession(officeCode);
      setSession(data);

      // Compute precise seconds remaining based on server expires_at
      const expiryMs = new Date(data.expires_at).getTime();
      const diffSec = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setSecondsRemaining(diffSec);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to connect to VorldX Attendance API. Reconnecting...';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRotating(false);
    }
  }, [officeCode]);

  // Initial load
  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  // 3. Force Rotate Session
  const handleForceRotate = async () => {
    setIsRotating(true);
    setErrorMessage(null);
    try {
      const data = await api.rotateQRSession(officeCode, 30);
      setSession(data);
      const expiryMs = new Date(data.expires_at).getTime();
      const diffSec = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setSecondsRemaining(diffSec);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : 'Failed to rotate QR session.'
      );
    } finally {
      setIsRotating(false);
    }
  };

  // 4. Server-driven Expiration Countdown & Auto-Refresh
  useEffect(() => {
    if (!session || errorMessage) return;

    const interval = setInterval(() => {
      const expiryMs = new Date(session.expires_at).getTime();
      const diff = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setSecondsRemaining(diff);

      // When expired, refresh safely from server
      if (diff <= 0) {
        clearInterval(interval);
        fetchActiveSession();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [session, errorMessage, fetchActiveSession]);

  // 5. Automatic retry on error every 4 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const retryTimer = setTimeout(() => {
      fetchActiveSession();
    }, 4000);
    return () => clearTimeout(retryTimer);
  }, [errorMessage, fetchActiveSession]);

  // 6. Draw QR code onto canvas
  useEffect(() => {
    if (!canvasRef.current || !session || secondsRemaining <= 0 || errorMessage) {
      return;
    }

    QRCode.toCanvas(canvasRef.current, session.qr_code_payload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0F172A', // Slate 900
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    }).catch((err) => {
      console.error('QR Render Error:', err);
    });
  }, [session, secondsRemaining, errorMessage]);

  // 7. Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Format time and date
  const timeFormatted = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateFormatted = currentTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate circular countdown stroke
  const totalDuration = 30;
  const progressRatio = Math.min(1, Math.max(0, secondsRemaining / totalDuration));
  const strokeDashoffset = 100 - progressRatio * 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-medium cursor-pointer"
            title="Return to Admin Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Admin Portal</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">
                VorldX Attendance Kiosk
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Office Check-in Terminal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Digital Clock & Office Badge */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="font-mono text-base font-bold text-white tracking-wider">
              {timeFormatted}
            </span>
            <span className="text-[11px] text-slate-400">{dateFormatted}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
            <span className="text-slate-500">Location:</span>
            <span className="font-mono text-indigo-400 font-semibold">{officeCode}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Center Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 max-w-4xl mx-auto w-full">
        {/* Terminal Title & Subtitle */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs font-medium mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>High-Security Dynamic QR Protocol</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
            Scan to Record Attendance
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Point your VorldX Employee Mobile App camera at the QR code below. Code automatically rotates every 30 seconds to prevent replay.
          </p>
        </div>

        {/* Central Display Card */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col items-center w-full max-w-md transition-all">
          {/* QR Display Container */}
          <div className="relative w-80 h-80 rounded-2xl bg-white p-4 shadow-inner flex items-center justify-center overflow-hidden border-4 border-slate-800/80">
            {/* Active Canvas */}
            <canvas
              ref={canvasRef}
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                isLoading || isRotating || errorMessage || secondsRemaining <= 0
                  ? 'opacity-0 scale-95'
                  : 'opacity-100 scale-100'
              }`}
            />

            {/* Loading / Refreshing Overlay */}
            {(isLoading || isRotating || (secondsRemaining <= 0 && !errorMessage)) && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-slate-200">
                <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
                <p className="font-semibold text-sm text-white">
                  {isLoading
                    ? 'Connecting to Kiosk Subsystem...'
                    : 'Rotating Dynamic QR Code...'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Generating secure one-time challenge
                </p>
              </div>
            )}

            {/* Error / Disconnected Overlay */}
            {errorMessage && (
              <div className="absolute inset-0 bg-rose-950/95 flex flex-col items-center justify-center p-6 text-center text-slate-200">
                <div className="w-12 h-12 rounded-full bg-rose-900/50 flex items-center justify-center mb-3 text-rose-400">
                  <WifiOff className="w-6 h-6 animate-pulse" />
                </div>
                <p className="font-bold text-sm text-white mb-1">
                  Terminal Disconnected
                </p>
                <p className="text-xs text-rose-300/80 mb-4 px-2 line-clamp-2">
                  {errorMessage}
                </p>
                <button
                  onClick={() => fetchActiveSession(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Connection</span>
                </button>
              </div>
            )}
          </div>

          {/* Countdown & Status Bar */}
          <div className="w-full mt-6 flex items-center justify-between pt-4 border-t border-slate-800">
            {/* Circular Progress & Seconds */}
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {/* Track */}
                  <path
                    className="text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Indicator */}
                  <path
                    className={`transition-all duration-300 ${
                      secondsRemaining <= 5
                        ? 'text-rose-500'
                        : secondsRemaining <= 10
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}
                    strokeDasharray="100"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span
                  className={`absolute text-xs font-bold font-mono ${
                    secondsRemaining <= 5
                      ? 'text-rose-400'
                      : secondsRemaining <= 10
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {secondsRemaining}s
                </span>
              </div>

              <div>
                <div className="text-xs font-medium text-white flex items-center gap-1.5">
                  <span>Dynamic Code Validity</span>
                  {errorMessage ? (
                    <span className="text-[10px] text-rose-400">(Offline)</span>
                  ) : (
                    <span className="text-[10px] text-emerald-400">(Active)</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {secondsRemaining > 0
                    ? `Refreshes in ${secondsRemaining} second${secondsRemaining === 1 ? '' : 's'}`
                    : 'Refreshing token...'}
                </div>
              </div>
            </div>

            {/* Manual Rotate Action */}
            <button
              onClick={handleForceRotate}
              disabled={isRotating || isLoading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Force immediate token rotation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
              <span>Rotate</span>
            </button>
          </div>
        </div>

        {/* Step-by-Step Mobile Instructions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mt-6 text-center">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-400 font-bold text-xs flex items-center justify-center mx-auto mb-1">
              1
            </div>
            <div className="text-xs font-medium text-slate-200">Open Mobile App</div>
            <div className="text-[11px] text-slate-400">Log in with Employee ID</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-400 font-bold text-xs flex items-center justify-center mx-auto mb-1">
              2
            </div>
            <div className="text-xs font-medium text-slate-200">Tap Scan Office QR</div>
            <div className="text-[11px] text-slate-400">On your mobile Dashboard</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-400 font-bold text-xs flex items-center justify-center mx-auto mb-1">
              3
            </div>
            <div className="text-xs font-medium text-slate-200">Scan & Check In</div>
            <div className="text-[11px] text-slate-400">Immediate verification</div>
          </div>
        </div>
      </main>

      {/* Bottom Footer Info */}
      <footer className="px-6 py-3 border-t border-slate-900 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>VorldX Enterprise Attendance System</span>
        </div>
        <div>
          Official Office Terminal • Session ID:{' '}
          <span className="font-mono text-slate-300">
            {session?.session_id ?? '---'}
          </span>
        </div>
      </footer>
    </div>
  );
};
export default KioskPage;
