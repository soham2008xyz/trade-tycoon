# Project Memory

- Online multiplayer leave is server-authoritative: `OnlineGame.handleLeave`
  must POST `/api/rooms/:id/leave` before returning to the menu, otherwise the
  departed player remains in the room snapshot and their board marker stays
  visible for other clients.
