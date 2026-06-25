import React, { useState, useMemo, useEffect } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
} from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

// ---------------------------------------------------------------------------
// CAMADA DE STORAGE — Firebase Firestore
// Implementa a mesma API (get/set/list) que o restante do código já usa,
// mas agora gravando de verdade em um banco compartilhado na nuvem.
// Qualquer pessoa que abrir este app, de qualquer computador, grava e lê
// do mesmo banco — o que faz o Painel CGE funcionar com dados reais de
// todas as UCIs.
// ---------------------------------------------------------------------------
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const COLECAO = "uci_trilha_diagnosticos";

if (typeof window !== "undefined") {
  window.storage = {
    async set(key, value) {
      try {
        await setDoc(doc(db, COLECAO, key), { value, savedAt: Date.now() });
        return { key, value };
      } catch (e) {
        console.error("Erro ao salvar no Firestore:", e);
        return null;
      }
    },
    async get(key) {
      // não utilizado pelo restante do código nesta versão, mantido por
      // compatibilidade de API.
      throw new Error("get individual não implementado — use list");
    },
    async list(prefix = "") {
      const snap = await getDocs(collection(db, COLECAO));
      const keys = [];
      snap.forEach((d) => {
        if (d.id.startsWith(prefix)) keys.push(d.id);
      });
      return { keys, _docs: snap };
    },
  };
}

// Helper usado pelo Painel: lê todos os documentos da coleção de uma vez,
// já parseando o JSON salvo em cada um.
async function listarTodosDiagnosticos() {
  const snap = await getDocs(collection(db, COLECAO));
  const itens = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data && data.value) {
      try {
        itens.push(JSON.parse(data.value));
      } catch (_) {
        // ignora documento corrompido
      }
    }
  });
  return itens;
}

// ---------------------------------------------------------------------------
// DADOS DO MODELO
// ---------------------------------------------------------------------------

const ORGAOS = [
  "ADAGRO", "ADEPE", "AGE", "APAC", "ARPE", "ATDEFN", "ATI", "CAMIL", "CEHAB", "CEPE",
  "COMPESA", "CONDEPE/FIDEM", "COPERGÁS", "CPRH", "CTM", "DER", "DETRAN", "EMPETUR", "EPC", "EPTI",
  "FACEPE", "FUNAPE", "FUNASE", "FUNDARPE", "GAB VICE-GOV", "HEMOPE", "IASSEPE", "IPA", "IPEM", "ITERPE",
  "JUCEPE", "LAFEPE", "PERPART", "PGE", "PORTO RECIFE", "SAD", "SAS", "SCGE", "SCJ", "SDA",
  "SDEC", "SDS", "SDS-CBMPE", "SDS-DASIS", "SDS-PCPE", "SDS-PMPE", "SEAP", "SECMULHER", "SECTI", "SECULT",
  "SEDEPE", "SEDUH", "SEE", "SEFAZ", "SEMAS", "SEMOBI", "SEPE", "SEPLAG", "SES", "SES-APEVISA",
  "SES-HAM", "SES-HBL", "SES-HGV", "SES-HOF", "SES-HR", "SES-HRA", "SES-LACEN", "SESP", "SETUR", "SJDHPV",
  "SRHS", "SUAPE", "UPE",
];

const FUNCOES_UCI = ["Titular", "Adjunto", "Membro"];

const TEMAS = [
  { id: "t1", nome: "Contratações Públicas", curto: "Contratações" },
  { id: "t2", nome: "Obras e Serviços de Engenharia", curto: "Obras" },
  { id: "t3", nome: "Convênios", curto: "Convênios" },
  { id: "t4", nome: "Integridade", curto: "Integridade" },
  { id: "t5", nome: "Correição", curto: "Correição" },
  { id: "t6", nome: "LGPD", curto: "LGPD" },
  { id: "t7", nome: "Transparência", curto: "Transparência" },
  { id: "t8", nome: "Prestação de Contas", curto: "Prest. Contas" },
  { id: "t9", nome: "Demandas de Órgãos de Controle", curto: "Órgãos Controle" },
  { id: "t10", nome: "Execução Orçamentária e Financeira", curto: "Orç./Financ." },
  { id: "t11", nome: "Gestão de Riscos", curto: "Riscos" },
  { id: "t12", nome: "Mapeamento e Melhoria de Processos", curto: "Processos" },
  { id: "t13", nome: "Análise de Dados e Informações Gerenciais", curto: "Dados Gerenciais" },
];

// Módulo 1 — Ambiente (3 perguntas por tema, escala de 5 pontos). invert:true
// significa que a ORDEM das opções já está dada de forma que opcao[0]=1 ... opcao[4]=5
// deve ser invertida no cálculo (índice 4 vira o valor 1, e por aí vai).
const MODULO1 = {
  t1: [
    { q: "O órgão realiza grande volume de contratações públicas?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
    { q: "O órgão enfrenta atrasos, questionamentos ou impugnações em seus processos de contratação?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Os órgãos de controle costumam apontar problemas relacionados a contratações?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
  ],
  t2: [
    { q: "O órgão executa obras ou serviços de engenharia com frequência?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Os contratos de obras do órgão sofrem aditivos, paralisações ou reformulações com frequência?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Existem problemas recorrentes relacionados a obras públicas?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
  ],
  t3: [
    { q: "O órgão celebra convênios ou instrumentos congêneres com frequência?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "O órgão tem dificuldade para cumprir prazos ou exigências na execução de convênios?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Existem ocorrências recorrentes relacionadas à execução ou prestação de contas de convênios?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
  ],
  t4: [
    { q: "Existem denúncias, conflitos de interesse ou situações relacionadas à ética com frequência?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "O órgão possui desafios relevantes relacionados à cultura de integridade?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
    { q: "O órgão possui canal de denúncias ou comitê de integridade estruturado e em funcionamento?", opts: ["Sempre", "Frequentemente", "Às vezes", "Raramente", "Nunca"], invert: true },
  ],
  t5: [
    { q: "Existem PADs ou sindicâncias com frequência no órgão?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Existem ocorrências que demandam apuração disciplinar regularmente?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Os processos disciplinares do órgão costumam ultrapassar os prazos legais?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
  ],
  t6: [
    { q: "O órgão trata grande volume de dados pessoais?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
    { q: "O órgão trata dados pessoais sensíveis?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Existem dúvidas ou dificuldades recorrentes relacionadas à LGPD?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
  ],
  t7: [
    { q: "O órgão recebe solicitações de acesso à informação com frequência?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Existem dificuldades relacionadas à transparência ativa?", opts: ["Não", "Baixa", "Média", "Alta", "Muito alta"] },
    { q: "O órgão já foi notificado ou penalizado por falhas de transparência ativa?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
  ],
  t8: [
    { q: "A prestação de contas anual exige esforço significativo do órgão?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
    { q: "Existem dificuldades recorrentes relacionadas ao eTCEPE ou aos pontos de controle?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "O órgão tem histórico de pendências ou ressalvas na prestação de contas anual?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
  ],
  t9: [
    { q: "O órgão recebe demandas de órgãos de controle com frequência?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "O acompanhamento de determinações e recomendações consome esforço significativo da UCI?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
    { q: "A UCI enfrenta dificuldades para coordenar respostas aos órgãos de controle?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
  ],
  t10: [
    { q: "O órgão enfrenta contingenciamentos, remanejamentos ou problemas de fluxo de caixa com frequência?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Existem inconsistências ou problemas recorrentes relacionados à execução orçamentária e financeira?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "O uso do e-Fisco é relevante para as atividades da UCI?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
  ],
  t11: [
    { q: "O órgão já enfrentou eventos de risco que geraram impacto relevante (financeiro, operacional ou de imagem)?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Problemas relevantes poderiam ser evitados com melhor gestão de riscos?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "O órgão possui dificuldades para identificar e monitorar riscos?", opts: ["Não", "Baixo", "Médio", "Alto", "Muito alto"] },
  ],
  t12: [
    { q: "Os principais processos do órgão estão mapeados e documentados?", opts: ["Todos", "A maioria", "Cerca da metade", "Poucos", "Nenhum"], invert: true },
    { q: "Os processos do órgão geram retrabalho, gargalos ou reclamações de outras áreas?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
    { q: "Problemas decorrem de processos mal definidos, não padronizados ou com retrabalho?", opts: ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"] },
  ],
  t13: [
    { q: "O órgão utiliza indicadores para monitorar resultados institucionais?", opts: ["Não utiliza", "Utiliza poucos", "Utiliza alguns", "Utiliza bastante", "Utiliza amplamente"] },
    { q: "Existe dificuldade para obter, consolidar ou analisar dados necessários às atividades da UCI?", opts: ["Não", "Baixa", "Média", "Alta", "Muito alta"] },
    { q: "Os sistemas e bases de dados do órgão fornecem informações suficientes para apoiar a atuação da UCI?", opts: ["Sempre", "Frequentemente", "Às vezes", "Raramente", "Nunca"], invert: true },
  ],
};

// Módulo 2 — Exigência: pergunta única para todos os temas (ver componente Modulo2).
const ESCALA_FREQ = ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Muito frequentemente"];

// Módulo 3 — Conhecimento (2 perguntas por tema)
// tipo "normativo": o saber teórico é essencialmente legislação/normas/conceitos jurídicos.
// tipo "tecnico": o saber teórico é metodologia/técnica/normas de referência (não legislação).
const MODULO3 = {
  t1: { teorico: "contratações públicas", pratico: "contratações públicas", tipo: "normativo" },
  t2: { teorico: "obras e serviços de engenharia", pratico: "obras e serviços de engenharia", tipo: "normativo" },
  t3: { teorico: "convênios e instrumentos congêneres", pratico: "convênios", tipo: "normativo" },
  t4: { teorico: "integridade pública", pratico: "integridade", tipo: "normativo" },
  t5: { teorico: "correição (PADs, sindicâncias, apuração disciplinar)", pratico: "correição", tipo: "normativo" },
  t6: { teorico: "LGPD e proteção de dados pessoais", pratico: "LGPD", tipo: "normativo" },
  t7: { teorico: "transparência pública", pratico: "transparência", tipo: "normativo" },
  t8: { teorico: "prestação de contas (eTCEPE, pontos de controle)", pratico: "prestação de contas", tipo: "normativo" },
  t9: { teorico: "funcionamento e exigências dos órgãos de controle", pratico: "atender demandas de órgãos de controle", tipo: "normativo" },
  t10: { teorico: "execução orçamentária e financeira", pratico: "execução orçamentária e financeira", tipo: "normativo" },
  t11: { teorico: "gestão de riscos", pratico: "gestão de riscos", tipo: "tecnico" },
  t12: { teorico: "mapeamento e melhoria de processos", pratico: "mapeamento e melhoria de processos", tipo: "tecnico" },
  t13: { teorico: "análise de dados e informações gerenciais", pratico: "análise de dados e informações gerenciais", tipo: "tecnico" },
};
const ESCALA_TEORICO = ["Nenhum", "Básico", "Intermediário", "Adequado", "Avançado"];
const ESCALA_PRATICO = ["Nenhuma", "Pouca", "Moderada", "Considerável", "Ampla"];

// ---------------------------------------------------------------------------
// FAIXAS DE CLASSIFICAÇÃO (4 faixas, escala de criticidade 1 a 5)
// ---------------------------------------------------------------------------
// Recursos de estudo recomendados por tema (cursos e livro).
// Itens entre aspas são placeholders fictícios — trocar pelo conteúdo real
// quando disponível. Os cursos de "Riscos" e "GD3" já são reais.
const RECURSOS = {
  t1: {
    cursos: [{ nome: '"Nova Lei de Licitações na Prática"', instrutor: '"Carlos Eduardo Matias"' }],
    livro: { titulo: '"Manual de Contratações Públicas"', autor: '"Helena Bittencourt"', editora: "Editora Fictícia" },
  },
  t2: {
    cursos: [{ nome: '"Fiscalização de Obras Públicas"', instrutor: '"Rodrigo Andrade Lima"' }],
    livro: { titulo: '"Gestão de Contratos de Engenharia"', autor: '"Marcos Vinícius Teles"', editora: "Editora Fictícia" },
  },
  t3: {
    cursos: [{ nome: '"Convênios e Transferências Voluntárias"', instrutor: '"Patrícia Albuquerque"' }],
    livro: { titulo: '"Manual de Prestação de Contas de Convênios"', autor: '"Fernando Costa Lins"', editora: "Editora Fictícia" },
  },
  t4: {
    cursos: [{ nome: '"Programas de Integridade no Setor Público"', instrutor: '"Juliana Wanderley"' }],
    livro: { titulo: '"Ética e Integridade na Administração Pública"', autor: '"Roberto Salgado"', editora: "Editora Fictícia" },
  },
  t5: {
    cursos: [{ nome: '"Processo Administrativo Disciplinar na Prática"', instrutor: '"Tiago Monteiro"' }],
    livro: { titulo: '"Manual de Correição Administrativa"', autor: '"Ana Cláudia Pessoa"', editora: "Editora Fictícia" },
  },
  t6: {
    cursos: [{ nome: '"LGPD na Administração Pública"', instrutor: '"Camila Resende"' }],
    livro: { titulo: '"Proteção de Dados Pessoais no Setor Público"', autor: '"Bruno Cavalcanti"', editora: "Editora Fictícia" },
  },
  t7: {
    cursos: [{ nome: '"Transparência Ativa e Lei de Acesso à Informação"', instrutor: '"Eduardo Farias"' }],
    livro: { titulo: '"Manual de Transparência Pública"', autor: '"Larissa Nascimento"', editora: "Editora Fictícia" },
  },
  t8: {
    cursos: [{ nome: '"Prestação de Contas e eTCEPE na Prática"', instrutor: '"Marcelo Tavares"' }],
    livro: { titulo: '"Manual de Prestação de Contas Anual"', autor: '"Renata Siqueira"', editora: "Editora Fictícia" },
  },
  t9: {
    cursos: [{ nome: '"Atendimento a Órgãos de Controle"', instrutor: '"Felipe Aragão"' }],
    livro: { titulo: '"Manual de Relacionamento com Órgãos de Controle"', autor: '"Cristina Holanda"', editora: "Editora Fictícia" },
  },
  t10: {
    cursos: [
      { nome: "GD3 — Gestão de Teto de Gastos", instrutor: '"a definir"' },
      { nome: '"Execução Orçamentária na Prática"', instrutor: '"Diego Barros"' },
    ],
    livro: { titulo: '"Manual de Execução Orçamentária e Financeira"', autor: '"Vanessa Lira"', editora: "Editora Fictícia" },
  },
  t11: {
    cursos: [
      { nome: "Gestão de Riscos em 7 Passos", instrutor: '"a definir"' },
      { nome: "Riscos nas Contratações com Apoio de IA", instrutor: '"a definir"' },
    ],
    livro: { titulo: '"Gestão de Riscos no Setor Público"', autor: '"Gustavo Peixoto"', editora: "Editora Fictícia" },
  },
  t12: {
    cursos: [{ nome: '"Mapeamento de Processos com BPMN"', instrutor: '"Aline Souto"' }],
    livro: { titulo: '"Gestão de Processos na Administração Pública"', autor: '"Henrique Dantas"', editora: "Editora Fictícia" },
  },
  t13: {
    cursos: [{ nome: '"Análise de Dados para Gestão Pública"', instrutor: '"Paulo Vasconcelos"' }],
    livro: { titulo: '"Indicadores e Painéis de Gestão"', autor: '"Simone Araújo"', editora: "Editora Fictícia" },
  },
};

const FAIXAS = [
  { min: 3.85, max: 5.01, nome: "Crítico", cor: "#A13D2E", bg: "#F8EAE6" },
  { min: 2.95, max: 3.85, nome: "Alto", cor: "#C47A1F", bg: "#FBF0DF" },
  { min: 2.05, max: 2.95, nome: "Moderado", cor: "#8A8530", bg: "#F6F4E0" },
  { min: 0, max: 2.05, nome: "Baixo", cor: "#2E7D6B", bg: "#E3F0EC" },
];
function faixaDe(valor) {
  return FAIXAS.find((f) => valor >= f.min && valor < f.max) || FAIXAS[FAIXAS.length - 1];
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

const TELAS = ["intro", "identificacao", "modulo1", "modulo2", "modulo3", "resultado", "painel"];

export default function TrilhaUCI() {
  const [tela, setTela] = useState("intro");
  const [respM1, setRespM1] = useState({}); // { "t1-0": valorBruto(0..4) }
  const [respM2, setRespM2] = useState({}); // { t1: 0..4 }
  const [respM3, setRespM3] = useState({}); // { "t1-teorico": 0..4, "t1-pratico": 0..4 }
  const [identificacao, setIdentificacao] = useState({ orgao: "", respondente: "", funcao: "" });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(false);
  const [jaSalvou, setJaSalvou] = useState(false);

  // -------------------- progresso --------------------
  const totalM1 = TEMAS.length * 3;
  const totalM2 = TEMAS.length;
  const totalM3 = TEMAS.length * 2;

  const feitoM1 = Object.keys(respM1).length;
  const feitoM2 = Object.keys(respM2).length;
  const feitoM3 = Object.keys(respM3).length;

  const m1Completo = feitoM1 === totalM1;
  const m2Completo = feitoM2 === totalM2;
  const m3Completo = feitoM3 === totalM3;
  const tudoCompleto = m1Completo && m2Completo && m3Completo;
  const pendenciasOutrosModulos = [
    !m1Completo && `Ambiente (${totalM1 - feitoM1} restante${totalM1 - feitoM1 > 1 ? "s" : ""})`,
    !m2Completo && `Exigência (${totalM2 - feitoM2} restante${totalM2 - feitoM2 > 1 ? "s" : ""})`,
  ].filter(Boolean);

  // -------------------- cálculo de scores --------------------
  const resultados = useMemo(() => {
    return TEMAS.map((t) => {
      // Ambiente: média das 3 perguntas (já normalizadas 1-5, considerando inversão)
      const perguntas = MODULO1[t.id];
      let somaAmb = 0;
      for (let i = 0; i < perguntas.length; i++) {
        const key = `${t.id}-${i}`;
        const bruto = respM1[key]; // índice 0..4 selecionado
        if (bruto === undefined) continue;
        const valor = perguntas[i].invert ? 5 - bruto : bruto + 1; // 1..5
        somaAmb += valor;
      }
      const ambiente = perguntas.length ? somaAmb / perguntas.length : 0;

      // Exigência: valor direto (1-5)
      const brutoExig = respM2[t.id];
      const exigencia = brutoExig !== undefined ? brutoExig + 1 : 0;

      // Conhecimento: média teórico + prático, depois gap = 6 - media
      const teo = respM3[`${t.id}-teorico`];
      const pra = respM3[`${t.id}-pratico`];
      const temTeo = teo !== undefined;
      const temPra = pra !== undefined;
      let conhecimento = 0;
      if (temTeo && temPra) conhecimento = ((teo + 1) + (pra + 1)) / 2;
      else if (temTeo) conhecimento = teo + 1;
      else if (temPra) conhecimento = pra + 1;
      const gapConhecimento = conhecimento ? 6 - conhecimento : 0;

      const criticidade = (ambiente + exigencia + gapConhecimento) / 3;

      return {
        ...t,
        ambiente: Number(ambiente.toFixed(2)),
        exigencia: Number(exigencia.toFixed(2)),
        conhecimento: Number(conhecimento.toFixed(2)),
        gapConhecimento: Number(gapConhecimento.toFixed(2)),
        criticidade: Number(criticidade.toFixed(2)),
      };
    }).sort((a, b) => b.criticidade - a.criticidade);
  }, [respM1, respM2, respM3]);

  const radarData = resultados.map((r) => ({
    tema: r.curto,
    criticidade: r.criticidade,
    full: 5,
  }));

  // -------------------- salvar no storage compartilhado --------------------
  const salvarResultado = async () => {
    if (jaSalvou || salvando) return;
    setSalvando(true);
    setErroSalvar(false);
    try {
      const registro = {
        orgao: identificacao.orgao.trim(),
        respondente: identificacao.respondente.trim(),
        funcao: identificacao.funcao.trim(),
        dataISO: new Date().toISOString(),
        resultados: resultados.map((r) => ({
          id: r.id,
          nome: r.nome,
          ambiente: r.ambiente,
          exigencia: r.exigencia,
          conhecimento: r.conhecimento,
          gapConhecimento: r.gapConhecimento,
          criticidade: r.criticidade,
        })),
      };
      const chave = `diagnostico:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const ok = await window.storage.set(chave, JSON.stringify(registro), true);
      if (!ok) throw new Error("Falha ao salvar");
      setJaSalvou(true);
    } catch (e) {
      setErroSalvar(true);
    } finally {
      setSalvando(false);
    }
  };

  // -------------------- handlers --------------------
  const setM1 = (temaId, idx, val) =>
    setRespM1((prev) => ({ ...prev, [`${temaId}-${idx}`]: val }));
  const setM2 = (temaId, val) =>
    setRespM2((prev) => ({ ...prev, [temaId]: val }));
  const setM3 = (temaId, campo, val) =>
    setRespM3((prev) => ({ ...prev, [`${temaId}-${campo}`]: val }));

  const indiceTela = TELAS.indexOf(tela);

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>
      <Header tela={tela} onIrPara={setTela} feitoM1={feitoM1} totalM1={totalM1} feitoM2={feitoM2} totalM2={totalM2} feitoM3={feitoM3} totalM3={totalM3} />

      <main style={styles.main}>
        {tela === "intro" && <Intro onStart={() => setTela("identificacao")} />}

        {tela === "identificacao" && (
          <Identificacao
            valores={identificacao}
            onChange={setIdentificacao}
            onAvançar={() => setTela("modulo1")}
          />
        )}

        {tela === "modulo1" && (
          <Modulo1
            respostas={respM1}
            onSet={setM1}
            onAvançar={() => setTela("modulo2")}
            completo={m1Completo}
            feito={feitoM1}
            total={totalM1}
          />
        )}

        {tela === "modulo2" && (
          <Modulo2
            respostas={respM2}
            onSet={setM2}
            onAvançar={() => setTela("modulo3")}
            onVoltar={() => setTela("modulo1")}
            completo={m2Completo}
            feito={feitoM2}
            total={totalM2}
          />
        )}

        {tela === "modulo3" && (
          <Modulo3
            respostas={respM3}
            onSet={setM3}
            onAvançar={() => {
              setTela("resultado");
              salvarResultado();
            }}
            onVoltar={() => setTela("modulo2")}
            completo={tudoCompleto}
            feito={feitoM3}
            total={totalM3}
            pendenciasOutrosModulos={pendenciasOutrosModulos}
          />
        )}

        {tela === "resultado" && (
          <Resultado
            resultados={resultados}
            radarData={radarData}
            onVoltar={() => setTela("modulo3")}
            salvando={salvando}
            jaSalvou={jaSalvou}
            erroSalvar={erroSalvar}
            onTentarSalvarNovamente={salvarResultado}
            onReiniciar={() => {
              setRespM1({});
              setRespM2({});
              setRespM3({});
              setIdentificacao({ orgao: "", respondente: "", funcao: "" });
              setJaSalvou(false);
              setErroSalvar(false);
              setTela("intro");
            }}
          />
        )}

        {tela === "painel" && (
          <PainelGerencial onSair={() => setTela("intro")} />
        )}
      </main>

      {tela === "intro" && (
        <button style={styles.painelLinkDiscreto} onClick={() => setTela("painel")}>
          Painel CGE
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HEADER
// ---------------------------------------------------------------------------
function Header({ tela, onIrPara, feitoM1, totalM1, feitoM2, totalM2, feitoM3, totalM3 }) {
  const passos = [
    { key: "modulo1", label: "I · Ambiente", feito: feitoM1, total: totalM1 },
    { key: "modulo2", label: "II · Exigência", feito: feitoM2, total: totalM2 },
    { key: "modulo3", label: "III · Conhecimento", feito: feitoM3, total: totalM3 },
  ];
  return (
    <header style={styles.header}>
      <div style={styles.headerInner}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>CGE·PE</span>
          <span style={styles.brandDivider} />
          <span style={styles.brandText}>Diagnóstico de Trilha — Unidades de Controle Interno</span>
        </div>
        {tela !== "intro" && tela !== "resultado" && tela !== "identificacao" && tela !== "painel" && (
          <nav style={styles.stepNav}>
            {passos.map((p, i) => {
              const ativo = tela === p.key;
              const pct = p.total ? Math.round((p.feito / p.total) * 100) : 0;
              return (
                <button
                  key={p.key}
                  onClick={() => onIrPara(p.key)}
                  style={{ ...styles.stepItem, ...styles.stepItemBtn, opacity: ativo ? 1 : 0.45 }}
                >
                  <div style={styles.stepLabelRow}>
                    <span style={{ ...styles.stepLabel, color: ativo ? "#0B2545" : "#5b6b85" }}>{p.label}</span>
                    <span style={styles.stepPct}>{pct}%</span>
                  </div>
                  <div style={styles.stepBarTrack}>
                    <div style={{ ...styles.stepBarFill, width: `${pct}%`, background: ativo ? "#2A9D8F" : "#9fb3c8" }} />
                  </div>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// INTRO
// ---------------------------------------------------------------------------
function Intro({ onStart }) {
  return (
    <div style={styles.introWrap}>
      <div style={styles.introEyebrow}>Terceira Linha · Controladoria Geral do Estado de Pernambuco</div>
      <h1 style={styles.introTitle}>
        Qual estudo vai render mais<br />para a sua atuação na UCI?
      </h1>
      <p style={styles.introLede}>
        Três blocos curtos — sobre o seu órgão, sobre o que mais exige de você no dia a dia,
        e sobre o que você já domina — cruzados para indicar, dos treze temas da trilha,
        exatamente onde estudar primeiro.
      </p>

      <div style={styles.introCards}>
        <div style={styles.introCard}>
          <div style={styles.introCardNum}>I</div>
          <div style={styles.introCardTitle}>Ambiente</div>
          <div style={styles.introCardDesc}>39 perguntas sobre a realidade do seu órgão, tema a tema.</div>
        </div>
        <div style={styles.introCard}>
          <div style={styles.introCardNum}>II</div>
          <div style={styles.introCardTitle}>Exigência</div>
          <div style={styles.introCardDesc}>13 perguntas sobre o que mais é cobrado de você.</div>
        </div>
        <div style={styles.introCard}>
          <div style={styles.introCardNum}>III</div>
          <div style={styles.introCardTitle}>Conhecimento</div>
          <div style={styles.introCardDesc}>26 perguntas de autoavaliação — teoria e prática.</div>
        </div>
      </div>

      <button style={styles.primaryBtn} onClick={onStart}>
        Iniciar diagnóstico →
      </button>
      <div style={styles.introFootnote}>Tempo estimado: 12–18 minutos · 78 itens no total</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IDENTIFICAÇÃO
// ---------------------------------------------------------------------------
function Identificacao({ valores, onChange, onAvançar }) {
  const completo =
    valores.orgao.trim().length > 1 &&
    valores.respondente.trim().length > 1 &&
    valores.funcao.trim().length > 1;
  return (
    <div style={styles.identWrap}>
      <div style={styles.introEyebrow}>Antes de começar</div>
      <h2 style={styles.identTitle}>Quem está respondendo?</h2>
      <p style={styles.identLede}>
        Essas informações identificam o seu órgão no painel da CGE-PE — não há nenhuma outra finalidade.
      </p>

      <label style={styles.identLabel}>
        Órgão / entidade
        <select
          value={valores.orgao}
          onChange={(e) => onChange({ ...valores, orgao: e.target.value })}
          style={styles.identSelect}
        >
          <option value="">Selecione o órgão…</option>
          {ORGAOS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>

      <label style={styles.identLabel}>
        Seu nome
        <input
          type="text"
          value={valores.respondente}
          onChange={(e) => onChange({ ...valores, respondente: e.target.value })}
          placeholder="Ex.: Maria da Silva"
          style={styles.identInput}
        />
      </label>

      <label style={styles.identLabel}>
        Função na UCI
        <select
          value={valores.funcao}
          onChange={(e) => onChange({ ...valores, funcao: e.target.value })}
          style={styles.identSelect}
        >
          <option value="">Selecione a função…</option>
          {FUNCOES_UCI.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </label>

      <Avançar disabled={!completo} onClick={onAvançar} label="Começar Módulo I →" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ESCALA (botões de opção genéricos)
// ---------------------------------------------------------------------------
function EscalaBotoes({ opcoes, valor, onSelect }) {
  return (
    <div style={styles.escalaRow}>
      {opcoes.map((op, idx) => {
        const selecionado = valor === idx;
        return (
          <button
            key={op}
            onClick={() => onSelect(idx)}
            style={{
              ...styles.escalaBtn,
              ...(selecionado ? styles.escalaBtnAtivo : {}),
            }}
          >
            <span style={{ ...styles.escalaBtnDot, ...(selecionado ? styles.escalaBtnDotAtivo : {}) }}>
              {idx + 1}
            </span>
            {op}
          </button>
        );
      })}
    </div>
  );
}

// Matriz de escala: tema nas linhas, opções no cabeçalho das colunas.
// Em telas largas, vira tabela de verdade (CSS Grid). Em telas estreitas,
// colapsa para cartão por tema com os rótulos sempre visíveis (sem scroll lateral).
function MatrizEscala({ temas, opcoes, valores, onSelect }) {
  const nCols = opcoes.length;
  return (
    <div className="matriz-escala-wrap">
      {/* Cabeçalho — some em mobile via CSS */}
      <div
        className="matriz-escala-header"
        style={{ gridTemplateColumns: `minmax(160px, 1.4fr) repeat(${nCols}, 1fr)` }}
      >
        <div className="matriz-escala-th matriz-escala-th-tema">Tema</div>
        {opcoes.map((op) => (
          <div key={op} className="matriz-escala-th">{op}</div>
        ))}
      </div>

      <div className="matriz-escala-body">
        {temas.map((t, ti) => (
          <div
            key={t.id}
            className="matriz-escala-row"
            style={{ gridTemplateColumns: `minmax(160px, 1.4fr) repeat(${nCols}, 1fr)` }}
          >
            <div className="matriz-escala-tema">
              <span style={styles.tabelaEscalaNumero}>{String(ti + 1).padStart(2, "0")}</span>{" "}
              {t.nome}
            </div>
            {opcoes.map((op, idx) => {
              const selecionado = valores[t.id] === idx;
              return (
                <div key={op} className="matriz-escala-cel">
                  <span className="matriz-escala-label-mobile">{op}</span>
                  <button
                    aria-label={`${t.nome}: ${op}`}
                    onClick={() => onSelect(t.id, idx)}
                    className={`matriz-escala-radio ${selecionado ? "ativo" : ""}`}
                  >
                    {selecionado && <span className="matriz-escala-dot" />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MÓDULO 1 — AMBIENTE
// ---------------------------------------------------------------------------
function Modulo1({ respostas, onSet, onAvançar, completo, feito, total }) {
  return (
    <ModuloShell
      numero="I"
      titulo="Conhecimento do ambiente do órgão"
      descricao="Para cada tema, avalie a realidade do seu órgão — não a sua atuação pessoal."
      feito={feito}
      total={total}
    >
      {TEMAS.map((t, ti) => (
        <TemaBloco key={t.id} numero={ti + 1} nome={t.nome}>
          {MODULO1[t.id].map((p, i) => (
            <div key={i} style={styles.perguntaWrap}>
              <p style={styles.perguntaTexto}>{p.q}</p>
              <EscalaBotoes
                opcoes={p.opts}
                valor={respostas[`${t.id}-${i}`]}
                onSelect={(idx) => onSet(t.id, i, idx)}
              />
            </div>
          ))}
        </TemaBloco>
      ))}

      <Avançar onClick={onAvançar} label="Avançar para Exigência →" />
    </ModuloShell>
  );
}

// ---------------------------------------------------------------------------
// MÓDULO 2 — EXIGÊNCIA (tabela compacta)
// ---------------------------------------------------------------------------
function Modulo2({ respostas, onSet, onAvançar, onVoltar, completo, feito, total }) {
  return (
    <ModuloShell
      numero="II"
      titulo="Exigência percebida no seu dia a dia"
      descricao="Uma pergunta única para todos os temas: com que frequência cada um exige de você na rotina?"
      feito={feito}
      total={total}
    >
      <div style={styles.perguntaUnicaWrap}>
        <p style={styles.perguntaUnicaTexto}>
          Com que frequência você é chamado a atuar em cada um dos temas abaixo?
        </p>
      </div>

      <MatrizEscala
        temas={TEMAS}
        opcoes={ESCALA_FREQ}
        valores={respostas}
        onSelect={(temaId, idx) => onSet(temaId, idx)}
      />

      <div style={styles.navRow}>
        <Voltar onClick={onVoltar} />
        <Avançar onClick={onAvançar} label="Avançar para Conhecimento →" />
      </div>
    </ModuloShell>
  );
}

// ---------------------------------------------------------------------------
// MÓDULO 3 — CONHECIMENTO
// ---------------------------------------------------------------------------
function Modulo3({ respostas, onSet, onAvançar, onVoltar, completo, feito, total, pendenciasOutrosModulos }) {
  return (
    <ModuloShell
      numero="III"
      titulo="Autoconhecimento"
      descricao="Para cada tema, avalie seu conhecimento teórico e sua experiência prática."
      feito={feito}
      total={total}
    >
      {TEMAS.map((t, ti) => {
        const ehTecnico = MODULO3[t.id].tipo === "tecnico";
        const fraseTeorico = ehTecnico
          ? `Como você avalia seu conhecimento teórico (metodologias, técnicas e conceitos) sobre ${MODULO3[t.id].teorico}?`
          : `Como você avalia seu conhecimento teórico (legislação, normas e conceitos) sobre ${MODULO3[t.id].teorico}?`;
        return (
          <TemaBloco key={t.id} numero={ti + 1} nome={t.nome}>
            <div style={styles.perguntaWrap}>
              <p style={styles.perguntaTexto}>{fraseTeorico}</p>
              <EscalaBotoes
                opcoes={ESCALA_TEORICO}
                valor={respostas[`${t.id}-teorico`]}
                onSelect={(idx) => onSet(t.id, "teorico", idx)}
              />
            </div>
            <div style={styles.perguntaWrap}>
              <p style={styles.perguntaTexto}>
                Como você avalia sua experiência prática em atuar em {MODULO3[t.id].pratico}?
              </p>
              <EscalaBotoes
                opcoes={ESCALA_PRATICO}
                valor={respostas[`${t.id}-pratico`]}
                onSelect={(idx) => onSet(t.id, "pratico", idx)}
              />
            </div>
          </TemaBloco>
        );
      })}

      {!completo && pendenciasOutrosModulos && pendenciasOutrosModulos.length > 0 && (
        <div style={styles.statusSalvar}>
          Ainda faltam respostas em: {pendenciasOutrosModulos.join(", ")}. Complete tudo para ver o resultado.
        </div>
      )}

      <div style={styles.navRow}>
        <Voltar onClick={onVoltar} />
        <Avançar disabled={!completo} onClick={onAvançar} label="Ver resultado do diagnóstico →" />
      </div>
    </ModuloShell>
  );
}

// ---------------------------------------------------------------------------
// SHELLS / BLOCOS REUTILIZÁVEIS
// ---------------------------------------------------------------------------
function ModuloShell({ numero, titulo, descricao, feito, total, children }) {
  return (
    <div style={styles.moduloWrap}>
      <div style={styles.moduloHead}>
        <div style={styles.moduloNumero}>{numero}</div>
        <div>
          <h2 style={styles.moduloTitulo}>{titulo}</h2>
          <p style={styles.moduloDescricao}>{descricao}</p>
        </div>
      </div>
      <div style={styles.moduloContador}>{feito} de {total} respondidas</div>
      <div style={styles.temasStack}>{children}</div>
    </div>
  );
}

function TemaBloco({ numero, nome, children, compacto }) {
  return (
    <section style={{ ...styles.temaBloco, ...(compacto ? styles.temaBlocoCompacto : {}) }}>
      <div style={styles.temaHead}>
        <span style={styles.temaNumero}>{String(numero).padStart(2, "0")}</span>
        <h3 style={styles.temaNome}>{nome}</h3>
      </div>
      <div style={styles.temaBody}>{children}</div>
    </section>
  );
}

function Avançar({ disabled, onClick, label }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...styles.primaryBtn, ...(disabled ? styles.btnDisabled : {}) }}>
      {label}
    </button>
  );
}
function Voltar({ onClick }) {
  return (
    <button onClick={onClick} style={styles.ghostBtn}>
      ← Voltar
    </button>
  );
}

// ---------------------------------------------------------------------------
// RESULTADO
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TRILHA DE ESTUDO RECOMENDADA — cursos e livro por tema prioritário
// ---------------------------------------------------------------------------
function TrilhaDeEstudo({ resultados }) {
  const prioritarios = resultados.filter((t) => {
    const f = faixaDe(t.criticidade);
    return f.nome === "Crítico" || f.nome === "Alto";
  });

  if (prioritarios.length === 0) {
    return (
      <div style={styles.trilhaEstudoVazia}>
        Nenhum tema ficou nas faixas Crítico ou Alto — seu perfil está equilibrado nesta rodada.
      </div>
    );
  }

  return (
    <div style={styles.trilhaEstudoWrap}>
      <div style={styles.trilhaEstudoHeader}>
        <h3 style={styles.trilhaEstudoTitulo}>Trilha de estudo recomendada</h3>
        <p style={styles.trilhaEstudoSub}>
          Cursos e leitura sugeridos para os temas de maior criticidade.{" "}
          <em>Itens entre aspas são exemplos provisórios, a substituir pelo conteúdo real da CGE-PE.</em>
        </p>
      </div>
      <div style={styles.trilhaEstudoLista}>
        {prioritarios.map((t) => {
          const r = RECURSOS[t.id];
          const f = faixaDe(t.criticidade);
          if (!r) return null;
          return (
            <div key={t.id} style={styles.trilhaEstudoCard}>
              <div style={styles.trilhaEstudoCardHead}>
                <span style={styles.trilhaEstudoNome}>{t.nome}</span>
                <span style={{ ...styles.faixaTag, background: f.bg, color: f.cor }}>{f.nome} · {t.criticidade}</span>
              </div>
              <div style={styles.trilhaEstudoItens}>
                {r.cursos.map((c, i) => (
                  <div key={i} style={styles.trilhaEstudoItem}>
                    <span style={styles.trilhaEstudoTag}>Curso</span>
                    <div>
                      <div style={styles.trilhaEstudoItemTitulo}>{c.nome}</div>
                      <div style={styles.trilhaEstudoItemSub}>Instrutor: {c.instrutor}</div>
                    </div>
                  </div>
                ))}
                <div style={styles.trilhaEstudoItem}>
                  <span style={{ ...styles.trilhaEstudoTag, background: "#EDE7F6", color: "#5E4B8B" }}>Livro</span>
                  <div>
                    <div style={styles.trilhaEstudoItemTitulo}>{r.livro.titulo}</div>
                    <div style={styles.trilhaEstudoItemSub}>{r.livro.autor} — {r.livro.editora}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Resultado({ resultados, radarData, onVoltar, onReiniciar, salvando, jaSalvou, erroSalvar, onTentarSalvarNovamente }) {
  const porFaixa = FAIXAS.map((f) => ({
    ...f,
    itens: resultados.filter((r) => faixaDe(r.criticidade).nome === f.nome),
  }));

  const top3 = resultados.slice(0, 3);

  return (
    <div style={styles.resultWrap}>
      <div style={styles.resultEyebrow}>Resultado do diagnóstico</div>
      <h2 style={styles.resultTitle}>Seu mapa de prioridades de estudo</h2>
      <p style={styles.resultLede}>
        Cálculo a partir do cruzamento entre exposição do órgão, exigência percebida no seu
        dia a dia e lacunas de conhecimento autodeclaradas.
      </p>

      {salvando && <div style={styles.statusSalvar}>Enviando seu diagnóstico para a CGE-PE…</div>}
      {jaSalvou && <div style={styles.statusSalvarOk}>✓ Diagnóstico enviado à CGE-PE com sucesso.</div>}
      {erroSalvar && (
        <div style={styles.statusSalvarErro}>
          Não foi possível enviar seu diagnóstico.{" "}
          <button onClick={onTentarSalvarNovamente} style={styles.statusSalvarBtn}>Tentar novamente</button>
        </div>
      )}

      <div style={styles.resultGrid}>
        <div style={styles.radarCard}>
          <ResponsiveContainer width="100%" height={420}>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke="#D8DEE6" />
              <PolarAngleAxis
                dataKey="tema"
                tick={{ fill: "#0B2545", fontSize: 11.5, fontFamily: "'IBM Plex Sans', sans-serif" }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#9fb3c8", fontSize: 10 }} />
              <Radar
                name="Criticidade"
                dataKey="criticidade"
                stroke="#A13D2E"
                fill="#A13D2E"
                fillOpacity={0.28}
                strokeWidth={2}
              />
              <Tooltip
                formatter={(v) => [`${v}`, "Criticidade"]}
                contentStyle={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, borderRadius: 8 }}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div style={styles.radarCaption}>Quanto mais distante do centro, mais crítico o tema.</div>
        </div>

        <div style={styles.top3Card}>
          <div style={styles.top3Label}>Prioridade imediata</div>
          {top3.map((t, i) => {
            const f = faixaDe(t.criticidade);
            return (
              <div key={t.id} style={styles.top3Item}>
                <span style={styles.top3Rank}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={styles.top3Nome}>{t.nome}</div>
                  <div style={styles.top3Detalhe}>
                    Ambiente {t.ambiente} · Exigência {t.exigencia} · Conhecimento {t.conhecimento}
                  </div>
                </div>
                <span style={{ ...styles.faixaTag, background: f.bg, color: f.cor }}>{f.nome}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.faixasWrap}>
        {porFaixa.map((f) => (
          <div key={f.nome} style={styles.faixaColuna}>
            <div style={{ ...styles.faixaHeader, color: f.cor }}>
              <span style={{ ...styles.faixaDotHeader, background: f.cor }} />
              {f.nome}
              <span style={styles.faixaCount}>{f.itens.length}</span>
            </div>
            <div style={styles.faixaLista}>
              {f.itens.length === 0 && <div style={styles.faixaVazio}>—</div>}
              {f.itens.map((t) => (
                <div key={t.id} style={{ ...styles.faixaItem, background: f.bg }}>
                  <span style={styles.faixaItemNome}>{t.nome}</span>
                  <span style={{ ...styles.faixaItemScore, color: f.cor }}>{t.criticidade}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <TrilhaDeEstudo resultados={resultados} />

      <details style={styles.detalheTecnico}>
        <summary style={styles.detalheSummary}>Ver tabela completa de cálculo por tema</summary>
        <table style={styles.tabela}>
          <thead>
            <tr>
              <th style={styles.th}>Tema</th>
              <th style={styles.th}>Ambiente</th>
              <th style={styles.th}>Exigência</th>
              <th style={styles.th}>Conhecimento</th>
              <th style={styles.th}>Gap conhec.</th>
              <th style={styles.th}>Criticidade</th>
              <th style={styles.th}>Faixa</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((t) => {
              const f = faixaDe(t.criticidade);
              return (
                <tr key={t.id}>
                  <td style={styles.td}>{t.nome}</td>
                  <td style={styles.td}>{t.ambiente}</td>
                  <td style={styles.td}>{t.exigencia}</td>
                  <td style={styles.td}>{t.conhecimento}</td>
                  <td style={styles.td}>{t.gapConhecimento}</td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>{t.criticidade}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.faixaTag, background: f.bg, color: f.cor }}>{f.nome}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <div style={styles.navRow}>
        <Voltar onClick={onVoltar} />
        <button onClick={onReiniciar} style={styles.ghostBtn}>↺ Refazer diagnóstico</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAINEL GERENCIAL (CGE) — protegido por senha simples
// ---------------------------------------------------------------------------
const SENHA_PAINEL = "cge2026"; // troque aqui a senha de acesso ao painel

function PainelGerencial({ onSair }) {
  const [autenticado, setAutenticado] = useState(false);
  const [senhaInput, setSenhaInput] = useState("");
  const [erroSenha, setErroSenha] = useState(false);

  function tentarEntrar() {
    if (senhaInput === SENHA_PAINEL) {
      setAutenticado(true);
      setErroSenha(false);
    } else {
      setErroSenha(true);
    }
  }

  if (!autenticado) {
    return (
      <div style={styles.painelLoginWrap}>
        <div style={styles.introEyebrow}>Acesso restrito</div>
        <h2 style={styles.identTitle}>Painel gerencial — CGE-PE</h2>
        <p style={styles.identLede}>Informe a senha de acesso para visualizar os dados agregados de todos os órgãos.</p>
        <input
          type="password"
          value={senhaInput}
          onChange={(e) => setSenhaInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tentarEntrar()}
          placeholder="Senha"
          style={styles.identInput}
          autoFocus
        />
        {erroSenha && <div style={styles.statusSalvarErro}>Senha incorreta.</div>}
        <div style={styles.navRow}>
          <Voltar onClick={onSair} />
          <button style={styles.primaryBtn} onClick={tentarEntrar}>Entrar →</button>
        </div>
      </div>
    );
  }

  return <PainelConteudo onSair={onSair} />;
}

function PainelConteudo({ onSair }) {
  const [carregando, setCarregando] = useState(true);
  const [registros, setRegistros] = useState([]);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro(false);
      try {
        const itens = await listarTodosDiagnosticos();
        if (ativo) setRegistros(itens);
      } catch (e) {
        console.error("Erro ao carregar diagnósticos:", e);
        if (ativo) setErro(true);
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, []);

  // Agregação por tema (média de criticidade entre todos os órgãos)
  const agregadoPorTema = useMemo(() => {
    const acumulado = {};
    TEMAS.forEach((t) => { acumulado[t.id] = { nome: t.nome, curto: t.curto, soma: 0, n: 0 }; });
    registros.forEach((reg) => {
      (reg.resultados || []).forEach((r) => {
        if (acumulado[r.id]) {
          acumulado[r.id].soma += r.criticidade;
          acumulado[r.id].n += 1;
        }
      });
    });
    return Object.values(acumulado)
      .map((a) => ({ ...a, media: a.n ? a.soma / a.n : 0 }))
      .sort((a, b) => b.media - a.media);
  }, [registros]);

  const radarEstado = agregadoPorTema.map((a) => ({ tema: a.curto, criticidade: Number(a.media.toFixed(2)) }));

  const orgaos = useMemo(() => {
    const porOrgao = {};
    registros.forEach((reg) => {
      const nome = reg.orgao || "(sem identificação)";
      if (!porOrgao[nome]) porOrgao[nome] = [];
      porOrgao[nome].push(reg);
    });
    return Object.entries(porOrgao).map(([nome, regs]) => {
      const ultimo = regs[regs.length - 1];
      const top = (ultimo.resultados || []).slice().sort((a, b) => b.criticidade - a.criticidade)[0];
      const nomesRespondentes = regs.map((r) => `${r.respondente}${r.funcao ? ` (${r.funcao})` : ""}`).join(", ");
      return {
        nome,
        respondentes: regs.length,
        nomesRespondentes,
        temaMaisCritico: top ? top.nome : "—",
        criticidadeTopo: top ? top.criticidade : 0,
      };
    }).sort((a, b) => b.criticidadeTopo - a.criticidadeTopo);
  }, [registros]);

  return (
    <div style={styles.resultWrap}>
      <div style={styles.resultEyebrow}>Painel gerencial · CGE-PE</div>
      <h2 style={styles.resultTitle}>Criticidade consolidada do Estado</h2>
      <p style={styles.resultLede}>
        Média de criticidade por tema entre todos os preenchimentos recebidos
        {registros.length > 0 && <> — {registros.length} preenchimento{registros.length > 1 ? "s" : ""} de {orgaos.length} órgão{orgaos.length > 1 ? "s" : ""}.</>}
      </p>

      {carregando && <div style={styles.statusSalvar}>Carregando dados de todas as UCIs…</div>}
      {erro && <div style={styles.statusSalvarErro}>Não foi possível carregar os dados.</div>}

      {!carregando && !erro && registros.length === 0 && (
        <div style={styles.faixaVazio}>Nenhum diagnóstico foi enviado ainda.</div>
      )}

      {!carregando && !erro && registros.length > 0 && (
        <>
          <div style={styles.resultGrid}>
            <div style={styles.radarCard}>
              <ResponsiveContainer width="100%" height={420}>
                <RadarChart data={radarEstado} outerRadius="75%">
                  <PolarGrid stroke="#D8DEE6" />
                  <PolarAngleAxis dataKey="tema" tick={{ fill: "#0B2545", fontSize: 11.5, fontFamily: "'IBM Plex Sans', sans-serif" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#9fb3c8", fontSize: 10 }} />
                  <Radar name="Criticidade média" dataKey="criticidade" stroke="#A13D2E" fill="#A13D2E" fillOpacity={0.28} strokeWidth={2} />
                  <Tooltip formatter={(v) => [`${v}`, "Criticidade média"]} contentStyle={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, borderRadius: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={styles.radarCaption}>Visão consolidada de todos os órgãos respondentes.</div>
            </div>

            <div style={styles.top3Card}>
              <div style={styles.top3Label}>Mais críticos no Estado</div>
              {agregadoPorTema.slice(0, 5).map((a, i) => {
                const f = faixaDe(a.media);
                return (
                  <div key={a.nome} style={styles.top3Item}>
                    <span style={styles.top3Rank}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={styles.top3Nome}>{a.nome}</div>
                      <div style={styles.top3Detalhe}>{a.n} respondente{a.n !== 1 ? "s" : ""}</div>
                    </div>
                    <span style={{ ...styles.faixaTag, background: f.bg, color: f.cor }}>{Number(a.media.toFixed(2))}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <details style={styles.detalheTecnico} open>
            <summary style={styles.detalheSummary}>Órgãos respondentes ({orgaos.length})</summary>
            <table style={styles.tabela}>
              <thead>
                <tr>
                  <th style={styles.th}>Órgão</th>
                  <th style={styles.th}>Respondentes</th>
                  <th style={styles.th}>Tema mais crítico</th>
                  <th style={styles.th}>Criticidade</th>
                </tr>
              </thead>
              <tbody>
                {orgaos.map((o) => {
                  const f = faixaDe(o.criticidadeTopo);
                  return (
                    <tr key={o.nome}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600, color: colors.ink }}>{o.nome}</div>
                        <div style={styles.tdSub}>{o.nomesRespondentes}</div>
                      </td>
                      <td style={styles.td}>{o.respondentes}</td>
                      <td style={styles.td}>{o.temaMaisCritico}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.faixaTag, background: f.bg, color: f.cor }}>{o.criticidadeTopo}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>

          <details style={styles.detalheTecnico}>
            <summary style={styles.detalheSummary}>Ranking completo de temas — média estadual</summary>
            <table style={styles.tabela}>
              <thead>
                <tr>
                  <th style={styles.th}>Tema</th>
                  <th style={styles.th}>Respondentes</th>
                  <th style={styles.th}>Criticidade média</th>
                  <th style={styles.th}>Faixa</th>
                </tr>
              </thead>
              <tbody>
                {agregadoPorTema.map((a) => {
                  const f = faixaDe(a.media);
                  return (
                    <tr key={a.nome}>
                      <td style={styles.td}>{a.nome}</td>
                      <td style={styles.td}>{a.n}</td>
                      <td style={{ ...styles.td, fontWeight: 700 }}>{Number(a.media.toFixed(2))}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.faixaTag, background: f.bg, color: f.cor }}>{f.nome}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </>
      )}

      <div style={styles.navRow}>
        <Voltar onClick={onSair} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ESTILOS
// ---------------------------------------------------------------------------
const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  button { font-family: 'IBM Plex Sans', sans-serif; cursor: pointer; }

  .matriz-escala-wrap {
    background: #FFFFFF;
    border: 1px solid #E2E6EA;
    border-radius: 10px;
    overflow: hidden;
  }
  .matriz-escala-header {
    display: grid;
    background: #FAFBFA;
    border-bottom: 2px solid #E2E6EA;
  }
  .matriz-escala-th {
    padding: 13px 8px;
    font-size: 11.5px;
    font-weight: 700;
    color: #9fb3c8;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .matriz-escala-th-tema {
    text-align: left;
    text-transform: none;
    font-size: 11.5px;
    padding-left: 16px;
  }
  .matriz-escala-body { display: flex; flex-direction: column; }
  .matriz-escala-row {
    display: grid;
    align-items: center;
    border-bottom: 1px solid #E2E6EA;
  }
  .matriz-escala-row:nth-child(even) { background: #FBFCFB; }
  .matriz-escala-row:last-child { border-bottom: none; }
  .matriz-escala-tema {
    padding: 11px 16px;
    font-size: 13.5px;
    font-weight: 500;
    color: #0B2545;
  }
  .matriz-escala-cel {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 9px 6px;
  }
  .matriz-escala-label-mobile { display: none; }
  .matriz-escala-radio {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #D8DEE6;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
  }
  .matriz-escala-radio.ativo { border-color: #0B2545; background: #0B2545; }
  .matriz-escala-dot { width: 9px; height: 9px; border-radius: 50%; background: #2A9D8F; }

  @media (max-width: 680px) {
    .matriz-escala-header { display: none; }
    .matriz-escala-row {
      display: block;
      padding: 14px 16px 12px;
    }
    .matriz-escala-tema { padding: 0 0 10px; font-size: 14.5px; font-weight: 600; }
    .matriz-escala-body { display: block; }
    .matriz-escala-cel {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: auto;
      padding: 0 12px 8px 0;
      vertical-align: top;
    }
    .matriz-escala-label-mobile {
      display: block;
      font-size: 10.5px;
      color: #5b6b85;
      font-weight: 600;
      text-align: center;
      max-width: 64px;
      line-height: 1.2;
    }
    .matriz-escala-radio { width: 26px; height: 26px; }
  }
`;

const colors = {
  ink: "#0B2545",
  inkSoft: "#3a4a63",
  bg: "#F6F7F5",
  card: "#FFFFFF",
  line: "#E2E6EA",
  accent: "#2A9D8F",
  accentDeep: "#1d6f64",
  critico: "#A13D2E",
};

const styles = {
  page: { minHeight: "100vh", background: colors.bg, fontFamily: "'IBM Plex Sans', sans-serif", color: colors.ink },
  main: { maxWidth: 920, margin: "0 auto", padding: "0 24px 80px" },

  header: { borderBottom: `1px solid ${colors.line}`, background: colors.card, position: "sticky", top: 0, zIndex: 10 },
  headerInner: { maxWidth: 920, margin: "0 auto", padding: "16px 24px" },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 },
  brandMark: { fontFamily: "'IBM Plex Serif', serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.04em", color: colors.ink },
  brandDivider: { width: 1, height: 16, background: colors.line },
  brandText: { fontSize: 13, color: colors.inkSoft, fontWeight: 500 },
  stepNav: { display: "flex", gap: 24, marginTop: 10 },
  stepItem: { flex: 1 },
  stepItemBtn: { background: "transparent", border: "none", padding: 0, textAlign: "left", display: "block" },
  stepLabelRow: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  stepLabel: { fontSize: 11.5, fontWeight: 600, letterSpacing: "0.02em" },
  stepPct: { fontSize: 11, color: "#9fb3c8", fontWeight: 500 },
  stepBarTrack: { height: 3, background: "#EAEDF0", borderRadius: 2, overflow: "hidden" },
  stepBarFill: { height: "100%", borderRadius: 2, transition: "width 0.3s ease" },

  introWrap: { padding: "72px 0 40px", textAlign: "center" },
  introEyebrow: { fontSize: 12.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.accentDeep, marginBottom: 18 },
  introTitle: { fontFamily: "'IBM Plex Serif', serif", fontSize: 38, lineHeight: 1.18, fontWeight: 700, color: colors.ink, margin: "0 0 22px" },
  introLede: { fontSize: 16, lineHeight: 1.65, color: colors.inkSoft, maxWidth: 560, margin: "0 auto 44px" },
  introCards: { display: "flex", gap: 16, marginBottom: 44, textAlign: "left" },
  introCard: { flex: 1, background: colors.card, border: `1px solid ${colors.line}`, borderRadius: 10, padding: "20px 18px" },
  introCardNum: { fontFamily: "'IBM Plex Serif', serif", fontSize: 13, fontWeight: 700, color: colors.accentDeep, marginBottom: 8 },
  introCardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 6 },
  introCardDesc: { fontSize: 13, color: colors.inkSoft, lineHeight: 1.5 },
  introFootnote: { fontSize: 12.5, color: "#9fb3c8", marginTop: 16 },

  identWrap: { paddingTop: 64, maxWidth: 440, margin: "0 auto" },
  identTitle: { fontFamily: "'IBM Plex Serif', serif", fontSize: 26, fontWeight: 700, margin: "0 0 10px", color: colors.ink },
  identLede: { fontSize: 14, color: colors.inkSoft, lineHeight: 1.55, marginBottom: 26 },
  identLabel: { display: "block", fontSize: 13, fontWeight: 600, color: colors.ink, marginBottom: 18 },
  identInput: {
    display: "block", width: "100%", marginTop: 7, padding: "12px 14px", fontSize: 14.5,
    border: `1px solid ${colors.line}`, borderRadius: 8, fontFamily: "'IBM Plex Sans', sans-serif",
    color: colors.ink, outline: "none",
  },
  identSelect: {
    display: "block", width: "100%", marginTop: 7, padding: "12px 14px", fontSize: 14.5,
    border: `1px solid ${colors.line}`, borderRadius: 8, fontFamily: "'IBM Plex Sans', sans-serif",
    color: colors.ink, outline: "none", background: "#fff", appearance: "auto",
  },

  painelLinkDiscreto: {
    display: "block", margin: "0 auto 40px", background: "transparent", border: "none",
    color: "#C7CDD6", fontSize: 11.5, textDecoration: "underline", padding: 8,
  },
  painelLoginWrap: { paddingTop: 80, maxWidth: 400, margin: "0 auto", textAlign: "left" },

  statusSalvar: { fontSize: 13, color: colors.inkSoft, background: "#F2F4F6", borderRadius: 8, padding: "10px 14px", marginBottom: 20 },
  statusSalvarOk: { fontSize: 13, color: colors.accentDeep, background: "#E7F3F1", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontWeight: 600 },
  statusSalvarErro: { fontSize: 13, color: colors.critico, background: "#F8EAE6", borderRadius: 8, padding: "10px 14px", marginBottom: 20 },
  statusSalvarBtn: { background: "none", border: "none", color: colors.critico, fontWeight: 700, textDecoration: "underline", padding: 0, fontSize: 13 },

  primaryBtn: {
    background: colors.ink, color: "#fff", border: "none", borderRadius: 8,
    padding: "14px 28px", fontSize: 14.5, fontWeight: 600, letterSpacing: "0.01em",
  },
  btnDisabled: { background: "#C7CDD6", cursor: "not-allowed" },
  ghostBtn: {
    background: "transparent", color: colors.ink, border: `1px solid ${colors.line}`,
    borderRadius: 8, padding: "13px 22px", fontSize: 14, fontWeight: 600,
  },

  moduloWrap: { paddingTop: 32 },
  moduloHead: { display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 6 },
  moduloNumero: {
    fontFamily: "'IBM Plex Serif', serif", fontSize: 22, fontWeight: 700, color: colors.accentDeep,
    width: 40, height: 40, borderRadius: 8, background: "#E7F3F1", display: "flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  moduloTitulo: { fontFamily: "'IBM Plex Serif', serif", fontSize: 23, fontWeight: 700, margin: "2px 0 6px" },
  moduloDescricao: { fontSize: 14, color: colors.inkSoft, margin: 0, lineHeight: 1.5 },
  moduloContador: { fontSize: 12.5, color: "#9fb3c8", fontWeight: 600, margin: "18px 0 24px", textAlign: "right" },

  temasStack: { display: "flex", flexDirection: "column", gap: 14 },
  temaBloco: { background: colors.card, border: `1px solid ${colors.line}`, borderRadius: 10, padding: "20px 22px" },
  temaBlocoCompacto: { padding: "18px 22px" },
  temaHead: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 },
  temaNumero: { fontFamily: "'IBM Plex Serif', serif", fontSize: 12, color: "#A9B6C6", fontWeight: 600 },
  temaNome: { fontSize: 15.5, fontWeight: 700, margin: 0, color: colors.ink },
  temaBody: { display: "flex", flexDirection: "column", gap: 16 },

  perguntaWrap: { display: "flex", flexDirection: "column", gap: 10 },
  perguntaTexto: { fontSize: 14, color: colors.inkSoft, margin: 0, lineHeight: 1.5 },

  escalaRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  escalaBtn: {
    display: "flex", alignItems: "center", gap: 8, background: "#F2F4F6", border: "1px solid transparent",
    borderRadius: 7, padding: "8px 13px 8px 8px", fontSize: 13, color: colors.inkSoft, fontWeight: 500,
  },
  escalaBtnAtivo: { background: "#0B2545", color: "#fff" },
  escalaBtnDot: {
    width: 20, height: 20, borderRadius: "50%", background: "#fff", color: "#9fb3c8",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  escalaBtnDotAtivo: { background: colors.accent, color: "#fff" },

  perguntaUnicaWrap: { background: colors.card, border: `1px solid ${colors.line}`, borderRadius: 10, padding: "18px 22px", marginBottom: 16 },
  perguntaUnicaTexto: { fontSize: 15.5, fontWeight: 600, color: colors.ink, margin: 0, lineHeight: 1.5 },

  tabelaEscalaNumero: { fontFamily: "'IBM Plex Serif', serif", fontSize: 11, color: "#C7CDD6", fontWeight: 600 },

  navRow: { display: "flex", justifyContent: "space-between", marginTop: 28 },

  resultWrap: { paddingTop: 36 },
  resultEyebrow: { fontSize: 12.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.accentDeep, marginBottom: 10 },
  resultTitle: { fontFamily: "'IBM Plex Serif', serif", fontSize: 30, fontWeight: 700, margin: "0 0 12px" },
  resultLede: { fontSize: 15, color: colors.inkSoft, lineHeight: 1.6, maxWidth: 620, marginBottom: 32 },

  resultGrid: { display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, marginBottom: 36 },
  radarCard: { background: colors.card, border: `1px solid ${colors.line}`, borderRadius: 12, padding: "20px 16px 12px" },
  radarCaption: { textAlign: "center", fontSize: 12, color: "#9fb3c8", marginTop: -8 },

  top3Card: { background: colors.ink, borderRadius: 12, padding: "22px 20px", color: "#fff", display: "flex", flexDirection: "column", gap: 14 },
  top3Label: { fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9fd8cf", marginBottom: 4 },
  top3Item: { display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 12 },
  top3Rank: { fontFamily: "'IBM Plex Serif', serif", fontSize: 20, fontWeight: 700, color: "#9fd8cf", width: 24 },
  top3Nome: { fontSize: 14, fontWeight: 600, marginBottom: 3 },
  top3Detalhe: { fontSize: 11.5, color: "#A9B6C6" },
  faixaTag: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5, whiteSpace: "nowrap" },

  faixasWrap: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 },
  faixaColuna: { display: "flex", flexDirection: "column", gap: 10 },
  faixaHeader: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700 },
  faixaDotHeader: { width: 8, height: 8, borderRadius: "50%" },
  faixaCount: { marginLeft: "auto", fontSize: 12, color: "#9fb3c8", fontWeight: 600 },
  faixaLista: { display: "flex", flexDirection: "column", gap: 6 },
  faixaItem: { display: "flex", justifyContent: "space-between", gap: 8, padding: "9px 11px", borderRadius: 7, fontSize: 12.5 },
  faixaItemNome: { color: colors.ink, fontWeight: 500, lineHeight: 1.3 },
  faixaItemScore: { fontWeight: 700, flexShrink: 0 },
  faixaVazio: { fontSize: 12, color: "#C7CDD6", padding: "9px 11px" },

  trilhaEstudoVazia: { fontSize: 13, color: colors.inkSoft, background: "#F2F4F6", borderRadius: 8, padding: "14px 16px", marginBottom: 28 },
  trilhaEstudoWrap: { marginBottom: 32 },
  trilhaEstudoHeader: { marginBottom: 16 },
  trilhaEstudoTitulo: { fontFamily: "'IBM Plex Serif', serif", fontSize: 19, fontWeight: 700, color: colors.ink, margin: "0 0 6px" },
  trilhaEstudoSub: { fontSize: 12.5, color: colors.inkSoft, margin: 0, lineHeight: 1.5 },
  trilhaEstudoLista: { display: "flex", flexDirection: "column", gap: 12 },
  trilhaEstudoCard: { background: colors.card, border: `1px solid ${colors.line}`, borderRadius: 10, padding: "16px 18px" },
  trilhaEstudoCardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  trilhaEstudoNome: { fontSize: 14.5, fontWeight: 700, color: colors.ink },
  trilhaEstudoItens: { display: "flex", flexDirection: "column", gap: 10 },
  trilhaEstudoItem: { display: "flex", gap: 10, alignItems: "flex-start" },
  trilhaEstudoTag: {
    fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: "#E7F3F1",
    color: colors.accentDeep, flexShrink: 0, marginTop: 1, textTransform: "uppercase", letterSpacing: "0.03em",
  },
  trilhaEstudoItemTitulo: { fontSize: 13.5, color: colors.ink, fontWeight: 500, lineHeight: 1.4 },
  trilhaEstudoItemSub: { fontSize: 12, color: "#9fb3c8", marginTop: 2 },

  detalheTecnico: { marginBottom: 28 },
  detalheSummary: { fontSize: 13, fontWeight: 600, color: colors.inkSoft, cursor: "pointer", padding: "10px 0" },
  tabela: { width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 12.5 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: `2px solid ${colors.line}`, color: "#9fb3c8", fontWeight: 600, fontSize: 11 },
  td: { padding: "9px 10px", borderBottom: `1px solid ${colors.line}`, color: colors.inkSoft },
  tdSub: { fontSize: 11, color: "#9fb3c8", marginTop: 2 },
};
