export async function getCurrentUser() {
  return {
    username: 'Network Team',
    displayName: 'Network Team',
    role: 'technician',
    teams: ['network_technicians'],
    timezone: 'America/Chicago',
    authProvider: 'local'
  };
}
