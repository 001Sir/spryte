import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

export interface GameManifest {
  slug: string;
  component: ReturnType<typeof dynamic<ComponentType>>;
}

// Auto-registry for all games — adding a new game only requires adding a folder + data entry
const registry: GameManifest[] = [
  { slug: 'gravity-well', component: dynamic(() => import('./gravity-well/GravityWellGame'), { ssr: false }) },
  { slug: 'chroma-flood', component: dynamic(() => import('./chroma-flood/ChromaFloodGame'), { ssr: false }) },
  { slug: 'echo-chamber', component: dynamic(() => import('./echo-chamber/EchoChamberGame'), { ssr: false }) },
  { slug: 'terravore', component: dynamic(() => import('./terravore/TerravoreGame'), { ssr: false }) },
  { slug: 'pulse-weaver', component: dynamic(() => import('./pulse-weaver/PulseWeaverGame'), { ssr: false }) },
  { slug: 'orbit-keeper', component: dynamic(() => import('./orbit-keeper/OrbitKeeperGame'), { ssr: false }) },
  { slug: 'symbiosis', component: dynamic(() => import('./symbiosis/SymbiosisGame'), { ssr: false }) },
  { slug: 'drift', component: dynamic(() => import('./drift/DriftGame'), { ssr: false }) },
  { slug: 'spectrum', component: dynamic(() => import('./spectrum/SpectrumGame'), { ssr: false }) },
  { slug: 'deja-vu', component: dynamic(() => import('./deja-vu/DejaVuGame'), { ssr: false }) },
  { slug: 'slide-devil', component: dynamic(() => import('./slide-devil/SlideDevilGame'), { ssr: false }) },
  { slug: 'whats-missing', component: dynamic(() => import('./whats-missing/WhatsMissingGame'), { ssr: false }) },
  { slug: 'cascade', component: dynamic(() => import('./cascade/CascadeGame'), { ssr: false }) },
  { slug: 'ricochet', component: dynamic(() => import('./ricochet/RicochetGame'), { ssr: false }) },
  { slug: 'burn', component: dynamic(() => import('./burn/BurnGame'), { ssr: false }) },
  { slug: 'rift', component: dynamic(() => import('./rift/RiftGame'), { ssr: false }) },
];

const registryMap = new Map(registry.map((r) => [r.slug, r]));

export function getGameComponent(slug: string) {
  return registryMap.get(slug)?.component ?? null;
}

export function getAllRegisteredSlugs(): string[] {
  return registry.map((r) => r.slug);
}

export default registry;
