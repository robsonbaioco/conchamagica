// A página já vem em português; só traduz para inglês se o navegador não estiver em português
var idiomas = navigator.languages || [navigator.language || 'pt'];
var emPortugues = idiomas.some(function(idioma) {
    return /^pt\b/i.test(idioma);
});

function traduzirParaIngles() {
    document.documentElement.lang = 'en';
    $('input[name="question"]').attr('placeholder', 'Ask the Magic Conch a question');
    $('.Button').text('Ask');
    $('#egg').attr('alt', 'All hail the Magic Conch!');
}

$(function() {
    if (!emPortugues) {
        traduzirParaIngles();
    }

    $.ajax({
        url: '',
        type: 'post',
        dataType: 'json',
    })
    .done(function() {
        console.log("success");
    });

    // wow
    new WOW({
        offset: 300
    }).init();

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

var answerTimer;

// Sorteia uma resposta, mostra a mensagem e toca o áudio
function ask() {
    var keys = Object.keys(answers);
    var answer = answers[keys[keys.length * Math.random() << 0]];

    shakeConcha();
    showAnswer(answer.texto);
    playAudio(answer.audio);
}

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
