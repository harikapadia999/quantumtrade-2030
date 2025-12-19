import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { VRButton, XR, Controllers, Hands } from '@react-three/xr';
import { OrbitControls, Text, Box, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

/**
 * VR Trading Environment for QuantumTrade 2030
 * Immersive 3D trading experience with spatial data visualization
 */

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
}

interface Position3D {
  x: number;
  y: number;
  z: number;
}

// 3D Price Chart Component
function PriceChart3D({ data, position }: { data: number[]; position: Position3D }) {
  const points = data.map((price, index) => {
    return new THREE.Vector3(
      position.x + (index * 0.1),
      position.y + (price / 1000),
      position.z
    );
  });

  return (
    <group>
      <Line
        points={points}
        color="#3B82F6"
        lineWidth={3}
      />
      {/* Price labels */}
      <Text
        position={[position.x, position.y + 2, position.z]}
        fontSize={0.3}
        color="#FFFFFF"
      >
        BTC/USD
      </Text>
    </group>
  );
}

// Market Sphere - Represents a trading pair
function MarketSphere({ market, position, onClick }: {
  market: MarketData;
  position: Position3D;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      if (hovered) {
        meshRef.current.scale.lerp(new THREE.Vector3(1.2, 1.2, 1.2), 0.1);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

  const color = market.change24h >= 0 ? '#10B981' : '#EF4444';

  return (
    <group position={[position.x, position.y, position.z]}>
      <Sphere
        ref={meshRef}
        args={[0.5, 32, 32]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.5 : 0.2}
          metalness={0.8}
          roughness={0.2}
        />
      </Sphere>

      {/* Market info */}
      <Text
        position={[0, 0.8, 0]}
        fontSize={0.2}
        color="#FFFFFF"
        anchorX="center"
      >
        {market.symbol}
      </Text>
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.15}
        color="#FFFFFF"
        anchorX="center"
      >
        ${market.price.toLocaleString()}
      </Text>
      <Text
        position={[0, 0.3, 0]}
        fontSize={0.12}
        color={color}
        anchorX="center"
      >
        {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
      </Text>
    </group>
  );
}

// Order Book Visualization
function OrderBookViz({ position }: { position: Position3D }) {
  const bids = Array.from({ length: 10 }, (_, i) => ({
    price: 50000 - (i * 100),
    volume: Math.random() * 10,
  }));

  const asks = Array.from({ length: 10 }, (_, i) => ({
    price: 50000 + (i * 100),
    volume: Math.random() * 10,
  }));

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Bids (green) */}
      {bids.map((bid, i) => (
        <Box
          key={`bid-${i}`}
          args={[bid.volume * 0.1, 0.1, 0.2]}
          position={[-bid.volume * 0.05, -i * 0.15, 0]}
        >
          <meshStandardMaterial color="#10B981" transparent opacity={0.7} />
        </Box>
      ))}

      {/* Asks (red) */}
      {asks.map((ask, i) => (
        <Box
          key={`ask-${i}`}
          args={[ask.volume * 0.1, 0.1, 0.2]}
          position={[ask.volume * 0.05, i * 0.15, 0]}
        >
          <meshStandardMaterial color="#EF4444" transparent opacity={0.7} />
        </Box>
      ))}

      <Text
        position={[0, 2, 0]}
        fontSize={0.3}
        color="#FFFFFF"
      >
        Order Book
      </Text>
    </group>
  );
}

// Portfolio Visualization
function PortfolioViz({ position }: { position: Position3D }) {
  const holdings = [
    { symbol: 'BTC', value: 50000, percentage: 40 },
    { symbol: 'ETH', value: 30000, percentage: 30 },
    { symbol: 'SOL', value: 15000, percentage: 15 },
    { symbol: 'AAPL', value: 10000, percentage: 10 },
    { symbol: 'Cash', value: 5000, percentage: 5 },
  ];

  const colors = ['#F59E0B', '#8B5CF6', '#10B981', '#3B82F6', '#6B7280'];

  return (
    <group position={[position.x, position.y, position.z]}>
      {holdings.map((holding, i) => {
        const angle = (i / holdings.length) * Math.PI * 2;
        const radius = 1.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = holding.percentage / 10;

        return (
          <group key={holding.symbol}>
            <Box
              args={[0.3, height, 0.3]}
              position={[x, height / 2, z]}
            >
              <meshStandardMaterial color={colors[i]} />
            </Box>
            <Text
              position={[x, height + 0.3, z]}
              fontSize={0.15}
              color="#FFFFFF"
              anchorX="center"
            >
              {holding.symbol}
            </Text>
            <Text
              position={[x, height + 0.1, z]}
              fontSize={0.12}
              color="#FFFFFF"
              anchorX="center"
            >
              {holding.percentage}%
            </Text>
          </group>
        );
      })}

      <Text
        position={[0, 3, 0]}
        fontSize={0.3}
        color="#FFFFFF"
        anchorX="center"
      >
        Portfolio
      </Text>
    </group>
  );
}

// Main VR Scene
function VRScene() {
  const [markets] = useState<MarketData[]>([
    { symbol: 'BTC/USD', price: 50000, change24h: 5.2, volume: 1000000000, marketCap: 1000000000000 },
    { symbol: 'ETH/USD', price: 3000, change24h: -2.1, volume: 500000000, marketCap: 400000000000 },
    { symbol: 'SOL/USD', price: 100, change24h: 8.5, volume: 200000000, marketCap: 50000000000 },
    { symbol: 'AAPL', price: 180, change24h: 1.2, volume: 100000000, marketCap: 3000000000000 },
  ]);

  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      {/* Market Spheres */}
      {markets.map((market, i) => {
        const angle = (i / markets.length) * Math.PI * 2;
        const radius = 5;
        return (
          <MarketSphere
            key={market.symbol}
            market={market}
            position={{
              x: Math.cos(angle) * radius,
              y: 0,
              z: Math.sin(angle) * radius,
            }}
            onClick={() => setSelectedMarket(market.symbol)}
          />
        );
      })}

      {/* Order Book */}
      <OrderBookViz position={{ x: -8, y: 0, z: 0 }} />

      {/* Portfolio */}
      <PortfolioViz position={{ x: 8, y: 0, z: 0 }} />

      {/* Price Chart */}
      <PriceChart3D
        data={Array.from({ length: 50 }, () => 50000 + Math.random() * 1000)}
        position={{ x: 0, y: 3, z: -5 }}
      />

      {/* Floor Grid */}
      <gridHelper args={[20, 20, '#1F2937', '#111827']} position={[0, -2, 0]} />
    </>
  );
}

// Main VR Trading App
export default function VRTradingEnvironment() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <VRButton />
      <Canvas>
        <XR>
          <Controllers />
          <Hands />
          <VRScene />
          <OrbitControls />
        </XR>
      </Canvas>
    </div>
  );
}
