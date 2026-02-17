import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Spryte Games — how we handle your data.',
  alternates: {
    canonical: 'https://sprytegames.com/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted text-sm mb-8">Last updated: February 17, 2026</p>

      <div className="space-y-8 text-foreground/90 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">Introduction</h2>
          <p>
            Spryte Games (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the website{' '}
            <Link href="/" className="text-accent hover:underline">SpryteGames.com</Link>.
            This Privacy Policy explains how we collect, use, and protect information when you
            visit our website and play our games.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Information We Collect</h2>
          <p className="mb-2">We collect minimal information to provide and improve our services:</p>
          <ul className="list-disc list-inside space-y-1 text-muted">
            <li><strong className="text-foreground/90">Usage Data:</strong> Pages visited, games played, time spent, browser type, device type, and referring URL.</li>
            <li><strong className="text-foreground/90">Local Storage:</strong> Game preferences and recently played games are stored locally on your device and are not transmitted to our servers.</li>
            <li><strong className="text-foreground/90">Cookies:</strong> We use essential cookies for site functionality, such as remembering your preferences.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">How We Use Information</h2>
          <ul className="list-disc list-inside space-y-1 text-muted">
            <li>To provide, maintain, and improve our games and website</li>
            <li>To detect and prevent technical issues</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Third-Party Services</h2>
          <p>
            We do not currently use third-party analytics services. If this changes in the
            future, we will update this policy accordingly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Children&apos;s Privacy</h2>
          <p>
            Our games are designed to be enjoyed by all ages. We do not knowingly collect
            personal information from children under 13. If you believe we have collected
            information from a child under 13, please contact us so we can promptly remove it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Data Security</h2>
          <p>
            We implement appropriate security measures to protect against unauthorized access,
            alteration, or destruction of data. However, no method of transmission over the
            Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any
            changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:contact@sprytegames.com" className="text-accent hover:underline">contact@sprytegames.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
