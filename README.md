# Mantus Christi — site da edição

Site de uma página só, feito para apresentar **a camisa da edição atual** — hoje, a
**Sucessão Apostólica** (edição de lançamento).

O que tem nele:

- **Camisa em 3D** (modelada por código) com as estampas reais da frente e das costas.
  Dá para **arrastar e girar**, e uma luz de vela acompanha o cursor.
- **Abertura** com contagem em algarismos romanos até **CCLXVII** (Leão XIV, o 267º papa).
- **A camisa vira com a rolagem** e a câmera **mergulha nas costas**, medalhão por medalhão,
  contando quem é cada papa (número na sucessão, anos, uma frase e um resumo).
- **Passar o cursor (ou tocar) nos medalhões** da camisa mostra o nome; clicar leva à história.
- **A frente: o Credo** — a câmera vai até "Una, Santa, Católica, Apostólica" e explica as quatro palavras.
- **Folhas douradas** (as mesmas da arte) caindo, que o cursor "sopra".
- **Foto do mockup com lupa**, área de **escolha de tamanho** e botão de compra.
- Funciona no celular. Sem WebGL (aparelhos muito antigos), mostra as fotos no lugar do 3D.

---

## Rodar no computador

Precisa do [Node.js](https://nodejs.org) instalado (versão 22.15 ou mais nova).

```bash
npm install
```

```bash
npm run dev
```

Abra o endereço que aparecer (normalmente `http://localhost:5173`).

## Colocar no ar

```bash
npm run build
```

Isso gera a pasta **`dist/`** — é ela que vai para a internet. Duas opções fáceis:

**Netlify (arrastar e soltar, sem conta de GitHub):**
1. Entre em <https://app.netlify.com/drop>.
2. Arraste a pasta `dist` para a página.
3. Pronto: ele mostra o link do site. Em *Domain settings* dá para ligar um domínio próprio.

**Vercel (atualiza sozinho a cada mudança):**
1. Suba esta pasta para um repositório no GitHub.
2. Em <https://vercel.com/new>, importe o repositório.
3. Ele detecta "Vite" sozinho (build: `npm run build`, pasta: `dist`). Clique em *Deploy*.

> Depois de ter o domínio definitivo, troque em `index.html` a linha
> `og:image` para o endereço completo (ex.: `https://seudominio.com.br/assets/og-image.jpg`).
> Isso faz a imagem aparecer quando o link for compartilhado no WhatsApp/Instagram.

---

## Editar textos, preço e compra

Tudo fica em **`src/drop.js`**:

| Campo        | O que é                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `price`      | Preço (ex.: `"R$ 149,90"`). Deixe `null` para não mostrar.              |
| `sizes`      | Tamanhos disponíveis.                                                   |
| `whatsapp`   | Número com DDI+DDD, só dígitos (ex.: `"5511999999999"`). O botão abre a conversa já com a camisa e o tamanho escolhidos. |
| `buyUrl`     | Se não usar WhatsApp: link da loja/formulário.                          |
| `instagram`  | `@perfil` ou link — aparece no rodapé.                                  |
| `fabric`     | Cor do tecido no 3D.                                                    |
| `popes`      | Os textos de cada medalhão (na ordem da arte).                          |
| `creed`      | As quatro palavras da frente e suas explicações.                        |

Enquanto `whatsapp` e `buyUrl` estiverem vazios, o botão avisa que as vendas abrem em breve.

## Próxima edição

1. Coloque os arquivos da arte na raiz do projeto (o PDF do Illustrator com frente na
   página 1 e costas na página 2, exportado com **"Preservar recursos de edição do Illustrator"**,
   e a foto do mockup). Se os nomes mudarem, ajuste no topo de `scripts/build-assets.mjs`.
   > Esses arquivos originais **não vão para o GitHub** (o repositório é público e o PDF contém
   > a arte editável completa). Eles ficam só no seu computador.
2. Rode:
   ```bash
   npm run assets
   ```
   Ele gera as estampas sem fundo em alta resolução, os recortes de cada medalhão,
   o logo, o selo e as versões leves da foto.
3. Atualize `src/drop.js` com o nome e os textos da nova camisa.

O capítulo "medalhão por medalhão" foi desenhado para a arte da Sucessão Apostólica;
numa arte diferente, a ideia de "a câmera passeia pela estampa" continua valendo, mas os
pontos de parada e os textos precisam ser refeitos para a nova arte.

---

## Estrutura

```
index.html              página (seções)
src/drop.js             conteúdo da edição (textos, preço, links)
src/main.js             abertura, rolagem, trilha de câmera, interações
src/styles/main.css     visual
src/three/shirt.js      a camisa 3D (modelagem, tecido, estampas)
src/three/Stage.js      cena, luzes, câmera, arrastar/girar, hover nos medalhões
src/three/atmosphere.js folhas, poeira de luz, auréola e feixes
src/three/textures.js   texturas geradas por código (malha, ribana, folhas)
scripts/build-assets.mjs gera os assets a partir dos arquivos originais
public/assets/          imagens otimizadas (geradas)
src/assets/             logo e selo em SVG (gerados do arquivo do Illustrator)
```

Fontes: Cinzel, Cormorant Garamond, Pinyon Script e Manrope (todas de licença aberta, embutidas no site).
