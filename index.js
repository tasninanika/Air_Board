const video = document.getElementById("input_video");
const canvas = document.getElementById("output_canvas");
const ctx = canvas.getContext("2d");
const typedTextDiv = document.getElementById("typedText");

let typedText = "";
let lastKeys = { left: null, right: null };
let lastTimes = { left: 0, right: 0 };
let isPointing = { left: false, right: false };

const keyboard = document.getElementsByClassName("key");

function getCoveredVideoDimensions() {
  const videoAspect = video.videoWidth / video.videoHeight;
  const canvasAspect = canvas.width / canvas.height;

  let width, height;
  if (videoAspect < canvasAspect) {
    width = canvas.width;
    height = canvas.width / videoAspect;
  } else {
    height = canvas.height;
    width = canvas.height * videoAspect;
  }

  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;

  return { width, height, x, y };
}

function updateCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
}

window.addEventListener("resize", updateCanvasSize);

video.addEventListener("loadedmetadata", () => {
  console.log("Video dimensions:", video.videoWidth, "x", video.videoHeight);
  updateCanvasSize();
});

video.addEventListener("error", (e) => {
  console.error("Video error:", e);
  typedTextDiv.textContent = "Camera error! Please check permissions.";
});

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  console.error("Camera API is not supported in this browser");
  typedTextDiv.textContent = "Camera not supported in this browser!";
}

function getKeyUnderPointer(x, y) {
  for (let key of keyboard) {
    const rect = key.getBoundingClientRect();
    const tolerance = 5;
    if (
      x >= rect.left - tolerance &&
      x <= rect.right + tolerance &&
      y >= rect.top - tolerance &&
      y <= rect.bottom + tolerance
    ) {
      return key;
    }
  }
  return null;
}

function isIndexFingerPointing(landmarks) {
  const indexTip = landmarks[8];
  const indexBase = landmarks[5];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const indexExtended = indexTip.y < indexBase.y;
  const othersFlexed =
    middleTip.y > indexBase.y &&
    ringTip.y > indexBase.y &&
    pinkyTip.y > indexBase.y;

  return indexExtended && othersFlexed;
}

function isHandOpen(landmarks) {
  return (
    landmarks[8].y < landmarks[6].y &&
    landmarks[12].y < landmarks[10].y &&
    landmarks[16].y < landmarks[14].y &&
    landmarks[20].y < landmarks[18].y
  );
}

function mapToScreen(x, y) {
  const rect = canvas.getBoundingClientRect();
  const { width, height, x: offsetX, y: offsetY } = getCoveredVideoDimensions();
  return {
    x: rect.left + (canvas.width - (offsetX + x * width)),
    y: rect.top + offsetY + y * height,
  };
}

function processKey(keyText) {
  switch (keyText) {
    case "Space":
      return typedText + " ";
    case "↵":
      if (typedText.trim().length > 0) {
        const blob = new Blob([typedText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "typed_text.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      return "";
    case "⌫":
      return typedText.slice(0, -1);
    default:
      return typedText + keyText;
  }
}

function processHand(landmarks, handIndex) {
  const indexTip = landmarks[8];
  const handedness = indexTip.x < 0.5 ? "left" : "right";

  isPointing[handedness] = isIndexFingerPointing(landmarks);

  const { x, y } = mapToScreen(indexTip.x, indexTip.y);
  const key = getKeyUnderPointer(x, y);

  if (key) {
    if (isPointing[handedness]) {
      key.classList.add("glow");
      if (
        key.innerText !== lastKeys[handedness] ||
        Date.now() - lastTimes[handedness] > 500
      ) {
        if (window.navigator.vibrate) {
          window.navigator.vibrate(50);
        }
        typedText = processKey(key.innerText);
        typedTextDiv.textContent = typedText;
        lastKeys[handedness] = key.innerText;
        lastTimes[handedness] = Date.now();
      }
    } else {
      key.classList.add("hovered");
    }
  } else {
    lastKeys[handedness] = null;
  }
}

function onResults(results) {
  updateCanvasSize();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  const { width, height, x: offsetX, y: offsetY } = getCoveredVideoDimensions();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.translate(offsetX, offsetY);
  ctx.scale(width / video.videoWidth, height / video.videoHeight);

  for (const key of keyboard) key.classList.remove("hovered", "glow");

  if (results.multiHandLandmarks.length > 0) {
    results.multiHandLandmarks.forEach((landmarks, index) => {
      const tip = landmarks[8];
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        tip.x * video.videoWidth,
        tip.y * video.videoHeight,
        4,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "#00FFAA";
      ctx.fill();
      ctx.restore();

      processHand(landmarks, index);
    });
  } else {
    lastKeys.left = null;
    lastKeys.right = null;
  }

  ctx.restore();
}

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
});

hands.onResults(onResults);

const camera = new Camera(video, {
  onFrame: async () => {
    try {
      await hands.send({ image: video });
    } catch (error) {
      console.error("MediaPipe error:", error);
      typedTextDiv.textContent = "Hand tracking error!";
    }
  },
  width: 1280,
  height: 720,
});

camera
  .start()
  .then(() => {
    console.log("Camera started successfully");
    typedTextDiv.textContent = "Start typing...";
    updateCanvasSize();
  })
  .catch((error) => {
    console.error("Camera start error:", error);
    typedTextDiv.textContent =
      "Camera access denied! Please allow camera access.";
  });

typedTextDiv.textContent = "Initializing camera...";
