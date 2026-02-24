self.addEventListener("push", event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/wtd-app/icons/icon-192.png"
    })
  );
});
