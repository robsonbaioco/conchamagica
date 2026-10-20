// Gera os áudios das respostas da concha usando as vozes do Microsoft Edge (Edge TTS).
//
// Uso:
//   npm run audios                          gera só os áudios que ainda não existem
//   npm run audios -- --todas               gera de novo todos os áudios (para ficar tudo com a mesma voz)
//   npm run audios -- --voz pt-BR-FranciscaNeural   usa outra voz para as frases em português
//   npm run audios -- --voz-ingles en-US-EmmaNeural  usa outra voz para as frases em inglês
//   npm run audios -- --amostras            gera uma frase de exemplo com cada voz em português, para comparar
//   npm run audios -- --vozes               lista as vozes em português disponíveis
//   (com --ingles, --amostras e --vozes usam as vozes em inglês dos EUA e do Reino Unido)
//
// As frases ficam em js/answer.js. Para criar uma nova, adicione uma entrada com `texto` e `audio`,
// mais a versão em inglês em `ingles: { texto, audio }`, e rode `npm run audios`.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const RAIZ = path.join(__dirname, '..');
const PASTA_AMOSTRAS = path.join(RAIZ, 'amostras-voz');

const VOZ_PADRAO = 'pt-BR-ThalitaMultilingualNeural';
const VOZ_INGLES = 'en-US-AriaNeural';
const FORMATO = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

// Ajuste fino da fala. Ex.: velocidade '-10%' (mais devagar), tom '-2st' (mais grave)
const VELOCIDADE = '-5%';
const TOM = '+0Hz';

const FRASE_AMOSTRA = 'Com toda certeza! Tente novamente mais tarde.';
const FRASE_AMOSTRA_INGLES = 'Maybe someday. Try asking again later.';

function lerArgumentos() {
    const args = process.argv.slice(2);
    const indiceVoz = args.indexOf('--voz');
    const indiceVozIngles = args.indexOf('--voz-ingles');

    return {
        todas: args.includes('--todas'),
        amostras: args.includes('--amostras'),
        vozes: args.includes('--vozes'),
        ingles: args.includes('--ingles'),
        voz: indiceVoz >= 0 ? args[indiceVoz + 1] : VOZ_PADRAO,
        vozIngles: indiceVozIngles >= 0 ? args[indiceVozIngles + 1] : VOZ_INGLES
    };
}

// js/answer.js é um script de navegador (`var answers = {...}`), então rodamos ele isolado
function lerRespostas() {
    const codigo = fs.readFileSync(path.join(RAIZ, 'js', 'answer.js'), 'utf8');
    const contexto = {};

    vm.runInNewContext(codigo, contexto);
    return Object.values(contexto.answers);
}

function escaparXml(texto) {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function sintetizar(tts, texto) {
    return new Promise((resolve, reject) => {
        const { audioStream } = tts.toStream(escaparXml(texto), { rate: VELOCIDADE, pitch: TOM });
        const partes = [];

        audioStream.on('data', (parte) => partes.push(parte));
        audioStream.on('error', reject);
        audioStream.on('close', () => {
            const audio = Buffer.concat(partes);

            if (audio.length === 0) {
                reject(new Error('o serviço não devolveu áudio para "' + texto + '"'));
            } else {
                resolve(audio);
            }
        });
    });
}

// Em inglês só as variantes dos EUA e do Reino Unido, para a lista de amostras não ficar enorme
async function vozesDoIdioma(tts, ingles) {
    const vozes = await tts.getVoices();
    return vozes.filter((v) => ingles ? /^en-(US|GB)$/.test(v.Locale) : v.Locale.startsWith('pt-'));
}

async function listarVozes(tts, ingles) {
    const vozes = await vozesDoIdioma(tts, ingles);

    vozes.forEach((v) => {
        const genero = v.Gender === 'Female' ? 'feminina' : 'masculina';
        console.log(v.ShortName.padEnd(36) + genero.padEnd(11) + v.Locale);
    });
}

async function gerarAmostras(tts, ingles) {
    const vozes = await vozesDoIdioma(tts, ingles);
    const pasta = ingles ? path.join(PASTA_AMOSTRAS, 'en') : PASTA_AMOSTRAS;

    fs.mkdirSync(pasta, { recursive: true });

    for (const v of vozes) {
        const arquivo = path.join(pasta, v.ShortName + '.mp3');

        // Pula as que já existem, para poder continuar se o serviço recusar no meio (erro 429)
        if (fs.existsSync(arquivo)) {
            continue;
        }

        await esperar(3000); // trocar de voz muito rápido faz o serviço recusar a conexão
        await tts.setMetadata(v.ShortName, FORMATO, {}); // o `{}` evita um bug do msedge-tts ao trocar de voz
        fs.writeFileSync(arquivo, await sintetizar(tts, ingles ? FRASE_AMOSTRA_INGLES : FRASE_AMOSTRA));
        console.log('amostra: ' + path.relative(RAIZ, arquivo));
    }
}

function sugerirNomeArquivo(texto, pasta) {
    const nome = texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

    return pasta + 'audio_' + nome + '.mp3';
}

async function gerarIdioma(tts, frases, { todas, voz, pasta }) {
    let gerados = 0, erros = 0;

    await tts.setMetadata(voz, FORMATO, {});
    console.log('voz: ' + voz + '\n');

    for (const frase of frases) {
        if (!frase.audio) {
            console.log('SEM AUDIO "' + frase.texto + '": adicione  audio: \'' + sugerirNomeArquivo(frase.texto, pasta) + '\'');
            erros++;
            continue;
        }

        const arquivo = path.join(RAIZ, frase.audio);

        if (!todas && fs.existsSync(arquivo)) {
            continue;
        }

        try {
            fs.mkdirSync(path.dirname(arquivo), { recursive: true });
            fs.writeFileSync(arquivo, await sintetizar(tts, frase.texto));
            console.log('ok    ' + frase.audio + '  "' + frase.texto + '"');
            gerados++;
        } catch (erro) {
            console.log('ERRO  ' + frase.audio + ': ' + erro.message);
            erros++;
        }
    }

    return { gerados, erros };
}

async function gerarRespostas(tts, { todas, voz, vozIngles }) {
    const respostas = lerRespostas();
    let erros = 0;

    respostas.filter((r) => !r.ingles).forEach((r) => {
        console.log('SEM INGLES "' + r.texto + '": adicione  ingles: { texto: \'...\', audio: \'/audio/en/audio_....mp3\' }');
        erros++;
    });

    console.log('Português');
    const pt = await gerarIdioma(tts, respostas, { todas, voz, pasta: '/audio/' });

    console.log('\nInglês');
    const en = await gerarIdioma(tts, respostas.filter((r) => r.ingles).map((r) => r.ingles), { todas, voz: vozIngles, pasta: '/audio/en/' });

    const gerados = pt.gerados + en.gerados;
    erros += pt.erros + en.erros;

    console.log('\n' + gerados + ' áudio(s) gerado(s)' + (erros ? ', ' + erros + ' problema(s)' : ''));
    if (!gerados && !erros) {
        console.log('Todos os áudios já existem. Use --todas para gerar de novo.');
    }

    return erros;
}

async function main() {
    const opcoes = lerArgumentos();
    const tts = new MsEdgeTTS();
    let erros = 0;

    try {
        if (opcoes.vozes) {
            await listarVozes(tts, opcoes.ingles);
        } else if (opcoes.amostras) {
            await gerarAmostras(tts, opcoes.ingles);
        } else {
            erros = await gerarRespostas(tts, opcoes);
        }
    } finally {
        tts.close();
    }

    process.exitCode = erros ? 1 : 0;
}

main().catch((erro) => {
    console.error('Falhou: ' + erro.message);
    process.exitCode = 1;
});
