// Um único elemento de áudio reaproveitado: assim uma resposta nova interrompe a anterior
// e, no celular, basta "destravar" o áudio uma vez durante um toque do usuário.
var voice = new Audio();

// Caminho relativo à página: funciona no GitHub Pages, com /index.html na URL e abrindo o arquivo direto
function audioUrl(path) {
	return path.replace(/^\//, '');
}

function playAudio(path) {
	voice.pause();
	voice.muted = false;
	voice.src = audioUrl(path);
	voice.play().catch(function() {});
}

// iOS só deixa tocar áudio iniciado dentro de um gesto (toque/clique). Como a resposta da
// corda dispara no meio do arrasto, tocamos o áudio mudo no primeiro toque para liberá-lo.
function unlockAudio() {
	if (voice.dataset.unlocked || !voice.paused) {
		return;
	}

	voice.dataset.unlocked = '1';
	voice.muted = true;
	voice.src = audioUrl(answers[0].audio);
	voice.play().then(function() {
		if (voice.muted) {
			voice.pause();
			voice.muted = false;
		}
	}).catch(function(err) {
		voice.muted = false;

		// Só tenta de novo se o navegador bloqueou (não quando uma resposta interrompeu o play)
		if (err && err.name === 'NotAllowedError') {
			delete voice.dataset.unlocked;
		}
	});
}
