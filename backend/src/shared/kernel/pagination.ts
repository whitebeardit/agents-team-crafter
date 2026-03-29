import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type IPaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginationMeta(page: number, perPage: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return { page, perPage, total, totalPages };
}
