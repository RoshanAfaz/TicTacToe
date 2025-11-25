let socket = null;

// Probe same-origin Socket.IO endpoint; if it returns 404 and a SOCKET_SERVER override
// exists, connect to that instead. This helps when frontend is hosted on Vercel
// and the socket backend runs on Render.
async function initSocket() {
    let useUrl = null;
    try {
        const res = await fetch('/socket.io/?EIO=4&transport=polling', { method: 'GET' });
        if (res.status === 404 && typeof window.SOCKET_SERVER !== 'undefined' && window.SOCKET_SERVER) {
            useUrl = window.SOCKET_SERVER;
        }
    } catch (e) {
        // If fetch failed (CORS or network), fall back to SOCKET_SERVER if provided
        if (typeof window.SOCKET_SERVER !== 'undefined' && window.SOCKET_SERVER) {
            useUrl = window.SOCKET_SERVER;
        }
    }

    socket = useUrl ? io(useUrl) : io();
    attachSocketHandlers(socket);
}

function attachSocketHandlers(s) {
    // roomCreated
    s.on('roomCreated', (data) => {
        gameState.playerSymbol = data.symbol;
        gameState.roomCode = data.roomCode;
        
        document.getElementById('roomCodeDisplay').textContent = `Room Code: ${data.roomCode}`;
        document.getElementById('waitingInfo').textContent = `You are ${data.symbol}. Waiting for opponent...`;
        
        showScreen('waitingScreen');
    });

    // playerJoined
    s.on('playerJoined', (data) => {
        gameState.opponentName = data.playerName;
        gameState.playerSymbol = data.playerSymbol;
        
        document.getElementById('waitingInfo').textContent = `${data.playerName} joined! Starting game...`;
    });

    // gameStarted
    s.on('gameStarted', (data) => {
        gameState.gameStarted = true;
        gameState.board = data.board;
        gameState.currentTurn = data.currentTurn;
        
        const player1Symbol = data.players[0].symbol;
        const player1Name = data.players[0].name;
        
        const player2Symbol = player1Symbol === 'X' ? 'O' : 'X';
        const player2Name = data.players[1].name;
        
        if (gameState.playerSymbol === 'X') {
            document.getElementById('player1Name').textContent = gameState.playerName;
            document.getElementById('player1Symbol').textContent = '(X)';
            document.getElementById('player2Name').textContent = gameState.opponentName;
            document.getElementById('player2Symbol').textContent = '(O)';
        } else {
            document.getElementById('player1Name').textContent = gameState.opponentName;
            document.getElementById('player1Symbol').textContent = '(X)';
            document.getElementById('player2Name').textContent = gameState.playerName;
            document.getElementById('player2Symbol').textContent = '(O)';
        }
        
        renderBoard();
        updateTurnIndicator();
        showScreen('gameScreen');
    });

    // moveMade
    s.on('moveMade', (data) => {
        gameState.board = data.board;
        gameState.currentTurn = data.nextTurn;
        
        renderBoard();
        updateTurnIndicator();
    });

    // gameWon
    s.on('gameWon', (data) => {
        gameState.winner = data.winner;
        gameState.gameOver = true;
        
        updateTurnIndicator();
        showWinnerCells(data.winningPattern);
        
        if (data.winner === gameState.playerSymbol) {
            confetti.trigger();
        }
        
        document.getElementById('restartBtn').style.display = 'inline-block';
    });

    // gameDraw
    s.on('gameDraw', () => {
        gameState.gameOver = true;
        gameState.winner = null;
        
        updateTurnIndicator();
        document.getElementById('restartBtn').style.display = 'inline-block';
    });

    // gameRestarted
    s.on('gameRestarted', (data) => {
        gameState.board = data.board;
        gameState.currentTurn = data.currentTurn;
        gameState.gameOver = false;
        gameState.winner = null;
        
        renderBoard();
        updateTurnIndicator();
        document.getElementById('restartBtn').style.display = 'none';
    });

    // roomError
    s.on('roomError', (message) => {
        document.getElementById('errorMessage').textContent = message;
        showScreen('errorScreen');
    });

    // playerDisconnected
    s.on('playerDisconnected', () => {
        gameState.gameStarted = false;
        document.getElementById('errorMessage').textContent = 'Your opponent disconnected. Game ended.';
        showScreen('errorScreen');
    });

    // connection events
    s.on('connect', () => {
        console.log('Connected to server');
    });

    s.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

// Initialize connection
initSocket();

let gameState = {
    roomCode: null,
    playerName: null,
    playerSymbol: null,
    opponentName: null,
    board: Array(9).fill(null),
    currentTurn: 'X',
    gameStarted: false,
    winner: null,
    gameOver: false
};

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showWelcome() {
    showScreen('welcomeScreen');
    resetGameState();
}

function showCreateRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    gameState.playerName = playerName;
    showScreen('createRoomScreen');
}

function showJoinRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    gameState.playerName = playerName;
    showScreen('joinRoomScreen');
}

function createRoom() {
    const roomCode = document.getElementById('createRoomCode').value.trim().toUpperCase();
    if (!roomCode) {
        alert('Please enter a room code');
        return;
    }
    
    gameState.roomCode = roomCode;
    socket.emit('createRoom', {
        roomCode: roomCode,
        playerName: gameState.playerName
    });
}

function joinRoom() {
    const roomCode = document.getElementById('joinRoomCode').value.trim().toUpperCase();
    if (!roomCode) {
        alert('Please enter a room code');
        return;
    }
    
    gameState.roomCode = roomCode;
    socket.emit('joinRoom', {
        roomCode: roomCode,
        playerName: gameState.playerName
    });
}

function leaveRoom() {
    if (gameState.roomCode) {
        socket.emit('leaveRoom', { roomCode: gameState.roomCode });
    }
    resetGameState();
    showWelcome();
}

function resetGameState() {
    gameState = {
        roomCode: null,
        playerName: null,
        playerSymbol: null,
        opponentName: null,
        board: Array(9).fill(null),
        currentTurn: 'X',
        gameStarted: false,
        winner: null,
        gameOver: false
    };
    document.getElementById('createRoomCode').value = '';
    document.getElementById('joinRoomCode').value = '';
    document.getElementById('restartBtn').style.display = 'none';
}

function updateBoard(board) {
    gameState.board = board;
    renderBoard();
}

function renderBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        const value = gameState.board[index];
        cell.textContent = value || '';
        cell.className = 'cell';
        
        if (value === 'X') {
            cell.classList.add('x');
        } else if (value === 'O') {
            cell.classList.add('o');
        }
        
        if (!gameState.gameStarted || gameState.gameOver || gameState.board[index] !== null) {
            cell.classList.add('disabled');
        }
        
        if (gameState.playerSymbol !== gameState.currentTurn && gameState.gameStarted && !gameState.gameOver) {
            cell.classList.add('disabled');
        }
    });
}

function makeMove(index) {
    if (!gameState.gameStarted || gameState.gameOver) {
        return;
    }
    
    if (gameState.playerSymbol !== gameState.currentTurn) {
        return;
    }
    
    if (gameState.board[index] !== null) {
        return;
    }

    socket.emit('makeMove', {
        roomCode: gameState.roomCode,
        position: index
    });
}

function updateTurnIndicator() {
    const turnIndicator = document.getElementById('turnIndicator');
    const gameMessage = document.getElementById('gameMessage');
    
    if (!gameState.gameStarted) {
        turnIndicator.textContent = 'Game not started';
        gameMessage.textContent = '';
        return;
    }

    if (gameState.gameOver) {
        if (gameState.winner) {
            const winnerName = gameState.winner === gameState.playerSymbol ? gameState.playerName : gameState.opponentName;
            gameMessage.textContent = `${winnerName} won!`;
            gameMessage.style.color = '#00ff88';
        } else {
            gameMessage.textContent = "It's a draw!";
            gameMessage.style.color = '#ffaa00';
        }
        turnIndicator.textContent = 'Game Over';
    } else {
        const isMyTurn = gameState.currentTurn === gameState.playerSymbol;
        turnIndicator.textContent = isMyTurn ? 'Your Turn' : "Opponent's Turn";
        gameMessage.textContent = `${gameState.currentTurn === 'X' ? 'X' : 'O'} is playing`;
        gameMessage.style.color = isMyTurn ? '#00ff88' : '#ff006e';
    }
}

function showWinnerCells(winningPattern) {
    const cells = document.querySelectorAll('.cell');
    winningPattern.forEach(index => {
        cells[index].classList.add('winner');
    });
}

// Socket Event Listeners
socket.on('roomCreated', (data) => {
    gameState.playerSymbol = data.symbol;
    gameState.roomCode = data.roomCode;
    
    document.getElementById('roomCodeDisplay').textContent = `Room Code: ${data.roomCode}`;
    document.getElementById('waitingInfo').textContent = `You are ${data.symbol}. Waiting for opponent...`;
    
    showScreen('waitingScreen');
});

socket.on('playerJoined', (data) => {
    gameState.opponentName = data.playerName;
    gameState.playerSymbol = data.playerSymbol;
    
    document.getElementById('waitingInfo').textContent = `${data.playerName} joined! Starting game...`;
});

socket.on('gameStarted', (data) => {
    gameState.gameStarted = true;
    gameState.board = data.board;
    gameState.currentTurn = data.currentTurn;
    
    const player1Symbol = data.players[0].symbol;
    const player1Name = data.players[0].name;
    
    const player2Symbol = player1Symbol === 'X' ? 'O' : 'X';
    const player2Name = data.players[1].name;
    
    if (gameState.playerSymbol === 'X') {
        document.getElementById('player1Name').textContent = gameState.playerName;
        document.getElementById('player1Symbol').textContent = '(X)';
        document.getElementById('player2Name').textContent = gameState.opponentName;
        document.getElementById('player2Symbol').textContent = '(O)';
    } else {
        document.getElementById('player1Name').textContent = gameState.opponentName;
        document.getElementById('player1Symbol').textContent = '(X)';
        document.getElementById('player2Name').textContent = gameState.playerName;
        document.getElementById('player2Symbol').textContent = '(O)';
    }
    
    renderBoard();
    updateTurnIndicator();
    showScreen('gameScreen');
});

socket.on('moveMade', (data) => {
    gameState.board = data.board;
    gameState.currentTurn = data.nextTurn;
    
    renderBoard();
    updateTurnIndicator();
});

socket.on('gameWon', (data) => {
    gameState.winner = data.winner;
    gameState.gameOver = true;
    
    updateTurnIndicator();
    showWinnerCells(data.winningPattern);
    
    if (data.winner === gameState.playerSymbol) {
        confetti.trigger();
    }
    
    document.getElementById('restartBtn').style.display = 'inline-block';
});

socket.on('gameDraw', () => {
    gameState.gameOver = true;
    gameState.winner = null;
    
    updateTurnIndicator();
    document.getElementById('restartBtn').style.display = 'inline-block';
});

socket.on('gameRestarted', (data) => {
    gameState.board = data.board;
    gameState.currentTurn = data.currentTurn;
    gameState.gameOver = false;
    gameState.winner = null;
    
    renderBoard();
    updateTurnIndicator();
    document.getElementById('restartBtn').style.display = 'none';
});

socket.on('roomError', (message) => {
    document.getElementById('errorMessage').textContent = message;
    showScreen('errorScreen');
});

socket.on('playerDisconnected', () => {
    gameState.gameStarted = false;
    document.getElementById('errorMessage').textContent = 'Your opponent disconnected. Game ended.';
    showScreen('errorScreen');
});

function restartGame() {
    socket.emit('restartGame', { roomCode: gameState.roomCode });
}

// Cell Click Handler
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.addEventListener('click', () => {
            makeMove(parseInt(cell.dataset.index));
        });
    });
});

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});
