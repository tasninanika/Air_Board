const video = document.getElementById("input_video");
const canvas = document.getElementById("output_canvas");
const ctx = canvas.getContext("2d");
const typedTextDiv = document.getElementById("typedText");

let typedText = "";
let lastKey = null;
let lastTime = 0;
const keyboard = document.getElementsByClassName("key");

function getKeyUnderPointer(x, y) {
  for (let key of keyboard) {
    const rect = key.getBoundingClientRect();
    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      return key;
    }
  }
  return null;
}

function processKey(keyText) {
  switch (keyText) {
    case "Space":
      return typedText + " ";
    case "⌫":
      return typedText.slice(0, -1);
    case "↵":
      return typedText + "\n";
    default:
      return typedText + keyText;
  }
}

function onResults(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const key of keyboard) key.classList.remove("hovered", "glow");

  if (results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const tip = landmarks[8];

    ctx.beginPath();
    ctx.arc(tip.x * canvas.width, tip.y * canvas.height, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();

    const rect = canvas.getBoundingClientRect();
    const px = rect.left + tip.x * rect.width;
    const py = rect.top + tip.y * rect.height;

    const key = getKeyUnderPointer(px, py);
    if (key) {
      key.classList.add("hovered");

      if (Date.now() - lastTime > 700 || key.innerText !== lastKey) {
        key.classList.add("glow");
        typedText = processKey(key.innerText);
        typedTextDiv.textContent = typedText;
        lastKey = key.innerText;
        lastTime = Date.now();
      }
    }
  }
}

// Mediapipe setup
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
});
hands.onResults(onResults);

const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480,
});
camera.start();
