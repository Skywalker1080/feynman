import { Router } from 'express';
import type { Request, Response } from 'express';
import type { GetSkillResponse, ListSkillsResponse } from '@feynman/types';
import type { SkillsDiscovery } from '../skills/discovery';

export function createSkillsRouter(skillsDiscovery: SkillsDiscovery) {
  const router = Router();

  // GET /skills — return manifest (name + description only, NOT full content)
  router.get('/', (_req: Request, res: Response) => {
    const response: ListSkillsResponse = { skills: skillsDiscovery.getManifest() };
    res.json(response);
  });

  // GET /skills/:name — return full skill markdown content
  router.get('/:name', (req: Request, res: Response) => {
    const content = skillsDiscovery.getSkillContent(req.params['name']!);
    if (content === null) {
      res
        .status(404)
        .json({ error: `Skill '${req.params['name']}' not found. Use GET /skills to list available skills.` });
      return;
    }
    const response: GetSkillResponse = { name: req.params['name']!, content };
    res.json(response);
  });

  return router;
}
