// Corda da concha, com física do Matter.js.
// Puxe o pino (mouse ou dedo): a corda sai da concha até um limite físico e, ao chegar
// nele, a concha responde. Ao soltar, a corda é recolhida devagar, como num brinquedo de
// puxar a cordinha.
(function() {
    var Engine = Matter.Engine,
        Bodies = Matter.Bodies,
        Body = Matter.Body,
        Composite = Matter.Composite,
        Constraint = Matter.Constraint;

    // Medidas em pixels da imagem original da concha (1080x810)
    var IMAGEM_LARGURA = 1080;
    var PINO = { x: 722, y: 207, w: 89, h: 80 }; // pino encaixado na concha (concha.png)
    var FURO = { x: 732, y: 272.5 };             // ponto de onde a corda sai da concha
    var PONTA = { x: -34.5, y: 25.5 };           // onde a corda prende no pino, relativo ao centro dele
    var COMPRIMENTO_MAX = 800;                   // limite físico da corda

    var SEGMENTOS = 12;
    var SEGUNDOS_PARA_RECOLHER = 2.4; // tempo para recolher a corda inteira depois de soltar
    var DURACAO_ENCAIXE = 220;        // ms da animação do pino encaixando na concha
    var PASSO = 1000 / 120;           // passo fixo da simulação

    var canvas = document.getElementById('corda');
    var ctx = canvas.getContext('2d');
    var pinoEl = document.getElementById('pino');
    var conchaImg = document.getElementById('concha-img');

    var escala = 1, maxComprimento = 0;
    var ancora = { x: 0, y: 0 };  // furo da concha
    var repouso = { x: 0, y: 0 }; // centro do pino encaixado
    var pontaLocal = { x: 0, y: 0 };

    // 'encaixado' | 'puxando' | 'solto' | 'encaixando'
    var estado = 'encaixado';
    var comprimento = 0; // quanto de corda está para fora da concha
    var armado = true;   // pode disparar uma resposta ao chegar no limite
    var ponteiroId = null, pegada = null, alvo = null;
    var rastro = []; // últimas posições do pino enquanto puxa, para calcular o embalo ao soltar
    var encaixe = null, anguloAnterior = 0;
    var desenhouCorda = false;

    var engine = Engine.create({
        gravity: { x: 0, y: 2 },
        constraintIterations: 40,
        positionIterations: 8
    });
    var semColisao = { collisionFilter: { mask: 0 } };

    var pino = Bodies.circle(0, 0, 10, Object.assign({ frictionAir: 0.03 }, semColisao));
    Body.setMass(pino, 2);
    Body.setStatic(pino, true);

    var segmentos = [];
    var ligacoes = [];

    for (var i = 0; i < SEGMENTOS; i++) {
        var segmento = Bodies.circle(0, 0, 2, Object.assign({ frictionAir: 0.05 }, semColisao));
        Body.setMass(segmento, 0.06);
        segmentos.push(segmento);
    }

    // furo -> segmento 0 -> ... -> último segmento -> ponta do pino
    for (var j = 0; j <= SEGMENTOS; j++) {
        ligacoes.push(Constraint.create({
            bodyA: j === 0 ? null : segmentos[j - 1],
            pointA: { x: 0, y: 0 },
            bodyB: j === SEGMENTOS ? pino : segmentos[j],
            pointB: { x: 0, y: 0 },
            length: 0,
            stiffness: 1,
            damping: 0.05
        }));
    }

    Composite.add(engine.world, [pino].concat(segmentos, ligacoes));

    // ---------------------------------------------------------------- medidas

    function medir() {
        var r = conchaImg.getBoundingClientRect();

        escala = r.width / IMAGEM_LARGURA;
        maxComprimento = COMPRIMENTO_MAX * escala;

        ancora.x = r.left + FURO.x * escala;
        ancora.y = r.top + FURO.y * escala;
        repouso.x = r.left + (PINO.x + PINO.w / 2) * escala;
        repouso.y = r.top + (PINO.y + PINO.h / 2) * escala;
        pontaLocal.x = PONTA.x * escala;
        pontaLocal.y = PONTA.y * escala;

        pinoEl.style.width = PINO.w * escala + 'px';
        pinoEl.style.height = PINO.h * escala + 'px';
    }

    function redimensionarCanvas() {
        var dpr = window.devicePixelRatio || 1;

        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        desenhouCorda = true; // força limpar/redesenhar
    }

    // ---------------------------------------------------------------- utilidades

    function girar(p, angulo) {
        var c = Math.cos(angulo), s = Math.sin(angulo);
        return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
    }

    function diferencaAngulo(a, b) {
        return Math.atan2(Math.sin(b - a), Math.cos(b - a));
    }

    function pontaNoMundo() {
        var p = girar(pontaLocal, pino.angle);
        return { x: pino.position.x + p.x, y: pino.position.y + p.y };
    }

    function distancia(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    // Garante que a ponta do pino não passe do comprimento máximo da corda
    function limitar(centro, angulo) {
        var p = girar(pontaLocal, angulo);
        var dx = centro.x + p.x - ancora.x;
        var dy = centro.y + p.y - ancora.y;
        var d = Math.hypot(dx, dy);

        if (d <= maxComprimento) {
            return { x: centro.x, y: centro.y, noLimite: false };
        }

        var k = maxComprimento / d;
        return { x: ancora.x + dx * k - p.x, y: ancora.y + dy * k - p.y, noLimite: true };
    }

    // Enfileira os segmentos no furo, levemente espaçados na direção do pino: se ficassem
    // exatamente no mesmo ponto, as ligações não teriam direção e a corda sairia embolada.
    function recolherCordaNoFuro() {
        var dx = pino.position.x - ancora.x, dy = pino.position.y - ancora.y;
        var d = Math.hypot(dx, dy) || 1;

        segmentos.forEach(function(s, i) {
            var k = (i + 1) * 0.05 / d;
            Body.setPosition(s, { x: ancora.x + dx * k, y: ancora.y + dy * k });
            Body.setVelocity(s, { x: 0, y: 0 });
        });
    }

    function chegouNoLimite() {
        if (!armado) {
            return;
        }

        armado = false;
        ask();

        if (navigator.vibrate) {
            navigator.vibrate(40);
        }
    }

    // ---------------------------------------------------------------- simulação

    function passo(dt) {
        var velocidadeRecolher = maxComprimento / SEGUNDOS_PARA_RECOLHER * dt / 1000;

        anguloAnterior = pino.angle;

        if (estado === 'puxando') {
            // Pino segue o ponteiro, limitado pelo tamanho da corda
            var destino = limitar({ x: alvo.x - pegada.x, y: alvo.y - pegada.y }, pino.angle);
            Body.setPosition(pino, destino);

            rastro.push({ x: destino.x, y: destino.y });
            if (rastro.length > 7) {
                rastro.shift();
            }

            // Pino gira acompanhando a direção da corda
            var referencia = segmentos[SEGMENTOS - 3].position;
            var direcao = Math.atan2(referencia.y - pino.position.y, referencia.x - pino.position.x);
            var anguloCorda = direcao - Math.atan2(pontaLocal.y, pontaLocal.x);
            var peso = Math.min(1, comprimento / (40 * escala + 1));
            var anguloAlvo = diferencaAngulo(0, anguloCorda) * peso;
            Body.setAngle(pino, pino.angle + diferencaAngulo(pino.angle, anguloAlvo) * 0.15);

            // A corda sai conforme é puxada e recolhe devagar se afrouxar
            var esticada = distancia(ancora, pontaNoMundo());
            comprimento = Math.min(maxComprimento, Math.max(comprimento - velocidadeRecolher, esticada));

            if (destino.noLimite) {
                chegouNoLimite();
            }
        } else if (estado === 'solto') {
            comprimento = Math.max(0, comprimento - velocidadeRecolher);

            if (comprimento < 4 * escala) {
                iniciarEncaixe();
            }
        } else if (estado === 'encaixando') {
            comprimento = Math.max(0, comprimento - velocidadeRecolher);
            encaixe.t = Math.min(1, encaixe.t + dt / DURACAO_ENCAIXE);

            var t = 1 - Math.pow(1 - encaixe.t, 3);
            Body.setPosition(pino, {
                x: encaixe.x + (repouso.x - encaixe.x) * t,
                y: encaixe.y + (repouso.y - encaixe.y) * t
            });
            Body.setAngle(pino, encaixe.angulo * (1 - t));

            if (encaixe.t >= 1) {
                estado = 'encaixado';
                comprimento = 0;
            }
        }

        if (comprimento < maxComprimento * 0.5) {
            armado = true;
        }

        var tamanhoLigacao = comprimento / (SEGMENTOS + 1);
        ligacoes.forEach(function(l) {
            l.length = tamanhoLigacao;
        });
        ligacoes[0].pointA = { x: ancora.x, y: ancora.y };

        // O Matter guarda o ponto de fixação já girado; atualizamos com a escala/ângulo atuais
        var ultima = ligacoes[SEGMENTOS];
        ultima.pointB = girar(pontaLocal, pino.angle);
        ultima.angleB = pino.angle;

        Engine.update(engine, dt);
    }

    function iniciarEncaixe() {
        Body.setStatic(pino, true);
        estado = 'encaixando';
        encaixe = {
            t: 0,
            x: pino.position.x,
            y: pino.position.y,
            angulo: diferencaAngulo(0, pino.angle)
        };
    }

    // ---------------------------------------------------------------- desenho

    function desenhar() {
        pinoEl.style.transform =
            'translate(' + (pino.position.x - PINO.w * escala / 2) + 'px,' +
            (pino.position.y - PINO.h * escala / 2) + 'px) rotate(' + pino.angle + 'rad)';

        if (estado === 'encaixado' || comprimento < 0.5) {
            if (desenhouCorda) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                desenhouCorda = false;
            }
            return;
        }

        var pontos = [ancora].concat(segmentos.map(function(s) {
            return s.position;
        }), [pontaNoMundo()]);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(pontos[0].x, pontos[0].y);

        // Curva suave passando pelos segmentos
        for (var i = 1; i < pontos.length - 1; i++) {
            var meioX = (pontos[i].x + pontos[i + 1].x) / 2;
            var meioY = (pontos[i].y + pontos[i + 1].y) / 2;
            ctx.quadraticCurveTo(pontos[i].x, pontos[i].y, meioX, meioY);
        }
        ctx.lineTo(pontos[pontos.length - 1].x, pontos[pontos.length - 1].y);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4.5;
        ctx.stroke();
        ctx.strokeStyle = '#fffdf2';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        desenhouCorda = true;
    }

    // ---------------------------------------------------------------- loop

    var ultimoTempo = null, acumulado = 0;

    function loop(tempo) {
        medir();

        if (estado === 'encaixado') {
            // Parado na concha: acompanha a concha (tremida, resize) sem simular
            Body.setPosition(pino, repouso);
            Body.setAngle(pino, 0);
        } else {
            acumulado += Math.min(Math.max(tempo - (ultimoTempo || tempo), 0), 50);
            while (acumulado >= PASSO) {
                passo(PASSO);
                acumulado -= PASSO;
            }
        }

        ultimoTempo = tempo;
        desenhar();
        requestAnimationFrame(loop);
    }

    // ---------------------------------------------------------------- mouse / toque

    pinoEl.addEventListener('pointerdown', function(e) {
        if (ponteiroId !== null || e.button > 0) {
            return;
        }

        e.preventDefault();
        unlockAudio();

        try {
            pinoEl.setPointerCapture(e.pointerId);
        } catch (erro) {
            // sem captura, os eventos de window abaixo continuam acompanhando o ponteiro
        }

        if (estado === 'encaixado') {
            recolherCordaNoFuro();
            comprimento = 0;
        }

        Body.setStatic(pino, true);
        estado = 'puxando';
        ponteiroId = e.pointerId;
        pegada = { x: e.clientX - pino.position.x, y: e.clientY - pino.position.y };
        alvo = { x: e.clientX, y: e.clientY };
        rastro = [];
        document.body.classList.add('_puxando');
    });

    window.addEventListener('pointermove', function(e) {
        if (e.pointerId !== ponteiroId) {
            return;
        }

        alvo = { x: e.clientX, y: e.clientY };
    });

    function soltar(e) {
        if (e.pointerId !== ponteiroId) {
            return;
        }

        ponteiroId = null;
        document.body.classList.remove('_puxando');

        // Mantém o embalo do pino ao soltar, medido nos últimos passos da simulação
        // (a velocidade do Matter é em px por ~16.7ms)
        var vx = 0, vy = 0;

        if (rastro.length > 1) {
            var fator = 1000 / 60 / PASSO / (rastro.length - 1);
            vx = (rastro[rastro.length - 1].x - rastro[0].x) * fator;
            vy = (rastro[rastro.length - 1].y - rastro[0].y) * fator;
        }

        var v = Math.hypot(vx, vy), vMax = 30;

        if (v > vMax) {
            vx *= vMax / v;
            vy *= vMax / v;
        }

        estado = 'solto';
        Body.setStatic(pino, false);
        Body.setVelocity(pino, { x: vx, y: vy });
        Body.setAngularVelocity(pino, diferencaAngulo(anguloAnterior, pino.angle) * (1000 / 60 / PASSO));
    }

    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    pinoEl.addEventListener('lostpointercapture', soltar);

    // ---------------------------------------------------------------- início

    function iniciar() {
        medir();
        redimensionarCanvas();
        recolherCordaNoFuro();
        pinoEl.classList.add('_ready');
        requestAnimationFrame(loop);
    }

    window.addEventListener('resize', redimensionarCanvas);

    if (conchaImg.complete && conchaImg.naturalWidth) {
        iniciar();
    } else {
        conchaImg.addEventListener('load', iniciar);
    }
})();
