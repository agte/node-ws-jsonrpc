import { assert } from '@agte/type';

export default class Client {
  #ws;

  #handlers = new Map();

  /**
   * @param {Object} ws
   * @param {Function} ws.on
   * @param {Function} ws.send
   */
  constructor(ws) {
    assert.object(ws);
    assert.function(ws.on);
    assert.function(ws.send);

    this.#ws = ws;
    this.#ws.on('message', async (str) => {
      let request;

      try {
        request = JSON.parse(str);
      } catch {
        this.#dispatchError(-32700, 'Parse error');
        return;
      }

      if (!request || typeof request !== 'object' || request.jsonrpc !== '2.0') {
        this.#dispatchError(-32600, 'Invalid request');
        return;
      }

      const { id, method, params } = request;

      try {
        assert.nonEmptyString(id);
        assert.nonEmptyString(method);
        assert.array(params);
      } catch {
        this.#dispatchError(-32600, 'Invalid request');
        return;
      }

      if (!this.#handlers.has(method)) {
        this.#sendError(id, -32601, 'Method not found');
        return;
      }

      try {
        const result = await this.#handlers.get(method)(...params);
        this.#sendResult(id, result);
      } catch (e) {
        // TODO Maybe catch a specific error "Invalid params" and handle it as "-32602".
        const code = e.code ? -(32500 + e.code) : -32603;
        this.#sendError(id, code, e.message);
      }
    });

    this.#sendResult = this.#sendResult.bind(this);
    this.#sendError = this.#sendError.bind(this);
    this.#dispatchEvent = this.#dispatchEvent.bind(this);
    this.#dispatchError = this.#dispatchError.bind(this);
  }

  /**
   * @param {string} method
   * @param {Function} handler
   */
  register(method, handler) {
    assert.nonEmptyString(method);
    assert.function(handler);
    this.#handlers.set(method, handler);
  }

  /**
   * @param {string} method
   * @param {Array} params
   */
  notify(method, params) {
    assert.nonEmptyString(method);
    assert.array(params);
    this.#dispatchEvent(method, params);
  }

  #sendResult = function sendResult(id, result) {
    this.#ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result,
    }));
  }

  #sendError = function sendError(id, code, message = '') {
    this.#ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code, message },
    }));
  }

  #dispatchEvent = function dispatchEvent(method, params) {
    this.#ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      method,
      params,
    }));
  }

  #dispatchError = function dispatchError(code, message = '') {
    this.#ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code, message },
    }));
  }
}
