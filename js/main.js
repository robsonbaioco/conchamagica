// Lógica da página (com jQuery): idioma (português/inglês), sorteio da resposta, animações da concha e o
// easter egg. Usa `answers` (answer.js) e playAudio (audio.js); ask() também é chamado por corda.js quando
// a cordinha chega no limite. Carregado depois das bibliotecas e de audio.js/answer.js (ver index.html).
// Idioma da página: o que a pessoa escolheu na bandeirinha ou, se nunca escolheu, o do navegador
var TEXTOS = {
    pt: {
        lang: 'pt-BR',
        pergunta: 'Faça uma pergunta à Concha Mágica',
        botao: 'Perguntar',
        saudacao: 'Todos saúdam a Concha Mágica!',
        trocar: 'Switch to English'
    },
    en: {
        lang: 'en',
        pergunta: 'Ask the Magic Conch a question',
        botao: 'Ask',
        saudacao: 'All hail the Magic Conch!',
        trocar: 'Mudar para português'
    }
};
var CHAVE_IDIOMA = 'conchamagica-idioma';
var idioma = idiomaSalvo() || idiomaDoNavegador();

/** "pt" se alguma língua preferida do navegador for português; senão "en". */
function idiomaDoNavegador() {
    var idiomas = navigator.languages || [navigator.language || 'pt'];
    var emPortugues = idiomas.some(function(item) {
        return /^pt\b/i.test(item);
    });

    return emPortugues ? 'pt' : 'en';
}

// O localStorage pode não existir ou dar erro (janela anônima, cookies bloqueados)
function idiomaSalvo() {
    try {
        var salvo = localStorage.getItem(CHAVE_IDIOMA);
        return TEXTOS[salvo] ? salvo : null;
    } catch (erro) {
        return null;
    }
}

/** Grava a escolha da bandeirinha (se o localStorage não deixar, a escolha vale só até recarregar). */
function salvarIdioma() {
    try {
        localStorage.setItem(CHAVE_IDIOMA, idioma);
    } catch (erro) {}
}

/** Troca os textos da página (lang, placeholder, botão, texto alternativo do GIF, dica da bandeirinha) para o idioma atual. */
function aplicarIdioma() {
    var textos = TEXTOS[idioma];

    document.documentElement.lang = textos.lang;
    $('input[name="question"]').attr('placeholder', textos.pergunta);
    $('.Button').text(textos.botao);
    $('#egg').attr('alt', textos.saudacao);
    $('#idioma').attr({ 'aria-label': textos.trocar, title: textos.trocar });
}

// Ao carregar a página: aplica o idioma, liga a bandeirinha e o formulário e pré-carrega os GIFs.
$(function() {
    aplicarIdioma();

    $('#idioma').on('click', function() {
        idioma = idioma === 'pt' ? 'en' : 'pt';
        aplicarIdioma();
        salvarIdioma();
    });

    // Pedido POST para a própria página, cuja resposta ninguém usa (sobra do começo do projeto). Num site
    // estático como o GitHub Pages ele falha sem efeito nenhum para a pessoa.
    $.ajax({
        url: '',
        type: 'post',
        dataType: 'json',
    })
    .done(function() {
        console.log("success");
    });

    // wow
    // WOW.js anima elementos com a classe "wow" ao rolar; hoje nenhum elemento da página usa essa classe.
    new WOW({
        offset: 300
    }).init();

    // Enviar a pergunta (Enter ou botão Perguntar): a frase de saudação dispara o easter egg; qualquer outra, uma resposta.
    $( "form" ).submit(function( event ) {
        event.preventDefault();

        if (ehSaudacao($('input[name="question"]').val())) {
            allHail();
        } else {
            ask();
        }
    });

    // Pré-carrega os GIFs do easter egg para o fade-in não aparecer pela metade
    eggGifs.forEach(function(gif) {
        new Image().src = gif;
    });
});

// Temporizador da resposta na tela (troca e some); cancelado quando outra resposta ou o easter egg entra.
var answerTimer;

// Sorteia uma resposta, mostra a mensagem e toca o áudio
function ask() {
    var keys = Object.keys(answers);
    var answer = answers[keys[keys.length * Math.random() << 0]];

    if (idioma === 'en' && answer.ingles) {
        answer = answer.ingles;
    }

    shakeConcha();
    showAnswer(answer.texto);
    playAudio(answer.audio);
}

/** Faz a concha tremer (reinicia a animação CSS _shake mesmo se ela já estava rodando). */
function shakeConcha() {
    var $img = $('#concha-img');

    $img.removeClass('_shake');
    $img[0].offsetWidth; // força reflow para reiniciar a animação
    $img.addClass('_shake');
}

// Mensagem que aparece com fade-in, fica um tempo e some com fade-out
function showAnswer(texto) {
    var $answer = $('#answer');
    var fadeOut = $answer.hasClass('_active') ? 400 : 0;

    clearTimeout(answerTimer);
    $answer.removeClass('_active');

    // Se o easter egg estiver na tela, sai de cena
    clearTimeout(eggTimer);
    $('#egg').removeClass('_active');

    // Se já tinha uma resposta na tela, espera ela sumir antes de mostrar a nova
    answerTimer = setTimeout(function() {
        $answer.find('span').text(texto);
        $answer.addClass('_active');

        answerTimer = setTimeout(function() {
            $answer.removeClass('_active');
        }, 2500 + texto.length * 60);
    }, fadeOut);
}

// Easter egg: "todos saudam a concha mágica" (ou "all hail the magic conch")
var eggGifs = ['images/saudacao1.gif', 'images/saudacao2.gif'];
var eggTimer;

// Minúsculas, sem acentos e sem pontuação, para a comparação ser tolerante
function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z]+/g, ' ')
        .trim();
}

/** A pergunta é "todos saudam a concha mágica" (ou "all hail the magic conch"), ignorando acentos, maiúsculas e pontuação. */
function ehSaudacao(texto) {
    var frase = normalizar(texto || '');

    return frase === 'todos saudam a concha magica' || frase === 'all hail the magic conch';
}

// Mostra um dos GIFs no lugar da resposta, com o dobro do tempo em tela
function allHail() {
    var $egg = $('#egg');
    var fadeOut = $egg.hasClass('_active') ? 400 : 0;

    shakeConcha();

    // Esconde a resposta normal, se tiver uma na tela
    clearTimeout(answerTimer);
    $('#answer').removeClass('_active');

    clearTimeout(eggTimer);
    $egg.removeClass('_active');

    eggTimer = setTimeout(function() {
        var gif = eggGifs[Math.floor(Math.random() * eggGifs.length)];

        // Reatribuir o src faz o GIF recomeçar do primeiro quadro
        $egg.attr('src', '');
        $egg.attr('src', gif);
        $egg.addClass('_active');

        eggTimer = setTimeout(function() {
            $egg.removeClass('_active');
        }, 7000);
    }, fadeOut);
}
