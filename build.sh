#!/bin/bash
set -e

echo "Installing root dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend
npm install
cd ..

echo "Build complete!"
