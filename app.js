const btnGravar = document.getElementById("btnGravar");
const btnParar = document.getElementById("btnParar");
const status = document.getElementById("status");
const timer = document.getElementById("timer");

let segundos = 0;
let timerInterval = null;

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

btnGravar.addEventListener("click", () => {
    status.textContent = "Gravando (simulado)";
    btnGravar.disabled = true;
    btnParar.disabled = false;
    iniciarTimer();
});

btnParar.addEventListener("click", () => {
    status.textContent = "Parado";
    btnGravar.disabled = false;
    btnParar.disabled = true;
    pararTimer();
});
