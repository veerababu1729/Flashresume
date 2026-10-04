"use client";

import { useEffect, useState } from "react";
import {
  isInstagramBrowser,
  getPlatform,
  handleInstagramRedirect,
  redirectAndroid,
  redirectIOS,
} from "@/lib/instagramRedirect";

const DESTINATION = "https://flashresume.in";

export default function OpenPage() {
  const [phase, setPhase] = useState<"redirecting" | "fallback" | "passthrough">("redirecting");
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");

  useEffect(() => {
    const dest = DESTINATION;
    const inInsta = isInstagramBrowser();
    const plat = getPlatform();
    setPlatform(plat);

    // Not in Instagram → just go to home immediately
    if (!inInsta) {
      window.location.replace(dest);
      return;
    }

    // Fire the redirect
    const handled = handleInstagramRedirect(dest);

    if (handled) {
      // Give it 2.5s to work, then show fallback UI if user is still here
      setTimeout(() => {
        setPhase("fallback");
      }, 2500);
    } else {
      // Unknown platform inside Instagram — show fallback immediately
      setPhase("fallback");
    }
  }, []);

  // Non-instagram users see nothing — instant redirect
  if (phase === "passthrough") return null;

  return (
    <div style={styles.root}>
      {/* Animated background orbs */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>⚡</span>
          <span style={styles.logoText}>FlashResume</span>
        </div>

        {phase === "redirecting" && (
          <>
            <div style={styles.spinnerWrap}>
              <div style={styles.spinner} />
            </div>
            <h1 style={styles.heading}>Opening in your browser…</h1>
            <p style={styles.sub}>
              {platform === "ios"
                ? "A dialog should appear — tap \"Open\" to continue."
                : "Launching your default browser automatically…"}
            </p>
          </>
        )}

        {phase === "fallback" && (
          <>
            <div style={styles.globeIcon}>🌐</div>
            <h1 style={styles.heading}>Open in your browser</h1>
            <p style={styles.sub}>
              For the best experience and 1-tap Google login, open FlashResume in your default browser.
            </p>

            {platform === "ios" && (
              <div style={styles.steps}>
                <div style={styles.step}>
                  <span style={styles.stepNum}>1</span>
                  <span>Tap the <strong style={styles.bold}>•••</strong> icon at the top right</span>
                </div>
                <div style={styles.step}>
                  <span style={styles.stepNum}>2</span>
                  <span>Select <strong style={styles.bold}>"Open in External Browser"</strong></span>
                </div>
              </div>
            )}

            <div style={styles.btnGroup}>
              {/* Primary: try scheme redirect again manually */}
              <button
                style={styles.primaryBtn}
                onClick={() => {
                  setPhase("redirecting");
                  if (platform === "android") {
                    redirectAndroid(DESTINATION);
                  } else {
                    redirectIOS(DESTINATION);
                  }
                  setTimeout(() => setPhase("fallback"), 2500);
                }}
              >
                🔗 Open in Browser
              </button>

              {/* Fallback: just go to the site in Instagram browser */}
              <button
                style={styles.secondaryBtn}
                onClick={() => (window.location.href = DESTINATION)}
              >
                Continue here instead
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(30px, -30px) scale(1.1); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

// ─── Inline styles ──────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'Inter', sans-serif",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #060f0d 0%, #0a1a16 50%, #060d0b 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    position: "relative",
    overflow: "hidden",
  },
  orb1: {
    position: "absolute",
    top: "-10%",
    right: "-5%",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,201,167,0.18) 0%, transparent 70%)",
    animation: "float1 8s ease-in-out infinite",
    pointerEvents: "none",
  },
  orb2: {
    position: "absolute",
    bottom: "-10%",
    left: "-5%",
    width: "350px",
    height: "350px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,168,150,0.14) 0%, transparent 70%)",
    animation: "float2 10s ease-in-out infinite",
    pointerEvents: "none",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    padding: "40px 32px",
    maxWidth: "380px",
    width: "100%",
    textAlign: "center",
    animation: "fadeIn 0.5s ease forwards",
    boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
    zIndex: 1,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "28px",
  },
  logoIcon: {
    fontSize: "22px",
  },
  logoText: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "-0.3px",
  },
  spinnerWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "24px",
  },
  spinner: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    border: "3px solid rgba(0,201,167,0.2)",
    borderTopColor: "#00C9A7",
    animation: "spin 0.9s linear infinite",
  },
  globeIcon: {
    fontSize: "52px",
    marginBottom: "16px",
    animation: "pulse 2s ease-in-out infinite",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 12px",
    lineHeight: 1.3,
  },
  sub: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.6,
    margin: "0 0 24px",
  },
  steps: {
    background: "rgba(0,201,167,0.07)",
    border: "1px solid rgba(0,201,167,0.2)",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "24px",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "14px",
    color: "rgba(255,255,255,0.75)",
  },
  stepNum: {
    minWidth: "26px",
    height: "26px",
    background: "linear-gradient(135deg, #00C9A7, #00A896)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
    color: "#fff",
  },
  bold: {
    color: "#fff",
    fontWeight: 600,
  },
  btnGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #00C9A7 0%, #008F7A 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "14px 24px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    letterSpacing: "-0.2px",
    transition: "opacity 0.2s",
  },
  secondaryBtn: {
    background: "transparent",
    color: "rgba(255,255,255,0.4)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s",
  },
};
