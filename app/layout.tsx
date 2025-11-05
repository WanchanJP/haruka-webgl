import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Haruka WebGL',
  description: 'Unity WebGL integration with Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
