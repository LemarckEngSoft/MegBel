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
- `CORS_ORIGIN`: origem permitida, por padrao `http://localhost:3000`.

## Banco e duas contas

A migration cria `pairs`, `users`, chaves estrangeiras, indices e uma restricao que impede uma terceira conta no mesmo espaco. A segunda migration cria mensagens, calendario, sequencia, atividade diaria, estado/catalogo do pet e marcos:

```bash
npm run db:migrate
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='senha-forte' \
USER_EMAIL=duo@example.com USER_PASSWORD='outra-senha-forte' \
npm run db:seed
```

As credenciais do seed sao lidas apenas das variaveis do ambiente e nunca ficam no repositorio. Execute o seed uma vez para o duo inicial.
As migrations sao idempotentes e podem ser executadas novamente depois de novas versoes.

## Desenvolvimento e producao

```bash
npm run dev
npm start
```

O Express serve `public/`, a API fica em `/api` e a rota `/api/health` confirma que o processo esta vivo. O Socket.IO usa o cookie da sessao e rooms por `pair_id` para chat, digitacao, pet e sequencia em tempo real.

Para o Render:

- Build Command: `npm install`
- Start Command: `npm start`
- Configure `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `DUO_TIMEZONE`, `CORS_ORIGIN` e `NODE_ENV=production` nas Environment Variables.
- Rode `npm run db:migrate` contra o PostgreSQL provisionado antes do primeiro seed.

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

Chat, calendario, sequencia basica, pet, notificacoes, participantes, nomeacoes e uploads de imagens ja possuem persistencia PostgreSQL e autorizacao no backend. Audio e personalizacao visual possuem o contrato inicial; punicoes, convites completos, itens em camadas e administracao continuam como proximas etapas do produto.
