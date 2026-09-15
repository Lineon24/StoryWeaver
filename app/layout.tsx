import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryWeaver — 캐릭터와 세계관 스튜디오",
  description: "캐릭터의 목소리와 세계의 필연을 지키는 AI 스토리텔링 워크스페이스",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
