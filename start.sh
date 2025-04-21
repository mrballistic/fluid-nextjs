#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Update packages
npm install

# Start the development server
npm run dev