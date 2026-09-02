import { Request, Response } from "express";

export function getHealth(_req: Request, res: Response) {
  res.json({
    status: "ok",
    service: "humtlo-communication-gateway",
    timestamp: new Date().toISOString(),
  });
}
