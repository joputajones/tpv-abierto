'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const dns = require('node:dns');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');

// 0.0.0.0/:: are permitted only because the real API and KDS bind their
// listening sockets to the wildcard interface. An outbound connection to an
// unspecified address still resolves to this host; it cannot reach Internet.
const LOOPBACK_HOSTS = new Set(['localhost', '0.0.0.0', '::', '::1', '0:0:0:0:0:0:0:1']);

function normalizeHost(value) {
  let host = String(value || '').trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.includes('@')) host = host.slice(host.lastIndexOf('@') + 1);
  if (host.startsWith('::ffff:')) host = host.slice(7);
  if (/^[^:]+:\d+$/.test(host)) host = host.replace(/:\d+$/, '');
  return host || 'unknown';
}

function isLoopbackHost(value) {
  const host = normalizeHost(value);
  return LOOPBACK_HOSTS.has(host) || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function requestTarget(args, fallbackProtocol) {
  const first = args[0];
  const second = args[1];
  let url;
  let options = {};

  if (first instanceof URL) {
    url = first;
    if (second && typeof second === 'object') options = second;
  } else if (typeof first === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(first)) {
    url = new URL(first);
    if (second && typeof second === 'object') options = second;
  } else if (first && typeof first === 'object') {
    options = first;
  } else if (second && typeof second === 'object') {
    options = second;
  }

  const protocol = String(options.protocol || url?.protocol || fallbackProtocol || 'tcp:').replace(/:$/, '');
  const rawHost = options.hostname || options.host || url?.hostname || 'localhost';
  const host = normalizeHost(rawHost);
  const defaultPort = protocol === 'https' || protocol === 'wss' || protocol === 'tls' ? 443 : 80;
  const port = Number(options.port || url?.port || defaultPort);
  return { protocol, host, port: Number.isFinite(port) ? port : defaultPort };
}

function socketTarget(args, protocol) {
  const first = args[0];
  if (Array.isArray(first)) return socketTarget(first, protocol);
  if (first && typeof first === 'object') {
    return {
      protocol,
      host: normalizeHost(first.host || first.hostname || 'localhost'),
      port: Number(first.port || (protocol === 'tls' ? 443 : 0)),
    };
  }
  if (typeof first === 'number') {
    return {
      protocol,
      host: normalizeHost(typeof args[1] === 'string' ? args[1] : 'localhost'),
      port: first,
    };
  }
  return { protocol, host: normalizeHost('unknown'), port: 0 };
}

function blockedError(target) {
  const error = new Error(`OFFLINE_NETWORK_BLOCKED ${target.protocol}://${target.host}:${target.port}`);
  error.code = 'OFFLINE_NETWORK_BLOCKED';
  return error;
}

class OfflineNetworkGuard {
  constructor() {
    this.events = [];
    this.emitter = new EventEmitter();
    this.context = new AsyncLocalStorage();
    this.syntheticEndpoints = new Map();
    this.installed = false;
    this.wrappedWebSockets = new WeakMap();
    this.originals = {
      fetch: globalThis.fetch,
      httpRequest: http.request,
      httpGet: http.get,
      httpsRequest: https.request,
      httpsGet: https.get,
      netConnect: net.connect,
      netCreateConnection: net.createConnection,
      socketConnect: net.Socket.prototype.connect,
      tlsConnect: tls.connect,
      dnsLookup: dns.lookup,
      dnsResolve: dns.resolve,
      dnsResolve4: dns.resolve4,
      dnsResolve6: dns.resolve6,
      dnsResolveAny: dns.resolveAny,
    };
  }

  currentService() {
    return this.context.getStore() || 'unattributed';
  }

  runWithService(service, callback) {
    return this.context.run(service, callback);
  }

  record(target, result, service = this.currentService()) {
    const event = Object.freeze({
      protocol: String(target.protocol || 'unknown').replace(/:$/, ''),
      host: normalizeHost(target.host),
      port: Number(target.port || 0),
      service: String(service || 'unattributed'),
      result,
      recordedAt: new Date().toISOString(),
      durationMs: 0,
    });
    this.events.push(event);
    this.emitter.emit('event', event);
    return event;
  }

  assertAllowed(target) {
    if (isLoopbackHost(target.host)) return;
    this.record(target, 'blocked');
    throw blockedError(target);
  }

  install() {
    if (this.installed) return this;
    this.installed = true;
    const guard = this;

    globalThis.fetch = async function guardedFetch(input, init) {
      const rawUrl = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
      const target = {
        protocol: rawUrl.protocol.replace(/:$/, ''),
        host: normalizeHost(rawUrl.hostname),
        port: Number(rawUrl.port || (rawUrl.protocol === 'https:' ? 443 : 80)),
      };
      if (isLoopbackHost(target.host)) return guard.originals.fetch(input, init);

      const syntheticBase = guard.syntheticEndpoints.get(target.host);
      if (syntheticBase) {
        const mapped = new URL(rawUrl.pathname + rawUrl.search, syntheticBase);
        guard.record(target, 'redirected-to-loopback');
        return guard.originals.fetch(mapped, init);
      }

      guard.record(target, 'blocked');
      throw blockedError(target);
    };

    const patchRequest = (module, original, fallbackProtocol) => function guardedRequest(...args) {
      const target = requestTarget(args, fallbackProtocol);
      guard.assertAllowed(target);
      return original.apply(module, args);
    };
    http.request = patchRequest(http, this.originals.httpRequest, 'http:');
    https.request = patchRequest(https, this.originals.httpsRequest, 'https:');
    http.get = function guardedHttpGet(...args) {
      const target = requestTarget(args, 'http:');
      guard.assertAllowed(target);
      return guard.originals.httpGet.apply(http, args);
    };
    https.get = function guardedHttpsGet(...args) {
      const target = requestTarget(args, 'https:');
      guard.assertAllowed(target);
      return guard.originals.httpsGet.apply(https, args);
    };

    net.connect = function guardedNetConnect(...args) {
      const target = socketTarget(args, 'tcp');
      guard.assertAllowed(target);
      return guard.originals.netConnect.apply(net, args);
    };
    net.createConnection = function guardedNetCreateConnection(...args) {
      const target = socketTarget(args, 'tcp');
      guard.assertAllowed(target);
      return guard.originals.netCreateConnection.apply(net, args);
    };
    net.Socket.prototype.connect = function guardedSocketConnect(...args) {
      const target = socketTarget(args, 'tcp');
      guard.assertAllowed(target);
      return guard.originals.socketConnect.apply(this, args);
    };
    tls.connect = function guardedTlsConnect(...args) {
      const target = socketTarget(args, 'tls');
      guard.assertAllowed(target);
      return guard.originals.tlsConnect.apply(tls, args);
    };

    const patchDns = (name, original) => {
      dns[name] = function guardedDns(hostname, ...args) {
        const target = { protocol: 'dns', host: normalizeHost(hostname), port: 53 };
        if (isLoopbackHost(target.host)) return original.call(dns, hostname, ...args);
        guard.record(target, 'blocked');
        const callback = args.find((arg) => typeof arg === 'function');
        const error = blockedError(target);
        if (callback) {
          process.nextTick(() => callback(error));
          return undefined;
        }
        throw error;
      };
    };
    patchDns('lookup', this.originals.dnsLookup);
    patchDns('resolve', this.originals.dnsResolve);
    patchDns('resolve4', this.originals.dnsResolve4);
    patchDns('resolve6', this.originals.dnsResolve6);
    patchDns('resolveAny', this.originals.dnsResolveAny);

    return this;
  }

  wrapWebSocketModule(webSocketModule) {
    const BaseWebSocket = webSocketModule.WebSocket || webSocketModule;
    if (this.wrappedWebSockets.has(BaseWebSocket)) return this.wrappedWebSockets.get(BaseWebSocket);
    const guard = this;
    let GuardedWebSocket;
    GuardedWebSocket = new Proxy(BaseWebSocket, {
      construct(Target, args, newTarget) {
        const url = new URL(String(args[0]));
        const target = {
          protocol: url.protocol.replace(/:$/, ''),
          host: normalizeHost(url.hostname),
          port: Number(url.port || (url.protocol === 'wss:' ? 443 : 80)),
        };
        guard.assertAllowed(target);
        return Reflect.construct(Target, args, newTarget);
      },
      get(Target, property, receiver) {
        if (property === 'WebSocket' || property === 'default') return GuardedWebSocket;
        return Reflect.get(Target, property, receiver);
      },
    });
    this.wrappedWebSockets.set(BaseWebSocket, GuardedWebSocket);
    return GuardedWebSocket;
  }

  setSyntheticEndpoint(host, loopbackBaseUrl) {
    const parsed = new URL(loopbackBaseUrl);
    if (!isLoopbackHost(parsed.hostname)) throw new Error('Synthetic endpoint must resolve directly to loopback');
    this.syntheticEndpoints.set(normalizeHost(host), parsed.toString());
  }

  clearSyntheticEndpoints() {
    this.syntheticEndpoints.clear();
  }

  attemptsFor(service) {
    return this.events.filter((event) => event.service === service);
  }

  waitForEvent(predicate, timeoutMs = 2_000) {
    const existing = this.events.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const onEvent = (event) => {
        if (!predicate(event)) return;
        clearTimeout(timer);
        this.emitter.off('event', onEvent);
        resolve(event);
      };
      const timer = setTimeout(() => {
        this.emitter.off('event', onEvent);
        reject(new Error(`offline network event not observed within ${timeoutMs} ms`));
      }, timeoutMs);
      this.emitter.on('event', onEvent);
    });
  }

  summary() {
    const byService = {};
    for (const event of this.events) byService[event.service] = (byService[event.service] || 0) + 1;
    return {
      totalAttempts: this.events.length,
      blockedAttempts: this.events.filter((event) => event.result === 'blocked').length,
      redirectedToLoopback: this.events.filter((event) => event.result === 'redirected-to-loopback').length,
      successfulExternalConnections: 0,
      maxFailureMs: this.events.reduce((max, event) => Math.max(max, event.durationMs), 0),
      byService,
      events: [...this.events],
    };
  }

  uninstall() {
    if (!this.installed) return;
    globalThis.fetch = this.originals.fetch;
    http.request = this.originals.httpRequest;
    http.get = this.originals.httpGet;
    https.request = this.originals.httpsRequest;
    https.get = this.originals.httpsGet;
    net.connect = this.originals.netConnect;
    net.createConnection = this.originals.netCreateConnection;
    net.Socket.prototype.connect = this.originals.socketConnect;
    tls.connect = this.originals.tlsConnect;
    dns.lookup = this.originals.dnsLookup;
    dns.resolve = this.originals.dnsResolve;
    dns.resolve4 = this.originals.dnsResolve4;
    dns.resolve6 = this.originals.dnsResolve6;
    dns.resolveAny = this.originals.dnsResolveAny;
    this.installed = false;
  }
}

module.exports = {
  OfflineNetworkGuard,
  isLoopbackHost,
  normalizeHost,
};
