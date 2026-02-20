import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Icon Types & Colors ─────────────────────────────────
const ICON_TYPES = [
  { label: 'Creator', symbol: '✦', color: '#ec4899' },    // pink
  { label: 'Developer', symbol: '<>', color: '#22d3ee' },   // cyan
  { label: 'Investor', symbol: '↗', color: '#34d399' },    // emerald
  { label: 'Student', symbol: '◈', color: '#a855f7' },     // purple
  { label: 'Builder', symbol: '⚙', color: '#f59e0b' },     // amber
  { label: 'Community', symbol: '◉', color: '#3b82f6' },   // blue
  { label: 'Music', symbol: '♫', color: '#f43f5e' },       // rose
  { label: 'Gaming', symbol: '⬡', color: '#8b5cf6' },      // violet
  { label: 'Fitness', symbol: '⚡', color: '#06b6d4' },     // cyan-500
  { label: 'Artist', symbol: '◆', color: '#e879f9' },      // fuchsia
];

// ─── Generate Nodes on a Sphere ──────────────────────────
function generateSphereNodes(count, radius) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);
    const type = ICON_TYPES[i % ICON_TYPES.length];
    nodes.push({ position: [x, y, z], ...type, id: i });
  }
  return nodes;
}

// ─── Generate Edges Between Nearby Nodes ─────────────────
function generateEdges(nodes, maxDist) {
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].position[0] - nodes[j].position[0];
      const dy = nodes[i].position[1] - nodes[j].position[1];
      const dz = nodes[i].position[2] - nodes[j].position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < maxDist) {
        edges.push({ from: i, to: j, dist });
      }
    }
  }
  return edges;
}

// ─── Glowing Node (Icon Sphere) ──────────────────────────
function GlobeNode({ position, color, pulseOffset }) {
  const meshRef = useRef();
  const glowRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1 + 0.15 * Math.sin(t * 1.5 + pulseOffset);
    if (meshRef.current) {
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 2.5);
      glowRef.current.material.opacity = 0.12 + 0.08 * Math.sin(t * 1.5 + pulseOffset);
    }
  });

  return (
    <group position={position}>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      {/* Core node */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ─── Connection Lines ────────────────────────────────────
function ConnectionLines({ nodes, edges }) {
  const linesRef = useRef();
  const lineCount = edges.length;

  const geometry = useMemo(() => {
    const positions = new Float32Array(lineCount * 6);
    const colors = new Float32Array(lineCount * 6);

    edges.forEach((edge, i) => {
      const from = nodes[edge.from];
      const to = nodes[edge.to];
      const c1 = new THREE.Color(from.color);
      const c2 = new THREE.Color(to.color);

      positions[i * 6 + 0] = from.position[0];
      positions[i * 6 + 1] = from.position[1];
      positions[i * 6 + 2] = from.position[2];
      positions[i * 6 + 3] = to.position[0];
      positions[i * 6 + 4] = to.position[1];
      positions[i * 6 + 5] = to.position[2];

      colors[i * 6 + 0] = c1.r;
      colors[i * 6 + 1] = c1.g;
      colors[i * 6 + 2] = c1.b;
      colors[i * 6 + 3] = c2.r;
      colors[i * 6 + 4] = c2.g;
      colors[i * 6 + 5] = c2.b;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [nodes, edges, lineCount]);

  useFrame(({ clock }) => {
    if (linesRef.current) {
      linesRef.current.material.opacity = 0.12 + 0.06 * Math.sin(clock.getElapsedTime() * 0.5);
    }
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.15} />
    </lineSegments>
  );
}

// ─── Background Particles ────────────────────────────────
function Particles({ count = 300 }) {
  const ref = useRef();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.01;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.005) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#00ffd5" size={0.015} transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

// ─── Orbiting Icon (for Island scene) ────────────────────
function OrbitingIcon({ angle, radius, speed, color, yOffset = 0 }) {
  const ref = useRef();
  const glowRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + angle;
    if (ref.current) {
      ref.current.position.x = Math.cos(t) * radius;
      ref.current.position.z = Math.sin(t) * radius;
      ref.current.position.y = yOffset + Math.sin(t * 2) * 0.1;
    }
    if (glowRef.current) {
      glowRef.current.position.copy(ref.current.position);
      glowRef.current.material.opacity = 0.1 + 0.05 * Math.sin(t * 3);
    }
  });

  return (
    <>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  );
}

// ─── Light Bridge (Island → orbiting icon) ───────────────
function LightBridge({ targetRef, color }) {
  const lineRef = useRef();

  useFrame(() => {
    if (lineRef.current && targetRef?.current) {
      const pos = lineRef.current.geometry.attributes.position;
      pos.setXYZ(0, 0, 0, 0);
      pos.setXYZ(1, targetRef.current.position.x, targetRef.current.position.y, targetRef.current.position.z);
      pos.needsUpdate = true;
    }
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array(6)}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.15} />
    </line>
  );
}

// ─── Central Island Platform ─────────────────────────────
function Island() {
  const ringRef = useRef();
  const pulseRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.15;
    }
    if (pulseRef.current) {
      const s = 1 + 0.08 * Math.sin(t * 1.2);
      pulseRef.current.scale.setScalar(s);
      pulseRef.current.material.opacity = 0.06 + 0.04 * Math.sin(t * 1.2);
    }
  });

  return (
    <group>
      {/* Base disk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.08, 64]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.9}
          roughness={0.2}
          emissive="#00ffd5"
          emissiveIntensity={0.05}
        />
      </mesh>

      {/* Glowing ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[1.25, 0.015, 16, 100]} />
        <meshBasicMaterial color="#00ffd5" transparent opacity={0.6} />
      </mesh>

      {/* Outer pulse ring */}
      <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <torusGeometry args={[1.6, 0.005, 16, 100]} />
        <meshBasicMaterial color="#00ffd5" transparent opacity={0.08} />
      </mesh>

      {/* Radial pulse planes */}
      {[0, 1, 2, 3].map((i) => (
        <PulseWave key={i} delay={i * 0.8} />
      ))}
    </group>
  );
}

function PulseWave({ delay }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    const t = ((clock.getElapsedTime() + delay) % 3.2) / 3.2;
    if (ref.current) {
      const scale = 1.3 + t * 1.5;
      ref.current.scale.setScalar(scale);
      ref.current.material.opacity = Math.max(0, 0.1 * (1 - t));
    }
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
      <torusGeometry args={[1, 0.003, 8, 80]} />
      <meshBasicMaterial color="#00ffd5" transparent opacity={0.1} />
    </mesh>
  );
}

// ─── Main Scene ──────────────────────────────────────────
export default function GlobeScene({ stage, progress }) {
  const groupRef = useRef();
  const { camera } = useThree();

  const nodes = useMemo(() => generateSphereNodes(50, 2.2), []);
  const edges = useMemo(() => generateEdges(nodes, 1.4), [nodes]);

  // Camera animation based on stage
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (stage === 'globe') {
      // Slowly rotating globe view
      camera.position.lerp(new THREE.Vector3(0, 0.5, 6), 0.02);
      camera.lookAt(0, 0, 0);
      if (groupRef.current) {
        groupRef.current.rotation.y = t * 0.08;
      }
    } else if (stage === 'zoom') {
      // Zoom toward the center
      const zoomProgress = Math.min(progress, 1);
      const ease = zoomProgress * zoomProgress * (3 - 2 * zoomProgress); // smoothstep
      const targetZ = 6 - ease * 4.5;
      const targetY = 0.5 - ease * 0.3;
      camera.position.lerp(new THREE.Vector3(0, targetY, targetZ), 0.05);
      camera.lookAt(0, 0, 0);
      if (groupRef.current) {
        groupRef.current.rotation.y = t * 0.08 + ease * 0.5;
      }
    } else if (stage === 'island') {
      // Settled on island view
      camera.position.lerp(new THREE.Vector3(0, 1.8, 3.5), 0.03);
      camera.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      {/* Ambient & directional lights */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 5, 5]} intensity={0.3} color="#a5b4fc" />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#00ffd5" distance={10} />

      {/* Background particles */}
      <Particles count={400} />

      {/* Globe group — visible during globe + zoom stages */}
      {(stage === 'globe' || stage === 'zoom') && (
        <group ref={groupRef}>
          {/* Wire sphere frame */}
          <mesh>
            <sphereGeometry args={[2.2, 32, 32]} />
            <meshBasicMaterial color="#00ffd5" wireframe transparent opacity={0.03} />
          </mesh>

          {/* Nodes */}
          {nodes.map((node, i) => (
            <GlobeNode
              key={i}
              position={node.position}
              color={node.color}
              pulseOffset={i * 0.4}
            />
          ))}

          {/* Connection lines */}
          <ConnectionLines nodes={nodes} edges={edges} />
        </group>
      )}

      {/* Island group — visible during island + landing stages */}
      {(stage === 'island' || stage === 'landing') && (
        <group>
          <Island />

          {/* Orbiting icons */}
          {ICON_TYPES.map((type, i) => (
            <OrbitingIcon
              key={i}
              angle={(i / ICON_TYPES.length) * Math.PI * 2}
              radius={1.8 + (i % 3) * 0.25}
              speed={0.15 + (i % 4) * 0.05}
              color={type.color}
              yOffset={0.2 + Math.sin(i) * 0.15}
            />
          ))}
        </group>
      )}
    </>
  );
}
