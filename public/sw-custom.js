// Service Worker personalizzato per Loop
// Integrato automaticamente da vite-plugin-pwa tramite injectManifest

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const url = data.url || self.location.origin + '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

self.addEventListener('notificationclose', (event) => {
  // Potremmo tracciare dismiss per analytics future
  console.log('Notifica chiusa:', event.notification.tag)
})

// Periodic Background Sync: il browser sveglia il SW anche ad app chiusa
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'loop-reminders') {
    event.waitUntil(checkAndNotifyReminders())
  }
})

async function checkAndNotifyReminders() {
  try {
    const clients = await self.clients.matchAll({ type: 'window' })
    // Se c'è un client attivo, lascia che sia lui a notificare
    // (evita duplicati e permette l'accesso a IndexedDB con contesto fresco)
    const hasActiveClient = clients.some(c => c.visibilityState === 'visible')
    if (hasActiveClient) return

    // Apri una window invisibile solo se non ce n'è una
    // (serve per far girare il check nel contesto dell'app con Dexie)
    // In alternativa, notifica direttamente con dati statici
    // Soluzione pragmatica: mostra una notifica "generica" e l'app controllerà
    // quando torna in foreground
    for (const client of clients) {
      client.postMessage({ type: 'CHECK_REMINDERS' })
    }
  } catch (e) {
    console.warn('periodicsync error:', e)
  }
}

// Listener per messaggi dal client
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})