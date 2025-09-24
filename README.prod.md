# Gazel Production Build

This is a production-ready build of the Gazel Bazel exploration tool.

## Prerequisites

- Node.js 18.0.0 or higher
- A Bazel workspace to explore

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env to set your BAZEL_WORKSPACE path
```

## Running the Server

### Production mode (default):
```bash
npm start
```

### Development mode (with more verbose logging):
```bash
npm run start:dev
```

The server will start on port 3002 by default. Access the application at:
- http://localhost:3002

## Configuration

Edit the `.env` file to configure:
- `BAZEL_WORKSPACE`: Path to your Bazel workspace (required)
- `PORT`: Server port (optional, defaults to 3002)

## Directory Structure

```
dist/
├── server/          # Compiled server code
├── assets/          # Client-side assets
├── index.html       # Main HTML file
├── package.json     # Production dependencies
└── .env.example     # Environment configuration template
```

## Deployment

This directory contains everything needed to deploy Gazel:

1. Copy the entire `dist` folder to your deployment target
2. Run `npm install` to install production dependencies
3. Configure the `.env` file
4. Start the server with `npm start`

### Using PM2 (recommended for production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server/index.js --name gazel

# Save PM2 configuration
pm2 save
pm2 startup
```

### Using systemd

Create a service file `/etc/systemd/system/gazel.service`:

```ini
[Unit]
Description=Gazel
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/dist
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl enable gazel
sudo systemctl start gazel
```

## Troubleshooting

- Ensure the BAZEL_WORKSPACE path exists and is accessible
- Check that port 3002 (or your configured port) is not in use
- Verify Node.js version is 18.0.0 or higher
- Check server logs for any error messages

## Support

For issues and documentation, visit the main project repository.
