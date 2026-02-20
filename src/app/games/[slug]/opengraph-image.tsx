import { ImageResponse } from 'next/og';
import { getGameBySlug, games } from '@/data/games';

export const alt = 'Game preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#06050e',
            color: '#eeedf5',
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Spryte Games
        </div>
      ),
      { ...size }
    );
  }

  const categoryColors: Record<string, string> = {
    Action: '#e94560',
    Arcade: '#f59e0b',
    Physics: '#0ea5e9',
    Puzzle: '#7c3aed',
    Strategy: '#10b981',
  };

  const difficultyColors: Record<string, string> = {
    Easy: '#4ade80',
    Medium: '#f59e0b',
    Hard: '#e94560',
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 70px',
          background: '#06050e',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: game.color,
          }}
        />

        {/* Decorative gradient blob */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: `${game.color}15`,
            filter: 'blur(80px)',
          }}
        />

        {/* Top section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Categories + Difficulty */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {game.categories.map((cat) => (
              <div
                key={cat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  background: `${categoryColors[cat] || '#e94560'}20`,
                  border: `1px solid ${categoryColors[cat] || '#e94560'}40`,
                  color: categoryColors[cat] || '#e94560',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {cat}
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '20px',
                background: `${difficultyColors[game.difficulty] || '#9896a8'}15`,
                border: `1px solid ${difficultyColors[game.difficulty] || '#9896a8'}30`,
                color: difficultyColors[game.difficulty] || '#9896a8',
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {game.difficulty}
            </div>
          </div>

          {/* Game title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: '#eeedf5',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              maxWidth: '900px',
            }}
          >
            {game.title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 24,
              color: '#9896a8',
              lineHeight: 1.5,
              maxWidth: '800px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {game.description}
          </div>
        </div>

        {/* Bottom section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#e94560',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              S
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#eeedf5' }}>
              Spryte Games
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 32px',
              borderRadius: '14px',
              background: '#e94560',
              color: 'white',
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play Free Now
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
