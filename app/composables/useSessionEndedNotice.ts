// Why this tab just got logged out by the server (account blocked, password
// changed elsewhere), set by app/plugins/session-guard.client.ts and shown
// once on the login page. Empty when the user logged out themselves.
export function useSessionEndedNotice() {
  return useState('session-ended-notice', () => '')
}
