# Equipgestor

Sistema de geração automática de escalas para organizações (primeira aplicação: ministério de louvor de igreja), com motor de alocação baseado em satisfação de restrições (CSP). Aplicação web responsiva com suporte a PWA.

> A nomenclatura de código (tabelas, variáveis, entidades, endpoints) é genérica (`organization`, `role`, `event`, `membership`, etc.) para permitir reuso futuro em outros nichos, mesmo que os textos de interface usem vocabulário de igreja nesta primeira versão.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- PostgreSQL hospedado no [Supabase](https://supabase.com) (usado apenas como banco Postgres via Prisma)
- [Prisma ORM](https://www.prisma.io) (Prisma 7, com driver adapter `@prisma/adapter-pg`)
- Tailwind CSS
- [Vitest](https://vitest.dev) + Testing Library para testes automatizados

## Pré-requisitos

- Node.js 20.19+ (recomendado usar a versão em `.nvmrc`/`package.json` se houver)
- Uma conta no [Supabase](https://supabase.com) com um projeto criado (ou outro Postgres acessível)

## Setup local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de variáveis de ambiente e preencha com as duas URLs do Supabase:

   ```bash
   cp .env.example .env
   ```

   No Supabase, em **Project Settings > Database > Connection string**:

   - `DATABASE_URL` → **Transaction pooler** (porta 6543, `?pgbouncer=true`) — usada pelo app em runtime (`src/lib/prisma.ts`)
   - `DIRECT_URL` → **Direct connection** (porta 5432) — usada pelo Prisma CLI/migrations via `prisma.config.ts`

   > No Prisma 7, `prisma.config.ts` aceita apenas `url` (não existe `directUrl` no config). Por isso migrations leem `DIRECT_URL` como `url` do config.

3. Gere o Prisma Client:

   ```bash
   npx prisma generate
   ```

4. Aplique as migrações no banco:

   ```bash
   npm run db:check-env
   npm run db:migrate
   ```

5. (Opcional) Popule dados de exemplo:

   ```bash
   npx prisma db seed
   ```

6. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

| Comando                 | Descrição                                                    |
| ----------------------- | ------------------------------------------------------------ |
| `npm run dev`           | Sobe o servidor de desenvolvimento                           |
| `npm run build`         | Build de produção                                            |
| `npm run start`         | Roda o build de produção                                     |
| `npm run lint`          | Roda o ESLint                                                |
| `npm run format`        | Formata o código com Prettier                                |
| `npm run format:check`  | Verifica formatação sem alterar arquivos                     |
| `npm run test`          | Roda os testes automatizados (Vitest)                        |
| `npm run test:watch`    | Roda os testes em modo watch                                 |
| `npm run test:coverage` | Roda os testes com relatório de cobertura                    |
| `npm run test:smoke`    | Roda o smoke test ponta a ponta (usa o banco real de `.env`) |

## Estrutura de pastas

```
src/
  app/                    # Rotas e páginas (Next.js App Router)
  lib/                    # Utilitários compartilhados e cliente Prisma
  modules/
    auth/                 # Autenticação e multi-tenant
    organizations/        # Organizações, membros, papéis/permissões
    scheduling/           # Motor de geração de escala (CSP) e configuração
    availability/         # Marcação de disponibilidade
    notifications/        # Notificações in-app
  generated/prisma/       # Código gerado pelo Prisma Client (não editar manualmente)
prisma/
  schema.prisma           # Modelagem de dados
  migrations/             # Histórico de migrações
```

## Convenções do projeto

- Commits locais a cada etapa concluída e testada; **nenhum `git push` é feito sem autorização explícita**.
- O motor de geração de escala (`src/modules/scheduling`) é tratado como problema de satisfação de restrições (CSP) sobre o período inteiro, não como um algoritmo sequencial/guloso.
- Testes automatizados são obrigatórios para: motor de geração de escala, fluxo de autenticação/multi-tenant e regras de mínimo de participação.

## Smoke test ponta a ponta

`src/test/critical-path.smoke.test.ts` cobre o caminho crítico completo (cadastro → aprovação → disponibilidade → geração → publicação → visualização pelo membro → edição manual → regeneração com `keep_manual` → undo → leitura offline) chamando diretamente a camada de serviço (a mesma usada pelas server actions) contra o banco real configurado em `.env`.

Não é um teste de navegador (o projeto não usa Playwright/Cypress) nem roda contra um banco de teste isolado — por isso fica fora do `npm run test` padrão e só executa via `npm run test:smoke`. Ele cria uma organização isolada (nome/e-mails únicos por execução) e remove tudo que criou ao final (`afterAll`); se o banco não estiver acessível, o teste falha explicitamente em vez de pular silenciosamente.
