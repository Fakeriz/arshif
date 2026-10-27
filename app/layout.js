import { Manrope } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Arshif — Personal & Business Finance',
  description: 'Multi-currency personal and business finance tracker with AI receipt scanning, voice log, debts, and bills tracking.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Arshif' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  openGraph: {
    title: 'Arshif — Personal & Business Finance',
    description: 'Multi-currency personal and business finance tracker with AI receipt scanning, voice log, debts, and bills tracking.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Arshif — Personal & Business Finance',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arshif — Personal & Business Finance',
    description: 'Multi-currency personal and business finance tracker with AI receipt scanning, voice log, debts, and bills tracking.',
    images: ['/og-image.png'],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // <-- Wajib ada untuk iOS
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F6F6' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={manrope.variable}>
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className={`${manrope.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
