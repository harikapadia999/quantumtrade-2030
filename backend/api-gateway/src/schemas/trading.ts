import Joi from 'joi';

export const orderSchema = Joi.object({
  symbol: Joi.string().required().uppercase().min(3).max(20),
  side: Joi.string().required().valid('buy', 'sell'),
  type: Joi.string().required().valid('market', 'limit', 'stop_loss', 'stop_limit'),
  quantity: Joi.number().required().positive(),
  price: Joi.number().positive().when('type', {
    is: Joi.string().valid('limit', 'stop_limit'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  stopPrice: Joi.number().positive().when('type', {
    is: Joi.string().valid('stop_loss', 'stop_limit'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  timeInForce: Joi.string().valid('GTC', 'IOC', 'FOK', 'GTD').default('GTC'),
  leverage: Joi.number().min(1).max(10).default(1),
  reduceOnly: Joi.boolean().default(false),
  postOnly: Joi.boolean().default(false),
});

export const cancelOrderSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
});

export const batchOrderSchema = Joi.object({
  orders: Joi.array().items(orderSchema).min(1).max(10).required(),
});

export const updateOrderSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().optional(),
  price: Joi.number().positive().optional(),
  stopPrice: Joi.number().positive().optional(),
});

export const getOrdersQuerySchema = Joi.object({
  symbol: Joi.string().uppercase().optional(),
  status: Joi.string().valid('pending', 'open', 'filled', 'cancelled', 'rejected').optional(),
  side: Joi.string().valid('buy', 'sell').optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export const getTradesQuerySchema = Joi.object({
  symbol: Joi.string().uppercase().optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export const closePositionSchema = Joi.object({
  symbol: Joi.string().required().uppercase(),
  quantity: Joi.number().positive().optional(),
  price: Joi.number().positive().optional(),
});
