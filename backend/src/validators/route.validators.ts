import { z } from 'zod';

export const createRouteSchema = z.object({
  name: z.string().min(1).max(200),
  optimizationObjective: z.enum(['TIME', 'DISTANCE']).default('TIME'),
  depot: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      address: z.string().optional(),
    })
    .optional(),
});

export const updateRouteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  optimizationObjective: z.enum(['TIME', 'DISTANCE']).optional(),
  depot: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      address: z.string().optional(),
    })
    .optional(),
});

export const createStopSchema = z.object({
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  timeWindowStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  timeWindowEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  serviceDurationMin: z.number().int().min(0).max(180).optional(),
  notes: z.string().nullable().optional(),
  customerOrderId: z.string().nullable().optional(),
});

export const updateStopSchema = createStopSchema.partial();

export const optimizeRouteSchema = z.object({
  objective: z.enum(['TIME', 'DISTANCE']).optional(),
});
