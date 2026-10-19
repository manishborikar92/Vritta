import { BRAND } from '@/lib/constants/brand';

export const metadata = {
  title: 'Sign In',
  description: `Sign in to ${BRAND.name} to cultivate mindful consistency and calm daily rhythms.`,
  alternates: {
    canonical: '/login',
  },
  openGraph: {
    title: `Sign In | ${BRAND.name}`,
    description: `Sign in to ${BRAND.name} to cultivate mindful consistency and calm daily rhythms.`,
    url: '/login',
    siteName: BRAND.name,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `Sign In | ${BRAND.name}`,
    description: `Sign in to ${BRAND.name} to cultivate mindful consistency and calm daily rhythms.`,
  },
};

/**
 * Layout for authentication routes (login, etc.)
 * Minimal layout without BottomNav, styled with semantic canvas tokens.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-canvas text-main transition-colors">
      {children}
    </div>
  );
}
