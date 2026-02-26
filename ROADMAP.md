# 📋 ROADMAP UNIFICADO – PRONTUÁRIO AI MVP

**Projeto:** Prontuário AI  
**Versão do Documento:** 3.3  
**Data:** 23/02/2026  
**Status do Projeto:** 🔵 Fase 3 (Produto) em Andamento
**Autor:** Atualizado após implementação de Autenticação Real no Supabase, Proteção de Arquivos Privados, Modo Noturno e Responsividade Mobile.

---

## 1. Visão Geral do Projeto

O **Prontuário AI** é um sistema de prontuário médico assistido por IA, baseado em:

1. **Gravação de consultas por áudio** (browser)
2. **Transcrição automática** (Groq Whisper)
3. **Extração clínica estruturada** (OpenAI GPT-4.1-mini)
4. **Revisão/aprovação médica** com versionamento e edição
5. **Geração de PDF clínico** versionado e armazenado

O projeto segue estratégia de **MVP orientado a fluxo clínico real**, priorizando confiabilidade, rastreabilidade e separação clara entre IA e decisão médica.

---

## 2. Arquitetura Atual do Sistema

```
┌──────────────────────────────────────────────────────────────────┐
│                     FRONTEND (HTML/CSS/JS)                       │
│  index.html + app.js + styles.css (arquivos locais)              │
│  + Tela embutida no n8n (/webhook/app) via Tailwind              │
├──────────────────────────────────────────────────────────────────┤
│                   BACKEND / ORQUESTRAÇÃO (n8n)                   │
│  Workflow: Prontuario_AI (ID: IewE4EVkamdV7adX) — ATIVO         │
│  4 webhooks: novaConsulta, cadastroPaciente, aprovarConsulta,app │
├──────────────────────────────────────────────────────────────────┤
│                      INFRAESTRUTURA                              │
│  • PostgreSQL (Supabase) — dados clínicos                        │
│  • Supabase Storage — áudios + PDFs                              │
│  • Groq Whisper (STT) — whisper-large-v3                         │
│  • OpenAI GPT-4.1-mini — extração clínica                       │
│  • Gotenberg (103.199.185.100:3010) — HTML→PDF                   │
└──────────────────────────────────────────────────────────────────┘
```

### Tabelas no Banco

| Tabela | Uso |
|--------|-----|
| `pacientes` | Dados cadastrais do paciente |
| `medicos` | Dados do médico (nome, CRM) |
| `consultas` | Consulta completa: áudio, transcrição, prontuário JSON, PDF, status |

### Schema do Prontuário (JSON)

```json
{
  "hda": "string ou null",
  "exame_fisico": "string ou null",
  "diagnostico": "string ou null",
  "diagnostico_historico": "string ou null",
  "tratamento": "string ou null",
  "observacoes": "string ou null"
}
```

---

## 3. Estado Atual — O Que Já Funciona

### 3.1 ✅ Fluxo A — Cadastro de Paciente (Backend)

**Webhook:** `POST /webhook/cadastroPaciente`  
**Status:** 🟢 100% Funcional

| Etapa | Node n8n | Status |
|-------|----------|--------|
| Receber dados | `cadastroPaciente` (webhook) | ✅ |
| Validar e normalizar | `validaEfiltrar` (code) | ✅ |
| Inserir no banco | `criarPaciente` (postgres) | ✅ |
| Responder com ID | `Respond to Webhook` | ✅ |

**Campos aceitos:** nome (obrigatório), data_nascimento, sexo, telefone, convenio, responsavel_nome, responsavel_parentesco, endereco, cidade, uf.

---

### 3.2 ✅ Fluxo B — Nova Consulta: Áudio → Transcrição → IA (Backend)

**Webhook:** `POST /webhook/novaConsulta` (multipart/form-data)  
**Status:** 🟢 100% Funcional

| Etapa | Node n8n | Status |
|-------|----------|--------|
| Receber áudio + IDs | `novaConsulta` (webhook, CORS habilitado) | ✅ |
| Preparar dados + preservar binário | `prepararDados` (code) | ✅ |
| Upload áudio → Supabase Storage | `supabaseAudio` (httpRequest) | ✅ |
| Atualizar audio_url na consulta | `att_consultaAudio` (postgres) | ✅ |
| Transcrição STT → Groq Whisper | `stt_Groq` (httpRequest) | ✅ |
| Criar registro da consulta | `criarConsulta` (postgres) | ✅ |
| Validar resposta STT | `stt_isOkay` (if) | ✅ |
| Salvar transcrição no banco | `subirTranscicao` (postgres) | ✅ |
| Extração clínica IA | `extrair prontuario AI` (agent, GPT-4.1-mini) | ✅ |
| Validar resposta IA | `ia_isOkay` (if) | ✅ |
| Parse e normalizar JSON | `parse` (code) | ✅ |
| Salvar prontuário JSON | `saveProntuario` (postgres) | ✅ |
| Responder com resultado | `Respond to Webhook1` | ✅ |
| Tratamento de erro STT | `error_tratamento` + `error_msg` | ✅ |
| Tratamento de erro IA | `error_ia` + `error_msg1` | ✅ |

**Fluxo paralelo:** `stt_Groq` (transcrição) e `supabaseAudio` (upload) rodam em paralelo após `prepararDados`.

**Regras da IA:**
- Extrai APENAS informações explícitas na transcrição
- NÃO inventa, deduz ou completa informações
- Retorna null para campos não mencionados
- Validação de conteúdo clínico mínimo (≥20 chars, blacklist de termos genéricos)

---

### 3.3 ✅ Fluxo C — Aprovação Médica → Versionamento → PDF (Backend)

**Webhook:** `POST /webhook/aprovarConsulta`  
**Status:** 🟢 100% Funcional (Corrigido em 13/02)

| Etapa | Node n8n | Status |
|-------|----------|--------|
| Receber consulta_id + conteudo_medico | `aprovarConsulta` (webhook corrigido para Response Node) | ✅ |
| Validar entrada | `validarEntrada` (code) | ✅ |
| Buscar consulta completa (JOIN) | `buscaConsulta` (postgres) | ✅ |
| Verificar status pendente_revisao | `statusValido` (if) | ✅ |
| Criar versão médica (versionamento) | `criarVersaoMedico` (code) | ✅ |
| Salvar prontuário atualizado | `salvarprontuarioATT` (postgres) | ✅ |
| Gerar HTML do prontuário | `gerarHTML` (code) | ✅ |
| Converter HTML → arquivo | `htmlTofile` (code) | ✅ |
| Converter → PDF (Gotenberg) | `converterPDF` (httpRequest) | ✅ |
| Upload PDF → Supabase Storage | `uploadPDFtoDB` (httpRequest) | ✅ |
| Atualizar consulta com PDF URL | `updtconsulta` (postgres) | ✅ |
| Responder com sucesso + PDF URL | `Respond to Webhook3` | ✅ |

**Sistema de versionamento:**
```json
{
  "versoes": [
    { "tipo": "ia", "conteudo": {...}, "criado_em": "..." },
    { "tipo": "medico", "conteudo": {...}, "criado_em": "..." }
  ],
  "versao_ativa": "medico"
}
```

---

### 3.4 ✅ Fluxo D — Tela Embutida no n8n (Prova de Conceito)

**Webhook:** `GET /webhook/app`  
**Status:** 🟡 Existe mas é limitada

Uma tela HTML mínima servida diretamente pelo n8n com:
- Cadastro de paciente (modal)
- Gravação de áudio (MediaRecorder, sem pause)
- **NÃO** envia áudio ao backend ainda
- Usa Tailwind CDN

---

### 3.5 ✅ Frontend Local (HTML/CSS/JS)

**Arquivos:** `index.html`, `app.js`, `styles.css`  
**Status:** � Funcional Completo (MVP Validável)

| Feature | Status |
|---------|--------|
| Captura de áudio via MediaRecorder API | ✅ |
| Detecção automática do melhor formato (audio/webm) | ✅ |
| Verificação de suporte do navegador | ✅ |
| Tratamento de permissões de microfone | ✅ |
| Botão Gravar com ícone SVG | ✅ |
| Botão Pausar/Retomar com toggle | ✅ |
| Botão Parar | ✅ |
| Timer de gravação (MM:SS) | ✅ |
| Player HTML5 integrado pós-gravação | ✅ |
| Design moderno com gradientes e efeitos | ✅ |
| Layout responsivo centralizado | ✅ |
| Envio via FormData (multipart/form-data) | ✅ |
| Envio de Blob direto (sem base64) | ✅ |
| Integração com webhook `/novaConsulta` | ✅ |
| Feedback visual (enviando/sucesso/erro) | ✅ |
| Separação de concerns (HTML/CSS/JS) | ✅ |
| Cadastro de paciente no frontend | ✅ |
| Seleção de paciente existente | ✅ (Concluído via Dashboard Médico) |
| Exclusão de pacientes | ✅ (Concluído na Recepção) |
| Redirecionamento automático | ✅ (`index.html` → `login.html`) |
| Visualização do prontuário gerado | ✅ |
| Tela de aprovação/edição médica | ✅ |
| Geração e Download de PDF | ✅ |
| Botão "Nova Consulta" / Reset | ✅ (Implementado no atendimento) |
| IDs dinâmicos | ✅ (Fluxo completo ID Paciente → Fila → Atendimento) |

**IDs hardcoded atuais (temporários):**
- Médico: `b76a352b-a9be-4ddb-a9a3-8edd897d9201`
- Webhook: `https://n8n.srv1181762.hstgr.cloud/webhook/novaConsulta` (Produção)

---

## 4. Macro-Fases do Projeto

| Fase | Status | Descrição |
|------|--------|-----------|
| **Fase 1** — Arquitetura + MVP Técnico | ✅ Concluída | Backend n8n funcional de ponta a ponta |
| **Fase 2** — MVP Validável (Piloto) | ✅ **CONCLUÍDA** (13/02) | Frontend funcional permitindo ciclo completo |
| **Fase 3** — MVP de Produto | 🔄 **EM PLANEJAMENTO** | Frontend dedicado, autenticação, UX refinado |
| **Fase 4** — Escala | ⏳ Futuro | Multi-médicos, multi-clínicas, LGPD |

---

## 4.1 🔄 Alterações Recentes (23/02/2026)

### ✅ Segurança e Autenticação (Real Auth)
- **Supabase Auth:** Substituição do login "mocado" por autenticação real de usuários utilizando a API oficial do Supabase (`signInWithPassword`).
- **Sincronização de IDs:** Correção do problema de foreign keys atrelando o UUID de autenticação do médico ao registro relacional interno da clínica.
- **Roteamento Protegido:** Injeção do `auth-guard.js` centralizado em todos os pontos, proibindo acesso anônimo a URLs e expulsando imediatamente via `signOut()`.
- **Arquivos Privados (Signed URLs):** PDFs e áudios de consulta (no Storage) se tornaram privados. O sistema agora usa URLs temporárias e assinadas para download bloqueando curiosos, robôs ou vazamentos pelo link público.

### ✅ UX, Estabilidade e Frontend
- **Modo Noturno (Dark Mode):** Sistema global de tema escuro ativado via botão no cabeçalho. Cores redefinidas, contrastes corrigidos, e fundos suavizados sem usar recortes de layout abruptos (pervenindo faixas desbotadas). Armazena a preferência na sessão (`localStorage`).
- **Problema de "Blinking" na Fila:** Redesenho completo do render de Histórico Médico usando `DocumentFragment` no DOM, evitando que a tela pisque constantemente enquanto links privados são descriptografados pelo cliente. Loop de timeout alongado.
- **Responsividade Mobile Completa:** Identificado e corrigido o estouro horizontal (`overflow-x-hidden`) no celular. Texto e espaçamento (`gaps`/`margens`) do header foram colapsados para não expulsar botões críticos da tela em aparelhos móveis.
- **Refino no Botão PDF:** Modificado o evento onClick (download do PDF) para barrar comportamento padrão de redirecionamento ou page-refresh no caso de PDFs que ainda estão sendo finalizados pelos nós do bot.
- **Continuidade de Fluxo:** Botão superior "Novo Paciente" na tela de consulta agora joga o usuário imediatamente de volta à recepção.

---

## 5. 🔵 FASE 3 — MVP DE PRODUTO (Plano Detalhado)

### Objetivo
> Transformar o MVP técnico em um produto polido e seguro para uso recorrente em clínica.

### Critério de Saída
> Sistema estável, multi-sessão, com gestão de histórico.

---

### 5.1 🔴 Prioridade CRÍTICA (UX e Estabilidade)

#### P5 — Botão "Nova Gravação" / Reset (✅ CONCLUÍDO)
- [x] Resetar todo o estado após aprovação (Tela de Sucesso)
- [x] Link de download do PDF na tela final
- [x] Botão "Voltar para Fila" funcional sem F5

#### P8 — Gestão de Pacientes (✅ CONCLUÍDO)
- [x] Endpoint `listarPacientes` no n8n corrigido
- [x] Exclusão física de pacientes no banco (via Recepção)
- [x] Dashboard Médico dinâmico (Fila Real)
- [x] Visualização de pacientes finalizados na Recepção

#### P9 — Polimento do Prontuário (✅ CONCLUÍDO - 19/02)
- [x] Correção de Encoding (UTF-8) e Acentos
- [x] Design Profissional (Fontes, Espaçamento)
- [x] Correção de Datas (DD/MM/AAAA e Fuso Horário)
- [x] Link de Áudio funcional no Histórico

---

### 5.2 🟡 Prioridade ALTA (Segurança e Histórico Real)

#### P10 — Autenticação e Perfis (✅ CONCLUÍDO - 23/02)
- [x] Login no frontend com Supabase Auth integrado
- [x] Proteção de rotas com expulsão baseada em tokens JWT (`auth-guard.js`)
- [x] Nome do médico vindo dinamicamente pela sessão validada
- [x] Remoção de mock logins (`admin/admin123`) e IDs em código duro

#### P12 — Histórico Segurou de Atendimentos (✅ CONCLUÍDO - 23/02)
- [x] Implementação dos nós `listarConsultas` listando informações corretas do usuário pareado
- [x] Permissão das *Privacidade de Storage* para pastas, forçando uso de API e Tokens temporários para recuperar arquivos.
- [x] Ocultar carregamento instável e renderizar DocumentFragment limpo.

#### P13 — Experiência Mobile & UI (✅ CONCLUÍDO - 23/02)
- [x] Botão central de Dark Mode integrado nas navegações
- [x] Prevenção de quebra de grid (Overflow-X) em celulares, compactando ícones e palavras irrelevantes do cabeçalho.
- [x] Ajustes nos backgrounds, eliminando faixas estáticas no escuro.
- [x] Botão atrativo "Novo Paciente" na UI do médico permitindo ciclo autônomo entre telas sem dor.

---

## 6. Plano de Execução — Próximos Passos

### 📅 Próximo Ciclo: Orquestração e Conformidade Final

| # | Tarefa | Estimativa | Observação |
|---|--------|-----------|------------|
| 16 | Proteção de Webhooks do n8n | 2h | Exigir "Token HTTP" Bearer vindo do front (JWT Auth) para aceitar envios de formulário, eliminando links abertos publicamente. |
| 17 | Nível de Segurança (RLS - Supabase) | 2h | Configurar *Row-Level Security* para garantir que médicos só puxem/vejam pacientes baseados no JWT assinado. |
| 18 | Filtros de Pesquisa na Recepção | 1.5h | Barra de Busca simples na Recepção para CPF / Nome do Paciente e re-uso do perfil clínico antigo. |
| 19 | Edição e Exibição Completa de Pacientes | 3h | O modal da recepção deve abrir capacidade para edição total do paciente ou geração de export de dossiê completo. |

---

## 7. Endpoints do Backend (Referência Rápida)

| Endpoint | Método | Input | Output |
|----------|--------|-------|--------|
| `/webhook/cadastroPaciente` | GET | `{ nome, data_nascimento, sexo, telefone, convenio, ... }` | `{ success, paciente_id, nome, created_at }` |
| `/webhook/novaConsulta` | POST (multipart) | `audio` (blob) + `paciente_id` + `medico_id` | `{ success, consulta_id, status, dados_extraidos }` |
| `/webhook/aprovarConsulta` | POST | `{ consulta_id, conteudo_medico }` | `{ success, consulta_id, status, pdf_url }` |
| `/webhook/app` | GET | — | HTML da tela embutida (POC) |

**Base URL (Produção):** `https://n8n.srv1181762.hstgr.cloud`  

---

## 11. Conclusão

O projeto concluiu a **Fase 3 (Produto Real)** em relação a Frontend e UX: abandonamos os Mocks e passamos a usar infraestrutura estrita com **Autenticação, Sessões Criptografadas no Supabase e UX Fluida para PC e Celulares.** O sistema de documentação e STT encontra-se em regime maduro, isolando o áudio e os PDFs através de links temporários controlados pelo sistema.

O foco para o encerramento do pacote atual muda para a camada grossa de dev-ops: **Assegurar os Webhooks do n8n com tokens Bearer (fechando a rede inteira em zero-trust) e habilitar funcionalidades de re-atendimento (busca ou edição de pacientes antigos) para concluir o loop contínuo de clínica.**

**Status Final:** Sistema Seguro, Design Refinado e Pronto para Escala via Autenticação Unificada.

**Última atualização:** 23/02/2026
