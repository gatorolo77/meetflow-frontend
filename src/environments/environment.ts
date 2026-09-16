function getApiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8080/api';
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8080/api';
  }

  if (protocol === 'https:' || port === '4200' || port === '') {
    return `${protocol}//${window.location.host}/api`;
  }

  return `http://${hostname}:8080/api`;
}

function getWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:8080/ws-signaling';
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:8080/ws-signaling';
  }

  if (protocol === 'https:' || port === '4200' || port === '') {
    return `${wsProtocol}//${window.location.host}/ws-signaling`;
  }

  return `${wsProtocol}//${hostname}:8080/ws-signaling`;
}

export const environment = {
  production: false,
  get apiUrl(): string { return getApiUrl(); },
  get wsUrl(): string { return getWsUrl(); }
};
