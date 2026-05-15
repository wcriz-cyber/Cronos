
export type NotificationType = 'buy' | 'sell' | 'alert' | 'error' | 'success';

class NotificationService {
  private sounds: Record<NotificationType, HTMLAudioElement>;

  constructor() {
    // Using high-quality notification sounds
    this.sounds = {
      buy: new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'),
      sell: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
      alert: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
      error: new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'),
      success: new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'),
    };

    // Preload them
    Object.values(this.sounds).forEach(audio => {
      audio.load();
      audio.volume = 0.5;
    });
  }

  play(type: NotificationType) {
    const sound = this.sounds[type];
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(e => console.warn('Audio playback blocked by browser:', e));
    }
  }

  notify(title: string, body: string, type: NotificationType = 'alert') {
    // 1. Play Sound
    this.play(type);

    // 2. Browser Push Notification if allowed
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/vite.svg' });
    }
  }

  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
}

export const notificationService = new NotificationService();
