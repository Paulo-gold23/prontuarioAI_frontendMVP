# 📋 ROADMAP & DOCUMENTAÇÃO TÉCNICA — PRONTUAR.IO

**Projeto:** prontuar.IO  
**Versão do Documento:** 4.0  
**Data:** 20/03/2026  
**Status do Projeto:** 🔵 Fase 3 (Produto) — Autenticação Real + UX Finalizada  
**Autor:** Documentação atualizada para refletir o estado real do código-fonte (all files verified).

---

## 1. Visão Geral do Projeto

O **prontuar.IO** é um sistema de prontuário médico assistido por IA, voltado para clínicas de geriatria e especialidades correlatas. O fluxo principal envolve:

1. **Gravação de consultas por áudio** diretamente no navegador (Web API `MediaRecorder`)
2. **Transcrição automática** via Groq Whisper (`whisper-large-v3`)
3. **Extração clínica estruturada** via OpenAI GPT-4.1-mini (através de um agente n8n)
4. **Revisão e aprovação médica** com edição dos campos do prontuário em tela
5. **Geração de PDF clínico** via Gotenberg, armazenado no Supabase Storage com URL assinada

O sistema separa claramente as responsabilidades: a IA **sugere**, o médico **aprova**.

---

## 2. Arquitetura do Sistema

```
┌───────────────────────────────────────────────────────────────────┐
│                   FRONTEND (HTML/CSS/JS — Estático)               │
│  index.html → login.html → recepcao.html / medico-dashboard.html  │
│                   │→ atendimento.html (app.js)                    │
│  Servido via: python -m http.server 8000 (dev local)              │
│  Dependências CDN: Tailwind CSS, Supabase JS v2, Phosphor Icons   │
├───────────────────────────────────────────────────────────────────┤
│                  SCRIPTS GLOBAIS COMPARTILHADOS                   │
│  auth-guard.js  — Supabase Auth, proteção de rota, signed URLs    │
│  dark-mode.js   — Sistema de tema claro/escuro (localStorage)     │
├───────────────────────────────────────────────────────────────────┤
│                  BACKEND / ORQUESTRAÇÃO (n8n Cloud)               │
│  Workflow: Prontuario_AI_FINAL (ID: IewE4EVkamdV7adX) — ATIVO    │
│  Host: https://n8n.srv1181762.hstgr.cloud                         │
│  6 Webhooks Ativos (ver Seção 7)                                  │
├───────────────────────────────────────────────────────────────────┤
│                       INFRAESTRUTURA                              │
│  • PostgreSQL (Supabase) — projeto: prontuario_ia                 │
│    Região: sa-east-1 | ID: bkkdexuzrjouafrwzdsw                   │
│  • Supabase Auth — autenticação real (signInWithPassword)         │
│  • Supabase Storage — buckets: consultas_audio, prontuarios_pdf   │
│    (Buckets PRIVADOS — acesso via Signed URLs, 5min de validade)  │
│  • Groq Whisper — whisper-large-v3 (STT)                          │
│  • OpenAI GPT-4.1-mini — extração clínica (via agente n8n)        │
│  • Gotenberg — conversão HTML→PDF (103.199.185.100:3010)          │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Estrutura de Arquivos do Frontend

```
prontuario_project/
├── index.html              → Redireciona imediatamente para login.html (meta refresh)
├── login.html              → Tela de autenticação (Supabase signInWithPassword)
├── recepcao.html           → Painel de recepção: cadastro, busca e gestão de pacientes
├── medico-dashboard.html   → Painel médico: fila de pacientes e histórico de consultas
├── atendimento.html        → Tela de atendimento: gravação → IA → aprovação → PDF
├── auth-guard.js           → Script global: auth, roteamento, URLs assinadas
├── dark-mode.js            → Script global: tema claro/escuro com localStorage
├── app.js                  → Lógica da tela de atendimento (ligado ao atendimento.html)
├── styles.css              → Estilos adicionais ao Tailwind
├── n8n_workflow.json       → Exportação completa do workflow n8n (backup)
└── ROADMAP.md              → Este documento
```

---

## 4. Banco de Dados (Supabase — Schema `public`)

### 4.1 Tabela `medicos`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid` (PK) | Identificador interno do médico no banco relacional |
| `nome` | `varchar` | Nome curto ou display name |
| `crm` | `varchar` (unique) | CRM (e.g., "CRM/SP 123456") |
| `especialidade` | `varchar` | Padrão: `'Geriatria'` |
| `ativo` | `boolean` | Padrão: `true` |
| `created_at` | `timestamptz` | Data de cadastro |
| `nome_completo` | `varchar` | Nome completo para impressão no prontuário |
| `uf_crm` | `char` | UF do CRM (e.g., "SP") |
| `registro_sbgg` | `varchar` | Registro na Sociedade Brasileira de Geriatria e Gerontologia |
| `assinatura_url` | `text` | URL da assinatura digital para PDF |
| `auth_user_id` | `uuid` | FK para o UUID do Supabase Auth (mapeia o login ao registro clínico) |

> **⚠️ Relação auth\_user\_id:** O Supabase Auth gera um UUID por usuário. Este é diferente do `id` primário da tabela `medicos`. A coluna `auth_user_id` faz a ponte entre os dois. No login, o sistema busca por `auth_user_id = user.id` e carrega os dados relacionais corretos.

### 4.2 Tabela `pacientes`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid` (PK) | Identificador do paciente |
| `nome` | `varchar` | Nome completo |
| `sexo` | `varchar` | M / F / Outro |
| `data_nascimento` | `date` | Data de nascimento |
| `estado_civil` | `varchar` | Estado civil |
| `escolaridade` | `varchar` | Nível de escolaridade |
| `profissao` | `varchar` | Profissão |
| `telefone` | `varchar` | Telefone de contato |
| `responsavel_nome` | `varchar` | Nome do responsável/acompanhante |
| `responsavel_parentesco` | `varchar` | Grau de parentesco do responsável |
| `responsavel_telefone` | `varchar` | Telefone do responsável |
| `endereco` | `varchar` | Logradouro |
| `bairro` | `varchar` | Bairro |
| `cidade` | `varchar` | Cidade |
| `uf` | `char` | Estado (UF) |
| `cep` | `varchar` | CEP |
| `convenio` | `varchar` | Plano de saúde / convênio |
| `plano` | `varchar` | Nome do plano dentro do convênio |
| `medico_id` | `uuid` (FK → medicos.id) | Médico responsável |
| `created_at` / `updated_at` | `timestamptz` | Auditoria |

### 4.3 Tabela `consultas`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid` (PK) | Identificador da consulta |
| `medico_id` | `uuid` (FK → medicos.id) | Médico responsável |
| `paciente_id` | `uuid` (FK → pacientes.id) | Paciente atendido |
| `audio_url` | `text` | Caminho no Storage (bucket `consultas_audio`) |
| `audio_duracao_segundos` | `int` | Duração do áudio em segundos |
| `audio_size_mb` | `numeric` | Tamanho do arquivo de áudio |
| `transcricao_completa` | `text` | Transcrição bruta do Groq Whisper |
| `prontuario` | `jsonb` | Payload versionado (com chave `versoes[]` e `versao_ativa`) |
| `prontuario_json` | `jsonb` | Snapshot da versão ativa para consulta rápida |
| `hda` | `text` | História da Doença Atual (versão aprovada) |
| `exame_fisico` | `text` | Exame físico (versão aprovada) |
| `diagnostico` | `text` | Diagnóstico (versão aprovada) |
| `diagnostico_historico` | `text` | Diagnósticos anteriores relevantes |
| `tratamento` | `text` | Plano terapêutico (versão aprovada) |
| `cid_principal` | `varchar` | CID-10 principal |
| `cid_descricao` | `varchar` | Descrição textual do CID |
| `cids_secundarios` | `text[]` | Lista de CIDs secundários |
| `exames_apresentados` | `jsonb` | Exames trazidos pelo paciente |
| `status` | `varchar` | Estado do ciclo: `processando` → `transcrito` → `pendente_revisao` → `aprovado` → `finalizado` |
| `pdf_url` | `text` | Caminho no Storage (bucket `prontuarios_pdf`) |
| `numero_atendimento` | `int` (auto-increment) | Número sequencial do atendimento |
| `hora_atendimento` | `time` | Hora de início do atendimento |
| `hora_saida` | `time` | Hora de saída do paciente |
| `nome_arquivo` | `text` | Nome do arquivo de áudio gravado |
| `transcrito_em` / `processado_em` / `revisado_em` / `aprovado_em` / `finalizado_em` | `timestamptz` | Timestamps de auditoria por etapa |
| `created_at` / `updated_at` | `timestamptz` | Auditoria geral |

### 4.4 Sistema de Versionamento do Prontuário

O campo `prontuario` (JSONB) armazena um histórico completo de versões:

```json
{
  "versoes": [
    {
      "tipo": "ia",
      "conteudo": {
        "hda": "...",
        "exame_fisico": "...",
        "diagnostico": "...",
        "tratamento": "...",
        "observacoes": "..."
      },
      "criado_em": "2026-03-20T12:00:00Z"
    },
    {
      "tipo": "medico",
      "conteudo": { "..." },
      "criado_em": "2026-03-20T12:05:00Z"
    }
  ],
  "versao_ativa": "medico"
}
```

> A versão `"ia"` é sempre gerada primeiro. A versão `"medico"` sobrescreve ou complementa após a aprovação. A `versao_ativa` determina qual versão é usada para gerar o PDF.

---

## 5. Autenticação e Segurança (`auth-guard.js`)

### Fluxo de Login (`login.html`)

1. Usuário insere e-mail e senha
2. `supabaseClient.auth.signInWithPassword()` autentica via Supabase Auth
3. O sistema busca o registro relacional na tabela `medicos` usando `auth_user_id = user.id`
4. **Se encontrado na tabela `medicos`**: papel `medico` → redireciona para `medico-dashboard.html`
5. **Se não encontrado**: papel `recepcao` → redireciona para `recepcao.html`
6. O objeto `medico_ativo` é persistido no `localStorage` com `id`, `auth_id`, `nome`, `crm`, `especialidade`

### Proteção de Rotas (`checkAuth()`)

- Injetado em todas as páginas via `<script src="auth-guard.js">`
- Ao carregar qualquer página (exceto `login.html`), verifica se existe `session` ativa no Supabase
- Se não houver sessão: redireciona imediatamente para `login.html`
- Se houver sessão e o usuário tentar acessar `login.html`: redireciona para a área correta

### Signed URLs (`getSignedUrl()`)

- PDFs e áudios ficam em **buckets privados** no Supabase Storage
- A função `getSignedUrl(bucket, path)` gera uma URL temporária com **5 minutos de validade**
- Chamada toda vez que o usuário precisa baixar/ouvir um arquivo
- Evita exposição de links permanentes que possam ser vazados ou indexados

### Headers de Autenticação para Webhooks (`getAuthHeaders()`)

- A função `getAuthHeaders()` extrai o `access_token` da sessão ativa do Supabase
- Retorna o header `Authorization: Bearer <JWT>`
- Todas as chamadas para os webhooks do n8n incluem este header (implementado no `app.js`)
- O n8n pode validar este token para garantir que apenas usuários autenticados disparam os fluxos

---

## 6. Páginas do Frontend — Detalhamento

### 6.1 `index.html` — Redirecionador

Arquivo mínimo com `<meta http-equiv="refresh">` que envia qualquer acesso direto ao root para `login.html`. Sem lógica JavaScript.

---

### 6.2 `login.html` — Autenticação

**Funcionalidades:**
- Formulário único de e-mail + senha
- Autenticação real via `supabaseClient.auth.signInWithPassword()`
- Determinação de papel (médico vs. recepção) baseada na tabela `medicos`, não no e-mail
- Feedback visual de loading no botão de submit
- Mensagem de erro humanizada (distingue "credenciais inválidas" de "erro de conexão")
- Botão de Dark Mode no canto superior direito

**Dependências CDN:**
- Tailwind CSS
- Supabase JS v2
- Phosphor Icons
- Google Fonts (Inter)

---

### 6.3 `recepcao.html` — Painel de Recepção

**Funcionalidades:**
- Listagem dinâmica de todos os pacientes (via `GET /webhook/listarPacientes`)
- Modal de **cadastro de novo paciente** com campos completos (dados pessoais, endereço, convênio, responsável)
- Botão de **exclusão física** de paciente (via `DELETE /webhook/webhookExcluir`, com confirmação)
- Visualização de pacientes finalizados (status `finalizado` separado na listagem)
- Navegação para `medico-dashboard.html` (Área Médica)
- Dark Mode integrado ao navbar
- Design responsivo com colapso de elementos no mobile

---

### 6.4 `medico-dashboard.html` — Painel Médico

**Funcionalidades:**
- Fila de pacientes em tempo real (busca via `GET /webhook/listarPacientes`)
- Estatísticas no topo: contagem de pacientes **aguardando** e atendidos **hoje**
- Card de paciente com status visual (badges por cor): Aguardando / Em Atendimento / Finalizado
- Clique no card → navega para `atendimento.html?paciente=NOME&id=UUID&convenio=XX`
- **Histórico de consultas**: lista as `N` últimas consultas do médico logado (via `GET /webhook/webhookListarConsultas`)
  - Link de PDF com Signed URL (renovada dinamicamente)
  - Link de áudio com Signed URL (renovada dinamicamente)
  - Dados: nome do paciente, data, status
- Evita "blinking" no render do histórico usando `DocumentFragment` — os links são resolvidos assincronamente e injetados em lote
- Nome do médico exibido no navbar, carregado do `localStorage.medico_ativo`
- Botão "Novo Paciente" → vai direto para `recepcao.html`
- Botão de Dark Mode no navbar
- Botão "Encerrar Sessão" que chama `supabaseClient.auth.signOut()` e limpa `localStorage`
- Design responsivo com layout em glassmorphism

---

### 6.5 `atendimento.html` + `app.js` — Tela de Atendimento

Este é o coração do produto. A tela passa por **3 estágios sequenciais**:

#### Estágio 1 — Gravação de Áudio

- API nativa `MediaRecorder` do browser
- Detecção automática do formato de áudio mais suportado: `audio/webm` → `audio/webm;codecs=opus` → `audio/ogg;codecs=opus` → `audio/mp4`
- Verificação de permissão de microfone com mensagem de erro amigável
- **Botão Gravar**: alterna entre iniciar e parar com mudança de cor e ícone
- **Botão Pausar/Retomar**: toggle com indicador visual (âmbar quando pausado)
- **Timer MM:SS** em tempo real, pausável
- **Visualizador de ondas** (Canvas API + Web Audio API) durante a gravação, para o quando pausado
- Player HTML5 para revisão do áudio antes de enviar
- Botão "Recomeçar" com modal de confirmação custom
- Estado do paciente exibido no topo (nome, convênio, badge "Em Atendimento" com animação)
- Dados do paciente carregados de URL params: `?paciente=NOME&id=UUID&convenio=XX`

#### Estágio 2 — Processamento pela IA

- Botão "Analisar com IA" dispara `processarProntuario()`
- Envia `FormData` via `POST /webhook/novaConsulta`:
  - `audio`: Blob gravado
  - `paciente_id`: UUID do paciente selecionado
  - `medico_id`: UUID do médico logado (resolvido via `garantirMedicoId()`)
  - Header `Authorization: Bearer <JWT>` via `getAuthHeaders()`
- Exibe spinner + texto "IA analisando áudio..." durante o processamento
- Resposta preenche automaticamente os campos do prontuário:
  - HDA (História da Doença Atual)
  - Exame Físico
  - Diagnóstico
  - Tratamento (+ Observações appended se houver)

#### Estágio 3 — Aprovação Médica

- Campos editáveis: o médico pode corrigir qualquer campo extraído pela IA
- Botão "Aprovar e Gerar Prontuário" dispara PUT para `POST /webhook/aprovarConsulta`
- Payload enviado: `{ consulta_id, conteudo_medico: { hda, exame_fisico, diagnostico, tratamento } }`
- **Timeout de segurança de 25 segundos**: se o Gotenberg demorar, a UI força sucesso otimista para não frustrar o usuário enquanto o backend ainda trabalha
- Após aprovação: tela de conclusão com botão de download do PDF
- PDF acessível via Signed URL (5 min de validade, gerada em `getSignedUrl('prontuarios_pdf', consulta_id + '.pdf')`)
- Badge do paciente atualizado para "Finalizado" (verde)

**Toasts de feedback:** sistema de notificações custom no canto inferior direito (sucesso, erro, info) — sem dependências externas, built-in no `app.js`.

**Modais de confirmação custom:** diálogo `showConfirm()` nativo sem `window.confirm()`.

---

### 6.6 `dark-mode.js` — Tema Claro/Escuro

**Implementação:**
- IIFE (Immediately Invoked Function Expression) para execução antes do DOM render
- Aplica a classe `dark` ao `<html>` imediatamente se `localStorage.getItem('theme') === 'dark'` (evita flash)
- Injeta um `<style>` global no `<head>` com overrides completos para modo escuro via CSS `!important`
- Cobre: backgrounds, textos, bordas, inputs, textareas, selects, gradientes, sombras, badges coloridos, ícones, hover states, group hovers
- Controla qualquer botão com `id="theme-toggle"` nas páginas — não cria botão próprio
- Preserva preferência no `localStorage` com chave `theme` ('dark' / 'light')

---

## 7. Backend n8n — Fluxos e Webhooks

**Workflow:** `Prontuario_AI_FINAL` | **ID:** `IewE4EVkamdV7adX`  
**Base URL:** `https://n8n.srv1181762.hstgr.cloud`

### 7.1 Fluxo A — Cadastro de Paciente

**Webhook:** `POST /webhook/cadastroPaciente`  
**Status:** 🟢 100% Funcional

| Node | Tipo | Função |
|------|------|--------|
| `cadastroPaciente` | webhook | Recebe dados do formulário da recepção |
| `validaEfiltrar` | code | Valida campos obrigatórios, normaliza dados (trim, lowercase parcial) |
| `criarPaciente` | postgres | `INSERT INTO pacientes (...)` |
| `Respond to Webhook` | respondToWebhook | Retorna `{ success, paciente_id, nome, created_at }` |

**Campos aceitos:** `nome` (obrigatório), `data_nascimento`, `sexo`, `telefone`, `convenio`, `plano`, `responsavel_nome`, `responsavel_parentesco`, `responsavel_telefone`, `endereco`, `bairro`, `cidade`, `uf`, `cep`, `estado_civil`, `escolaridade`, `profissao`.

---

### 7.2 Fluxo B — Nova Consulta: Áudio → Transcrição → IA

**Webhook:** `POST /webhook/novaConsulta` (multipart/form-data)  
**Status:** 🟢 100% Funcional

| Node | Tipo | Função |
|------|------|--------|
| `novaConsulta` | webhook | Recebe áudio (blob) + `paciente_id` + `medico_id` |
| `prepararDados` | code | Prepara metadados, preserva o binário do áudio |
| `supabaseAudio` _(paralelo)_ | httpRequest | Upload do áudio → Supabase Storage (`consultas_audio`) |
| `stt_Groq` _(paralelo)_ | httpRequest | Envia áudio para Groq Whisper-large-v3 (STT) |
| `criarConsulta` | postgres | `INSERT INTO consultas (medico_id, paciente_id, status='processando')` |
| `att_consultaAudio` | postgres | Atualiza `audio_url` na consulta recém-criada |
| `stt_isOkay` | if | Verifica se a transcrição retornou texto válido (≥ 1 char) |
| `subirTranscicao` | postgres | Salva `transcricao_completa` e atualiza `status='transcrito'` |
| `extrair prontuario AI` | agent (LangChain) | Agente GPT-4.1-mini: extrai campos clínicos da transcrição |
| `ia_isOkay` | if | Valida JSON retornado pela IA (≥ 20 chars, sem termos genéricos na blacklist) |
| `parse` | code | Parseia e normaliza o JSON clínico |
| `saveProntuario` | postgres | Salva `prontuario` JSON e atualiza `status='pendente_revisao'` |
| `Respond to Webhook1` | respondToWebhook | Retorna `{ success, consulta_id, status, dados_extraidos }` |
| `error_tratamento` + `error_msg` | postgres + code | Tratamento de erro no STT |
| `error_ia` + `error_msg1` | postgres + code | Tratamento de erro na IA |
| `resolverMedicoId` | code | Resolve o `medico_id` interno a partir do JWT do Supabase Auth (se necessário) |

**Regras da IA (Prompt do Agente):**
- Extrai **APENAS** informações explicitamente mencionadas na transcrição
- **Não inventa**, deduz ou completa dados clínicos
- Retorna `null` para campos não mencionados
- Blacklist de termos genéricos que invalidam a extração

---

### 7.3 Fluxo C — Aprovação Médica → PDF

**Webhook:** `POST /webhook/aprovarConsulta`  
**Status:** 🟢 100% Funcional

| Node | Tipo | Função |
|------|------|--------|
| `aprovarConsulta` | webhook | Recebe `consulta_id` + `conteudo_medico` (JSON editado pelo médico) |
| `validarEntrada` | code | Valida que `consulta_id` existe e `conteudo_medico` não está vazio |
| `buscaConsulta` | postgres | `SELECT * FROM consultas JOIN medicos JOIN pacientes WHERE id = $1` |
| `statusValido` | if | Verifica se `status = 'pendente_revisao'` (bloqueia double-submit) |
| `criarVersaoMedico` | code | Cria objeto de versão `{ tipo: 'medico', conteudo: {...}, criado_em }` e insere no array `versoes` |
| `salvarprontuarioATT` | postgres | Atualiza `prontuario` (JSONB), `status='aprovado'`, campos `hda/exame_fisico/diagnostico/tratamento` |
| `gerarHTML` | code | Renderiza template HTML do prontuário com dados do médico, paciente e conteúdo clínico |
| `htmlTofile` | code | Converte a string HTML em arquivo binário para envio ao Gotenberg |
| `converterPDF` | httpRequest | POST multipart para Gotenberg: `HTML → PDF` (timeout: ~20s) |
| `uploadPDFtoDB` | httpRequest | Upload do PDF → Supabase Storage (`prontuarios_pdf`) com caminho `{consulta_id}.pdf` |
| `updtconsulta` | postgres | Atualiza `pdf_url`, `status='finalizado'`, `finalizado_em` |
| `Respond to Webhook3` | respondToWebhook | Retorna `{ success, consulta_id, status, pdf_url }` |

---

### 7.4 Fluxo D — Listagem de Pacientes

**Webhook:** `GET /webhook/listarPacientes`  
**Status:** 🟢 Funcional

| Node | Tipo | Função |
|------|------|--------|
| `listarPacientes` | webhook | Recebe requisição (com JWT opcional) |
| `listar` | postgres | `SELECT * FROM pacientes ORDER BY created_at DESC` |
| `Respond to Webhook2` | respondToWebhook | Retorna array de pacientes |

---

### 7.5 Fluxo E — Exclusão de Paciente

**Webhook:** `DELETE /webhook/webhookExcluir`  
**Status:** 🟢 Funcional

| Node | Tipo | Função |
|------|------|--------|
| `webhookExcluir` | webhook | Recebe `paciente_id` |
| `postgresDelete` | postgres | `DELETE FROM pacientes WHERE id = $1` |
| `responseExclusao` | respondToWebhook | Confirma exclusão |

---

### 7.6 Fluxo F — Histórico de Consultas do Médico

**Webhook:** `GET /webhook/webhookListarConsultas`  
**Status:** 🟢 Funcional

| Node | Tipo | Função |
|------|------|--------|
| `webhookListarConsultas` | webhook | Recebe JWT do médico logado |
| `resolverMedicoId` | code | Extrai `medico_id` interno a partir do JWT/auth_user_id |
| `postgresListarConsultas` | postgres | `SELECT consultas JOIN pacientes WHERE medico_id = $1 ORDER BY created_at DESC LIMIT 20` |
| `respondListarConsultas` | respondToWebhook | Retorna array de consultas com `nome_paciente`, `status`, `pdf_url`, `audio_url`, `created_at` |

---

## 8. Supabase Storage — Buckets

| Bucket | Visibilidade | Conteúdo | Acesso |
|--------|-------------|----------|--------|
| `consultas_audio` | **Privado** | Áudios das consultas (`.webm`, `.mp4`, etc.) | Signed URL (5 min) |
| `prontuarios_pdf` | **Privado** | PDFs dos prontuários aprovados (`.pdf`) | Signed URL (5 min) |

### Funcionamento das Signed URLs

```javascript
// auth-guard.js → getSignedUrl()
async function getSignedUrl(bucket, path) {
    const { data, error } = await supabaseClient.storage
        .from(bucket)
        .createSignedUrl(path, 300); // 300 segundos = 5 minutos
    return data.signedUrl;
}
```

- As URLs são geradas no frontend, não no backend
- Cada clique em "Baixar PDF" ou "Ouvir Áudio" gera uma nova URL
- Nunca são armazenadas permanentemente — apenas usadas no momento do acesso

---

## 9. Fluxo Completo de Atendimento

```
[RECEPÇÃO]
  Recepcionista faz login (role: recepcao)
  → Cadastra paciente novo (nome, telefone, convênio, ...)
  → Paciente aparece na fila

[MÉDICO]
  Médico faz login (role: medico)
  → Dashboard mostra fila de pacientes aguardando
  → Clica no nome do paciente → vai para atendimento.html

[ATENDIMENTO]
  Clica "Gravar" → MediaRecorder inicia
     (timer roda, visualizador de onda anima)
  Pausa/retoma se necessário
  Clica "Parar" → Player permite ouvir o áudio gravado

  Clica "Analisar com IA"
     → Blob enviado como FormData + JWT + medico_id + paciente_id
     → n8n: upload áudio (Storage) + transcrição Groq (paralelos)
     → n8n: agente GPT-4.1-mini extrai campos clínicos do texto
     → Frontend exibe campos preenchidos pela IA em textareas editáveis

  Médico revisa e edita os campos
  Clica "Aprovar e Gerar Prontuário"
     → n8n: salva prontuário versionado no banco
     → n8n: gera HTML → Gotenberg → PDF
     → n8n: upload PDF para Storage
     → Frontend exibe tela de conclusão com link de download (Signed URL)

  Badge do paciente → "Finalizado"
  Médico clica "Voltar para Fila" → ciclo reinicia
```

---

## 10. Macro-Fases do Projeto

| Fase | Status | Descrição |
|------|--------|-----------|
| **Fase 1** — Arquitetura + MVP Técnico | ✅ Concluída | Backend n8n funcional de ponta a ponta |
| **Fase 2** — MVP Validável (Piloto) | ✅ **Concluída** | Frontend funcional permitindo ciclo clínico completo |
| **Fase 3** — MVP de Produto | ✅ **Concluída** | Autenticação real, arquivos privados, dark mode, responsividade mobile |
| **Fase 4** — Conformidade e Escala | 🔄 Próxima etapa | Multi-clínicas, RLS Supabase, proteção dos webhooks, LGPD |

---

## 11. Próximos Passos (Backlog Priorizado)

| # | Tarefa | Estimativa | Observação |
|---|--------|------------|------------|
| 16 | **Proteção dos Webhooks do n8n** | 2h | Configurar o n8n para exigir e validar o header `Authorization: Bearer <JWT>` em cada webhook. O frontend já envia o header (via `getAuthHeaders()`). Falta a validação no lado do n8n. |
| 17 | **Row-Level Security (RLS) no Supabase** | 2h | Ativar RLS nas tabelas `pacientes` e `consultas` para garantir que médicos só vejam dados dos seus próprios pacientes. Atualmente `rls_enabled: false` nas 3 tabelas. |
| 18 | **Filtros de Busca na Recepção** | 1.5h | Barra de busca por nome ou convênio na lista de pacientes da recepção. |
| 19 | **Edição de Paciente** | 3h | Modal na recepção para editar dados cadastrais de um paciente existente (reutilizando o formulário de cadastro em modo de edição). |

---

## 12. Variáveis de Configuração

| Variável | Valor | Localidade |
|----------|-------|-----------|
| `SUPABASE_URL` | `https://bkkdexuzrjouafrwzdsw.supabase.co` | `auth-guard.js` linha 3 |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` (JWT anon key) | `auth-guard.js` linha 4 |
| `WEBHOOK_BASE_URL` | `https://n8n.srv1181762.hstgr.cloud/webhook` | `app.js` linha 32 |
| ID do Workflow n8n | `IewE4EVkamdV7adX` | `n8n_workflow.json` |
| ID do projeto Supabase | `bkkdexuzrjouafrwzdsw` | `auth-guard.js` |

---

## 13. Dependências Externas (CDN)

| Biblioteca | Versão | Uso |
|-----------|--------|-----|
| Tailwind CSS | via CDN | Estilização de todas as páginas |
| Supabase JS | v2 (CDN) | Auth, Postgres queries, Storage |
| Phosphor Icons | Web (CDN) | Ícones em todas as páginas |
| Google Fonts — Inter | — | Tipografia (login, recepção) |
| Google Fonts — Outfit | — | Tipografia (dashboard médico) |

> **Nota:** Todas as dependências são carregadas via CDN, sem `npm` ou bundler. O projeto roda como HTML estático puro.

---

## 14. Como Rodar Localmente

```bash
# No diretório do projeto
cd prontuario_project

# Subir servidor HTTP simples
python -m http.server 8000

# Acessar no browser
# http://localhost:8000
# → redireciona automaticamente para login.html
```

> O CORS dos webhooks n8n já está configurado para aceitar requisições de qualquer origem durante o desenvolvimento. Em produção, restringir para o domínio hospedado.

---

**Última atualização:** 20/03/2026  
**Estado real verificado em:** todos os arquivos `.html`, `.js`, schema Supabase e workflow n8n via MCP.
