import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Opening FlashResume | Flashresume",
  description: "Redirecting you to FlashResume in your default browser for the best experience.",
  robots: {
    index: false,   // Don't index this utility page
    follow: false,
  },
};

export default function OpenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
