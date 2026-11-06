# Documentação da Concha Mágica

Guia para quem vai dar manutenção na Concha Mágica. O [README da raiz](../README.md) explica como criar frases novas e gerar os áudios; aqui está **como a página funciona por dentro** e **como mexer nela sem quebrar nada**. O projeto é pequeno, então tudo fica neste arquivo.

## Visão geral

Página estática (HTML, CSS e JavaScript puro, sem build), publicada no GitHub Pages em <https://robsonbaioco.github.io/conchamagica/>. A pessoa faz uma pergunta (ou puxa a cordinha da concha) e recebe uma resposta sorteada, em texto e falada. As falas são MP3 gerados antes, uma vez, com as vozes do Microsoft Edge (Edge TTS); a página só toca os arquivos.

```
index.html
├── css/libs/monalisa.css   framework CSS de terceiros (formulário, botão)
├── css/style.css           visual próprio: concha, resposta, easter egg, corda, pino, bandeirinha
├── js/libs/                jQuery e Matter.js (terceiros, minificados; não editar)
├── js/audio.js             toca os MP3 (um <audio> só, reaproveitado)
├── js/answer.js            as respostas (texto + caminho do MP3, em pt e en)
├── js/main.js              idioma, sorteio, animações, easter egg
└── js/corda.js             a cordinha com física (Matter.js)

scripts/gerar-audios.js     (Node) gera os MP3 que faltam a partir de answer.js
audio/, audio/en/           os MP3 das respostas
amostras-voz/, amostras-voz/en/   a mesma frase em cada voz disponível, para escolher
images/                     fundo, concha sem pino, pino, GIFs do easter egg, prévia do link (e os .psd de origem)
```

A ordem dos `<script>` no `index.html` importa: bibliotecas, `audio.js`, `answer.js`, `main.js` e por último `corda.js`. São scripts clássicos, que compartilham funções e variáveis globais (`answers`, `ask`, `playAudio`, `unlockAudio`).

## Como funciona

### Perguntar

- **Formulário**: Enter ou o botão Perguntar chamam `ask()` (main.js). O texto da pergunta não importa, a não ser o easter egg abaixo.
- **Cordinha**: puxar o pino da concha até o limite também chama `ask()` (ver abaixo).
- `ask()` sorteia uma entrada de `answers` (todas com a mesma chance), escolhe a versão em inglês se o idioma for inglês, faz a concha tremer (`_shake`), mostra o texto e toca o áudio.
- A resposta aparece com fade-in e some sozinha depois de `2,5 s + 60 ms por caractere`. Se já havia uma resposta na tela, ela some antes (400 ms) e a nova entra.

### Easter egg

Perguntar "todos saudam a concha mágica" ou "all hail the magic conch" (sem diferença de acentos, maiúsculas e pontuação, via `normalizar`) mostra um dos dois GIFs de `images/saudacao*.gif` por 7 s no lugar da resposta, sem áudio. Os GIFs são pré-carregados ao abrir a página, e o `src` é zerado e reatribuído para o GIF começar do primeiro quadro.

### Idioma

- Na primeira visita, a página fica em português se alguma língua preferida do navegador for português; senão, em inglês.
- A bandeirinha no canto mostra o idioma atual (CSS: `html[lang="en"]` troca qual SVG aparece) e, ao clicar, troca para o outro e grava a escolha no `localStorage` (`conchamagica-idioma` = `pt` ou `en`). Se o `localStorage` não estiver disponível (janela anônima, cookies bloqueados), a escolha vale até recarregar.
- `aplicarIdioma` troca o `lang` da página, o placeholder, o botão, o texto alternativo do GIF e a dica da bandeirinha. Os textos ficam em `TEXTOS` (main.js); as respostas, em `answers` (answer.js).

### Áudio (`js/audio.js`)

- Um único `Audio` reaproveitado: uma resposta nova interrompe a anterior.
- Os caminhos em `answer.js` começam com `/` (relativos à raiz do projeto, que é como o script de geração os entende); `audioUrl` tira a barra, para o áudio funcionar no GitHub Pages (que serve o site em `/conchamagica/`) e abrindo o `index.html` direto do disco.
- **iPhone/iPad**: o Safari só deixa tocar áudio iniciado dentro de um gesto. A resposta da corda dispara no meio do arrasto, não no toque, então `unlockAudio()` toca um áudio **mudo** no primeiro toque no pino para "destravar" o elemento. Se o navegador recusar (`NotAllowedError`), tenta de novo no próximo toque.

### A cordinha (`js/corda.js`)

Física com o **Matter.js**: a corda é uma corrente de 12 bolinhas sem colisão, ligadas por restrições de distância, do furo da concha até a ponta do pino. Estados:

| Estado | O que acontece |
|---|---|
| `encaixado` | o pino fica parado na concha (acompanhando a tremida e o redimensionamento), sem simulação |
| `puxando` | o pino segue o dedo/mouse, sem passar de `COMPRIMENTO_MAX` (650 px da imagem); a corda sai conforme é puxada e gira o pino na direção dela. Chegar no limite chama `ask()` e vibra o celular (`navigator.vibrate`); só dispara de novo depois que a corda voltar para menos da metade |
| `solto` | o pino sai com o embalo dos últimos movimentos (limitado) e cai/balança pela física; a corda é recolhida em 2,4 s (`SEGUNDOS_PARA_RECOLHER`) |
| `encaixando` | com a corda recolhida, o pino desliza de volta para a concha em 220 ms |

- Todas as medidas (`PINO`, `FURO`, `PONTA`, `COMPRIMENTO_MAX`) estão em pixels da **imagem original da concha (1080 px de largura)** e são convertidas pela escala atual a cada quadro (`medir`): a corda se ajusta a qualquer tamanho de tela.
- A simulação roda em passos fixos de 1/120 s, independentes da taxa de quadros.
- A corda é desenhada num `<canvas>` que cobre a tela, como uma curva suave pelos segmentos (contorno preto, miolo creme). O pino é um `<div>` com a imagem `pino.png`, movido por `transform`. Os dois ficam fora do `.content` para poder sair da área da concha.
- Enquanto puxa, `body` ganha a classe `_puxando` (cursor de "agarrando" na página toda).

### Prévia do link

As tags `og:*` e `twitter:card` do `index.html` fazem a prévia ao compartilhar o link (WhatsApp, Telegram, Discord...), com `images/og-preview.jpg` (1200 × 630). A descrição tem uma quebra de linha codificada como `&#10;`.

## Dados

O único dado gravado é a escolha de idioma (`localStorage`, chave `conchamagica-idioma`). Nada é enviado para servidor.

## Manutenção

### Frase nova, trocar voz, regenerar áudios

Está no [README da raiz](../README.md#criando-novas-frases): acrescentar a entrada em `js/answer.js` (com a versão `ingles`) e rodar `npm run audios`, que cria só os MP3 que faltam. O script lê `answer.js` executando-o isolado (`vm`), então o arquivo precisa continuar sendo `var answers = { ... }` válido. Requisito: Node e `npm install` (instala o `msedge-tts`, única dependência, só de desenvolvimento).

Os MP3 gerados ficam no repositório: a página não depende do Edge TTS para funcionar, só o script.

### Texto novo na interface

Acrescente a chave nos dois idiomas de `TEXTOS` (main.js) e aplique em `aplicarIdioma`.

### Mudar a concha ou o pino

Se trocar `images/conchasempino.png` ou `images/pino.png`, refaça as medidas no topo de `corda.js` (posição e tamanho do pino encaixado, furo de onde sai a corda e ponto onde ela prende no pino) em pixels da imagem nova, e ajuste `IMAGEM_LARGURA` se a largura mudar. Os `.psd` em `images/` são os arquivos de origem.

### Publicar

O site é servido pelo GitHub Pages a partir do repositório: um push no branch publicado atualiza a página. Não há build.

### Testar

Não há testes automáticos. Abra o `index.html` no navegador (direto do disco funciona) e confira: o formulário, a cordinha com mouse e com toque, o easter egg, a troca de idioma e o áudio. `node --check js/<arquivo>.js` confere a sintaxe. Para o áudio no iPhone, só testando num iPhone.

## Pontos frágeis conhecidos

- **Edge TTS não oficial**: o script usa um serviço gratuito da Microsoft que pode mudar ou parar. Os áudios já gerados continuam valendo; para frases novas, seria preciso outra forma de gerar o MP3. Trocar de voz rápido demais faz o serviço recusar (por isso a espera de 3 s entre amostras). Continua: serviço externo; só dá para tratar quando ele mudar.
- **Áudio no iOS** depende do truque do áudio mudo no primeiro toque no pino. Quem só usa o formulário toca o áudio direto no clique, que já é um gesto. Continua: só dá para testar num iPhone.
- **Medidas fixas da imagem** em corda.js: trocar a imagem da concha sem refazer as medidas desalinha o pino e o furo. Continua: regra de manutenção (receita em "Mudar a concha ou o pino").
- **Sorteio sem memória**: a mesma resposta pode sair duas vezes seguidas (de propósito ou não, é como o código está). Continua: depende de decisão (a concha do desenho repete respostas).
- **Bibliotecas antigas e minificadas** em `js/libs/` (jQuery, Matter.js 0.20.0) e `css/libs/monalisa.css`: são copiadas no repositório, não vêm do npm; atualizar é trocar o arquivo à mão. Continua: atualizar o jQuery ou o Matter.js pede teste manual da corda e do formulário.
