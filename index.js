// Firebase-Konfiguration und Initialisierung
const firebaseConfig = {
  apiKey: "AIzaSyA7MPdJVoY4dtJK5NtVpagmjWDLP6lxulE",
  authDomain: "miinigame-rutheneum.firebaseapp.com",
  databaseURL: "https://miinigame-rutheneum-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "miinigame-rutheneum",
  storageBucket: "miinigame-rutheneum.appspot.com",
  messagingSenderId: "8331688238",
  appId: "1:8331688238:web:b85657e7895bf28c1e22bf",
  measurementId: "G-GQYZJT93RJ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let birdY, birdVel, gravity = 0.5, jump = -8;
let pipes, pipeWidth = 50, gap = 120, frame, score, gameOver = false;
let currentUsername = "";
let topScores35 = [];

const startScreen = document.getElementById("startScreen");
const gameInfo = document.getElementById("gameInfo");
const countdownEl = document.getElementById("countdown");
const playerNameDisplay = document.getElementById("playerNameDisplay");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function resetGame() {
  birdY = 200;
  birdVel = 0;
  pipes = [];
  frame = 0;
  score = 0;
  gameOver = false;
}

function startGame() {
  currentUsername = document.getElementById("usernameInput").value.trim();
  if (!currentUsername) {
    alert("Bitte gib einen Namen ein!");
    return;
  }

  // UI wechseln
  startScreen.style.display = "none";
  gameInfo.style.display = "block";
  playerNameDisplay.textContent = "👤 " + currentUsername;
  countdownEl.style.display = "block";
  canvas.style.display = "none";

  loadTop35Scores(() => {
    startCountdown();
  });
}

function startCountdown() {
  let count = 3;
  countdownEl.textContent = count;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;
    } else {
      clearInterval(interval);
      countdownEl.style.display = "none";
      canvas.style.display = "block";
      resetGame();
      update();
    }
  }, 1000);
}

function drawBird() {
  ctx.fillStyle = "yellow";
  ctx.beginPath();
  ctx.arc(50, birdY, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawPipes() {
  ctx.fillStyle = "green";
  pipes.forEach(pipe => {
    ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
    ctx.fillRect(pipe.x, pipe.top + gap, pipeWidth, canvas.height - pipe.top - gap);
  });
}

function update() {
  if (gameOver) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  birdVel += gravity;
  birdY += birdVel;

  if (frame % 90 === 0) {
    let top = Math.random() * (canvas.height - gap - 100) + 20;
    pipes.push({ x: canvas.width, top });
  }

  pipes.forEach(pipe => {
    pipe.x -= 2;
  });

  // Punkte erhöhen, wenn Pipe vorbei
  pipes.forEach(pipe => {
    if (!pipe.passed && pipe.x + pipeWidth < 50) {
      score++;
      pipe.passed = true;
      onScoreUpdate(score);
    }
  });

  pipes = pipes.filter(pipe => pipe.x + pipeWidth > 0);

  // Kollision
  if (
    birdY > canvas.height || birdY < 0 ||
    pipes.some(pipe => pipe.x < 62 && pipe.x + pipeWidth > 38 && (birdY < pipe.top || birdY > pipe.top + gap))
  ) {
    endGame();
    return;
  }

  drawPipes();
  drawBird();

  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText("Score: " + score, 10, 25);

  frame++;
  requestAnimationFrame(update);
}

function endGame() {
  gameOver = true;

  ctx.fillStyle = "red";
  ctx.font = "40px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Game Over!", canvas.width / 2, canvas.height / 2);
  ctx.textAlign = "left";

  saveHighscore(score);

  setTimeout(() => {
    // UI zurücksetzen
    startScreen.style.display = "block";
    gameInfo.style.display = "none";
    canvas.style.display = "none";
    document.getElementById("usernameInput").value = "";
  }, 3000);
}

function loadTop35Scores(callback) {
  db.ref("highscores")
    .orderByChild("score")
    .limitToLast(35)
    .once("value")
    .then(snapshot => {
      topScores35 = [];
      snapshot.forEach(data => {
        topScores35.push({ key: data.key, ...data.val() });
      });
      topScores35.sort((a, b) => b.score - a.score);
      updateTop10UI();
      updateTop5UI();
      if (callback) callback();
    });
}

function updateTop10UI() {
  let html = "<h3>🏆 Top 10 Highscores</h3>";
  topScores35.slice(0, 10).forEach((s, i) => {
    html += `<div>${i + 1}. <strong>${escapeHtml(s.username)}</strong> - ${s.score} Punkte</div>`;
  });
  document.getElementById("highscoresStart").innerHTML = html;
}

function updateTop5UI() {
  let html = "<h3>🎮 Top 5 im Spiel</h3>";

  const combined = [...topScores35];
  const existingIndex = combined.findIndex(s => s.username === currentUsername && s.score === score);

  // Aktuellen Score temporär hinzufügen, falls nicht schon vorhanden und score>0
  if (score > 0 && existingIndex === -1) {
    combined.push({ username: currentUsername, score: score, time: Date.now() });
  }

  combined.sort((a, b) => b.score - a.score);
  const top5 = combined.slice(0, 5);

  top5.forEach((s, i) => {
    const highlight = (s.username === currentUsername && s.score === score) ? "highlight" : "";
    html += `<div class="${highlight}">${i + 1}. <strong>${escapeHtml(s.username)}</strong> - ${s.score} Punkte</div>`;
  });

  document.getElementById("highscoresGame").innerHTML = html;
}

function onScoreUpdate(newScore) {
  score = newScore;
  updateTop5UI();
}

function saveHighscore(finalScore) {
  if (!currentUsername) return;

  const ref = db.ref("highscores");

  // Fügt neuen Score hinzu
  ref.push({ username: currentUsername, score: finalScore, time: Date.now() }).then(() => {
    // Prüfe jetzt ob mehr als 35 Scores vorliegen, lösche die schlechtesten, falls nötig
    ref.once("value").then(snapshot => {
      let scores = [];
      snapshot.forEach(data => scores.push({ key: data.key, ...data.val() }));
      scores.sort((a, b) => b.score - a.score);

      if (scores.length > 35) {
        const toRemove = scores.slice(35);
        toRemove.forEach(item => {
          ref.child(item.key).remove();
        });
      }

      loadTop35Scores();
    });
  });
}
function sendFeedback() {
  const feedbackText = document.getElementById("feedbackInput").value.trim();
  if (!feedbackText) {
    alert("Bitte gib Feedback ein.");
    return;
  }
  // Optional: Benutzername mitanhängen
  const feedbackEntry = {
    username: currentUsername || "Anonym",
    feedback: feedbackText,
    time: Date.now()
  };
  firebase.database().ref("feedback").push(feedbackEntry)
    .then(() => {
      document.getElementById("feedbackMessage").textContent = "Danke für dein Feedback!";
      document.getElementById("feedbackInput").value = "";
    })
    .catch(err => {
      document.getElementById("feedbackMessage").textContent = "Fehler beim Absenden.";
      console.error(err);
    });
}

// Steuerung
document.addEventListener("keydown", e => {
  if (!gameOver && canvas.style.display === "block") birdVel = jump;
});
canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  if (!gameOver && canvas.style.display === "block") birdVel = jump;
});

// Beim Laden schon die Top 10 für die Startseite laden
loadTop35Scores();
