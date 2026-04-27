const cardElement = document.querySelector("#story-card");
const previousCardElement = document.querySelector("#previous-card");
const previousCardIndexElement = document.querySelector("#previous-card-index");
const previousCardTitleElement = document.querySelector("#previous-card-title");
const previousCardBodyElement = document.querySelector("#previous-card-body");
const cardIndexElement = document.querySelector("#card-index");
const cardTitleElement = document.querySelector("#card-title");
const cardBodyElement = document.querySelector("#card-body");
const mechanicStatusElement = document.querySelector("#mechanic-status");
const leftChoiceElement = document.querySelector("#left-choice");
const rightChoiceElement = document.querySelector("#right-choice");
const leftButton = document.querySelector("#left-button");
const rightButton = document.querySelector("#right-button");
const leftHint = document.querySelector("#left-hint");
const rightHint = document.querySelector("#right-hint");
const endingPanel = document.querySelector("#ending-panel");
const endingLabelElement = document.querySelector("#ending-label");
const endingTitleElement = document.querySelector("#ending-title");
const endingTextElement = document.querySelector("#ending-text");
const restartButton = document.querySelector("#restart-button");

const cards = {
  firstMeet: {
    index: "Card 1",
    mechanic: "timedLeft",
    title: "上學路上與他/她相遇",
    body: "稻田旁的小路很窄，腳踏車鈴聲擦過清晨的霧氣。那一天，你們剛好並肩了一小段路。",
    leftText: "搭訕",
    rightText: "沉默",
    left: {
      message: "搭訕，相遇你們在一起了",
      next: "hometownWork",
    },
    right: {
      ending: "A",
      title: "結局 A",
      text: "畢業了依舊沒能跟他/她說上話",
    },
  },
  hometownWork: {
    index: "Card 2",
    mechanic: "tenClicksLeft",
    title: "出社會的爭執",
    body: "對方希望在鄉下找一份簡單穩定的工作。你看著遠方的城市燈火，心裡一直有另一種聲音。",
    leftText: "前往大城市",
    rightText: "留在鄉下",
    left: {
      message: "依然決然前往大城市，你們之間再也沒聯絡",
      next: "juniorCoworker",
    },
    right: {
      ending: "B",
      title: "結局 B",
      text: "在一個小舊公寓與叛逆期的兒子吵架",
    },
  },
  juniorCoworker: {
    index: "Card 3",
    mechanic: "holdRight",
    title: "工作上遇到了善解人意的學妹",
    body: "她向你訴苦感情問題。深夜的辦公室只剩鍵盤聲，和一杯已經冷掉的咖啡。",
    leftText: "陪她走下去",
    rightText: "介紹下屬",
    left: {
      ending: "C",
      title: "結局 C",
      text: "辦公室戀情穩定發展",
    },
    right: {
      message: "介紹有能力的下屬給他認識",
      next: "firstLoveWedding",
    },
  },
  firstLoveWedding: {
    index: "Card 4",
    mechanic: "waitBeforeChoice",
    title: "忙碌了半輩子受到初戀的結婚邀請函",
    body: "信封很薄，拿在手上卻有一種說不出的重量。日期就印在你已經排滿會議的那一天。",
    leftText: "不去",
    rightText: "前往祝福",
    left: {
      ending: "D",
      title: "結局 D",
      text: "不去！希望她未來過得很好，某天茫茫人海與他/她交錯而過",
    },
    right: {
      ending: "continue",
      title: "To Be Continue",
      text: "前往送上滿滿的祝福，卻遇到在暗自啜泣的他/她",
    },
  },
};

const endingD = cards.firstLoveWedding.left;

let currentCardId = "firstMeet";
let previousCard = null;
let dragStartX = 0;
let dragDeltaX = 0;
let isDragging = false;
let isResolving = false;
let clickCount = 0;
let holdTimer = null;
let statusTimer = null;
let cardStartedAt = 0;
let suppressNextRightClick = false;

renderCard();

function renderCard() {
  const card = cards[currentCardId];
  clearMechanicTimers();
  cardStartedAt = Date.now();
  clickCount = 0;
  isResolving = false;

  cardIndexElement.textContent = card.index;
  cardTitleElement.textContent = card.title;
  cardBodyElement.textContent = card.body;
  leftChoiceElement.textContent = card.leftText;
  rightChoiceElement.textContent = card.rightText;
  endingPanel.hidden = true;
  cardElement.hidden = false;
  leftButton.disabled = false;
  rightButton.disabled = false;
  renderPreviousCard();
  resetCardPosition();
  startCardMechanic(card);
}

function startCardMechanic(card) {
  if (card.mechanic === "timedLeft") {
    statusTimer = window.setInterval(() => {
      const remaining = Math.max(0, 5 - Math.floor((Date.now() - cardStartedAt) / 1000));
      mechanicStatusElement.textContent = `還有 ${remaining} 秒可以搭訕`;

      if (Date.now() - cardStartedAt >= 5000) {
        choose("right");
      }
    }, 120);
    return;
  }

  if (card.mechanic === "tenClicksLeft") {
    mechanicStatusElement.textContent = "前往大城市需要 10 次確認：0/10";
    return;
  }

  if (card.mechanic === "holdRight") {
    mechanicStatusElement.textContent = "按住「介紹下屬」一段時間才說得出口";
    return;
  }

  if (card.mechanic === "waitBeforeChoice") {
    statusTimer = window.setInterval(() => {
      const remaining = Math.max(0, 10 - Math.floor((Date.now() - cardStartedAt) / 1000));
      mechanicStatusElement.textContent = `再猶豫 ${remaining} 秒，就會自動選擇不去`;

      if (Date.now() - cardStartedAt >= 10000) {
        choose("left");
      }
    }, 120);
    return;
  }

  mechanicStatusElement.textContent = "";
}

function requestChoice(direction) {
  const card = cards[currentCardId];

  if (isResolving || !endingPanel.hidden) {
    return;
  }

  if (card.mechanic === "tenClicksLeft" && direction === "left") {
    clickCount += 1;
    mechanicStatusElement.textContent = `前往大城市需要 10 次確認：${clickCount}/10`;

    if (clickCount < 10) {
      pulseCard();
      return;
    }
  }

  if (card.mechanic === "holdRight" && direction === "right") {
    mechanicStatusElement.textContent = "請按住右側選擇，不要只點一下";
    pulseCard();
    return;
  }

  choose(direction);
}

function choose(direction) {
  if (isResolving) {
    return;
  }

  const card = cards[currentCardId];
  const outcome = card[direction];
  isResolving = true;
  clearMechanicTimers();
  animateChoice(direction);

  window.setTimeout(() => {
    if (outcome.ending) {
      showEnding(outcome);
      return;
    }

    previousCard = {
      index: card.index,
      title: card.title,
      body: outcome.message,
    };
    currentCardId = outcome.next;
    renderCard();
  }, 190);
}

function showEnding(outcome) {
  clearMechanicTimers();
  isResolving = true;
  cardElement.hidden = true;
  leftButton.disabled = true;
  rightButton.disabled = true;
  endingPanel.hidden = false;
  endingLabelElement.textContent = outcome.ending === "continue" ? "Prototype End" : `Ending ${outcome.ending}`;
  endingTitleElement.textContent = outcome.title;
  endingTextElement.textContent = outcome.text;
  previousCardElement.hidden = true;
  resetCardPosition();
}

function renderPreviousCard() {
  if (!previousCard) {
    previousCardElement.hidden = true;
    return;
  }

  previousCardIndexElement.textContent = previousCard.index;
  previousCardTitleElement.textContent = previousCard.title;
  previousCardBodyElement.textContent = previousCard.body;
  previousCardElement.hidden = false;
}

function beginHoldRight() {
  const card = cards[currentCardId];

  if (card.mechanic !== "holdRight" || isResolving) {
    return;
  }

  let progress = 0;
  mechanicStatusElement.textContent = "保持按住：0%";
  clearHoldTimer();
  holdTimer = window.setInterval(() => {
    progress += 8;
    mechanicStatusElement.textContent = `保持按住：${Math.min(progress, 100)}%`;

    if (progress >= 100) {
      clearHoldTimer();
      suppressNextRightClick = true;
      choose("right");
    }
  }, 120);
}

function clearHoldTimer() {
  window.clearInterval(holdTimer);
  holdTimer = null;
}

function clearMechanicTimers() {
  window.clearInterval(statusTimer);
  statusTimer = null;
  clearHoldTimer();
}

function animateChoice(direction) {
  const sign = direction === "left" ? -1 : 1;
  cardElement.style.transform = `translateX(${sign * 560}px) rotate(${sign * 16}deg)`;
  cardElement.style.boxShadow = "0 24px 80px rgba(78, 64, 42, 0.12)";
}

function pulseCard() {
  cardElement.style.transition = "transform 90ms ease";
  cardElement.style.transform = "translateX(0) scale(0.985)";
  window.setTimeout(resetCardPosition, 100);
}

function resetCardPosition() {
  cardElement.style.transition = "transform 180ms ease, box-shadow 180ms ease";
  cardElement.style.transform = "translateX(0) rotate(0deg)";
  cardElement.style.boxShadow = "0 24px 80px rgba(78, 64, 42, 0.24)";
  leftHint.style.opacity = 0;
  rightHint.style.opacity = 0;
}

function updateDragPosition(deltaX) {
  const rotation = deltaX / 22;
  cardElement.style.transition = "none";
  cardElement.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;
  leftHint.style.opacity = deltaX < 0 ? Math.min(Math.abs(deltaX) / 140, 1) : 0;
  rightHint.style.opacity = deltaX > 0 ? Math.min(deltaX / 140, 1) : 0;
}

cardElement.addEventListener("pointerdown", (event) => {
  if (endingPanel.hidden === false || isResolving) {
    return;
  }

  isDragging = true;
  dragStartX = event.clientX;
  dragDeltaX = 0;
  cardElement.setPointerCapture(event.pointerId);
});

cardElement.addEventListener("pointermove", (event) => {
  if (!isDragging) {
    return;
  }

  dragDeltaX = event.clientX - dragStartX;
  updateDragPosition(dragDeltaX);
});

cardElement.addEventListener("pointerup", () => {
  if (!isDragging) {
    return;
  }

  isDragging = false;

  if (dragDeltaX <= -120) {
    requestChoice("left");
  } else if (dragDeltaX >= 120) {
    requestChoice("right");
  } else {
    resetCardPosition();
  }
});

cardElement.addEventListener("pointercancel", () => {
  isDragging = false;
  resetCardPosition();
});

document.addEventListener("keydown", (event) => {
  if (!endingPanel.hidden) {
    return;
  }

  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    event.preventDefault();
    requestChoice("left");
  }

  if (event.code === "ArrowRight" || event.code === "KeyD") {
    event.preventDefault();
    requestChoice("right");
  }
});

leftButton.addEventListener("click", () => requestChoice("left"));
rightButton.addEventListener("click", () => {
  if (suppressNextRightClick) {
    suppressNextRightClick = false;
    return;
  }

  requestChoice("right");
});
rightButton.addEventListener("pointerdown", beginHoldRight);
rightButton.addEventListener("pointerup", clearHoldTimer);
rightButton.addEventListener("pointercancel", clearHoldTimer);
rightButton.addEventListener("pointerleave", clearHoldTimer);

restartButton.addEventListener("click", () => {
  clearMechanicTimers();
  currentCardId = "firstMeet";
  previousCard = null;
  renderCard();
});
