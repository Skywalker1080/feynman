import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HealthResponse } from '@feynman/types';

export function createHealthRouter(version: string) {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const body: HealthResponse = { status: 'ok', version };
    res.json(body);
  });

  return router;
}
