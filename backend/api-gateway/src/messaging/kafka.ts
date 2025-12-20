import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { logger } from '../utils/logger';

class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer>;
  private static instance: KafkaService;

  private constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer();
    this.consumers = new Map();
  }

  public static getInstance(): KafkaService {
    if (!KafkaService.instance) {
      KafkaService.instance = new KafkaService();
    }
    return KafkaService.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Kafka producer connected');
    } catch (error) {
      logger.error('Kafka connection error:', error);
      throw error;
    }
  }

  public async publish(topic: string, message: any): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            value: JSON.stringify(message),
            timestamp: Date.now().toString(),
          },
        ],
      });
      logger.debug('Message published to Kafka', { topic });
    } catch (error) {
      logger.error('Kafka publish error:', { topic, error });
      throw error;
    }
  }

  public async publishBatch(topic: string, messages: any[]): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: messages.map((msg) => ({
          value: JSON.stringify(msg),
          timestamp: Date.now().toString(),
        })),
      });
      logger.debug('Batch published to Kafka', { topic, count: messages.length });
    } catch (error) {
      logger.error('Kafka batch publish error:', { topic, error });
      throw error;
    }
  }

  public async subscribe(
    topic: string,
    groupId: string,
    handler: (message: any) => Promise<void>,
  ): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    
    try {
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          try {
            const value = message.value?.toString();
            if (value) {
              const parsed = JSON.parse(value);
              await handler(parsed);
            }
          } catch (error) {
            logger.error('Kafka message processing error:', { topic, partition, error });
          }
        },
      });

      this.consumers.set(`${topic}-${groupId}`, consumer);
      logger.info('Kafka consumer subscribed', { topic, groupId });
    } catch (error) {
      logger.error('Kafka subscribe error:', { topic, groupId, error });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      
      for (const [key, consumer] of this.consumers.entries()) {
        await consumer.disconnect();
        logger.info('Kafka consumer disconnected', { key });
      }
      
      logger.info('Kafka disconnected');
    } catch (error) {
      logger.error('Kafka disconnect error:', error);
      throw error;
    }
  }
}

export const initializeKafka = async (): Promise<void> => {
  const kafka = KafkaService.getInstance();
  await kafka.connect();
  
  // Subscribe to important topics
  await kafka.subscribe('trades', 'api-gateway-trades', async (message) => {
    logger.info('Trade received:', message);
    // Handle trade event
  });

  await kafka.subscribe('orders', 'api-gateway-orders', async (message) => {
    logger.info('Order received:', message);
    // Handle order event
  });

  await kafka.subscribe('market-data', 'api-gateway-market', async (message) => {
    logger.debug('Market data received:', message);
    // Handle market data event
  });
};

export const kafka = KafkaService.getInstance();
export default kafka;
