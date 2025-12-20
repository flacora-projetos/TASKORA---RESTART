importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

// Config extraído do SDK do projeto (dacora---tarefas)
firebase.initializeApp({
  apiKey: "AIzaSyD8Qv-wQBJsGrYAhY_6T1iHdWCjtjmxtEQ",
  authDomain: "dacora---tarefas.firebaseapp.com",
  projectId: "dacora---tarefas",
  storageBucket: "dacora---tarefas.appspot.com",
  messagingSenderId: "406318974539",
  appId: "1:406318974539:web:d842997c1b064c0ba56fce"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload?.notification || {};
  const title = notification.title || "Taskora";
  const body = notification.body || "Você tem uma atualização.";
  const options = {
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: payload?.data || {}
  };
  self.registration.showNotification(title, options);
});
