const canvas = document.querySelector("#game-board");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const statusElement = document.querySelector("#game-status");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");

const gridSize = 24;
const tileCount = canvas.width / gridSize;
const startSnake = [
  { x: 9, y: 10 },
  { x: 8, y: 10 },
  { x: 7, y: 10 },
];

const directions = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

let snake;
let food;
let direction;
let nextDirection;
let score;
let bestScore = readBestScore();
let gameTimer = null;
let gameState = "ready";

bestScoreElement.textContent = bestScore;
resetGame();

function resetGame() {
  snake = startSnake.map((segment) => ({ ...segment }));
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  food = placeFood();
  setState("ready");
  updateScore();
  draw();
  showOverlay("Snake", "Press Start or Space to play.");
}

function startGame() {
  if (gameState === "running") {
    return;
  }

  if (gameState === "gameover") {
    resetGame();
  }

  setState("running");
  hideOverlay();
  gameTimer = window.setInterval(tick, 120);
}

function pauseGame() {
  if (gameState !== "running") {
    return;
  }

  window.clearInterval(gameTimer);
  gameTimer = null;
  setState("paused");
  showOverlay("Paused", "Press Space or Start to continue.");
}

function restartGame() {
  window.clearInterval(gameTimer);
  gameTimer = null;
  resetGame();
}

function tick() {
  direction = nextDirection;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  if (isWallCollision(head) || isSnakeCollision(head)) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    food = placeFood();
    updateScore();
  } else {
    snake.pop();
  }

  draw();
}

function endGame() {
  window.clearInterval(gameTimer);
  gameTimer = null;
  setState("gameover");
  showOverlay("Game Over", "Press Restart or Space to try again.");
}

function placeFood() {
  let position;

  do {
    position = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (snake.some((segment) => segment.x === position.x && segment.y === position.y));

  return position;
}

function isWallCollision(position) {
  return position.x < 0 || position.y < 0 || position.x >= tileCount || position.y >= tileCount;
}

function isSnakeCollision(position) {
  return snake.some((segment) => segment.x === position.x && segment.y === position.y);
}

function queueDirection(newDirection) {
  const isReverse =
    newDirection.x + direction.x === 0 && newDirection.y + direction.y === 0;

  if (!isReverse) {
    nextDirection = newDirection;
  }
}

function updateScore() {
  scoreElement.textContent = score;

  if (score > bestScore) {
    bestScore = score;
    saveBestScore(bestScore);
    bestScoreElement.textContent = bestScore;
  }
}

function readBestScore() {
  try {
    return Number(localStorage.getItem("snakeBestScore") || 0);
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem("snakeBestScore", String(value));
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

function setState(nextState) {
  gameState = nextState;
  const labels = {
    ready: "Ready",
    running: "Playing",
    paused: "Paused",
    gameover: "Game Over",
  };

  statusElement.textContent = labels[nextState];
}

function draw() {
  context.fillStyle = "#0a0d09";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
}

function drawGrid() {
  context.strokeStyle = "rgba(255, 255, 255, 0.045)";
  context.lineWidth = 1;

  for (let index = 0; index <= tileCount; index += 1) {
    const position = index * gridSize + 0.5;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, position);
    context.lineTo(canvas.width, position);
    context.stroke();
  }
}

function drawSnake() {
  snake.forEach((segment, index) => {
    context.fillStyle = index === 0 ? "#c7f970" : "#82d173";
    context.fillRect(
      segment.x * gridSize + 2,
      segment.y * gridSize + 2,
      gridSize - 4,
      gridSize - 4,
    );
  });
}

function drawFood() {
  context.fillStyle = "#f25f5c";
  context.beginPath();
  context.arc(
    food.x * gridSize + gridSize / 2,
    food.y * gridSize + gridSize / 2,
    gridSize * 0.34,
    0,
    Math.PI * 2,
  );
  context.fill();
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (gameState === "running") {
      pauseGame();
    } else {
      startGame();
    }
    return;
  }

  const newDirection = directions[event.code];

  if (newDirection) {
    event.preventDefault();
    queueDirection(newDirection);
    if (gameState === "ready") {
      startGame();
    }
  }
});

document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("click", () => {
    const map = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    queueDirection(map[button.dataset.direction]);
    if (gameState === "ready") {
      startGame();
    }
  });
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
restartButton.addEventListener("click", restartGame);

if (new URLSearchParams(window.location.search).get("play") === "1") {
  startGame();
}
