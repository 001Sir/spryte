import type { Metadata } from 'next';
import Link from 'next/link';
import FaqAccordion from './FaqAccordion';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about Spryte Games — free browser games, accounts, scoring, offline play, and more.',
};

const faqs = [
  {
    question: 'Do I need an account to play?',
    answer: 'No! Spryte Games requires no sign-up, login, or account creation. Just open the site and play. Your scores and progress are saved locally in your browser.',
  },
  {
    question: 'Are the games really free?',
    answer: 'Yes, all games on Spryte Games are completely free to play. There are no microtransactions, premium content, or hidden fees.',
  },
  {
    question: 'How are my scores saved?',
    answer: 'All scores, favorites, statistics, and achievements are stored in your browser\'s localStorage. This means your data stays on your device and is never sent to any server. If you clear your browser data, your progress will be reset.',
  },
  {
    question: 'Can I play offline?',
    answer: 'Yes! Once you\'ve visited Spryte Games, the site is cached by your browser\'s service worker. You can play all games without an internet connection. You can also install it as a PWA (Progressive Web App) from your browser for an app-like experience.',
  },
  {
    question: 'What are daily challenges?',
    answer: 'Every day, a new challenge is generated for a specific game with a target to meet (like scoring a certain number of points or reaching a specific level). Complete challenges to build streaks and earn special achievements.',
  },
  {
    question: 'How do achievements work?',
    answer: 'There are 30+ achievements across per-game challenges, cross-game milestones, and meta achievements. They unlock automatically as you play. Visit the Achievements page to see your progress and discover what\'s available.',
  },
  {
    question: 'Do the games work on mobile?',
    answer: 'Yes! All games are designed to be responsive and work on mobile devices. Many games have touch controls. For the best experience on games that use keyboard controls, we recommend a desktop or laptop.',
  },
  {
    question: 'What technology do the games use?',
    answer: 'All games are built with HTML5 Canvas and the Web Audio API. Sound effects are procedurally generated — no audio files are loaded. The site is built with Next.js and React.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="max-w-[800px] mx-auto px-4 sm:px-10 py-24">
        <nav className="flex items-center gap-2 text-sm text-dim mb-8" aria-label="Breadcrumbs">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground">FAQ</span>
        </nav>

        <h1 className="text-3xl font-bold mb-2">Frequently Asked Questions</h1>
        <p className="text-muted mb-10">Everything you need to know about Spryte Games.</p>

        <FaqAccordion faqs={faqs} />
      </div>
    </>
  );
}
