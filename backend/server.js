const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active rooms and their players
const rooms = new Map();

app.use(express.static(path.join(__dirname, '../frontend')));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create room
  socket.on('createRoom', (data) => {
    const { roomCode, playerName } = data;

    if (rooms.has(roomCode)) {
      socket.emit('roomError', 'Room already exists');
      return;
    }

    rooms.set(roomCode, {
      players: [{ id: socket.id, name: playerName, symbol: 'X' }],
      board: Array(9).fill(null),
      currentTurn: 'X',
      gameStarted: false,
      winner: null
    });

    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, symbol: 'X', playerName });
    console.log(`Room ${roomCode} created by ${playerName}`);
  });

  // Join room
  socket.on('joinRoom', (data) => {
    const { roomCode, playerName } = data;
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('roomError', 'Room does not exist');
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('roomError', 'Room is full');
      return;
    }

    room.players.push({ id: socket.id, name: playerName, symbol: 'O' });
    room.gameStarted = true;

    socket.join(roomCode);

    // Notify both players
    io.to(roomCode).emit('gameStarted', {
      players: room.players,
      currentTurn: room.currentTurn,
      board: room.board
    });
    
    // Notify second player that first player joined
    socket.emit('playerJoined', {
      playerName: room.players[0].name,
      playerSymbol: 'O'
    });

    console.log(`${playerName} joined room ${roomCode}`);
  });

  // Handle player move
  socket.on('makeMove', (data) => {
    const { roomCode, position } = data;
    const room = rooms.get(roomCode);

    if (!room || !room.gameStarted) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.symbol !== room.currentTurn) {
      socket.emit('invalidMove', 'Not your turn');
      return;
    }

    if (room.board[position] !== null || room.winner) return;

    room.board[position] = player.symbol;

    // Check for winner
    const winner = checkWinner(room.board);
    if (winner) {
      room.winner = winner;
      const winningPattern = getWinningPattern(room.board);
      io.to(roomCode).emit('gameWon', {
        winner: winner,
        winningPattern: winningPattern
      });
    } else if (room.board.every(cell => cell !== null)) {
      room.winner = 'draw';
      io.to(roomCode).emit('gameDraw');
    } else {
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
      io.to(roomCode).emit('moveMade', {
        board: room.board,
        nextTurn: room.currentTurn
      });
    }
  });

  // Restart game
  socket.on('restartGame', (data) => {
    const roomCode = typeof data === 'string' ? data : data.roomCode;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.board = Array(9).fill(null);
    room.currentTurn = 'X';
    room.winner = null;

    io.to(roomCode).emit('gameRestarted', {
      board: room.board,
      currentTurn: room.currentTurn
    });
  });

  // Handle leave room
  socket.on('leaveRoom', (data) => {
    const roomCode = data.roomCode;
    const room = rooms.get(roomCode);
    
    if (!room) return;
    
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      room.players.splice(playerIndex, 1);
      
      if (room.players.length === 0) {
        rooms.delete(roomCode);
      } else {
        io.to(roomCode).emit('playerDisconnected');
        room.gameStarted = false;
        room.winner = null;
      }
    }
    
    socket.leave(roomCode);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Find and remove player from room
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          // Notify remaining player
          io.to(roomCode).emit('playerDisconnected');
          room.gameStarted = false;
          room.winner = null;
        }
        break;
      }
    }
  });
});

function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function getWinningPattern(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return pattern;
    }
  }
  return [];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});