const SHARE_CACHE = 'financeos-share-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // รับ POST จาก share_target action
  if (e.request.method === 'POST' && url.searchParams.has('share')) {
    e.respondWith(handleShareTarget(e));
    return;
  }
});

async function handleShareTarget(e) {
  try {
    const data = await e.request.formData();
    const file = data.get('images');

    if (file && file.type.startsWith('image/')) {
      const ab = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(ab);
      const dataURL = `data:${file.type};base64,${b64}`;

      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (allClients.length > 0) {
        // แอปเปิดอยู่ — ส่ง message ตรงได้เลย
        allClients[0].postMessage({ type: 'SHARED_IMAGE', dataURL });
        allClients[0].focus();
      } else {
        // แอปปิดอยู่ — เก็บใน cache ไว้ก่อน
        const cache = await caches.open(SHARE_CACHE);
        await cache.put('pending-share', new Response(JSON.stringify({ dataURL })));
      }
    }
  } catch {}

  return Response.redirect('.', 303);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
