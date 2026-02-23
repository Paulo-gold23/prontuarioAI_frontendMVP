
// Configurações do Supabase (Vou deixar os campos para você preencher)
// Você encontra isso em Settings -> API no seu painel do Supabase
const SUPABASE_URL = 'https://bkkdexuzrjouafrwzdsw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJra2RleHV6cmpvdWFmcnd6ZHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzMwOTUsImV4cCI6MjA4NTYwOTA5NX0.yxnTQ9CuQKcOrY4aPoWCUpJxFwusHHwHV2fVc5jzVkI';



// Inicializa o cliente Supabase (disponível via CDN nos HTMLs)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient; // Disponibiliza globalmente como supabaseClient para evitar conflitos de nome com a lib

/**
 * Função global para proteger as rotas.
 * Se o usuário não tiver uma sessão ativa, redireciona para login.html
 */
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();

    // Se estivermos na página de login, não queremos redirecionar de volta pra ela
    const isLoginPage = window.location.pathname.includes('login.html');

    if (!session && !isLoginPage) {
        console.warn("Sessão não encontrada. Redirecionando para login...");
        window.location.href = 'login.html';
        return null;
    }

    if (session && isLoginPage) {
        // Se já está logado e tentou entrar no login, manda pra recepção
        window.location.href = 'recepcao.html';
        return session;
    }

    return session;
}

/**
 * Gera uma URL assinada temporária para arquivos privados
 * @param {string} bucket - Nome do bucket (ex: 'prontuarios_pdf')
 * @param {string} path - Caminho/nome do arquivo
 * @returns {Promise<string>} - URL assinada ou a original em caso de erro
 */
async function getSignedUrl(bucket, path) {
    try {
        // Se o path já for uma URL completa, extrai apenas o nome do arquivo
        const fileName = path.includes('/') ? path.split('/').pop() : path;

        const { data, error } = await supabaseClient
            .storage
            .from(bucket)
            .createSignedUrl(fileName, 300); // URL válida por 5 minutos (300s)

        if (error) throw error;
        return data.signedUrl;
    } catch (err) {
        console.error(`Erro ao assinar URL (${bucket}/${path}):`, err.message);
        return null;
    }
}

// Executa a checação imediatamente ao carregar o script
// (Exceto se for a página de login, onde a checagem é manual no form)
if (!window.location.pathname.includes('login.html')) {
    checkAuth();
}
