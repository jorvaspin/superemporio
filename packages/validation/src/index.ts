import { z } from 'zod';

export const cartItemSchema = z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) });
export const checkoutSchema = z.object({
  email: z.string().email(), firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?56?9\d{8}$/), fulfillment: z.enum(['delivery', 'pickup']),
  commune: z.string().trim().min(2).max(80).optional(), address: z.string().trim().min(4).max(160).optional(),
  addressDetail: z.string().trim().max(160).optional(), reference: z.string().trim().max(240).optional(),
  couponCode: z.string().trim().toUpperCase().max(32).optional(), notes: z.string().trim().max(240).optional(), documentType: z.enum(['receipt', 'invoice']).default('receipt'),
  taxId: z.string().max(16).optional(), businessName: z.string().max(160).optional(), businessActivity: z.string().max(160).optional(),
}).superRefine((data, context) => {
  if (data.fulfillment === 'delivery' && (!data.commune || !data.address)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Indica comuna y dirección para despacho.' });
  if (data.documentType === 'invoice' && (!data.taxId || !data.businessName || !data.businessActivity)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Completa los datos para factura.' });
});

export const productSchema = z.object({
  name: z.string().trim().min(3).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  brand: z.string().trim().max(80), description: z.string().trim().min(10).max(5000),
});
