import type { NextFunction, Request, Response } from 'express';
import { StoreConflictError } from '../store/RoomStore';

/**
 * Terminal error handler. Express 5 forwards rejected async route handler
 * promises here automatically (unlike Express 4, which needed an explicit
 * `next(err)` call in every handler), so this is the single place that turns
 * an unexpected failure into a JSON response instead of Express's default
 * HTML error page.
 *
 * Must be registered last, after every router — Express identifies error
 * middleware by its four-argument signature.
 */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    // An SSE stream or similar already started writing. The route's own
    // cleanup should already have run, but end the response here too as a
    // backstop so a late/uncaught failure can't leave the connection open
    // until the function times out.
    res.end();
    return;
  }

  if (err instanceof StoreConflictError) {
    // Not a bug — the caller lost a race against another writer on the same
    // room. Distinct status so clients can retry instead of treating it as
    // a hard failure.
    res.status(503).json({ error: 'busy, please retry' });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({ error: 'internal server error' });
};
