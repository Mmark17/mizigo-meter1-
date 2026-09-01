const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PUBLIC_DIR = path.join(__dirname, 'public');
const API_DIR = path.join(__dirname, 'api');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
}

async function callApi(handler, req, res) {
  const adaptedReq = {
    method: req.method,
    body: req.body,
    headers: req.headers,
    query: req.query,
  };
  const adaptedRes = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      const body = JSON.stringify(data);
      this.setHeader('Content-Type', 'application/json');
      this.end(body);
    },
    end(body) {
      res.writeHead(this.statusCode, this.headers);
      res.end(body);
    },
  };

  await handler(adaptedReq, adaptedRes);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname === '/favicon.ico') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const handlerPath = path.join(API_DIR, apiPath + '.js');

    if (!fs.existsSync(handlerPath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    let body = '';
    req.setEncoding('utf8');
    await new Promise((resolve) => {
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', resolve);
    });

    try {
      const handler = require(handlerPath);
      req.body = body ? JSON.parse(body) : {};
      req.query = parsedUrl.query;
      await callApi(handler, req, res);
    } catch (err) {
      res.statusCode = 500;
      res.end('Server error: ' + err.message);
    }
    return;
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'login.html' : pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveStatic(filePath, res);
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Local dev server running at http://localhost:${PORT}`);
});
