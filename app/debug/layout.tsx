import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Debug | Haruka WebGL",
  description: "Unity WebGL integration debug and verification pages",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DebugLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
