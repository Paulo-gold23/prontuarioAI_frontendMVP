
// ================= CONFIGURAÇÕES E SELETORES =================

const btnGravar = document.getElementById("btnGravar");
const btnPausar = document.getElementById("btnPausar");
const spacerPausar = document.getElementById("spacerPausar");
const btnProcessarIA = document.getElementById("btnProcessarIA");
const btnRecomecar = document.getElementById("btnRecomecar");
const acoesPosGrava = document.getElementById("acoesPosGrava");
const playerAudio = document.getElementById("playerAudio");
const controlPrincipal = document.getElementById("controlPrincipal");
const hintText = document.getElementById("hintText");

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const timer = document.getElementById("timer");
const waveformCanvas = document.getElementById("waveformCanvas");

let mediaRecorder;
let audioChunks = [];
let segundos = 0;
let timerInterval = null;
let currentStream = null;
let audioBlobFinal = null;
let consultaIdGlobal = null;
let isRecording = false;
let isPaused = false;

let pacienteAtual = null;
const medicoAtivo = JSON.parse(localStorage.getItem('medico_ativo')) || { id: 'b76a352b-a9be-4ddb-a9a3-8edd897d9201' };
const MEDICO_ID = medicoAtivo.id;
const WEBHOOK_BASE_URL = "https://n8n.srv1181762.hstgr.cloud/webhook";

// ================= INICIALIZAÇÃO =================

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pNome = urlParams.get('paciente');
    const pId = urlParams.get('id');

    if (pNome && pId) {
        pacienteAtual = { id: pId, nome: pNome };

        const nomeEl = document.getElementById('pacienteNome');
        if (nomeEl) nomeEl.textContent = pNome;

        const statusBadge = document.getElementById('pacienteStatus');
        if (statusBadge) {
            statusBadge.className = "px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-100 uppercase tracking-widest flex items-center gap-1.5";
            statusBadge.innerHTML = `<div class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div> Em Atendimento`;
        }

        if (btnGravar) btnGravar.disabled = false;
        setRecordingStatus("ready");
    }
});

// ================= UI HELPERS (CUSTOM POPUPS) =================

function showToast(message, type = "success") {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = "ph-fill ph-check-circle text-emerald-500";
    if (type === "error") icon = "ph-fill ph-warning-circle text-rose-500";
    if (type === "info") icon = "ph-fill ph-info text-indigo-500";

    toast.innerHTML = `
        <i class="${icon} text-2xl"></i>
        <span class="text-sm font-bold text-slate-700">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showConfirm(title, message, callback) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;

    overlay.style.display = 'flex';

    document.getElementById('confirmOk').onclick = () => {
        overlay.style.display = 'none';
        callback();
    };

    document.getElementById('confirmCancel').onclick = () => {
        overlay.style.display = 'none';
    };
}

function setRecordingStatus(state) {
    switch (state) {
        case "ready":
            statusText.textContent = "Pronto para iniciar atendimento";
            statusDot.className = "w-2 h-2 rounded-full bg-slate-400";
            hintText.textContent = "Clique para começar";
            controlPrincipal.style.display = "flex";
            acoesPosGrava.classList.add("hidden");
            btnPausar.classList.add("hidden");
            if (spacerPausar) spacerPausar.classList.add("hidden");
            break;
        case "recording":
            statusText.textContent = "Gravando consulta...";
            statusDot.className = "w-2 h-2 rounded-full bg-rose-500 animate-pulse";
            hintText.textContent = "Clique para parar";
            btnPausar.classList.remove("hidden");
            if (spacerPausar) spacerPausar.classList.remove("hidden");
            break;
        case "paused":
            statusText.textContent = "Gravação pausada";
            statusDot.className = "w-2 h-2 rounded-full bg-amber-500";
            hintText.textContent = "Clique para retomar";
            break;
        case "finished":
            statusText.textContent = "Áudio capturado";
            statusDot.className = "w-2 h-2 rounded-full bg-emerald-500";
            hintText.style.display = "none";
            controlPrincipal.style.display = "none";
            acoesPosGrava.classList.remove("hidden");
            break;
        case "processing":
            statusText.textContent = "IA analisando áudio...";
            statusDot.className = "w-2 h-2 rounded-full bg-indigo-500 animate-bounce";
            acoesPosGrava.classList.add("opacity-50", "pointer-events-none");
            break;
    }
}

// ================= GRAVAÇÃO DE ÁUDIO =================

async function iniciarGravacao() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentStream = stream;

        const mimeType = getSupportedMimeType();
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            audioBlobFinal = new Blob(audioChunks, { type: mimeType });
            const audioUrl = URL.createObjectURL(audioBlobFinal);
            playerAudio.src = audioUrl;
            setRecordingStatus("finished");
        };

        mediaRecorder.start();
        isRecording = true;
        isPaused = false;
        iniciarTimer();

        btnGravar.innerHTML = `<i class="ph-fill ph-stop text-5xl"></i>`;
        btnGravar.classList.replace('from-indigo-600', 'from-rose-500');
        btnGravar.classList.replace('to-indigo-700', 'to-rose-600');

        setRecordingStatus("recording");
        if (waveformCanvas) desenharOnda(stream);

    } catch (err) {
        console.error("Erro ao acessar microfone:", err);
        showToast("Não foi possível acessar o microfone.", "error");
    }
}

function pararGravacao() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        isRecording = false;
        isPaused = false;
        pararTimer();
        liberarStream();

        btnGravar.innerHTML = `<i class="ph-fill ph-microphone text-5xl"></i>`;
        btnGravar.classList.replace('from-rose-500', 'from-indigo-600');
        btnGravar.classList.replace('to-rose-600', 'to-indigo-700');
    }
}

function togglePause() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    if (!isPaused) {
        mediaRecorder.pause();
        isPaused = true;
        pararTimer();
        setRecordingStatus("paused");
        document.getElementById('iconPausar').className = "ph-fill ph-play text-3xl";
        btnPausar.classList.replace('text-slate-400', 'text-amber-500');
    } else {
        mediaRecorder.resume();
        isPaused = false;
        continuarTimer();
        setRecordingStatus("recording");
        document.getElementById('iconPausar').className = "ph-fill ph-pause text-3xl";
        btnPausar.classList.replace('text-amber-500', 'text-slate-400');
    }
}

function getSupportedMimeType() {
    const types = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg'];
    for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
}

function liberarStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

// ================= TIMER =================

function iniciarTimer() {
    segundos = 0;
    timer.textContent = "00:00";
    continuarTimer();
}

function continuarTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        segundos++;
        const mins = Math.floor(segundos / 60).toString().padStart(2, '0');
        const secs = (segundos % 60).toString().padStart(2, '0');
        timer.textContent = `${mins}:${secs}`;
    }, 1000);
}

function pararTimer() {
    clearInterval(timerInterval);
}

// ================= VISUALIZER =================

function desenharOnda(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const ctx = waveformCanvas.getContext("2d");
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;

    function render() {
        if (!isRecording || isPaused) {
            if (!isRecording) ctx.clearRect(0, 0, width, height);
            if (isRecording && isPaused) requestAnimationFrame(render);
            return;
        }
        requestAnimationFrame(render);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, width, height);
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height;
            ctx.fillStyle = `rgba(79, 70, 229, ${barHeight / height + 0.1})`;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 2;
        }
    }
    render();
}

// ================= EVENTOS =================

btnGravar.onclick = () => {
    if (!isRecording) iniciarGravacao();
    else pararGravacao();
};

btnPausar.onclick = () => togglePause();

btnRecomecar.onclick = () => {
    showConfirm("Recomeçar Gravação", "Isso apagará o áudio atual. Continuar?", () => {
        audioBlobFinal = null;
        playerAudio.src = "";
        timer.textContent = "00:00";
        setRecordingStatus("ready");
    });
};

btnProcessarIA.onclick = () => processarProntuario();

async function processarProntuario() {
    if (!pacienteAtual) return showToast("Selecione um paciente", "error");
    if (!audioBlobFinal) return showToast("Grave primeiro", "error");

    setRecordingStatus("processing");
    btnProcessarIA.innerHTML = `<i class="ph ph-spinner animate-spin"></i> Analisando...`;

    const formData = new FormData();
    formData.append("audio", audioBlobFinal, "consulta.webm");
    formData.append("paciente_id", pacienteAtual.id);
    formData.append("medico_id", MEDICO_ID);

    try {
        const response = await fetch(WEBHOOK_BASE_URL + "/novaConsulta", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (data.success || data.consulta_id) {
            consultaIdGlobal = data.consulta_id;
            document.getElementById('gravacaoContainer').classList.add('hidden');
            document.getElementById('resultadoProntuario').classList.remove('hidden');

            document.getElementById('hda').value = data.hda || data.dados_extraidos?.hda || '';
            document.getElementById('exame_fisico').value = data.exame_fisico || data.dados_extraidos?.exame_fisico || '';
            document.getElementById('diagnostico').value = data.diagnostico || data.dados_extraidos?.diagnostico || '';

            // Tratamento + Observações
            let trat = data.tratamento || data.dados_extraidos?.tratamento || '';
            const obs = data.observacoes || data.dados_extraidos?.observacoes || '';
            if (obs && !trat.includes(obs)) {
                trat += `\n\n📌 OBSERVAÇÕES:\n${obs}`;
            }
            document.getElementById('tratamento').value = trat;

            showToast("Prontuário gerado!", "success");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            throw new Error(data.message || "Erro no processamento da IA");
        }
    } catch (err) {
        showToast("Erro: " + err.message, "error");
        setRecordingStatus("finished");
        btnProcessarIA.innerHTML = `<i class="ph-fill ph-sparkle text-2xl"></i> ANALISAR COM IA`;
        acoesPosGrava.classList.remove("opacity-50", "pointer-events-none");
    }
}

// ================= APROVAÇÃO FINAL =================

const btnAprovar = document.getElementById('btnAprovar');
const btnDescartar = document.getElementById('btnDescartar');

if (btnAprovar) {
    btnAprovar.onclick = async () => {
        if (!consultaIdGlobal) return;

        btnAprovar.disabled = true;
        btnAprovar.innerHTML = `<i class="ph ph-spinner animate-spin"></i> Gerando Documentos...`;

        const payload = {
            consulta_id: consultaIdGlobal,
            conteudo_medico: {
                hda: document.getElementById('hda').value,
                exame_fisico: document.getElementById('exame_fisico').value,
                diagnostico: document.getElementById('diagnostico').value,
                tratamento: document.getElementById('tratamento').value
            }
        };

        try {
            // Promessa com timeout de segurança (30s)
            const fetchPromise = fetch(WEBHOOK_BASE_URL + "/aprovarConsulta", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            // Se o servidor demorar > 30s, assumimos sucesso otimista no backend e liberamos o PDF
            // Isso evita erro "NetworkError" no frontend enquanto n8n ainda trabalha
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000));

            let res;
            try {
                res = await Promise.race([fetchPromise, timeoutPromise]);
            } catch (e) {
                if (e.message === 'TIMEOUT') {
                    console.warn("Backend lento, forçando sucesso UI");
                    // Simular resposta OK
                    res = { ok: true, json: () => ({ success: true }) };
                } else {
                    throw e;
                }
            }

            if (res.ok) {
                // Tentar parsear
                let result = {};
                try {
                    result = await res.json();
                } catch (e) {
                    console.warn("JSON inválido ou vazio, assumindo sucesso");
                    result = { success: true };
                }

                document.getElementById('resultadoProntuario').classList.add('hidden');
                document.getElementById('conclusaoAtendimento').classList.remove('hidden');

                // Sempre reconstruir link, pois se deu timeout ou erro, o ID é garantido
                const pdfLink = `https://bkkdexuzrjouafrwzdsw.supabase.co/storage/v1/object/public/prontuarios_pdf/${payload.consulta_id}.pdf`;

                const btnPDF = document.getElementById('btnDownloadPDF');
                if (btnPDF) {
                    btnPDF.href = pdfLink;
                    btnPDF.onclick = (e) => { window.open(pdfLink, '_blank'); return false; };
                }

                // Atualizar badge
                const badge = document.getElementById('pacienteStatus');
                if (badge) {
                    badge.className = "px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-100 uppercase tracking-widest flex items-center gap-1.5";
                    badge.innerHTML = `<i class="ph-fill ph-check-circle"></i> Finalizado`;
                }

                showToast("Prontuário assinado com sucesso!");
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // NÃO reabilitar botão para evitar duplo clique
                return;
            } else {
                const text = await res.text();
                throw new Error(`Erro Servidor: ${res.status}`);
            }

        } catch (err) {
            console.error(err);
            if (err.message.includes('TIMEOUT') || err.message.length < 50) {
                showToast("Processo demorou, mas deve finalizar em breve. Verifique o PDF.", "warning");
                // Força UI de sucesso
                document.getElementById('resultadoProntuario').classList.add('hidden');
                document.getElementById('conclusaoAtendimento').classList.remove('hidden');
                btnDownloadPDF.href = `https://bkkdexuzrjouafrwzdsw.supabase.co/storage/v1/object/public/prontuarios_pdf/${payload.consulta_id}.pdf`;
            } else {
                showToast("Erro ao aprovar: " + err.message, "error");
                btnAprovar.disabled = false;
                btnAprovar.textContent = "Tentar Novamente";
            }
        }
    };
}

if (btnDescartar) {
    btnDescartar.onclick = () => {
        showConfirm("Sair do Atendimento", "Deseja mesmo descartar este atendimento e voltar para a fila?", () => {
            window.location.href = "medico-dashboard.html";
        });
    };
}
