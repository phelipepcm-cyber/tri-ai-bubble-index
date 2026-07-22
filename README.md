# TRI AI Bubble Index — produto completo

Dashboard estático, responsivo e gratuito com:

- cadastro obrigatório por nome, e-mail e WhatsApp;
- consentimento de comunicação;
- registro de cada acesso;
- contador de acessos e último acesso por lead;
- atualização automática do índice em dias úteis;
- publicação automática no GitHub Pages;
- custo mensal de infraestrutura: **R$ 0 dentro dos planos gratuitos**.

## 1. Criar o Supabase

1. Acesse o Supabase e crie um projeto gratuito.
2. Abra **SQL Editor > New query**.
3. Cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
4. Abra **Project Settings > API**.
5. Copie:
   - `Project URL`;
   - `anon public key`.
6. Abra `config.js` e substitua:

```js
supabaseUrl: "COLE_AQUI_A_PROJECT_URL",
supabaseAnonKey: "COLE_AQUI_A_ANON_PUBLIC_KEY",
```

A chave `anon public` pode ficar no site. As regras de segurança do arquivo SQL bloqueiam a leitura pública dos leads.

## 2. Criar o repositório no GitHub

1. Crie um repositório chamado `tri-ai-bubble-index`.
2. Deixe o repositório **público** para usar GitHub Pages e Actions gratuitamente.
3. Envie todos os arquivos deste pacote para a raiz do repositório.
4. Confirme que a branch principal se chama `main`.

Forma simples pelo site do GitHub:

- clique em **Add file > Upload files**;
- arraste todo o conteúdo da pasta, incluindo `.github`;
- clique em **Commit changes**.

## 3. Ativar o GitHub Pages

1. No repositório, abra **Settings > Pages**.
2. Em **Source**, escolha **GitHub Actions**.
3. Abra a aba **Actions**.
4. Selecione `Publicar dashboard no GitHub Pages` e clique em **Run workflow**.
5. Ao finalizar, o link aparecerá no próprio workflow e em **Settings > Pages**.

O endereço gratuito terá este formato:

```text
https://SEU-USUARIO.github.io/tri-ai-bubble-index/
```

## 4. Executar a primeira atualização real

O pacote começa com dados visuais demonstrativos para permitir a publicação imediata.

1. Abra a aba **Actions**.
2. Selecione `Atualizar TRI AI Bubble Index`.
3. Clique em **Run workflow**.
4. O robô buscará dados de mercado, recalculará o índice e substituirá automaticamente os dados demonstrativos.

Depois disso, a atualização ocorrerá de segunda a sexta, às 08:30 no horário de Brasília.

## 5. Ver os cadastrados e acessos

No Supabase:

- **Table Editor > leads**: nome, e-mail, WhatsApp, data do cadastro, último acesso e quantidade de acessos;
- **Table Editor > access_logs**: cada visita individual;
- **Table Editor > leads_comercial**: visão pronta com classificação `Novo`, `Engajado` ou `Quente`.

Para exportar, abra a tabela ou visão e use **Export data > CSV**.

## Estrutura

```text
index.html                       página do dashboard
styles.css                       identidade visual e responsividade
app.js                           cadastro, acesso, gráfico e integração
config.js                        credenciais públicas do Supabase
data/dashboard.json              dados mostrados na tela
scripts/update_dashboard.py      cálculo automático do índice
supabase/schema.sql              banco, segurança e registro de acessos
.github/workflows/update-data.yml automação diária
.github/workflows/deploy-pages.yml publicação do site
```

## Observações importantes

- O índice usa proxies quantitativos de preço, momentum, concentração e volatilidade.
- O Yahoo Finance é acessado por `yfinance`, sem cobrança e sem chave, mas é uma fonte não contratual e pode alterar seu funcionamento.
- O conteúdo é educacional e não representa recomendação de investimento.
- Antes da divulgação pública, substitua os dados do `config.js` e execute o primeiro workflow de atualização.
