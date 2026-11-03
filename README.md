# 4horizon

**Jogue até quatro contas de [Poke Horizon Idle](https://pokehorizonidle.com) lado a lado**, com um Resumo ao vivo de cada conta, notificações do Windows para o que importa e uma Visão geral do seu dia.

*In English: [README.en.md](README.en.md) · O mesmo texto em formato simples, para o Bloco de Notas: [ComoUsar.txt](ComoUsar.txt)*

GitHub: https://github.com/venom1337idle/4horizon

> O 4horizon é uma ferramenta feita por fã. Ele **não** é feito, aprovado ou ligado aos desenvolvedores do Poke Horizon Idle, nem à Nintendo, Game Freak ou The Pokémon Company.
> Confira as regras do jogo antes de usar: o uso é por sua conta e risco.

## O que ele faz

- **Até quatro painéis do jogo** numa janela só (Configurações › Painéis do jogo: 1 a 4). Cada painel guarda o seu próprio login.
- **Resumo** de cada conta, ou de todas: gold, XP e abates por hora, a equipe, a sessão, os suprimentos, os drops, a melhor captura e uma comparação com as suas melhores hunts.
- **Visão geral**: uma tabela de todas as contas, as incubadoras (ovos em anéis de contagem regressiva), as últimas capturas (com filtros e ordem) e **Hoje**: shinies, ótimas capturas, drops valiosos, ovos chocados, evoluções e novas hunts das 00:00 às 23:59.
- **Histórico** dos seus totais por dia.
- **Notificações do Windows**: um shiny, uma ótima captura, um drop valioso, suprimentos acabando, uma conta que parou de caçar, uma nova hunt, uma missão do passe, um objetivo de missão diária, um ovo pronto para chocar. Com horário de silêncio e um botão de **modo silencioso**.
- **Botões em cada painel**: Centro, Market, Mochila, Hunts, *Voltar para a última hunt*, zoom.
- **Entrar em todas** com logins salvos (as senhas são criptografadas, veja abaixo).
- **Limpeza de popups**: depois de um login ela fecha o anúncio, fecha o Hunt Analyzer e recolhe o chat.
- **Modo economia**: esconde as telas do jogo enquanto você está longe (os jogos continuam caçando) e poupa quase toda a CPU.
- Minimizar para a bandeja, iniciar com o PC, português e inglês.
- **Diagnóstico** (Configurações › Diagnóstico): uma autoverificação e um relatório para enviar quando algo der errado.

## Instalar

Você precisa do **Windows 10 ou 11** (64 bits). Outros sistemas não foram testados.

### O jeito fácil: o instalador

1. Baixe o **`4horizon-Setup-x.y.z.exe`** na [página de Releases](https://github.com/venom1337idle/4horizon/releases/latest).
2. Abra o arquivo. O Windows pode dizer *"O Windows protegeu o computador"*: o instalador não tem assinatura digital (assinar custa dinheiro todo ano). Clique em **Mais informações › Executar assim mesmo**.
3. Escolha onde instalar (ou deixe o padrão). Ele coloca o **4horizon** no menu Iniciar e na área de trabalho. Não precisa de administrador.

**Para atualizar**: baixe o instalador novo e abra; as suas configurações, o seu histórico e os seus logins salvos são mantidos.
**Para desinstalar**: Configurações do Windows › Aplicativos › 4horizon. As suas configurações, o histórico e os logins salvos ficam em `%APPDATA%\4horizon`; apague essa pasta também se quiser que eles sumam.

### Pelo código-fonte

Você também precisa do **[Node.js](https://nodejs.org) (a versão LTS)**.

1. Baixe este projeto: o botão verde **Code** › **Download ZIP**, e descompacte (ou `git clone https://github.com/venom1337idle/4horizon.git`).
2. Abra o PowerShell na pasta do projeto (a que tem o `package.json`) e rode:
   ```
   npm install
   npm start
   ```
3. Opcional: um ícone na área de trabalho que abre o app sem a janela preta. Na mesma janela do PowerShell:
   ```powershell
   $app = (Get-Location).Path
   $s = (New-Object -ComObject WScript.Shell).CreateShortcut("$HOME\Desktop\4horizon.lnk")
   $s.TargetPath = "$app\node_modules\electron\dist\electron.exe"; $s.Arguments = '.'; $s.WorkingDirectory = $app; $s.IconLocation = "$app\icon.ico"; $s.Save()
   ```

Para atualizar: feche o app pela bandeja, troque os arquivos da pasta pelos novos (ou `git pull`), rode `npm install` e abra de novo.

## Os seus dados, e o que o app lê

**O que ele lê do jogo.** O app lê as mensagens que a página do jogo recebe do servidor do jogo (os mesmos dados que o jogo mostra para você), pelas próprias ferramentas de desenvolvedor do Chromium (o "debugger"). Essa leitura nunca envia nada ao jogo e nunca altera as mensagens dele.
Dessas mensagens ele guarda **só o que mostra para você**: taxas, contagens, a equipe, capturas, drops. Nada é enviado para lugar nenhum.

**O que ele faz no jogo.** Só o que você pede, apertando os próprios botões do jogo na página, como você faria: os botões dos painéis (Centro, Market, Mochila, Hunts, *Voltar para a última hunt*), o botão do Analyzer, *Entrar em todas* (ele preenche o formulário de login do jogo) e a limpeza de popups (ela fecha o anúncio e o Hunt Analyzer e recolhe o chat depois de um login; para desligar, coloque `"enabled": false` no `tidy-settings.json` da pasta de dados do usuário).
Na loja de diamantes, os botões de doação não podem ser apertados dentro do app: um link leva para a página oficial do jogo.

**Onde ficam os seus dados.** O histórico, as configurações das notificações e da limpeza de popups e os seus logins salvos ficam na pasta de dados do app no seu perfil do Windows (`%APPDATA%\4horizon`), nunca na pasta do app.

**Logins salvos.** As senhas são criptografadas pela proteção do próprio Windows (DPAPI, pelo `safeStorage` do Electron): só o seu usuário do Windows, no seu computador, consegue lê-las. Se a criptografia não estiver disponível, as senhas não são salvas. Elas nunca são gravadas em texto puro, nunca vão para o log e nunca são enviadas para a janela do app.
*Atenção*: isso as protege de outros usuários do computador e de quem copiar o arquivo, **não** de um programa rodando como você (malware).

**Os painéis do jogo são travados.** Eles não recebem nenhuma permissão (câmera, microfone, localização, notificações, dispositivos...) a não ser escrever na área de transferência e tela cheia; só podem abrir o endereço do próprio jogo; o WebRTC não consegue descobrir o seu endereço de rede. Os links que o jogo abre vão para o seu navegador normal.

**O que mais o app acessa.** Além do jogo: a [PokéAPI](https://pokeapi.co), uma vez, para os nomes dos Pokémon (guardados depois disso), e as imagens dos Pokémon da PokéAPI no GitHub. Como qualquer acesso à internet, eles veem o seu endereço IP; não recebem nada sobre você ou as suas contas. Não há nenhum tipo de estatística ou telemetria.

**O relatório do Diagnóstico** contém nomes de tipos de mensagem e de campos, contagens e configurações sim/não, nunca valores do jogo, senhas ou e-mails. Os nomes dos personagens ficam escondidos por padrão.

Mais em [SECURITY.md](SECURITY.md) (em inglês).

## Algo não funciona?

Abra **Configurações › Diagnóstico**, veja a autoverificação, depois copie o **relatório** e cole numa [nova issue](https://github.com/venom1337idle/4horizon/issues) com algumas palavras sobre o que você fez e o que aconteceu.

## Para desenvolvedores

- `npm test` roda todos os testes (cerca de 50 conjuntos): veja [test/README.md](test/README.md) (em inglês).
- `npm run dist` cria o instalador do Windows na pasta `dist/` (no Windows). Enviar uma tag de versão (`git tag v1.0.0`, `git push --tags`) faz o GitHub criar o instalador e colocá-lo num rascunho de release.
- Os textos: o inglês fica no código, o português em `test/window/pt/`: veja [test/README.md](test/README.md).
- Os arquivos de dados do jogo (`hunt-data.js`, `game-data.json`) e como eles são feitos: veja [tools/README.md](tools/README.md).

## Licença

[MIT](LICENSE) © venom1337idle
