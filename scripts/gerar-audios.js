// Gera os áudios das respostas da concha usando as vozes do Microsoft Edge (Edge TTS).
//
// Uso:
//   npm run audios                          gera só os áudios que ainda não existem
//   npm run audios -- --todas               gera de novo todos os áudios (para ficar tudo com a mesma voz)
//   npm run audios -- --voz pt-BR-FranciscaNeural   usa outra voz
//   npm run audios -- --amostras            gera uma frase de exemplo com cada voz pt-BR, para comparar
//   npm run audios -- --vozes               lista as vozes em português disponíveis
//
// As frases ficam em js/answer.js. Para criar uma nova, adicione uma entrada com `texto` e `audio`
// e rode `npm run audios`.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const RAIZ = path.join(__dirname, '..');
const PASTA_AMOSTRAS = path.join(RAIZ, 'amostras-voz');

const VOZ_PADRAO = 'pt-BR-ThalitaMultilingualNeural';
const FORMATO = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

// Ajuste fino da fala. Ex.: velocidade '-10%' (mais devagar), tom '-2st' (mais grave)
const VELOCIDADE = '-5%';
const TOM = '+0Hz';

const FRASE_AMOSTRA = 'Com toda certeza! Tente novamente mais tarde.';

function lerArgumentos() {
    const args = process.argv.slice(2);
    const indiceVoz = args.indexOf('--voz');

    return {
        todas: args.includes('--todas'),
        amostras: args.includes('--amostras'),
        vozes: args.includes('--vozes'),
        voz: indiceVoz >= 0 ? args[indiceVoz + 1] : VOZ_PADRAO
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

async function vozesPortugues(tts) {
    const vozes = await tts.getVoices();
    return vozes.filter((v) => v.Locale.startsWith('pt-'));
}

async function listarVozes(tts) {
    const vozes = await vozesPortugues(tts);

    vozes.forEach((v) => {
        const genero = v.Gender === 'Female' ? 'feminina' : 'masculina';
        console.log(v.ShortName.padEnd(36) + genero.padEnd(11) + v.Locale);
    });
}

async function gerarAmostras(tts) {
    const vozes = await vozesPortugues(tts);

    fs.mkdirSync(PASTA_AMOSTRAS, { recursive: true });

    for (const v of vozes) {
        await tts.setMetadata(v.ShortName, FORMATO, {}); // o `{}` evita um bug do msedge-tts ao trocar de voz
        const arquivo = path.join(PASTA_AMOSTRAS, v.ShortName + '.mp3');
        fs.writeFileSync(arquivo, await sintetizar(tts, FRASE_AMOSTRA));
        console.log('amostra: ' + path.relative(RAIZ, arquivo));
    }
}

function sugerirNomeArquivo(texto) {
    const nome = texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

    return '/audio/audio_' + nome + '.mp3';
}

async function gerarRespostas(tts, { todas, voz }) {
    const respostas = lerRespostas();
    let gerados = 0, erros = 0;

    await tts.setMetadata(voz, FORMATO, {});
    console.log('voz: ' + voz + '\n');

    for (const resposta of respostas) {
        if (!resposta.audio) {
            console.log('SEM AUDIO "' + resposta.texto + '": adicione  audio: \'' + sugerirNomeArquivo(resposta.texto) + '\'');
            erros++;
            continue;
        }

        const arquivo = path.join(RAIZ, resposta.audio);

        if (!todas && fs.existsSync(arquivo)) {
            continue;
        }

        try {
            fs.mkdirSync(path.dirname(arquivo), { recursive: true });
            fs.writeFileSync(arquivo, await sintetizar(tts, resposta.texto));
            console.log('ok    ' + resposta.audio + '  "' + resposta.texto + '"');
            gerados++;
        } catch (erro) {
            console.log('ERRO  ' + resposta.audio + ': ' + erro.message);
            erros++;
        }
    }

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
            await listarVozes(tts);
        } else if (opcoes.amostras) {
            await gerarAmostras(tts);
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
