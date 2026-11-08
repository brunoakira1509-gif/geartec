# Arena X1 · Multiplayer

Um único serviço Node serve o jogo (`public/index.html`) e os lobbies via WebSocket (`/ws`).

## Testar local
```
npm install
npm start
```
Abra `http://localhost:3000` em duas abas → MULTIPLAYER → CRIAR SALA numa e ENTRAR na outra.

## Deploy no Render
1. Suba esta pasta para um repositório no GitHub.
2. Render → **New + → Blueprint** (usa o `render.yaml`) ou **Web Service** com Build `npm install` e Start `npm start`.
3. Abra a URL `https://SEU-APP.onrender.com`. O cliente conecta sozinho em `wss://SEU-APP.onrender.com/ws`.

> Plano free: o serviço dorme após ~15 min sem uso e a primeira conexão pode levar ~1 min.
> Para abrir o HTML de outro lugar: `index.html?server=wss://SEU-APP.onrender.com/ws`.

## Como funciona
- **Sala:** quem cria é o host e configura na própria sala: kills para vencer (5–50), máximo de jogadores (2–8), times (todos contra todos / 2 / 3 / 4) e mapa (hoje só "Torre do Relógio"; o campo `map` já existe no servidor e na UI).
- **Times:** cada jogador escolhe o time na sala, sem fogo amigo e com placar por time.
- **Autoridade:** o servidor controla salas, times, placar, limite de kills e fim de partida. Movimento e acertos são calculados no cliente de quem atira e o servidor repassa o dano (ver limitações).

## Limitações atuais
- Sem anti-cheat: acertos são confiados ao atirador.
- Não dá para entrar numa partida já iniciada.
- Voadora (cover slip) e o mira-vermelha do crosshair ainda só funcionam contra o bot do treino.
- Mapas: para adicionar, crie a geometria por índice de `cfg.map` (hoje o mapa é construído direto no script).
