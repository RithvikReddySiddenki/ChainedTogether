'use client';

import { Canvas } from '@react-three/fiber';
import GlobeScene from './GlobeScene';

interface GlobeCanvasProps {
  stage: string;
  progress: number;
}

export default function GlobeCanvas({ stage, progress }: GlobeCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 6], fov: 50, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#070b14']} />
      <fog attach="fog" args={['#070b14', 8, 20]} />
      <GlobeScene stage={stage} progress={progress} />
    </Canvas>
  );
}
