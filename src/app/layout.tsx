import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from '@/hooks/useAuth';
import { SWRProvider } from '@/components/SWRProvider';
import ToastProvider from '@/components/ToastProvider';

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
  icons: {
    icon: "/Logos/Rounded150.png",
    apple: "/Logos/Rounded150.png",
  },
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=TikTok+Sans:opsz,wdth,wght@12..36,100,300..900&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://use.typekit.net/ioz6eoq.css" />
        <link rel="icon" href="/Logos/Rounded150.png" type="image/png" />
        <link rel="apple-touch-icon" href="/Logos/Rounded150.png" />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-N72HXY4YR2"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-N72HXY4YR2');
          `}
        </Script>
        <SWRProvider>
          <AuthProvider>
            <ToastProvider />
            {children}
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
