// Kept out of `app/`: expo-router treats every file there as a route.
export type Screen =
  | 'new-game'
  | 'local-game'
  | 'multiplayer-menu'
  | 'online-create'
  | 'online-join'
  | 'online-resume';

// Screens are a state machine, not routes, so the URL never changes; each one
// is reported to analytics as a virtual page (#334).
export function pageViewFor(screen: Screen): { path: string; title: string } {
  switch (screen) {
    case 'new-game':
      return { path: '/', title: 'Main menu' };
    case 'local-game':
      return { path: '/local-game', title: 'Local game' };
    case 'multiplayer-menu':
      return { path: '/multiplayer', title: 'Multiplayer menu' };
    case 'online-create':
      return { path: '/online/create', title: 'Create room' };
    case 'online-join':
      return { path: '/online/join', title: 'Join room' };
    case 'online-resume':
      return { path: '/online/resume', title: 'Resume game' };
  }
}
