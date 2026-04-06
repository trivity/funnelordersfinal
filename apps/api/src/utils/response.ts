import { Response } from 'express';

export function success<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function paginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; limit: number; total: number },
) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}

export function created<T>(res: Response, data: T) {
  return success(res, data, 201);
}
