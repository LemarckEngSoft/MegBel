# Duo Days

Espaco web privado para exatamente duas pessoas. Esta primeira etapa entrega a fundacao Node.js + Express + PostgreSQL, login sem cadastro publico e sessao segura por cookie HttpOnly.

## Requisitos

- Node.js 20+
- npm
- PostgreSQL 14+

## Instalar

```bash
npm install
cp .env.example .env
```

Configure no `.env`:

- `PORT`: porta HTTP; o Render injeta este valor automaticamente.
- `DATABASE_URL`: URL do PostgreSQL.
- `JWT_SECRET`: segredo longo e aleatorio para as sessoes.
- `COOKIE_SECRET`: segredo usado pelo cookie parser.
- `DUO_TIMEZONE`: timezone do casal, por padrao `America/Manaus`.
- `CORS_ORIGIN`: origem permitida, por padrao `http://localhost:3001` em desenvolvimento.
- `UPLOAD_DIR`: diretorio local de uploads; no Render aponta para o disco persistente.

## Banco e duas contas

A migration cria `pairs`, `users`, chaves estrangeiras, indices e uma restricao que impede uma terceira conta no mesmo espaco. A segunda migration cria mensagens, calendario, sequencia, atividade diaria, estado/catalogo do pet e marcos:

```bash
npm run db:migrate
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='senha-forte' \
USER_EMAIL=duo@example.com USER_PASSWORD='outra-senha-forte' \
npm run db:seed
```

As credenciais do seed sao lidas apenas das variaveis do ambiente e nunca ficam no repositorio. Execute o seed uma vez para o duo inicial. Para inicializar contas, configure `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `USER_NAME`, `USER_EMAIL` e `USER_PASSWORD` no ambiente e execute `npm run db:seed`.
As migrations sao idempotentes e podem ser executadas novamente depois de novas versoes.

## Desenvolvimento e producao

```bash
npm run dev
npm start
```

No Codespaces, o servidor local de desenvolvimento usa `PORT=3001` para evitar conflito com outros processos; abra a porta 3001 na aba Ports do VS Code.

O Express serve `public/`, a API fica em `/api` e a rota `/api/health` confirma que o processo esta vivo. O Socket.IO usa o cookie da sessao e rooms por `pair_id` para chat, digitacao, pet e sequencia em tempo real.

## Deploy no Render

O arquivo `render.yaml` define o Web Service, PostgreSQL 16, migration antes do deploy, health check e disco persistente montado para uploads. No Render, crie um Blueprint a partir deste repositório e revise os planos/custos: o Web Service Starter e o disco persistente sao pagos; o banco Basic tambem pode gerar cobranca.

Configure no painel do Render:

- `CORS_ORIGIN`: URL HTTPS publica do Web Service, por exemplo `https://duo-days.onrender.com`.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `USER_NAME`, `USER_EMAIL`, `USER_PASSWORD`: credenciais iniciais como variaveis secretas; nao as adicione ao YAML ou ao Git.
- `JWT_SECRET` e `COOKIE_SECRET` sao gerados pelo Blueprint; `DATABASE_URL` e ligada ao PostgreSQL gerenciado.

O Blueprint roda `npm run db:migrate` antes de cada deploy. Depois do primeiro deploy e de preencher as seis variaveis das contas, abra o Shell do Web Service e execute `npm run db:seed` uma unica vez. O seed grava hashes bcrypt e cria o par de duas contas; nao o repita num banco com contas ja criadas.

Build Command: `npm ci`. Start Command: `npm start`. O Render injeta `PORT`; o servidor nao depende de uma porta fixa. O disco persistente guarda as imagens enviadas; sem ele, uploads em disco local seriam perdidos em reinicios/redeploys.

## Seguranca atual

- Senhas armazenadas somente como hash bcrypt.
- JWT em cookie HttpOnly, SameSite Lax e Secure em producao.
- Login protegido por rate limit.
- Helmet, CORS e queries parametrizadas.
- Sessao e `pair_id` identificados pelo backend; nao sao aceitos do frontend.
- `password_hash` nunca e retornado pela API.

## Testes

```bash
npm test
```

Chat, calendario, sequencia, pet, notificacoes, participantes, nomeacoes, uploads e punicoes possuem persistencia PostgreSQL. A migration `008_rebase_streak_151.sql` fixa a base em 10 dias a partir de 17/05/2026, preenche como completas as presencas anteriores de 17/05 a 04/10 e deixa 05/10 como dia 151 aguardando registro.
