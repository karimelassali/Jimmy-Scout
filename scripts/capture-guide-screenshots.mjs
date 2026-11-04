import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

const baseUrl = (process.argv[2] || 'https://jimyscout-production.up.railway.app').replace(/\/$/, '');
const outputDir = path.resolve(process.cwd(), 'public/assets/guide/live');
const debuggingPort = 9333;
const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jimyscout-guide-'));

await fs.mkdir(outputDir, { recursive: true });

const browser = spawn('/usr/bin/chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${debuggingPort}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${profileDir}`,
  'about:blank',
], { stdio: 'ignore' });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/version`);
      if (response.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error('Chromium debugging port did not start.');
}

async function createPage() {
  const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?about:blank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Cannot create capture page (${response.status}).`);
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  let id = 0;
  const pending = new Map();
  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  return { socket, send };
}

async function capture(tab, filename, scrollY = 0) {
  const page = await createPage();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.send('Page.navigate', { url: `${baseUrl}/?tab=${tab}` });
  await wait(3500);
  await page.send('Runtime.evaluate', {
    expression: `localStorage.setItem('jimiscout_setup_completed','true'); location.reload();`,
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    const ready = await page.send('Runtime.evaluate', {
      expression: `!document.body.innerText.includes('Jimy se prépare') && document.body.innerText.length > 300`,
      returnByValue: true,
    });
    if (ready.result?.value) break;
    await wait(300);
  }
  await page.send('Runtime.evaluate', { expression: `window.scrollTo(0, ${scrollY});` });
  await wait(500);
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await fs.writeFile(path.join(outputDir, filename), Buffer.from(result.data, 'base64'));
  page.socket.close();
}

try {
  await waitForDebugger();
  await capture('control', 'accueil.png');
  await capture('leads', 'dossiers.png');
  await capture('emails', 'envoyes.png');
  await capture('targets', 'regions.png');
  await capture('scanner', 'scanner.png');
  await capture('persona', 'reglages.png');
  console.log(`Captured 6 real application screens in ${outputDir}`);
} finally {
  const browserExit = new Promise((resolve) => browser.once('exit', resolve));
  browser.kill('SIGTERM');
  await Promise.race([browserExit, wait(2000)]);
  await fs.rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
}
