import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const supabaseOrigin = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!supabaseUrl) return "";

  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return "";
  }
})();

const supabaseRealtimeOrigin = supabaseOrigin
  .replace(/^https:/, "wss:")
  .replace(/^http:/, "ws:");

const buildContentSecurityPolicy = () => {
  const connectSrc = [
    "'self'",
    supabaseOrigin,
    supabaseRealtimeOrigin,
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://analytics.google.com",
    "https://stats.g.doubleclick.net",
    "https://api.mixpanel.com",
    "https://api-js.mixpanel.com",
    isDevelopment ? "ws:" : "",
    isDevelopment ? "wss:" : "",
  ];

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com https://kauth.kakao.com",
    `script-src 'self' 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : ""} blob: https://www.googletagmanager.com https://www.google-analytics.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc.filter(Boolean).join(" ")}`,
    "media-src 'self' blob: data:",
    "frame-src 'self' https://accounts.google.com https://kauth.kakao.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.map((directive) => directive.replace(/\s+/g, " ").trim()).join("; ");
};

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
