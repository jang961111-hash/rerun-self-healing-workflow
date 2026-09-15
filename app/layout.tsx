import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RE:RUN — 스스로 고치는 업무 자동화",
  description:
    "자연어로 정의한 반복업무가 실패하면 AI가 진단하고 수정안을 제안, 사람의 승인으로만 적용되는 자가수정 워크플로우 엔진",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
