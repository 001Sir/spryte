// Score Card Generator — Canvas-based OG image generation for sharing

export interface ScoreCardOptions {
  gameTitle: string;
  score: number;
  isNewHigh: boolean;
  gameColor: string;
  achievementCount?: number;
}

export async function generateScoreCard(options: ScoreCardOptions): Promise<Blob> {
  const { gameTitle, score, isNewHigh, gameColor, achievementCount } = options;

  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#06050e';
  ctx.fillRect(0, 0, W, H);

  // Subtle gradient
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
  grad.addColorStop(0, `${gameColor}15`);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // Accent line at top
  ctx.fillStyle = gameColor;
  ctx.fillRect(20, 20, W - 40, 4);

  // "Spryte Games" branding
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#9896a8';
  ctx.textAlign = 'left';
  ctx.fillText('SPRYTE GAMES', 60, 80);

  // Game title
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillStyle = '#eeedf5';
  ctx.textAlign = 'center';
  ctx.fillText(gameTitle, W / 2, H / 2 - 60);

  // Score
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.fillStyle = gameColor;
  ctx.fillText(score.toLocaleString(), W / 2, H / 2 + 60);

  // New high score badge
  if (isNewHigh) {
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 110);
  }

  // Achievement badges
  if (achievementCount && achievementCount > 0) {
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(`${achievementCount} achievements earned`, W / 2, H - 80);
  }

  // Bottom branding
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#706f82';
  ctx.textAlign = 'center';
  ctx.fillText('sprytegames.com', W / 2, H - 45);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png');
  });
}
