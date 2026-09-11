$(function() {
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
        ask();
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

    // Se já tinha uma resposta na tela, espera ela sumir antes de mostrar a nova
    answerTimer = setTimeout(function() {
        $answer.find('span').text(texto);
        $answer.addClass('_active');

        answerTimer = setTimeout(function() {
            $answer.removeClass('_active');
        }, 2500 + texto.length * 60);
    }, fadeOut);
}
