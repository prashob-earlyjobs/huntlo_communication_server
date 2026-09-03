import { Response } from "express";

export function sendSuccess(res: Response, statusCode: number, data) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendError(res: Response, statusCode: number, error) {
  return res.status(statusCode).json({
    success: false,
    error,
  });
}
