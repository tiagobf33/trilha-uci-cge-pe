# Diagnóstico de Trilha de Capacitação — UCI · CGE-PE (versão com Firebase)

Esta versão grava os diagnósticos em um banco de dados real na nuvem
(Firebase Firestore, gratuito), permitindo que o Painel CGE agregue
respostas de UCIs em qualquer computador, não só no mesmo navegador.

## Passo 1 — Criar o projeto no Firebase (gratuito)

1. Acesse **console.firebase.google.com** e entre com sua conta Google
2. **Add project** → dê um nome (ex: `trilha-uci-cge-pe`) → pode desativar o Google Analytics → **Criar projeto**
3. No menu lateral: **Build → Firestore Database** (ou "Databases & Storage → Firestore")
4. **Create database** → modo **Native** → escolha uma região (ex: `southamerica-east1`) → regras: **Test mode** por enquanto
5. **Project settings** (ícone de engrenagem) → role até **"Your apps"** → clique no ícone **`</>`** (Web) → dê um nome → **Register app**
6. Copie o objeto `firebaseConfig` que aparece — vai parecer com isto:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "trilha-uci-cge-pe.firebaseapp.com",
  projectId: "trilha-uci-cge-pe",
  storageBucket: "trilha-uci-cge-pe.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123",
};
```

## Passo 2 — Colar a configuração no projeto

Abra o arquivo `src/firebaseConfig.js` deste pacote e substitua os valores
`"COLE_AQUI"` pelos valores reais que você copiou no passo anterior.

## Passo 3 — Regras de segurança do Firestore (importante)

O "Test mode" do Firebase **expira automaticamente em 30 dias** e depois
bloqueia todo acesso. Antes de esse prazo passar, vá em
**Firestore Database → Rules** no console e troque pelo seguinte, que
permite que qualquer pessoa leia e grave diagnósticos (não há dados
sensíveis de login envolvidos, apenas respostas do questionário):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /uci_trilha_diagnosticos/{docId} {
      allow read, write: if true;
    }
  }
}
```

Clique **Publish** depois de colar. Isso mantém o acesso liberado
indefinidamente (sem a expiração de 30 dias do modo de teste).

> Se no futuro quiser restringir quem pode escrever (por exemplo, exigir
> login), é possível adicionar Firebase Authentication — me avise se quiser
> ajuda com isso.

## Passo 4 — Publicar gratuitamente (StackBlitz)

1. Acesse **stackblitz.com** → **Create** → template **React**
2. Substitua os arquivos do template pelos deste pacote, nos mesmos caminhos:
   - `src/App.jsx`
   - `src/index.js`
   - `src/firebaseConfig.js` (já com seus valores reais preenchidos)
   - `public/index.html`
   - `package.json`
3. Aguarde a instalação automática das dependências (`react`, `recharts`, `firebase`)
4. A aplicação aparece rodando na pré-visualização, com uma URL pública compartilhável
5. Para uma URL fixa, use o botão **Deploy** dentro do StackBlitz

## Como verificar se está funcionando

1. Preencha o diagnóstico completo em um navegador (ou aba anônima)
2. Volte ao **console.firebase.google.com → Firestore Database → Data**
3. Você deve ver uma coleção `uci_trilha_diagnosticos` com um documento novo
4. Abra o **Painel CGE** (senha definida em `SENHA_PAINEL` dentro de `App.jsx`) — os dados desse preenchimento devem aparecer agregados ali

## Limites do plano gratuito (Spark)

O Firestore gratuito permite, por dia: 50.000 leituras, 20.000 gravações,
20.000 exclusões, e 1 GiB de armazenamento total. Para o volume de uso de
diagnósticos das UCIs de Pernambuco, isso é mais do que suficiente —
mesmo com centenas de respondentes.

## Senha do Painel CGE

Definida na constante `SENHA_PAINEL`, dentro de `App.jsx`:

```js
const SENHA_PAINEL = "cge2026";
```

Troque pelo valor que preferir antes de publicar.
