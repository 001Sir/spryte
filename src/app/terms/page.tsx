import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Spryte Games — rules for using our website and games.',
  alternates: {
    canonical: 'https://sprytegames.com/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted text-sm mb-8">Last updated: February 17, 2026</p>

      <div className="space-y-8 text-foreground/90 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">Acceptance of Terms</h2>
          <p>
            By accessing and using{' '}
            <Link href="/" className="text-accent hover:underline">SpryteGames.com</Link>{' '}
            (&quot;the Site&quot;), you agree to be bound by these Terms of Service. If you do not
            agree to these terms, please do not use the Site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Use of the Site</h2>
          <p className="mb-2">You agree to use the Site only for lawful purposes. You may not:</p>
          <ul className="list-disc list-inside space-y-1 text-muted">
            <li>Use the Site in any way that violates applicable laws or regulations</li>
            <li>Attempt to interfere with the proper functioning of the Site</li>
            <li>Attempt to gain unauthorized access to any part of the Site</li>
            <li>Use automated tools to scrape or extract content from the Site</li>
            <li>Reproduce, distribute, or create derivative works from our games without permission</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Intellectual Property</h2>
          <p>
            All games, content, graphics, and code on SpryteGames.com are the property of
            Spryte Games or its licensors and are protected by copyright and intellectual
            property laws. You may play our games for personal, non-commercial use only.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Free Games</h2>
          <p>
            All games on Spryte Games are provided free of charge. We reserve the right to
            modify, suspend, or discontinue any game or feature at any time without prior notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Disclaimer of Warranties</h2>
          <p>
            The Site and all games are provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind, either express or implied. We do not guarantee that the
            Site will be uninterrupted, error-free, or free of viruses or other harmful
            components.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Spryte Games shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages arising out of
            or relating to your use of the Site or our games.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms of Service at any time. Changes will be
            effective immediately upon posting to the Site. Your continued use of the Site
            constitutes acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Contact Us</h2>
          <p>
            If you have questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:contact@sprytegames.com" className="text-accent hover:underline">contact@sprytegames.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
