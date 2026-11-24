import type { Metadata } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

// Pixel font (SIL Open Font License), only for titles and big numbers.
const pixel = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Retro Quest',
  description: 'Run your sprint retrospective as a cosy fantasy adventure.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>{children}</body>
    </html>
  );
}
