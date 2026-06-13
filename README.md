# 🐍 Treinaconda

Jogo multiplayer de navegador no estilo **slither.io**, com tema vermelho/floresta,
guarda-roupa de skins, integração com avatares do **Habbo.com.br**, ranking ao vivo,
mini-mapa e pódio. Sala única, partidas de **4 minutos**.

## Como funciona
- O **primeiro jogador a entrar vira host** e controla quando a partida começa.
- Cada jogador escolhe **nickname**, **nick do Habbo** (mostra a carinha) e a **skin** no guarda-roupa.
- Coma os pontos pelo mapa para **crescer e somar pontos**.
- **Corte na frente** de outra cobra para eliminá-la (igual slither.io). Quem morre vira **espectador** até o tempo acabar.
- Câmera focada na sua cobra, **mini-mapa** mostra só a **sua** posição.
- No fim dos 4 minutos: **pódio do 1º lugar por 5s** e volta ao lobby para outra partida.
- Suporta **até 50 jogadores** na sala.

## Controles
- **Desktop:** mova o mouse para virar, segure o **clique** ou a **barra de espaço** para acelerar (boost gasta pontos).
- **Mobile:** toque e arraste na tela para virar e segure o botão **BOOST** para acelerar.

O movimento é renderizado a 60fps com interpolação entre os quadros do servidor, então a cobra anda de forma fluida mesmo com a rede a 15 ticks por segundo.

## Rodar localmente
```bash
npm install
npm start
```
Abra `http://localhost:3000` em várias abas/dispositivos. (Para testar com amigos na mesma rede, use o IP da sua máquina, ex.: `http://192.168.0.10:3000`.)

## Subir no GitHub
```bash
git init
git add .
git commit -m "Treinaconda"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/treinaconda.git
git push -u origin main
```

## Deploy no Render (onrender.com)
1. Entre no painel do Render → **New** → **Web Service**.
2. Conecte sua conta do GitHub e selecione o repositório **treinaconda**.
3. Configure:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (ou superior)
4. Clique em **Create Web Service**. O Render usa a variável `PORT` automaticamente (o servidor já lê `process.env.PORT`).
5. Quando ficar "Live", compartilhe a URL `https://treinaconda.onrender.com` (ou o nome que você escolher).

> Observações:
> - No plano **Free** o serviço "dorme" após inatividade; o primeiro acesso pode demorar alguns segundos para acordar.
> - Os avatares do Habbo são carregados direto do `habbo.com.br` pelo navegador de cada jogador (não passam pelo servidor).
> - WebSocket/Socket.IO funciona normalmente no Render sem configuração extra.

## Ajustes rápidos (server.js)
| Constante | O que muda |
|-----------|------------|
| `ROUND_MS` | Duração da partida (padrão 4 min) |
| `MAX_PLAYERS` | Limite de jogadores (padrão 50) |
| `WORLD_RADIUS` | Tamanho da arena |
| `TARGET_FOOD` | Quantidade de comida no mapa |
| `NORMAL_SPEED` / `BOOST_SPEED` | Velocidade da cobra e do boost |

## Estrutura
```
treinaconda/
├── server.js          # servidor autoritativo (Express + Socket.IO)
├── package.json
├── public/
│   ├── index.html     # lobby + jogo + pódio
│   ├── style.css      # tema vermelho/floresta
│   └── game.js        # render do canvas, controles, HUD
└── README.md
```
