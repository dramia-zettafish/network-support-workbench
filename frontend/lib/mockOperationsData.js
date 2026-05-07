export const operationStats = [
  {
    label: 'Open Tickets',
    value: '18',
    detail: '5 updated today',
    status: { label: 'Active', tone: 'info' }
  },
  {
    label: 'Pending UPS',
    value: '7',
    detail: 'Waiting for schedule review',
    status: { label: 'Queue', tone: 'warning' }
  },
  {
    label: 'Scheduled This Week',
    value: '4',
    detail: '2 schools represented',
    status: { label: 'Planned', tone: 'success' }
  },
  {
    label: 'RMAs Waiting',
    value: '3',
    detail: 'Admin follow-up needed',
    status: { label: 'Hold', tone: 'neutral' }
  }
];

export const openCases = [
  { ticket: '460893', school: 'West Campus', workflow: 'UPS', status: 'Pending', age: '2d', tone: 'warning' },
  { ticket: '460901', school: 'North Campus', workflow: 'Ticket', status: 'Open', age: '4h', tone: 'info' },
  { ticket: '460912', school: 'Central HS', workflow: 'RMA', status: 'Waiting', age: '1d', tone: 'neutral' },
  { ticket: '460944', school: 'East Campus', workflow: 'UPS', status: 'Scheduled', age: '3d', tone: 'success' }
];

export const recentActivity = [
  { time: '08:15', activity: 'Ticket 460901 opened for switch replacement', owner: 'Network Team' },
  { time: '09:05', activity: 'UPS install schedule prepared for West Campus', owner: 'NOC' },
  { time: '10:20', activity: 'RMA prompt copied for corrupted IOS case', owner: 'RMA Admin' },
  { time: '11:10', activity: 'Ticket 460944 moved to in progress', owner: 'Network Team' }
];
