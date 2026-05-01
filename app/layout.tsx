import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AuthProvider } from "@/context/AuthContext";
import { BgmProvider } from "@/context/BgmContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qraft - 질문으로 시작하는 사유",
  description: "질문으로 시작하는 사유",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preload" as="audio" href="/bgm.mp3" type="audio/mpeg" />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <BgmProvider>{children}</BgmProvider>
        </AuthProvider>
      </body>
      <GoogleAnalytics gaId="G-T3TCC34TS8" />
    </html>
  );
}
