import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/hooks/useAuth';
import { SWRProvider } from '@/components/SWRProvider';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScrollStopper - AI that thinks like a content strategist",
  description: "Upload your product screenshots and let ScrollStopper generate scroll-stopping TikToks in seconds. AI-powered video generation for founders and marketers.",
  keywords: ["AI video generation", "TikTok", "Instagram", "content marketing", "social media", "automation"],
  authors: [{ name: "ScrollStopper" }],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <SWRProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
