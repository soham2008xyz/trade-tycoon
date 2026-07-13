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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    // An SSE stream or similar already started writing; nothing to do but
    // let Express close the connection.
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
