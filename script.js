// The behaviour of the page lives here (the "logic").
// Keeping looks (styles.css) and logic (script.js) in separate files
// is the habit that makes turning this into a real app easier later.

const cheers = [
  "You did it! 🎉",
  "Look at you, building things! 💪",
  "That's a real web app on your screen. 🍰",
  "Nice work. Keep going! ✨",
];

const button = document.getElementById("cheer");
const message = document.getElementById("message");

button.addEventListener("click", () => {
  const random = cheers[Math.floor(Math.random() * cheers.length)];
  message.textContent = random;
});
