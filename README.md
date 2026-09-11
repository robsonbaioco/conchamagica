# concha_magica
Página para responder suas perguntas infundáveis sobre a sua vida monótona clicando [aqui](https://robsonbaioco.github.io/conchamagica)

# magic_shell
Page to answer your unfounded questions about the monotonie of life clicking [here](https://robsonbaioco.github.io/conchamagica)

## Criando novas frases

As respostas ficam em `js/answer.js` e os áudios são gerados com as vozes do Microsoft Edge
(Edge TTS), usando o script `scripts/gerar-audios.js`. A voz padrão é a
`pt-BR-ThalitaMultilingualNeural`.

### Preparação (só na primeira vez)

Precisa ter o [Node.js](https://nodejs.org) instalado. Na pasta do projeto, rode:

```bash
npm install
```

### Adicionando uma frase

1. Abra `js/answer.js` e adicione uma nova entrada no final, com o próximo número, o texto
   e o caminho do áudio:

   ```js
   13: {
       texto: 'pergunte de novo',
       audio: '/audio/audio_pergunte.mp3'
   },
   ```

2. Gere o áudio:

   ```bash
   npm run audios
   ```

   O script cria só os áudios que ainda não existem, então os que já estão prontos não são
   alterados. Se você esquecer o campo `audio`, ele avisa e sugere um nome de arquivo.

3. Abra o `index.html` no navegador e puxe a cordinha (ou clique em **Ask**) para testar.

### Trocando a voz

A pasta `amostras-voz/` tem a mesma frase falada por cada voz em português disponível, para
comparar. Para usar outra voz:

- só numa execução: `npm run audios -- --voz pt-BR-FranciscaNeural`
- como padrão: altere `VOZ_PADRAO` no topo de `scripts/gerar-audios.js`

Para que todas as frases fiquem com a mesma voz, gere tudo de novo (isso **sobrescreve** os
áudios existentes):

```bash
npm run audios -- --todas
```

### Outros comandos

| Comando | O que faz |
|---|---|
| `npm run audios -- --vozes` | lista as vozes em português disponíveis |
| `npm run audios -- --amostras` | gera de novo as amostras em `amostras-voz/` |

No topo de `scripts/gerar-audios.js` também dá para ajustar a velocidade (`VELOCIDADE`) e o
tom (`TOM`) da fala. Por exemplo, `TOM = '-2st'` deixa a voz mais grave.

> O Edge TTS usa um serviço gratuito e não oficial da Microsoft, que pode mudar ou parar de
> funcionar. Os áudios gerados ficam salvos em `audio/`, então o site continua funcionando
> mesmo que isso aconteça.
