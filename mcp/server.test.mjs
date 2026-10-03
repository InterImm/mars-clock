// Talks to the MCP server the way a client does, over stdio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';

const SERVER = new URL('./server.mjs', import.meta.url).pathname;

function session() {
  const p = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '';
  const waiting = new Map();
  p.stdout.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
      waiting.get(msg.id)?.(msg);
    }
  });
  let next = 1;
  const call = (method, params) => new Promise((resolve) => {
    const id = next++;
    waiting.set(id, resolve);
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const notify = (method) => p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  return { call, notify, close: () => p.stdin.end() };
}

test('MCP handshake, tool list and calls', async () => {
  const s = session();
  const init = await s.call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(init.result.serverInfo.name, 'mars-time');
  assert.ok(init.result.capabilities.tools);
  s.notify('notifications/initialized');

  const list = await s.call('tools/list', {});
  assert.deepEqual(list.result.tools.map((t) => t.name).sort(),
    ['get_mars_time', 'interimm_to_earth', 'mars_year_dates', 'mission_sol', 'sol_to_earth']);
  for (const t of list.result.tools) assert.equal(t.inputSchema.type, 'object');

  const now = await s.call('tools/call', { name: 'get_mars_time', arguments: { utc: '2026-10-03T10:00:00Z', longitude: 137.44 } });
  const r = now.result.structuredContent;
  assert.equal(r.marsYear, 39);
  assert.equal(r.interimm.zone, 9);
  assert.equal(r.missions.curiosity.sol, 5033);
  assert.equal(JSON.parse(now.result.content[0].text).marsSolDate, r.marsSolDate);

  const back = await s.call('tools/call', { name: 'interimm_to_earth', arguments: { year: 31, month: 1, day: 3, time: '06:19:13', zone: 5 } });
  assert.ok(Math.abs(Date.parse(back.result.structuredContent.utc) - Date.parse('2026-10-03T10:00:00Z')) < 2000);

  const sol = await s.call('tools/call', { name: 'sol_to_earth', arguments: { mission: 'curiosity', sol: 5033 } });
  const { startsUtc, endsUtc } = sol.result.structuredContent;
  assert.ok(Date.parse(startsUtc) <= Date.parse('2026-10-03T10:00:00Z') && Date.parse('2026-10-03T10:00:00Z') < Date.parse(endsUtc));

  const my = await s.call('tools/call', { name: 'mars_year_dates', arguments: { marsYear: 39 } });
  assert.match(my.result.structuredContent.startUtc, /^2026-09-30/);

  const bad = await s.call('tools/call', { name: 'mission_sol', arguments: { mission: 'nope' } });
  assert.equal(bad.result.isError, true);
  const unknown = await s.call('nope/nope', {});
  assert.equal(unknown.error.code, -32601);
  s.close();
});

test('one-shot CLI prints JSON', () => {
  const out = JSON.parse(execFileSync(process.execPath, [SERVER, 'now', '--utc', '2026-10-03T10:00:00Z', '--zone', '5']));
  assert.equal(out.interimm.date, '31-1-3');
  assert.equal(out.interimm.zone, 5);
});
