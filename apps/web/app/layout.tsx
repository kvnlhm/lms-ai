import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NotifierProvider } from './components/notifier';
import './styles.css';

export const metadata: Metadata = {
  title: 'LMS AIPrenuer',
  description: 'Platform pembelajaran coding, AI, bisnis, marketing, dan kesiapan kerja.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <NotifierProvider>{children}</NotifierProvider>
      </body>
    </html>
  );
}
