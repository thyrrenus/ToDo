// Utilidad para notificaciones nativas de escritorio del navegador

export const isNotificationsSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermissionState = () => {
  if (!isNotificationsSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async () => {
  if (!isNotificationsSupported()) {
    console.warn('Este navegador no soporta notificaciones de escritorio.');
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    localStorage.setItem('enableWebNotifications', 'true');
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    localStorage.setItem('enableWebNotifications', permission === 'granted' ? 'true' : 'false');
    return permission;
  } catch (err) {
    console.error('Error al solicitar permisos de notificaciones:', err);
    return 'denied';
  }
};

export const sendNotification = (title, body = '', options = {}) => {
  if (!isNotificationsSupported()) return null;

  // Check if Web Notifications are enabled in localStorage
  const isEnabled = localStorage.getItem('enableWebNotifications') !== 'false'; // Default to true if not set
  const permission = Notification.permission;

  if (!isEnabled || permission !== 'granted') {
    return null;
  }

  try {
    const defaultOptions = {
      body,
      icon: '/public/favicon.ico', // Fallback icon path
      badge: '/public/favicon.ico',
      tag: 'todo-productivity-alert',
      renotify: true,
      ...options
    };

    const notification = new Notification(title, defaultOptions);
    return notification;
  } catch (err) {
    console.error('Error al emitir la notificación de escritorio:', err);
    return null;
  }
};
