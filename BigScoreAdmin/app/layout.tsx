import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthGate } from "@/contexts/AuthGate";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BigScore Admin Panel",
  description:
    "Admin dashboard for managing the BigScore iOS app content and configuration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={
          inter.className + " bg-bg-primary text-text-primary antialiased"
        }
      >
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
