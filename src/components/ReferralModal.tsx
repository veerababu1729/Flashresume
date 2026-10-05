"use client";
import { useState } from "react";
import { X, Gift, Copy, Check, Mail, Share2 } from "lucide-react";

interface Props {
  referralCode: string;
  onClose: () => void;
}

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

/** True only on real touch phones/tablets (iOS Safari / Android Chrome). */
function isRealMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function ReferralModal({ referralCode, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${referralCode}`
      : "";

  const shareText =
    "I used Flashresume to rebuild my resume in 60 seconds! Must try.";

  const handleCopy = async () => {
    try {
      await copyToClipboard(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: "Flashresume", text: shareText, url });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  };

  const mobile = isRealMobile();

  const shareOptions = [
    {
      label: "WhatsApp",
      icon: (
        <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
          <circle cx="16" cy="16" r="16" fill="#25D366" />
          <path
            d="M22.9 9.1A9.7 9.7 0 0 0 16 6.3a9.7 9.7 0 0 0-8.4 14.6L6 26l5.2-1.6A9.7 9.7 0 0 0 16 25.7a9.7 9.7 0 0 0 9.7-9.7 9.7 9.7 0 0 0-2.8-6.9zm-6.9 14.9a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.9.9-3-.2-.3a8 8 0 1 1 6.8 3.7zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7 7 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3a3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.5 4 5 5 0 0 0 2.9.5c.6-.1 1.4-.5 1.6-1 .2-.5.2-.9.1-1l-.6-.3z"
            fill="#fff"
          />
        </svg>
      ),
      href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + url)}`,
      bg: "hover:bg-green-50",
      border: "border-green-200",
    },
    {
      label: "Email",
      icon: <Mail className="w-7 h-7 text-blue-500" />,
      href: `mailto:?subject=${encodeURIComponent("Try Flashresume!")}&body=${encodeURIComponent(shareText + "\n\n" + url)}`,
      bg: "hover:bg-blue-50",
      border: "border-blue-200",
    },
    {
      label: "Twitter / X",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      ),
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
      bg: "hover:bg-gray-50",
      border: "border-gray-200",
    },
    {
      label: "LinkedIn",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.997 23.227 23.997 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      bg: "hover:bg-blue-50",
      border: "border-blue-100",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm mx-auto relative text-center">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-5 mt-2">
          <div className="mx-auto w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <Gift className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-bold text-xl text-gray-800 mb-2 leading-tight">
            Share &amp; get 100 bonus credits free
          </h3>
          <p className="text-sm text-gray-500 px-2">
            Invite friends to Flashresume. You get 100 free credits when they
            download their first resume!
          </p>
        </div>

        {/* Share icon grid — always shown */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {shareOptions.map((opt) => (
            <a
              key={opt.label}
              href={opt.href}
              target="_blank"
              rel="noopener noreferrer"
              title={opt.label}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border ${opt.border} ${opt.bg} transition-all active:scale-95`}
            >
              {opt.icon}
              <span className="text-[10px] font-medium text-gray-600 leading-tight">
                {opt.label}
              </span>
            </a>
          ))}
        </div>

        {/* Copy link row — always shown */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 mb-3">
          <span className="flex-1 text-xs text-gray-500 truncate text-left">
            {url}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary
                       bg-primary/10 hover:bg-primary/20 active:scale-95
                       transition-all px-3 py-1.5 rounded-lg shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Native share button — only on real iOS/Android */}
        {mobile && typeof navigator.share === "function" && (
          <button
            onClick={handleNativeShare}
            className="w-full flex items-center justify-center gap-2 border border-gray-200
                       text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50
                       active:scale-95 transition-all text-sm"
          >
            <Share2 className="w-4 h-4" />
            More apps…
          </button>
        )}
      </div>
    </div>
  );
}
