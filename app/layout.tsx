import './globals.css'
import type { Metadata } from 'next'
import { Pontano_Sans } from 'next/font/google'
import { TypekitLoader } from '@/components/typekit-loader'
import { ToastProvider } from '@/components/providers/toaster-provider'
import { ConfettiProvider } from '@/components/providers/confetti-provider'

const pontanoSans = Pontano_Sans({ 
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Continuing Professional Education (CPE)',
  description: 'Continuing Professional Education training platform for educators.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={pontanoSans.className}>
        <TypekitLoader />
        <ConfettiProvider />
        <ToastProvider />
        {children}
      </body>
    </html>
  )
}
