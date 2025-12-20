import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

interface CORSConfig {
  origin: string | string[];
  credentials: boolean;
}

interface Config {
  env: string;
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
  kafka: KafkaConfig;
  jwt: JWTConfig;
  cors: CORSConfig;
  tradingEngine: {
    url: string;
    timeout: number;
  };
  marketData: {
    url: string;
    timeout: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  websocket: {
    pingInterval: number;
    pingTimeout: number;
  };
}

export const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'quantumtrade',
    username: process.env.DB_USER || 'quantumtrade',
    password: process.env.DB_PASSWORD || 'changeme',
    ssl: process.env.DB_SSL === 'true',
    poolMin: 2,
    poolMax: 10,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: 'qt:',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'quantumtrade-api-gateway',
    groupId: 'api-gateway-group',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3002'],
    credentials: true,
  },

  tradingEngine: {
    url: process.env.TRADING_ENGINE_URL || 'http://localhost:8080',
    timeout: 5000,
  },

  marketData: {
    url: process.env.MARKET_DATA_URL || 'http://localhost:8081',
    timeout: 3000,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },

  websocket: {
    pingInterval: 30000,
    pingTimeout: 5000,
  },
};

export default config;
