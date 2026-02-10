const btnGravar = document.getElementById("btnGravar");
const btnParar = document.getElementById("btnParar");
const status = document.getElementById("status");
const timer = document.getElementById("timer");

let mediaRecorder;
let audioChunks = [];
let segundos = 0;
let timerInterval = null;

/* ================= TIMER ================= */

function iniciarTimer() {
    segundos = 0;
    timer.textContent = "00:00";

    timerInterval = setInterval(() => {
        segundos++;
        const min = String(Math.floor(segundos / 60)).padStart(2, "0");
        const sec = String(segundos % 60).padStart(2, "0");
        timer.textContent = `${min}:${sec}`;
    }, 1000);
}

function pararTimer() {
    clearInterval(timerInterval);
}

/* ================= GRAVAÇÃO ================= */

btnGravar.addEventListener("click", iniciarGravacao);
btnParar.addEventListener("click", pararGravacao);

async function iniciarGravacao() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm"
        });

        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstart = () => {
            status.textContent = "Gravando...";
            btnGravar.disabled = true;
            btnParar.disabled = false;
            iniciarTimer();
        };

        mediaRecorder.onstop = () => {
            pararTimer();
            status.textContent = "Áudio capturado";
            console.log("Chunks:", audioChunks);
        };

        mediaRecorder.start();

    } catch (err) {
        console.error(err);
        status.textContent = "Erro ao acessar microfone";
    }
}

function pararGravacao() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        btnGravar.disabled = false;
        btnParar.disabled = true;
    }
}
