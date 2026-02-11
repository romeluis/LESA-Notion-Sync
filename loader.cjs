const http = require('http');

const PORT = process.env.PORT || 3000;

let lastSyncTime = null;
let syncStatus = 'starting';
const steps = {
    events: { status: 'pending', lastError: null },
    members: { status: 'pending', lastError: null },
    registrations: { status: 'pending', lastError: null }
};

// Expose functions so app.js can report sync status
global.__syncTracker = {
    reportSyncComplete: () => {
        lastSyncTime = new Date();
        syncStatus = 'ok';
    },
    reportSyncError: () => {
        syncStatus = 'error';
    },
    reportStepComplete: (step) => {
        if (steps[step]) {
            steps[step].status = 'ok';
            steps[step].lastError = null;
        }
    },
    reportStepError: (step, message) => {
        if (steps[step]) {
            steps[step].status = 'error';
            steps[step].lastError = message;
        }
    }
};

function stepBadge(step) {
    const s = steps[step];
    if (s.status === 'ok') return '<span class="status ok">OK</span>';
    if (s.status === 'error') return '<span class="status error">Error</span>';
    return '<span class="status starting">Pending</span>';
}

function stepError(step) {
    const s = steps[step];
    if (s.lastError) return `<div class="error-msg">${s.lastError}</div>`;
    return '';
}

const server = http.createServer((req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: syncStatus,
            uptime: `${hours}h ${minutes}m`,
            lastSync: lastSyncTime,
            steps,
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Browser-friendly status page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html><head><title>LESA Notion Sync</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 20px; background: #f5f5f5; }
  .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 16px; }
  h1 { font-size: 1.3em; margin-top: 0; }
  h2 { font-size: 1.1em; margin-top: 0; color: #333; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.9em; }
  .ok { background: #d4edda; color: #155724; }
  .starting { background: #fff3cd; color: #856404; }
  .error { background: #f8d7da; color: #721c24; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee; }
  .label { color: #666; }
  .error-msg { font-size: 0.8em; color: #721c24; background: #f8d7da; padding: 6px 10px; border-radius: 6px; margin-top: 4px; word-break: break-word; }
  .step { padding: 8px 0; border-bottom: 1px solid #eee; }
  .step-header { display: flex; justify-content: space-between; align-items: center; }
</style></head>
<body>
  <div class="card">
    <h1>LESA Notion Sync</h1>
    <div class="row"><span class="label">Status</span><span class="status ${syncStatus}">${syncStatus === 'ok' ? 'Running' : syncStatus === 'error' ? 'Error' : 'Starting...'}</span></div>
    <div class="row"><span class="label">Uptime</span><span>${hours}h ${minutes}m</span></div>
    <div class="row"><span class="label">Last Sync</span><span>${lastSyncTime ? lastSyncTime.toLocaleString() : 'Pending...'}</span></div>
    <div class="row"><span class="label">Schedule</span><span>Every 10 min</span></div>
  </div>
  <div class="card">
    <h2>Sync Steps</h2>
    <div class="step">
      <div class="step-header"><span class="label">Events</span>${stepBadge('events')}</div>
      ${stepError('events')}
    </div>
    <div class="step">
      <div class="step-header"><span class="label">Members</span>${stepBadge('members')}</div>
      ${stepError('members')}
    </div>
    <div class="step">
      <div class="step-header"><span class="label">Registrations</span>${stepBadge('registrations')}</div>
      ${stepError('registrations')}
    </div>
  </div>
</body></html>`);
});

server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

// Load the sync application
async function loadApp() {
    try {
        console.log('Loading application...');
        await import('./app.js');
        console.log('Application loaded successfully');
    } catch (error) {
        console.error('Failed to load application:', error);
        process.exit(1);
    }
}

loadApp();
