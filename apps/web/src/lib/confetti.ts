import confetti from 'canvas-confetti';

export const fireConfetti = {
  fullScreen: () =>
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2563EB', '#7C3AED', '#059669', '#D97706'],
    }),
  fromElement: (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    confetti({ particleCount: 80, spread: 60, origin: { x, y } });
  },
};
