import EventEmitter from 'events';
import test from 'ava';
import Client from '../src/Client.js';

class WS extends EventEmitter {
  send() {} // eslint-disable-line class-methods-use-this
}

test('Constructor: correct ws object', (t) => {
  t.notThrows(() => new Client(new WS()));
});

test('Constructor: incorrect ws object', (t) => {
  t.throws(() => new Client(null));
  t.throws(() => new Client({}));
  t.throws(() => new Client({ on: function on() {} }));
  t.throws(() => new Client(new EventEmitter()));
});

test('Method "register": correct arguments', (t) => {
  const ws = new WS();
  const client = new Client(ws);
  t.notThrows(() => client.register('sum', async (a, b) => a + b));
});

test('Method "register": incorrect arguments', (t) => {
  const ws = new WS();
  const client = new Client(ws);
  t.throws(() => client.register());
  t.throws(() => client.register(6, () => {}));
  t.throws(() => client.register('', () => {}));
  t.throws(() => client.register('sum'));
  t.throws(() => client.register('sum', {}));
  t.throws(() => client.register('sum', { call: () => {}, apply: () => {} }));
});

test.cb('Request: correct result', (t) => {
  const request = {
    jsonrpc: '2.0',
    id: '1',
    method: 'sum',
    params: [2, 3],
  };
  const response = {
    jsonrpc: '2.0',
    id: '1',
    result: 5,
  };
  t.plan(1);
  const ws = new WS();
  ws.send = function send(message) {
    t.is(message, JSON.stringify(response));
    t.end();
  };
  const client = new Client(ws);
  client.register('sum', async (a, b) => a + b);
  ws.emit('message', JSON.stringify(request));
});

test.cb('Request: correct result with timeout', (t) => {
  const request = {
    jsonrpc: '2.0',
    id: '1',
    method: 'sum',
    params: [2, 3],
  };
  const response = {
    jsonrpc: '2.0',
    id: '1',
    result: 5,
  };
  t.plan(1);
  const ws = new WS();
  ws.send = function send(message) {
    t.is(message, JSON.stringify(response));
  };
  const client = new Client(ws);
  client.register('sum', async (a, b) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return a + b;
  });
  ws.emit('message', JSON.stringify(request));
  setTimeout(t.end, 6);
});

test.cb('Request: parse error', (t) => {
  const response = {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32700, message: 'Parse error' },
  };
  t.plan(1);
  const ws = new WS();
  ws.send = function send(message) {
    t.is(message, JSON.stringify(response));
    t.end();
  };
  const client = new Client(ws);
  client.register('sum', async (a, b) => a + b);
  ws.emit('message', 'abcdef');
});

test.cb('Request: invalid request', (t) => {
  const response = {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32600, message: 'Invalid request' },
  };
  t.plan(5);
  const ws = new WS();
  ws.send = function send(message) {
    t.is(message, JSON.stringify(response));
  };
  const client = new Client(ws);
  client.register('sum', async (a, b) => a + b);
  ws.emit('message', JSON.stringify(''));
  ws.emit('message', JSON.stringify({
    id: '1',
    method: 'sum',
    params: [2, 3],
  }));
  ws.emit('message', JSON.stringify({
    jsonrpc: '2.0',
    method: 'sum',
    params: [2, 3],
  }));
  ws.emit('message', JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    params: [2, 3],
  }));
  ws.emit('message', JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    method: 'sum',
  }));
  process.nextTick(t.end);
});

test.cb('Request: method not found', (t) => {
  const response = {
    jsonrpc: '2.0',
    id: '1',
    error: { code: -32601, message: 'Method not found' },
  };
  t.plan(1);
  const ws = new WS();
  ws.send = function send(message) {
    t.is(message, JSON.stringify(response));
    t.end();
  };
  const client = new Client(ws);
  client.register('sum', async (a, b) => a + b);
  ws.emit('message', JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    method: 'divide',
    params: [10, 2],
  }));
});

test.cb('Request: internal error', (t) => {
  const ws = new WS();
  ws.send = function send(message) {
    const json = JSON.parse(message);
    t.is(json.jsonrpc, '2.0');
    t.is(json.id, '1');
    t.truthy(json.error);
    t.is(json.error.code, -32603);
    t.truthy(json.error.message);
    t.end();
  };
  const client = new Client(ws);
  client.register('sum', async () => {
    throw new Error('Something has happend');
  });
  ws.emit('message', JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    method: 'sum',
    params: [2, 3],
  }));
});

test.cb('Notify: correct result', (t) => {
  const notification = {
    jsonrpc: '2.0',
    id: null,
    method: 'update',
    params: ['name', 'Ivan'],
  };
  const ws = new WS();
  ws.send = function send(message) {
    t.is(message, JSON.stringify(notification));
    t.end();
  };
  const client = new Client(ws);
  client.notify('update', ['name', 'Ivan']);
});
