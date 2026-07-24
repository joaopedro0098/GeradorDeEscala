Criar uma landing page moderna para o Gerescala, um sistema de escalação de equipes de louvor. A página será construída no arquivo `src/routes/index.tsx`, substituindo o placeholder atual, e terá metadados de SEO no `__root.tsx` e no próprio `index.tsx`.

## Decisões de design (já alinhadas com o usuário)

- **Paleta:** azul profundo (noturno) com dourado suave — `#0f172a`, `#1e293b`, `#f59e0b`, `#f8fafc`.
- **Tipografia:** Outfit (títulos) + Figtree (corpo) — "Amigável & Contemporânea".
- **Layout do hero:** lado a lado — texto à esquerda, preview do app à direita.
- **Estilo geral:** moderno, limpo, com espaçamento generoso, bordas arredondadas médias e micro-interações suaves.

## Estrutura da página

1. **Navegação simples**
   - Logo "Gerescala".
   - Links: Funcionalidades, Como funciona, Depoimentos.
   - CTA principal: "Começar agora".

2. **Hero (split-screen)**
   - À esquerda: título grande, subtítulo, CTA primário e secundário, lista de benefícios rápidos (ícones).
   - À direita: visual do app — um card de escala semanal estilizado com avatares, datas, funções (vocal, violão, teclado, etc.) e um destaque de "tudo organizado".
   - Um efeito de brilho/gradiente sutil no fundo para dar profundidade.

3. **Seção de logos / confiança**
   - "Ideal para ministérios de louvor, bandas e igrejas" com ícones de igreja, música, equipe.

4. **Funcionalidades em grid**
   - 3 cards principais: escala automática, disponibilidade da equipe, notificações e lembretes.
   - Cada card com ícone, título, descrição curta e link de saber mais.

5. **Como funciona**
   - 3 passos numerados: cadastre a equipe, defina as regras, gere a escala em segundos.
   - Visual alinhado ao lado.

6. **Depoimentos**
   - 2 cards de depoimentos de líderes de louvor, com foto (avatar ilustrado), nome, função e frase curta.

7. **CTA final**
   - Bloco de conversão com fundo gradiente azul, título e botão de ação.

8. **Footer minimalista**
   - Logo, links, copyright e redes sociais (com ícones).

## Implementação técnica

- Atualizar `src/styles.css` com tokens de design (azul profundo, dourado, fontes Outfit/Figtree) usando `@theme` e carregando as fontes via `<link>` no `__root.tsx`.
- Criar componentes internos na landing page para manter o arquivo organizado: `Nav`, `Hero`, `FeatureCard`, `Step`, `Testimonial`, `Footer`.
- Garantir que a landing page seja responsiva: empilhamento em mobile, split-screen em desktop.
- Adicionar `head()` em `index.tsx` com título, descrição, og:title, og:description, og:type e twitter:card.
- Atualizar o `__root.tsx` para metadados base (viewport, charset, favicon) e remover os placeholders genéricos de "Lovable App".
- Usar `lucide-react` para ícones e Tailwind v4 com tokens semânticos.

## Critério de conclusão

- A landing page renderiza no preview com todas as seções descritas.
- Não há mais o placeholder do blank-app.
- A página passa no build e fica visualmente moderna e responsiva.
- Após aprovação, publicar o app para link de produção.