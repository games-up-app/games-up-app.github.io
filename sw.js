// Service worker: recebe notificações push e abre o painel ao tocar.
// Não guarda dados do painel em cache (privacidade).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Só abre páginas do próprio app (o domínio é dividido com outro site).
function urlSegura(u) {
  const escopo = self.registration.scope;
  try {
    const alvo = new URL(typeof u === 'string' && /^\?[\w=&-]{0,100}$/.test(u) ? u : './', escopo);
    return alvo.href.startsWith(escopo) ? alvo.href : escopo;
  } catch { return escopo; }
}

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titulo: 'Games Up', texto: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Games Up', {
    body: d.texto || '',
    icon: 'icones/icone-192.png',
    badge: 'icones/icone-192.png',
    data: { url: urlSegura(d.url) },
    lang: 'pt-BR',
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = urlSegura(e.notification.data && e.notification.data.url ? '?' + (new URL(e.notification.data.url).search.slice(1)) : null);
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if (c.url.startsWith(self.registration.scope)) { await c.navigate(url).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
